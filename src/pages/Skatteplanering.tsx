import { useState, useMemo, useCallback } from "react";
import {
  Calculator, Zap, ArrowRight, TrendingDown, Lightbulb,
  Sliders as SliderIcon, Check, Trophy, Save, Trash2, ChevronDown, ChevronUp,
  AlertTriangle,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend,
} from "recharts";
import {
  useTransactions, useForestActivities, useTaxScenarios, useStands,
  fmt, calcResultat,
  type ForestActivity, type TaxScenario,
} from "@/hooks/useSkogskollData";
import { useLossCarryForwards, applyLossCarryForwards, useSaveLossCarryForward } from "@/hooks/useLossCarryForwards";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

/* ── Swedish progressive tax brackets 2025 ── */
const TAX_BRACKETS = [
  { limit: 0, rate: 0 },
  { limit: 614000, rate: 0.32 },         // kommunalskatt ~32%
  { limit: Infinity, rate: 0.52 },        // + statlig skatt ~20%
];

function calcTaxDetailed(income: number): number {
  if (income <= 0) return 0;
  let tax = 0, prev = 0;
  for (const b of TAX_BRACKETS) {
    if (income <= prev) break;
    const taxable = Math.min(income, b.limit) - prev;
    tax += Math.max(0, taxable) * b.rate;
    prev = b.limit;
  }
  return Math.round(tax);
}

function calcEffectiveRate(income: number, tax: number) {
  return income > 0 ? Math.round((tax / income) * 100) : 0;
}

const fmtK = (n: number) => {
  if (Math.abs(n) >= 1000000) return `${(n / 1000000).toFixed(1)} mkr`;
  if (Math.abs(n) >= 1000) return `${Math.round(n / 1000)} tkr`;
  return `${n} kr`;
};

/* ── Scenario type used in the simulator ── */
interface SimScenario {
  id: string;
  name: string;
  year: number;
  selectedActivityIds: string[];
  uttagPercent: number;
  extraIncome: number;
  extraExpenses: number;
  // computed
  totalIncome: number;
  totalCost: number;
  resultat: number;
  tax: number;
  netAfterTax: number;
}

let scenarioCounter = 0;
function makeScenarioId() {
  return `sim-${++scenarioCounter}-${Date.now()}`;
}

function buildScenario(
  name: string,
  year: number,
  selectedActivityIds: string[],
  activities: ForestActivity[],
  baseResultat: number,
  uttagPercent: number,
  extraIncome: number,
  extraExpenses: number,
): SimScenario {
  const selected = activities.filter(a => selectedActivityIds.includes(a.id));
  const actIncome = selected.reduce((s, a) => s + a.estimated_income, 0);
  const actCost = selected.reduce((s, a) => s + a.estimated_cost, 0);
  const growthYears = year - new Date().getFullYear();
  const grownIncome = Math.round(actIncome * Math.pow(1.032, Math.max(0, growthYears)) * (uttagPercent / 100));
  const totalIncome = baseResultat + grownIncome + extraIncome;
  const totalCost = actCost + extraExpenses;
  const resultat = totalIncome - totalCost;
  const tax = calcTaxDetailed(resultat);
  const netAfterTax = resultat - tax;
  return {
    id: makeScenarioId(), name, year, selectedActivityIds, uttagPercent,
    extraIncome, extraExpenses,
    totalIncome, totalCost, resultat, tax, netAfterTax,
  };
}

