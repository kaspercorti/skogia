import { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useTransactions } from "@/hooks/useSkogskollData";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"];

const formatSEK = (value: number) => {
  if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
  return value.toString();
};

export default function CashFlowChart() {
  const { data: transactions = [] } = useTransactions();

  const data = useMemo(() => {
    const year = new Date().getFullYear();
    return MONTHS.map((month, i) => {
      const monthTx = transactions.filter(t => {
        const d = new Date(t.date);
        return d.getFullYear() === year && d.getMonth() === i;
      });
      return {
        month,
        inkomst: monthTx.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0),
        utgift: monthTx.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0),
      };
    });
  }, [transactions]);

  return (
    <div className="bg-card rounded-xl border border-border p-5 opacity-0 animate-fade-in" style={{ animationDelay: "200ms" }}>
      <h3 className="font-display text-lg text-card-foreground mb-4">Kassaflöde {new Date().getFullYear()}</h3>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(152, 45%, 28%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(152, 45%, 28%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(36, 60%, 50%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(36, 60%, 50%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(40, 15%, 88%)" />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(150, 10%, 45%)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: "hsl(150, 10%, 45%)" }} tickFormatter={formatSEK} axisLine={false} tickLine={false} />
            <Tooltip formatter={(value: number) => [`${value.toLocaleString("sv-SE")} kr`, ""]} contentStyle={{ backgroundColor: "hsl(40, 25%, 99%)", border: "1px solid hsl(40, 15%, 88%)", borderRadius: "0.5rem", fontSize: "0.875rem" }} />
            <Area type="monotone" dataKey="inkomst" stroke="hsl(152, 45%, 28%)" fill="url(#incomeGrad)" strokeWidth={2} name="Inkomst" />
            <Area type="monotone" dataKey="utgift" stroke="hsl(36, 60%, 50%)" fill="url(#expenseGrad)" strokeWidth={2} name="Utgift" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="flex gap-6 mt-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="h-2.5 w-2.5 rounded-full bg-primary" />Inkomster</div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="h-2.5 w-2.5 rounded-full bg-accent" />Utgifter</div>
      </div>
    </div>
  );
}
