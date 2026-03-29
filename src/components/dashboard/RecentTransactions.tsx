import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTransactions, fmt } from "@/hooks/useSkogskollData";

export default function RecentTransactions() {
  const { data: transactions = [] } = useTransactions();
  const recent = transactions.slice(0, 5);

  return (
    <div className="bg-card rounded-xl border border-border p-5 opacity-0 animate-fade-in" style={{ animationDelay: "400ms" }}>
      <h3 className="font-display text-lg text-card-foreground mb-4">Senaste transaktioner</h3>
      <div className="space-y-2">
        {recent.length === 0 && <p className="text-sm text-muted-foreground">Inga transaktioner ännu.</p>}
        {recent.map((tx) => (
          <div key={tx.id} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
            <div className={cn("h-8 w-8 rounded-full flex items-center justify-center shrink-0", tx.type === "income" ? "bg-primary/10" : "bg-accent/10")}>
              {tx.type === "income" ? <ArrowDownLeft className="h-4 w-4 text-primary" /> : <ArrowUpRight className="h-4 w-4 text-accent" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-card-foreground truncate">{tx.description || tx.category}</p>
              <p className="text-xs text-muted-foreground">{tx.date}</p>
            </div>
            <span className={cn("text-sm font-semibold tabular-nums", tx.type === "income" ? "text-primary" : "text-card-foreground")}>
              {tx.type === "income" ? "+" : "−"}{tx.amount.toLocaleString("sv-SE")} kr
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
