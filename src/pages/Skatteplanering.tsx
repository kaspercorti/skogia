import { useState, useMemo } from "react";
import { Calculator, Zap, ArrowRight, TrendingDown, Lightbulb, Sliders as SliderIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

// ── Tax model (förenklad) ──────────────────────────
// Kommunalskatt ~32%, statlig skatt >~600k = 20%
const TAX_BRACKETS = [
  { limit: 0, rate: 0 },
  { limit: 614000, rate: 0.32 },
  { limit: Infinity, rate: 0.52 },
];

function calcTax(income: number): number {
  let tax = 0;
  let prev = 0;
  for (const b of TAX_BRACKETS) {
    if (income <= prev) break;
    const taxable = Math.min(income, b.limit) - prev;
    tax += Math.max(0, taxable) * b.rate;
    prev = b.limit;
  }
  return Math.round(tax);
}

const fmt = (n: number) => n.toLocaleString("sv-SE") + " kr";
const fmtK = (n: number) => {
  if (Math.abs(n) >= 1000000) return `${(n / 1000000).toFixed(1)} mkr`;
  if (Math.abs(n) >= 1000) return `${Math.round(n / 1000)} tkr`;
  return `${n} kr`;
};

// ── Baseline data ──────────────────────────────────
const BASE_INCOME_2024 = 457000; // Historiska intäkter (utan stor avverkning)
const BASE_COSTS_2024 = 125000;
const AVVERKNING_VALUE = 990000; // Avd 1 – Tallmon
const YEARLY_TILLVAXT = 0.032; // 3.2% tillväxt → mer värde om man väntar

// ── Component ──────────────────────────────────────
export default function Skatteplanering() {
  const [avverkningYear, setAvverkningYear] = useState(2026); // 2025-2030
  const [uttagPercent, setUttagPercent] = useState(100); // 50-100%

  const scenarios = useMemo(() => {
    const years = [2025, 2026, 2027, 2028, 2029, 2030];
    return years.map((y) => {
      const yearsGrowth = y - 2024;
      const grownValue = Math.round(AVVERKNING_VALUE * Math.pow(1 + YEARLY_TILLVAXT, yearsGrowth));
      const uttag = Math.round(grownValue * (uttagPercent / 100));
      const isAvverkningYear = y === avverkningYear;
      const income = BASE_INCOME_2024 + (isAvverkningYear ? uttag : 0);
      const resultat = income - BASE_COSTS_2024;
      const tax = calcTax(resultat);
      const netto = resultat - tax;
      return { year: String(y), income, resultat, tax, netto, uttag: isAvverkningYear ? uttag : 0, isActive: isAvverkningYear };
    });
  }, [avverkningYear, uttagPercent]);

  // Compare: avverka 2025 vs chosen year
  const tax2025 = useMemo(() => {
    const income = BASE_INCOME_2024 + Math.round(AVVERKNING_VALUE * (uttagPercent / 100));
    return calcTax(income - BASE_COSTS_2024);
  }, [uttagPercent]);

  const taxChosen = useMemo(() => {
    const s = scenarios.find((s) => s.isActive);
    return s?.tax || 0;
  }, [scenarios]);

  const saving = tax2025 - taxChosen;
  const chosenScenario = scenarios.find((s) => s.isActive)!;

  // Current year tax overview
  const currentResultat = BASE_INCOME_2024 - BASE_COSTS_2024;
  const currentTax = calcTax(currentResultat);

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

  return (
    <main className="flex-1 p-4 md:p-8 overflow-auto">
      {/* Hero insight */}
      {avverkningYear > 2025 && saving > 0 && (
        <div className="rounded-xl border-2 border-primary/30 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 p-5 md:p-6 mb-6 relative overflow-hidden">
          <div className="absolute top-3 right-3 opacity-10">
            <TrendingDown className="h-20 w-20 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1.5">
            <Zap className="h-4 w-4 text-accent" /> Skatteoptimering
          </p>
          <p className="font-display text-xl md:text-2xl font-bold text-foreground mb-1">
            Om du väntar till {avverkningYear} <ArrowRight className="inline h-5 w-5 text-accent mx-1" /> <span className="text-primary">sparar du {fmt(saving)} i skatt</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Jämfört med att avverka redan 2025. Virket växer dessutom med {(YEARLY_TILLVAXT * 100).toFixed(1)}% per år.
          </p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Calculator className="h-7 w-7 text-primary" />
        <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Skatteplanering</h1>
      </div>

      {/* Current year overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Resultat 2024</p>
          <p className="text-lg font-bold tabular-nums text-card-foreground">{fmtK(currentResultat)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Beräknad skatt 2024</p>
          <p className="text-lg font-bold tabular-nums text-destructive">{fmtK(currentTax)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Effektiv skattesats</p>
          <p className="text-lg font-bold tabular-nums text-card-foreground">{currentResultat > 0 ? Math.round((currentTax / currentResultat) * 100) : 0}%</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Netto efter skatt</p>
          <p className="text-lg font-bold tabular-nums text-primary">{fmtK(currentResultat - currentTax)}</p>
        </div>
      </div>

      {/* Simulator */}
      <div className="rounded-xl border border-border bg-card p-5 md:p-6 mb-6">
        <div className="flex items-center gap-2 mb-5">
          <SliderIcon className="h-4 w-4 text-accent" />
          <h3 className="font-display text-lg text-card-foreground">Simulera avverkning</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Slider: Year */}
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm font-medium text-card-foreground">Avverkningsår</label>
              <span className="text-sm font-bold text-accent tabular-nums">{avverkningYear}</span>
            </div>
            <Slider
              value={[avverkningYear]}
              onValueChange={([v]) => setAvverkningYear(v)}
              min={2025}
              max={2030}
              step={1}
              className="mb-1"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>2025</span><span>2030</span>
            </div>
          </div>

          {/* Slider: Uttag */}
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm font-medium text-card-foreground">Andel uttag</label>
              <span className="text-sm font-bold text-accent tabular-nums">{uttagPercent}%</span>
            </div>
            <Slider
              value={[uttagPercent]}
              onValueChange={([v]) => setUttagPercent(v)}
              min={25}
              max={100}
              step={5}
              className="mb-1"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>25%</span><span>100%</span>
            </div>
          </div>
        </div>

        {/* Simulation result */}
        <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-border">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Intäkt vid avverkning</p>
            <p className="text-lg font-bold tabular-nums text-primary">{fmtK(chosenScenario.uttag)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Skatt det året</p>
            <p className="text-lg font-bold tabular-nums text-destructive">{fmtK(chosenScenario.tax)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Netto</p>
            <p className="text-lg font-bold tabular-nums text-card-foreground">{fmtK(chosenScenario.netto)}</p>
          </div>
        </div>
      </div>

      {/* Tax comparison chart */}
      <div className="rounded-xl border border-border bg-card p-4 md:p-6 mb-6">
        <h3 className="font-display text-lg text-card-foreground mb-4">Skatt per år vid avverkning</h3>
        <div className="h-[260px] md:h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={scenarios}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(40 15% 88%)" />
              <XAxis dataKey="year" tick={{ fontSize: 12, fill: "hsl(150 10% 45%)" }} />
              <YAxis tickFormatter={fmtK} tick={{ fontSize: 11, fill: "hsl(150 10% 45%)" }} width={55} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="tax" name="Skatt" radius={[4, 4, 0, 0]}>
                {scenarios.map((s, i) => (
                  <Cell key={i} fill={s.isActive ? "hsl(152 45% 28%)" : "hsl(40 15% 88%)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tips */}
      <div className="rounded-xl border border-accent/20 bg-accent/5 p-5">
        <div className="flex items-start gap-3">
          <Lightbulb className="h-5 w-5 text-accent shrink-0 mt-0.5" />
          <div>
            <h3 className="font-display text-base font-semibold text-card-foreground mb-2">Skattetips för skogsägare</h3>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <Badge variant="secondary" className="text-xs shrink-0 mt-0.5">Skogskonto</Badge>
                <span>Sätt in upp till 60% av skogsintäkten på skogskonto – skjut upp skatten i max 10 år.</span>
              </li>
              <li className="flex items-start gap-2">
                <Badge variant="secondary" className="text-xs shrink-0 mt-0.5">Räntefördelning</Badge>
                <span>Positivt kapitalunderlag ger möjlighet att fördela inkomst till kapital (30% skatt).</span>
              </li>
              <li className="flex items-start gap-2">
                <Badge variant="secondary" className="text-xs shrink-0 mt-0.5">Periodisering</Badge>
                <span>Avsätt till periodiseringsfond – skjut upp till 30% av resultatet i 6 år.</span>
              </li>
              <li className="flex items-start gap-2">
                <Badge variant="secondary" className="text-xs shrink-0 mt-0.5">Timing</Badge>
                <span>Sprid avverkningar över flera år för att undvika höga marginalskatter.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}
