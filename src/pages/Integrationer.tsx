import { Link2, Building2, Landmark, RefreshCw, CheckCircle2, XCircle, Clock, ArrowDownToLine, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useIntegrations, useBankAccounts, useTaxAccounts, fmt } from "@/hooks/useSkogskollData";
import { useState } from "react";
import BankMatchingSection from "@/components/bank/BankMatchingSection";

const iconMap: Record<string, any> = {
  bank: Building2,
  skattekonto: Landmark,
  skogsbruksplan: ExternalLink,
};

export default function Integrationer() {
  const { data: integrations = [] } = useIntegrations();
  const { data: bankAccounts = [] } = useBankAccounts();
  const { data: taxAccounts = [] } = useTaxAccounts();
  const [syncing, setSyncing] = useState<string | null>(null);

  const handleSync = (id: string) => {
    setSyncing(id);
    setTimeout(() => {
      setSyncing(null);
      toast.success("Synkronisering klar");
    }, 1500);
  };

  const connectedCount = integrations.filter(i => i.status === "connected").length;

  // Combine integration info with account data
  const enriched = integrations.map(intg => {
    const Icon = iconMap[intg.type] || ExternalLink;
    let saldo: number | null = null;
    let accountInfo = "";

    if (intg.type === "bank") {
      const accounts = bankAccounts.filter(a => a.bank_name.toLowerCase().includes(intg.provider.toLowerCase()));
      saldo = accounts.reduce((s, a) => s + a.current_balance, 0);
      accountInfo = accounts.map(a => a.account_number_masked).filter(Boolean).join(", ");
    } else if (intg.type === "skattekonto") {
      const ta = taxAccounts[0];
      if (ta) saldo = ta.current_balance;
    }

    return { ...intg, Icon, saldo, accountInfo };
  });

  return (
    <main className="flex-1 p-4 md:p-8 overflow-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link2 className="h-7 w-7 text-primary" />
        <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Integrationer</h1>
        <Badge variant="secondary" className="ml-2">{connectedCount}/{integrations.length} kopplade</Badge>
      </div>

      <div className="space-y-4">
        {enriched.length === 0 && <p className="text-muted-foreground">Inga integrationer konfigurerade.</p>}
        {enriched.map(intg => (
          <div key={intg.id} className={cn("rounded-xl border bg-card p-5 transition-all", intg.status === "connected" ? "border-primary/20" : "border-border")}>
            <div className="flex items-start gap-4">
              <div className={cn("h-11 w-11 rounded-lg flex items-center justify-center shrink-0", intg.status === "connected" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                <intg.Icon className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-display text-base font-semibold text-card-foreground">{intg.provider}</h3>
                  {intg.status === "connected" ? (
                    <Badge variant="outline" className="gap-1 text-xs bg-primary/10 text-primary border-primary/20"><CheckCircle2 className="h-3 w-3" /> Kopplad</Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 text-xs bg-muted text-muted-foreground"><XCircle className="h-3 w-3" /> Ej kopplad</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{intg.type}</p>
                {intg.status === "connected" && (
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-3 text-sm">
                    {intg.saldo !== null && (
                      <span className="text-card-foreground">Saldo: <span className={cn("font-semibold tabular-nums", intg.saldo >= 0 ? "text-primary" : "text-destructive")}>{fmt(intg.saldo)}</span></span>
                    )}
                    {intg.accountInfo && <span className="text-muted-foreground font-mono text-xs">{intg.accountInfo}</span>}
                    {intg.last_synced_at && (
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Senast: {new Date(intg.last_synced_at).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" })}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                {intg.status === "connected" ? (
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => handleSync(intg.id)} disabled={syncing === intg.id}>
                    <RefreshCw className={cn("h-3.5 w-3.5", syncing === intg.id && "animate-spin")} />
                    {syncing === intg.id ? "Synkar..." : "Hämta"}
                  </Button>
                ) : (
                  <Button size="sm" className="gap-1.5 text-xs" disabled>
                    <ArrowDownToLine className="h-3.5 w-3.5" /> Koppla
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <BankMatchingSection />
    </main>
  );
}
