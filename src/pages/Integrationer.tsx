import { useState } from "react";
import { Link2, Building2, Landmark, RefreshCw, CheckCircle2, XCircle, Clock, ArrowDownToLine, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  connected: boolean;
  lastSync: string | null;
  saldo: number | null;
  accountNumber?: string;
}

const fmt = (n: number) => n.toLocaleString("sv-SE") + " kr";

export default function Integrationer() {
  const [integrations, setIntegrations] = useState<Integration[]>([
    {
      id: "bank",
      name: "Handelsbanken",
      description: "Företagskonto – automatisk import av transaktioner",
      icon: <Building2 className="h-6 w-6" />,
      connected: true,
      lastSync: "2024-11-15 08:32",
      saldo: 342000,
      accountNumber: "6112 xxx xxx 4",
    },
    {
      id: "skogskonto",
      name: "Skogskonto (Handelsbanken)",
      description: "Skogskonto för uppskov av skogsintäkter",
      icon: <Landmark className="h-6 w-6" />,
      connected: true,
      lastSync: "2024-11-15 08:32",
      saldo: 120000,
      accountNumber: "6112 xxx xxx 7",
    },
    {
      id: "skatteverket",
      name: "Skatteverket",
      description: "Skattekonto – se saldo och kommande inbetalningar",
      icon: <Landmark className="h-6 w-6" />,
      connected: false,
      lastSync: null,
      saldo: null,
    },
    {
      id: "skogsbruksplan",
      name: "Min Skogsbruksplan (pcSKOG)",
      description: "Importera bestånddata från pcSKOG eller Skogsappen",
      icon: <ExternalLink className="h-6 w-6" />,
      connected: false,
      lastSync: null,
      saldo: null,
    },
  ]);

  const [syncing, setSyncing] = useState<string | null>(null);

  const handleConnect = (id: string) => {
    setIntegrations((prev) =>
      prev.map((i) =>
        i.id === id
          ? {
              ...i,
              connected: true,
              lastSync: new Date().toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" }),
              saldo: id === "skatteverket" ? -85000 : i.saldo,
            }
          : i
      )
    );
    toast.success("Kopplad!", { description: `Integrationen är nu aktiv.` });
  };

  const handleDisconnect = (id: string) => {
    setIntegrations((prev) =>
      prev.map((i) => (i.id === id ? { ...i, connected: false, lastSync: null, saldo: null } : i))
    );
    toast.info("Frånkopplad");
  };

  const handleSync = (id: string) => {
    setSyncing(id);
    setTimeout(() => {
      setIntegrations((prev) =>
        prev.map((i) =>
          i.id === id
            ? { ...i, lastSync: new Date().toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" }) }
            : i
        )
      );
      setSyncing(null);
      toast.success("Synkronisering klar", { description: "Transaktioner har hämtats." });
    }, 1500);
  };

  const connectedCount = integrations.filter((i) => i.connected).length;

  return (
    <main className="flex-1 p-4 md:p-8 overflow-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link2 className="h-7 w-7 text-primary" />
        <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Integrationer</h1>
        <Badge variant="secondary" className="ml-2">{connectedCount}/{integrations.length} kopplade</Badge>
      </div>

      {/* Integration cards */}
      <div className="space-y-4">
        {integrations.map((intg) => (
          <div
            key={intg.id}
            className={cn(
              "rounded-xl border bg-card p-5 transition-all",
              intg.connected ? "border-primary/20" : "border-border"
            )}
          >
            <div className="flex items-start gap-4">
              {/* Icon */}
              <div className={cn(
                "h-11 w-11 rounded-lg flex items-center justify-center shrink-0",
                intg.connected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              )}>
                {intg.icon}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-display text-base font-semibold text-card-foreground">{intg.name}</h3>
                  {intg.connected ? (
                    <Badge variant="outline" className="gap-1 text-xs bg-primary/10 text-primary border-primary/20">
                      <CheckCircle2 className="h-3 w-3" /> Kopplad
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 text-xs bg-muted text-muted-foreground">
                      <XCircle className="h-3 w-3" /> Ej kopplad
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{intg.description}</p>

                {/* Connected details */}
                {intg.connected && (
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-3 text-sm">
                    {intg.saldo !== null && (
                      <span className="text-card-foreground">
                        Saldo: <span className={cn("font-semibold tabular-nums", intg.saldo >= 0 ? "text-primary" : "text-destructive")}>{fmt(intg.saldo)}</span>
                      </span>
                    )}
                    {intg.accountNumber && (
                      <span className="text-muted-foreground font-mono text-xs">{intg.accountNumber}</span>
                    )}
                    {intg.lastSync && (
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Senast synkad: {intg.lastSync}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 shrink-0">
                {intg.connected ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs"
                      onClick={() => handleSync(intg.id)}
                      disabled={syncing === intg.id}
                    >
                      <RefreshCw className={cn("h-3.5 w-3.5", syncing === intg.id && "animate-spin")} />
                      {syncing === intg.id ? "Synkar..." : "Hämta"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs text-muted-foreground"
                      onClick={() => handleDisconnect(intg.id)}
                    >
                      Koppla från
                    </Button>
                  </>
                ) : (
                  <Button size="sm" className="gap-1.5 text-xs" onClick={() => handleConnect(intg.id)}>
                    <ArrowDownToLine className="h-3.5 w-3.5" /> Koppla
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
