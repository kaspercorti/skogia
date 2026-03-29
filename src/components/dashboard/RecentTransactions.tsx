import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

const transactions = [
  { date: "2024-11-15", desc: "Virkesförsäljning – Holmen", amount: 95000, type: "income" as const },
  { date: "2024-11-10", desc: "Planteringskostnad", amount: -18500, type: "expense" as const },
  { date: "2024-10-28", desc: "Maskinunderhåll", amount: -7200, type: "expense" as const },
  { date: "2024-10-15", desc: "Skogsvårdsavgift", amount: -3400, type: "expense" as const },
  { date: "2024-08-20", desc: "Virkesförsäljning – SCA", amount: 320000, type: "income" as const },
];

export default function RecentTransactions() {
  return (
    <div className="bg-card rounded-xl border border-border p-5 opacity-0 animate-fade-in" style={{ animationDelay: "400ms" }}>
      <h3 className="font-display text-lg text-card-foreground mb-4">Senaste transaktioner</h3>
      <div className="space-y-2">
        {transactions.map((tx, i) => (
          <div key={i} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
            <div
              className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                tx.type === "income" ? "bg-primary/10" : "bg-accent/10"
              )}
            >
              {tx.type === "income" ? (
                <ArrowDownLeft className="h-4 w-4 text-primary" />
              ) : (
                <ArrowUpRight className="h-4 w-4 text-accent" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-card-foreground truncate">{tx.desc}</p>
              <p className="text-xs text-muted-foreground">{tx.date}</p>
            </div>
            <span
              className={cn(
                "text-sm font-semibold tabular-nums",
                tx.type === "income" ? "text-forest-light" : "text-card-foreground"
              )}
            >
              {tx.type === "income" ? "+" : ""}
              {tx.amount.toLocaleString("sv-SE")} kr
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
