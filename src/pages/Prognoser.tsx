import { useState, useMemo } from "react";
import { TrendingUp, Zap, TreePine, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

// ── Prognos-data generator ─────────────────────────
// Baserat på skogsplan-data, historik och planerade åtgärder
const BASE_YEAR = 2024;

interface YearData {
  year: string;
  intakter: number;
  kostnader: number;
  resultat: number;
}

interface ActionInsight {
  year: number;
  bestand: string;
  action: string;
  amount: number;
  description: string;
}

const PLANNED_ACTIONS: ActionInsight[] = [
  { year: 2025, bestand: "Avd 1 – Tallmon", action: "Slutavverkning", amount: 990000, description: "Tall & gran, 2 200 m³sk à 450 kr" },
  { year: 2025, bestand: "Avd 3 – Björkängen", action: "Röjning", amount: -12000, description: "Röjning ungskog, 5.7 ha" },
  { year: 2026, bestand: "Avd 2 – Granbacken", action: "Gallring", amount: 280000, description: "Gran gallringsvirke, ~600 m³sk" },
  { year: 2026, bestand: "Avd 4 – Stormyran", action: "Slutavverkning", amount: 1786000, description: "Blandskog, 3 800 m³sk à 470 kr" },
  { year: 2027, bestand: "Avd 6 – Åskullen", action: "Gallring", amount: 350000, description: "Tall/gran, ~780 m³sk" },
  { year: 2028, bestand: "Avd 5 – Nyplantering Syd", action: "Röjning", amount: -9000, description: "Ungskog gran, 6 ha" },
];

const RECURRING_COSTS = [
  { label: "Skogsvårdsavgift", amount: 8500 },
  { label: "Maskinunderhåll", amount: 12000 },
  { label: "Försäkring", amount: 6000 },
  { label: "Vägunderhåll", amount: 5000 },
];
const YEARLY_FIXED_COST = RECURRING_COSTS.reduce((s, c) => s + c.amount, 0);

function generateForecast(years: number): YearData[] {
  const data: YearData[] = [];
  for (let i = 0; i < years; i++) {
    const y = BASE_YEAR + 1 + i;
    const actions = PLANNED_ACTIONS.filter((a) => a.year === y);
    const actionIncome = actions.filter((a) => a.amount > 0).reduce((s, a) => s + a.amount, 0);
    const actionCost = Math.abs(actions.filter((a) => a.amount < 0).reduce((s, a) => s + a.amount, 0));
    // Add some organic growth income for years without big actions
    const organicIncome = actionIncome === 0 ? 25000 + Math.round(Math.random() * 15000) : 0;
    const intakter = actionIncome + organicIncome;
    const kostnader = YEARLY_FIXED_COST + actionCost;
    data.push({
      year: String(y),
      intakter,
      kostnader,
      resultat: intakter - kostnader,
    });
  }
  return data;
}

// ── Formatter ──────────────────────────────────────
const fmtK = (n: number) => {
  if (Math.abs(n) >= 1000000) return `${(n / 1000000).toFixed(1)} mkr`;
  if (Math.abs(n) >= 1000) return `${Math.round(n / 1000)} tkr`;
  return `${n} kr`;
};
const fmt = (n: number) => n.toLocaleString("sv-SE") + " kr";

// ── Custom tooltip ─────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload) return null;
  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
      <p className="text-sm font-semibold text-card-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="text-xs" style={{ color: p.color }}>
          {p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  );
}

