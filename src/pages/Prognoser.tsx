import { useState, useMemo } from "react";
import { TrendingUp, Zap, TreePine, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useForestActivities, useStands, fmt } from "@/hooks/useSkogskollData";

const fmtK = (n: number) => {
  if (Math.abs(n) >= 1000000) return `${(n / 1000000).toFixed(1)} mkr`;
  if (Math.abs(n) >= 1000) return `${Math.round(n / 1000)} tkr`;
  return `${n} kr`;
};

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

const YEARLY_FIXED_COST = 31500; // Recurring costs

export default function Prognoser() {
  const [horizon, setHorizon] = useState<"1" | "5" | "10">("5");
  const { data: activities = [] } = useForestActivities();
  const { data: stands = [] } = useStands();

  const currentYear = new Date().getFullYear();

  const data = useMemo(() => {
    const years = Number(horizon);
    const result = [];
    for (let i = 0; i < years; i++) {
      const y = currentYear + i;
      const yearActivities = activities.filter(a => {
        if (!a.planned_date) return false;
        return new Date(a.planned_date).getFullYear() === y;
      });
      const actionIncome = yearActivities.reduce((s, a) => s + a.estimated_income, 0);
      const actionCost = yearActivities.reduce((s, a) => s + a.estimated_cost, 0);
      const intakter = actionIncome || (i > 0 ? 25000 : 0);
      const kostnader = YEARLY_FIXED_COST + actionCost;
      result.push({ year: String(y), intakter, kostnader, resultat: intakter - kostnader });
    }
    return result;
  }, [horizon, activities, currentYear]);

  const totals = useMemo(() => ({
    intakter: data.reduce((s, d) => s + d.intakter, 0),
    kostnader: data.reduce((s, d) => s + d.kostnader, 0),
    resultat: data.reduce((s, d) => s + d.resultat, 0),
  }), [data]);

  const biggestActivity = useMemo(() => {
    return activities
      .filter(a => a.status === "planned" && a.estimated_income > 0)
      .sort((a, b) => b.estimated_income - a.estimated_income)[0] || null;
  }, [activities]);

  const biggestStand = biggestActivity?.stand_id ? stands.find(s => s.id === biggestActivity.stand_id) : null;

  return (
    <main className="flex-1 p-4 md:p-8 overflow-auto">
      {biggestActivity && (
        <div className="rounded-xl border-2 border-primary/30 bg-gradient-to-r from-primary/5 to-accent/5 p-5 md:p-6 mb-6 relative overflow-hidden">
          <div className="absolute top-3 right-3 opacity-10"><Zap className="h-20 w-20 text-primary" /></div>
          <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1.5"><Zap className="h-4 w-4 text-accent" /> Insikt</p>
          <p className="font-display text-xl md:text-2xl font-bold text-foreground mb-1">
            {biggestActivity.type} <ArrowRight className="inline h-5 w-5 text-accent mx-1" /> <span className="text-primary">+{fmt(biggestActivity.estimated_income)}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            <TreePine className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
            {biggestStand?.name || "Planerad åtgärd"} – {biggestActivity.notes || ""}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-7 w-7 text-primary" />
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Prognoser</h1>
        </div>
        <Tabs value={horizon} onValueChange={v => setHorizon(v as "1" | "5" | "10")}>
          <TabsList>
            <TabsTrigger value="1">1 år</TabsTrigger>
            <TabsTrigger value="5">5 år</TabsTrigger>
            <TabsTrigger value="10">10 år</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

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

      {/* Planned actions */}
      <div className="rounded-xl border border-border bg-card p-4 md:p-6">
        <h3 className="font-display text-lg text-card-foreground mb-4">Planerade åtgärder</h3>
        <div className="space-y-3">
          {activities.filter(a => a.status === "planned").map(a => {
            const stand = stands.find(s => s.id === a.stand_id);
            return (
              <div key={a.id} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
                <span className="text-sm font-bold text-accent tabular-nums">{a.planned_date ? new Date(a.planned_date).getFullYear() : "—"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-card-foreground">{stand?.name || "Okänt bestånd"}</p>
                  <p className="text-xs text-muted-foreground">{a.type} – {a.notes || ""}</p>
                </div>
                <span className={cn("text-sm font-semibold tabular-nums whitespace-nowrap", a.estimated_net >= 0 ? "text-primary" : "text-card-foreground")}>
                  {a.estimated_net >= 0 ? "+" : "−"}{fmt(Math.abs(a.estimated_net))}
                </span>
              </div>
            );
          })}
          {activities.filter(a => a.status === "planned").length === 0 && (
            <p className="text-sm text-muted-foreground">Inga planerade åtgärder.</p>
          )}
        </div>
      </div>
    </main>
  );
}
