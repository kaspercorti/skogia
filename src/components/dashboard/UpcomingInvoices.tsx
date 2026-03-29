import { cn } from "@/lib/utils";

const invoices = [
  { id: "F-2024-012", customer: "Holmen Skog AB", amount: 145000, due: "2024-12-15", status: "obetald" as const },
  { id: "F-2024-011", customer: "SCA Skog", amount: 52000, due: "2024-12-01", status: "förfallen" as const },
  { id: "F-2024-010", customer: "Södra Skogsägarna", amount: 78500, due: "2024-11-20", status: "betald" as const },
];

const statusStyles = {
  betald: "bg-primary/10 text-primary",
  obetald: "bg-accent/10 text-accent",
  förfallen: "bg-destructive/10 text-destructive",
};

export default function UpcomingInvoices() {
  return (
    <div className="bg-card rounded-xl border border-border p-5 opacity-0 animate-fade-in" style={{ animationDelay: "500ms" }}>
      <h3 className="font-display text-lg text-card-foreground mb-4">Fakturor</h3>
      <div className="space-y-3">
        {invoices.map((inv) => (
          <div key={inv.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-card-foreground">{inv.customer}</p>
              <p className="text-xs text-muted-foreground">{inv.id} · Förfaller {inv.due}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-semibold tabular-nums text-card-foreground">
                {inv.amount.toLocaleString("sv-SE")} kr
              </p>
              <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full capitalize", statusStyles[inv.status])}>
                {inv.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