// ── Component ──────────────────────────────────────
export default function Prognoser() {
  const [horizon, setHorizon] = useState<"1" | "5" | "10">("5");

  const data = useMemo(() => generateForecast(Number(horizon)), [horizon]);

  const totals = useMemo(() => ({
    intakter: data.reduce((s, d) => s + d.intakter, 0),
    kostnader: data.reduce((s, d) => s + d.kostnader, 0),
    resultat: data.reduce((s, d) => s + d.resultat, 0),
  }), [data]);

  // Find the biggest single action for the "wow" insight
  const biggestAction = useMemo(() => {
    const relevantActions = PLANNED_ACTIONS.filter(
      (a) => a.amount > 0 && a.year <= BASE_YEAR + Number(horizon)
    );
    return relevantActions.sort((a, b) => b.amount - a.amount)[0] || null;
  }, [horizon]);

  return (
    <main className="flex-1 p-4 md:p-8 overflow-auto">
      {/* Hero insight */}
      {biggestAction && (
        <div className="rounded-xl border-2 border-primary/30 bg-gradient-to-r from-primary/5 to-accent/5 p-5 md:p-6 mb-6 relative overflow-hidden">
          <div className="absolute top-3 right-3 opacity-10">
            <Zap className="h-20 w-20 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1.5">
            <Zap className="h-4 w-4 text-accent" /> Insikt
          </p>
          <p className="font-display text-xl md:text-2xl font-bold text-foreground mb-1">
            Om du avverkar {biggestAction.year} <ArrowRight className="inline h-5 w-5 text-accent mx-1" /> <span className="text-primary">+{fmt(biggestAction.amount)}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            <TreePine className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
            {biggestAction.bestand} – {biggestAction.description}
          </p>
        </div>
      )}

      {/* Header + horizon selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-7 w-7 text-primary" />
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Prognoser</h1>
        </div>
        <Tabs value={horizon} onValueChange={(v) => setHorizon(v as "1" | "5" | "10")}>
          <TabsList>
            <TabsTrigger value="1">1 år</TabsTrigger>
            <TabsTrigger value="5">5 år</TabsTrigger>
            <TabsTrigger value="10">10 år</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Progn. intäkter</p>
          <p className="text-lg md:text-xl font-bold tabular-nums text-primary">{fmtK(totals.intakter)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Progn. kostnader</p>
          <p className="text-lg md:text-xl font-bold tabular-nums text-destructive">{fmtK(totals.kostnader)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Progn. resultat</p>
          <p className={cn("text-lg md:text-xl font-bold tabular-nums", totals.resultat >= 0 ? "text-primary" : "text-destructive")}>{fmtK(totals.resultat)}</p>
        </div>
      </div>

      {/* Chart – Revenue & Costs */}
      <div className="rounded-xl border border-border bg-card p-4 md:p-6 mb-6">
        <h3 className="font-display text-lg text-card-foreground mb-4">Intäkter & kostnader per år</h3>
        <div className="h-[280px] md:h-[340px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(40 15% 88%)" />
              <XAxis dataKey="year" tick={{ fontSize: 12, fill: "hsl(150 10% 45%)" }} />
              <YAxis tickFormatter={fmtK} tick={{ fontSize: 11, fill: "hsl(150 10% 45%)" }} width={60} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="intakter" name="Intäkter" fill="hsl(152 45% 28%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="kostnader" name="Kostnader" fill="hsl(0 65% 52%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart – Resultat */}
      <div className="rounded-xl border border-border bg-card p-4 md:p-6 mb-6">
        <h3 className="font-display text-lg text-card-foreground mb-4">Resultatutveckling</h3>
        <div className="h-[240px] md:h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="resultGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(152 45% 28%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(152 45% 28%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(40 15% 88%)" />
              <XAxis dataKey="year" tick={{ fontSize: 12, fill: "hsl(150 10% 45%)" }} />
              <YAxis tickFormatter={fmtK} tick={{ fontSize: 11, fill: "hsl(150 10% 45%)" }} width={60} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="resultat" name="Resultat" stroke="hsl(152 45% 28%)" fill="url(#resultGrad)" strokeWidth={2.5} dot={{ r: 4, fill: "hsl(152 45% 28%)" }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Planned actions timeline */}
      <div className="rounded-xl border border-border bg-card p-4 md:p-6">
        <h3 className="font-display text-lg text-card-foreground mb-4">Planerade åtgärder</h3>
        <div className="space-y-3">
          {PLANNED_ACTIONS.filter((a) => a.year <= BASE_YEAR + Number(horizon)).map((a, i) => (
            <div key={i} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
              <div className="flex flex-col items-center">
                <span className="text-sm font-bold text-accent tabular-nums">{a.year}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-card-foreground">{a.bestand}</p>
                <p className="text-xs text-muted-foreground">{a.action} – {a.description}</p>
              </div>
              <span className={cn(
                "text-sm font-semibold tabular-nums whitespace-nowrap",
                a.amount >= 0 ? "text-primary" : "text-card-foreground"
              )}>
                {a.amount >= 0 ? "+" : "−"}{fmt(Math.abs(a.amount))}
              </span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