export default function Skatteplanering() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: transactions = [] } = useTransactions();
  const { data: activities = [] } = useForestActivities();
  const { data: stands = [] } = useStands();
  const { data: savedScenarios = [] } = useTaxScenarios();
  const { data: lossCarryForwards = [] } = useLossCarryForwards();
  const saveLoss = useSaveLossCarryForward();

  const year = new Date().getFullYear();
  const currentResultat = calcResultat(transactions, year);

  // Apply loss carry-forwards to current result
  const lossResult = useMemo(
    () => applyLossCarryForwards(currentResultat, lossCarryForwards),
    [currentResultat, lossCarryForwards]
  );

  const currentTax = calcTaxDetailed(lossResult.taxableResultat);
  const currentNet = lossResult.taxableResultat - currentTax;

  // Check if current year creates a new loss
  const currentYearCreatesLoss = currentResultat < 0;
  const currentYearLossAmount = currentYearCreatesLoss ? Math.abs(currentResultat) : 0;
  const existingLossForYear = lossCarryForwards.find(l => l.year === year);
  const canSaveCurrentLoss = currentYearCreatesLoss && !existingLossForYear;

  const plannedActivities = activities.filter(a => a.status === "planned");
  const totalPlannedIncome = plannedActivities.reduce((s, a) => s + a.estimated_income, 0);
  const totalPlannedCost = plannedActivities.reduce((s, a) => s + a.estimated_cost, 0);

  /* ── Scenario builder state ── */
  const [scenarioName, setScenarioName] = useState("Scenario A");
  const [scenarioYear, setScenarioYear] = useState(year);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [uttagPercent, setUttagPercent] = useState(100);
  const [extraIncome, setExtraIncome] = useState(0);
  const [extraExpenses, setExtraExpenses] = useState(0);
  const [simScenarios, setSimScenarios] = useState<SimScenario[]>([]);
  const [showBuilder, setShowBuilder] = useState(true);
  const [saving, setSaving] = useState(false);

  const toggleActivity = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const currentSim = useMemo(() => buildScenario(
    scenarioName, scenarioYear, selectedIds, activities, currentResultat,
    uttagPercent, extraIncome, extraExpenses,
  ), [scenarioName, scenarioYear, selectedIds, activities, currentResultat, uttagPercent, extraIncome, extraExpenses]);

  const addScenario = useCallback(() => {
    setSimScenarios(prev => [...prev, { ...currentSim, id: makeScenarioId() }]);
    setScenarioName(`Scenario ${String.fromCharCode(65 + simScenarios.length + 1)}`);
    setSelectedIds([]);
    setUttagPercent(100);
    setExtraIncome(0);
    setExtraExpenses(0);
    toast.success("Scenario tillagt i jämförelsen");
  }, [currentSim, simScenarios.length]);

  const removeScenario = (id: string) => {
    setSimScenarios(prev => prev.filter(s => s.id !== id));
  };

  /* ── Quick scenarios (prebuilt) ── */
  const quickScenarios = useMemo(() => {
    if (plannedActivities.length === 0) return [];
    const allIds = plannedActivities.map(a => a.id);
    return [
      buildScenario("Avverka allt i år", year, allIds, activities, currentResultat, 100, 0, 0),
      buildScenario("Avverka allt nästa år", year + 1, allIds, activities, currentResultat, 100, 0, 0),
      buildScenario("Vänta 2 år", year + 2, allIds, activities, currentResultat, 100, 0, 0),
      buildScenario("Halvt uttag i år", year, allIds, activities, currentResultat, 50, 0, 0),
      buildScenario("Halvt uttag nästa år", year + 1, allIds, activities, currentResultat, 50, 0, 0),
    ];
  }, [plannedActivities, activities, currentResultat, year]);

  /* ── Recommendations ── */
  const allCompare = [...simScenarios, ...quickScenarios];
  const bestTax = allCompare.length > 0 ? allCompare.reduce((best, s) => s.tax < best.tax ? s : best) : null;
  const bestNet = allCompare.length > 0 ? allCompare.reduce((best, s) => s.netAfterTax > best.netAfterTax ? s : best) : null;

  /* ── Save scenario to DB ── */
  const saveScenario = async (s: SimScenario) => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("tax_scenarios").insert({
      user_id: user.id,
      year: s.year,
      scenario_name: s.name,
      estimated_income: s.totalIncome,
      estimated_expenses: s.totalCost,
      estimated_profit: s.resultat,
      estimated_tax: s.tax,
      notes: `Uttag: ${s.uttagPercent}%, Netto: ${fmtK(s.netAfterTax)}`,
    });
    setSaving(false);
    if (error) { toast.error("Kunde inte spara scenario"); return; }
    toast.success("Scenario sparat");
    queryClient.invalidateQueries({ queryKey: ["tax_scenarios"] });
  };

  /* ── Delete saved scenario ── */
  const deleteSaved = async (id: string) => {
    await supabase.from("tax_scenarios").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["tax_scenarios"] });
    toast.success("Scenario borttaget");
  };

  /* ── Chart data ── */
  const chartData = useMemo(() => {
    const items = simScenarios.length > 0 ? simScenarios : quickScenarios.slice(0, 3);
    return items.map(s => ({
      name: s.name,
      Skatt: s.tax,
      Netto: s.netAfterTax,
      isCustom: simScenarios.some(x => x.id === s.id),
    }));
  }, [simScenarios, quickScenarios]);

  function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload) return null;
    return (
      <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
        <p className="text-sm font-semibold text-card-foreground mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.dataKey} className="text-xs" style={{ color: p.color }}>{p.name}: {fmt(p.value)}</p>
        ))}
      </div>
    );
  }

  const standMap = Object.fromEntries(stands.map(s => [s.id, s]));

  return (
    <main className="flex-1 p-4 md:p-8 overflow-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Calculator className="h-7 w-7 text-primary" />
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Skatteplanering</h1>
          <p className="text-sm text-muted-foreground">Simulera beslut och optimera din skatt</p>
        </div>
      </div>

      {/* ═══ Section 1: Nuvarande skattesituation ═══ */}
      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">Nuvarande skattesituation {year}</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">Resultat</p>
            <p className="text-lg font-bold tabular-nums text-card-foreground">{fmtK(currentResultat)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">Beräknad skatt</p>
            <p className="text-lg font-bold tabular-nums text-destructive">{fmtK(currentTax)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">Effektiv skattesats</p>
            <p className="text-lg font-bold tabular-nums text-card-foreground">{calcEffectiveRate(currentResultat, currentTax)}%</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">Netto efter skatt</p>
            <p className="text-lg font-bold tabular-nums text-primary">{fmtK(currentNet)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">Planerade intäkter</p>
            <p className="text-lg font-bold tabular-nums text-accent">{fmtK(totalPlannedIncome)}</p>
            <p className="text-xs text-muted-foreground">{plannedActivities.length} åtgärder, kostnad {fmtK(totalPlannedCost)}</p>
          </div>
        </div>
      </section>

      {/* ═══ Section 2: Rekommendation banner ═══ */}
      {bestTax && bestNet && (
        <div className="rounded-xl border-2 border-primary/30 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 p-5 relative overflow-hidden">
          <div className="absolute top-3 right-3 opacity-10"><Trophy className="h-20 w-20 text-primary" /></div>
          <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1.5"><Zap className="h-4 w-4 text-accent" /> Rekommendation</p>
          <div className="space-y-1">
            <p className="text-sm text-foreground">
              <span className="font-semibold text-primary">Lägst skatt:</span> "{bestTax.name}" → {fmt(bestTax.tax)} skatt
              {bestTax.id !== bestNet.id && <span className="text-muted-foreground"> (netto {fmtK(bestTax.netAfterTax)})</span>}
            </p>
            <p className="text-sm text-foreground">
              <span className="font-semibold text-accent">Högst netto:</span> "{bestNet.name}" → {fmt(bestNet.netAfterTax)} netto efter skatt
            </p>
            {bestTax.id !== bestNet.id && (
              <p className="text-xs text-muted-foreground mt-1">
                Skillnad i skatt: {fmt(Math.abs(bestNet.tax - bestTax.tax))} · Skillnad i netto: {fmt(Math.abs(bestNet.netAfterTax - bestTax.netAfterTax))}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ═══ Section 3: Quick comparison ═══ */}
      {quickScenarios.length > 0 && (
        <section>
          <h2 className="font-display text-lg font-semibold text-foreground mb-3">Snabbjämförelse</h2>
          <div className="overflow-x-auto rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[160px]">Scenario</TableHead>
                  <TableHead className="text-right">År</TableHead>
                  <TableHead className="text-right">Uttag</TableHead>
                  <TableHead className="text-right">Intäkt</TableHead>
                  <TableHead className="text-right">Kostnad</TableHead>
                  <TableHead className="text-right">Resultat</TableHead>
                  <TableHead className="text-right">Skatt</TableHead>
                  <TableHead className="text-right">Netto</TableHead>
                  <TableHead className="text-right">Eff. skatt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quickScenarios.map((s) => (
                  <TableRow key={s.id} className={s.id === bestNet?.id ? "bg-primary/5" : ""}>
                    <TableCell className="font-medium text-card-foreground flex items-center gap-1.5">
                      {s.id === bestNet?.id && <Trophy className="h-3.5 w-3.5 text-primary" />}
                      {s.name}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{s.year}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.uttagPercent}%</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtK(s.totalIncome)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtK(s.totalCost)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtK(s.resultat)}</TableCell>
                    <TableCell className="text-right tabular-nums text-destructive">{fmtK(s.tax)}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold text-primary">{fmtK(s.netAfterTax)}</TableCell>
                    <TableCell className="text-right tabular-nums">{calcEffectiveRate(s.resultat, s.tax)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {/* ═══ Section 4: Scenario builder ═══ */}
      <section>
        <button
          onClick={() => setShowBuilder(!showBuilder)}
          className="flex items-center gap-2 font-display text-lg font-semibold text-foreground mb-3 hover:text-primary transition-colors"
        >
          <SliderIcon className="h-5 w-5 text-accent" />
          Bygg eget scenario
          {showBuilder ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {showBuilder && (
          <div className="rounded-xl border border-border bg-card p-5 space-y-5">
            {/* Name + year */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-sm">Scenarionamn</Label>
                <Input value={scenarioName} onChange={e => setScenarioName(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">År för åtgärden</Label>
                <div className="flex items-center gap-3 mt-1">
                  <Slider value={[scenarioYear]} onValueChange={([v]) => setScenarioYear(v)} min={year} max={year + 5} step={1} className="flex-1" />
                  <span className="text-sm font-bold text-accent tabular-nums w-12 text-right">{scenarioYear}</span>
                </div>
              </div>
              <div>
                <Label className="text-sm">Andel uttag</Label>
                <div className="flex items-center gap-3 mt-1">
                  <Slider value={[uttagPercent]} onValueChange={([v]) => setUttagPercent(v)} min={10} max={100} step={5} className="flex-1" />
                  <span className="text-sm font-bold text-accent tabular-nums w-12 text-right">{uttagPercent}%</span>
                </div>
              </div>
            </div>

            {/* Activity selection */}
            {plannedActivities.length > 0 && (
              <div>
                <Label className="text-sm mb-2 block">Välj åtgärder att inkludera</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {plannedActivities.map(a => {
                    const stand = a.stand_id ? standMap[a.stand_id] : null;
                    return (
                      <label
                        key={a.id}
                        className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-all ${
                          selectedIds.includes(a.id) ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/20"
                        }`}
                      >
                        <Checkbox
                          checked={selectedIds.includes(a.id)}
                          onCheckedChange={() => toggleActivity(a.id)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-card-foreground">{a.type}{stand ? ` – ${stand.name}` : ""}</p>
                          <p className="text-xs text-muted-foreground">{a.notes}</p>
                          <div className="flex gap-3 mt-1 text-xs tabular-nums">
                            <span className="text-primary">+{fmtK(a.estimated_income)}</span>
                            <span className="text-destructive">-{fmtK(a.estimated_cost)}</span>
                            <span className="text-muted-foreground">netto {fmtK(a.estimated_net)}</span>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Extra income/expenses */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm">Övriga intäkter (kr)</Label>
                <Input type="number" value={extraIncome || ""} onChange={e => setExtraIncome(Number(e.target.value) || 0)} placeholder="0" className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">Övriga kostnader (kr)</Label>
                <Input type="number" value={extraExpenses || ""} onChange={e => setExtraExpenses(Number(e.target.value) || 0)} placeholder="0" className="mt-1" />
              </div>
            </div>

            {/* Live preview */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-4 border-t border-border">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Total intäkt</p>
                <p className="text-lg font-bold tabular-nums text-card-foreground">{fmtK(currentSim.totalIncome)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Total kostnad</p>
                <p className="text-lg font-bold tabular-nums text-card-foreground">{fmtK(currentSim.totalCost)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Resultat</p>
                <p className="text-lg font-bold tabular-nums text-card-foreground">{fmtK(currentSim.resultat)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Skatt ({calcEffectiveRate(currentSim.resultat, currentSim.tax)}%)</p>
                <p className="text-lg font-bold tabular-nums text-destructive">{fmtK(currentSim.tax)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Netto efter skatt</p>
                <p className="text-lg font-bold tabular-nums text-primary">{fmtK(currentSim.netAfterTax)}</p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 pt-2">
              <Button onClick={addScenario} className="gap-1.5">
                <Check className="h-4 w-4" /> Lägg till i jämförelsen
              </Button>
              <Button variant="outline" onClick={() => saveScenario(currentSim)} disabled={saving} className="gap-1.5">
                <Save className="h-4 w-4" /> Spara scenario
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* ═══ Section 5: Custom scenario comparison ═══ */}
      {simScenarios.length > 0 && (
        <section>
          <h2 className="font-display text-lg font-semibold text-foreground mb-3">Dina scenarier – jämförelse</h2>
          <div className="overflow-x-auto rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[140px]">Scenario</TableHead>
                  <TableHead className="text-right">År</TableHead>
                  <TableHead className="text-right">Uttag</TableHead>
                  <TableHead className="text-right">Intäkt</TableHead>
                  <TableHead className="text-right">Kostnad</TableHead>
                  <TableHead className="text-right">Resultat</TableHead>
                  <TableHead className="text-right">Skatt</TableHead>
                  <TableHead className="text-right">Netto</TableHead>
                  <TableHead className="text-right">Eff. skatt</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {simScenarios.map((s) => {
                  const isBestNet = bestNet?.id === s.id;
                  const isBestTax = bestTax?.id === s.id;
                  return (
                    <TableRow key={s.id} className={isBestNet ? "bg-primary/5" : ""}>
                      <TableCell className="font-medium text-card-foreground">
                        <div className="flex items-center gap-1.5">
                          {isBestNet && <Trophy className="h-3.5 w-3.5 text-primary" />}
                          {isBestTax && !isBestNet && <TrendingDown className="h-3.5 w-3.5 text-accent" />}
                          {s.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{s.year}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.uttagPercent}%</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtK(s.totalIncome)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtK(s.totalCost)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtK(s.resultat)}</TableCell>
                      <TableCell className="text-right tabular-nums text-destructive">{fmtK(s.tax)}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold text-primary">{fmtK(s.netAfterTax)}</TableCell>
                      <TableCell className="text-right tabular-nums">{calcEffectiveRate(s.resultat, s.tax)}%</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => saveScenario(s)} disabled={saving}><Save className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeScenario(s.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Diff summary */}
          {simScenarios.length >= 2 && (() => {
            const sorted = [...simScenarios].sort((a, b) => a.tax - b.tax);
            const low = sorted[0], high = sorted[sorted.length - 1];
            return (
              <div className="mt-3 rounded-xl border border-accent/20 bg-accent/5 p-4">
                <p className="text-sm text-foreground">
                  <span className="font-semibold">{low.name}</span> ger <span className="font-semibold text-primary">{fmt(high.tax - low.tax)} lägre skatt</span> och{" "}
                  <span className="font-semibold text-accent">{fmt(low.netAfterTax - high.netAfterTax)} mer netto</span> jämfört med <span className="font-semibold">{high.name}</span>.
                </p>
              </div>
            );
          })()}
        </section>
      )}

      {/* ═══ Section 6: Chart ═══ */}
      {chartData.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-4 md:p-6">
          <h3 className="font-display text-lg text-card-foreground mb-4">Skatt vs Netto per scenario</h3>
          <div className="h-[280px] md:h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tickFormatter={fmtK} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={60} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Skatt" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Netto" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* ═══ Section 7: Saved scenarios from DB ═══ */}
      {savedScenarios.length > 0 && (
        <section>
          <h2 className="font-display text-lg font-semibold text-foreground mb-3">Sparade scenarier</h2>
          <div className="overflow-x-auto rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Namn</TableHead>
                  <TableHead className="text-right">År</TableHead>
                  <TableHead className="text-right">Intäkt</TableHead>
                  <TableHead className="text-right">Kostnad</TableHead>
                  <TableHead className="text-right">Resultat</TableHead>
                  <TableHead className="text-right">Skatt</TableHead>
                  <TableHead>Anteckningar</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {savedScenarios.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium text-card-foreground">{s.scenario_name}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.year}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtK(s.estimated_income)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtK(s.estimated_expenses)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtK(s.estimated_profit)}</TableCell>
                    <TableCell className="text-right tabular-nums text-destructive">{fmtK(s.estimated_tax)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{s.notes}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteSaved(s.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {/* ═══ Section 8: Tips ═══ */}
      <section className="rounded-xl border border-accent/20 bg-accent/5 p-5">
        <div className="flex items-start gap-3">
          <Lightbulb className="h-5 w-5 text-accent shrink-0 mt-0.5" />
          <div>
            <h3 className="font-display text-base font-semibold text-card-foreground mb-2">Skatteverktyg för skogsägare</h3>
            <p className="text-xs text-muted-foreground mb-3">Dessa instrument kan minska skatten ytterligare – stöd för dem planeras i kommande versioner.</p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li className="flex items-start gap-2"><Badge variant="secondary" className="text-xs shrink-0 mt-0.5">Skogskonto</Badge><span>Sätt in upp till 60% av skogsintäkten på skogskonto – skjut upp skatten i max 10 år.</span></li>
              <li className="flex items-start gap-2"><Badge variant="secondary" className="text-xs shrink-0 mt-0.5">Räntefördelning</Badge><span>Positivt kapitalunderlag ger möjlighet att fördela inkomst till kapital (30% skatt istället för marginalskatt).</span></li>
              <li className="flex items-start gap-2"><Badge variant="secondary" className="text-xs shrink-0 mt-0.5">Periodiseringsfond</Badge><span>Avsätt upp till 30% av resultatet – skjut upp skatten i 6 år.</span></li>
              <li className="flex items-start gap-2"><Badge variant="secondary" className="text-xs shrink-0 mt-0.5">Expansionsfond</Badge><span>Beskatta vinst med 20,6% istället för marginalskatt genom avsättning till expansion.</span></li>
              <li className="flex items-start gap-2"><Badge variant="secondary" className="text-xs shrink-0 mt-0.5">Timing</Badge><span>Sprid avverkningar över flera år för att undvika höga marginalskatter – simulera ovan!</span></li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
