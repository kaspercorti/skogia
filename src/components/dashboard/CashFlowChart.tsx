import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const data = [
  { month: "Jan", inkomst: 0, utgift: 12000 },
  { month: "Feb", inkomst: 0, utgift: 8500 },
  { month: "Mar", inkomst: 185000, utgift: 15000 },
  { month: "Apr", inkomst: 0, utgift: 22000 },
  { month: "Maj", inkomst: 0, utgift: 9000 },
  { month: "Jun", inkomst: 45000, utgift: 18000 },
  { month: "Jul", inkomst: 0, utgift: 7000 },
  { month: "Aug", inkomst: 320000, utgift: 35000 },
  { month: "Sep", inkomst: 0, utgift: 12000 },
  { month: "Okt", inkomst: 0, utgift: 14000 },
  { month: "Nov", inkomst: 95000, utgift: 20000 },
  { month: "Dec", inkomst: 0, utgift: 10000 },
];

const formatSEK = (value: number) => {
  if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
  return value.toString();
};

export default function CashFlowChart() {
  return (
    <div className="bg-card rounded-xl border border-border p-5 opacity-0 animate-fade-in" style={{ animationDelay: "200ms" }}>
      <h3 className="font-display text-lg text-card-foreground mb-4">Kassaflöde 2024</h3>
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
            <Tooltip
              formatter={(value: number) => [`${value.toLocaleString("sv-SE")} kr`, ""]}
              contentStyle={{
                backgroundColor: "hsl(40, 25%, 99%)",
                border: "1px solid hsl(40, 15%, 88%)",
                borderRadius: "0.5rem",
                fontSize: "0.875rem",
              }}
            />
            <Area type="monotone" dataKey="inkomst" stroke="hsl(152, 45%, 28%)" fill="url(#incomeGrad)" strokeWidth={2} name="Inkomst" />
            <Area type="monotone" dataKey="utgift" stroke="hsl(36, 60%, 50%)" fill="url(#expenseGrad)" strokeWidth={2} name="Utgift" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="flex gap-6 mt-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-2.5 w-2.5 rounded-full bg-primary" />
          Inkomster
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-2.5 w-2.5 rounded-full bg-accent" />
          Utgifter
        </div>
      </div>
    </div>
  );
}
