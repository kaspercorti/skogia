import { Wallet, TrendingUp, TreePine, Receipt, Calculator, CalendarClock, Zap, ArrowRight, ChevronRight, AlertTriangle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import StatCard from "@/components/dashboard/StatCard";
import CashFlowChart from "@/components/dashboard/CashFlowChart";
import ForestOverview from "@/components/dashboard/ForestOverview";
import RecentTransactions from "@/components/dashboard/RecentTransactions";
import { useNavigate } from "react-router-dom";

const fmt = (n: number) => n.toLocaleString("sv-SE") + " kr";

export default function Index() {
  const navigate = useNavigate();

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="px-4 md:px-6 py-5 border-b border-border">
        <h1 className="text-2xl font-display text-foreground">Översikt</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Din skogsverksamhet – beslut & status</p>
      </header>

      <main className="p-4 md:p-6 space-y-5 max-w-7xl">
        {/* Decision banner – next action */}
        <div
          className="rounded-xl border-2 border-primary/30 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 p-4 md:p-5 cursor-pointer hover:shadow-sm transition-all relative overflow-hidden"
          onClick={() => navigate("/prognoser")}
        >
          <div className="absolute top-2 right-2 opacity-10">
            <Zap className="h-16 w-16 text-primary" />
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
            <Zap className="h-3.5 w-3.5 text-accent" /> Nästa beslut
          </p>
          <p className="font-display text-lg md:text-xl font-bold text-foreground">
            Avverka Avd 4 – Stormyran i år <ArrowRight className="inline h-5 w-5 text-accent mx-1" /> <span className="text-primary">+1 786 000 kr</span>
          </p>
          <p className="text-sm text-muted-foreground mt-0.5">
            3 800 m³sk tall/gran/löv · planerad slutavverkning 2025
          </p>
          <div className="flex items-center gap-1 mt-2 text-xs text-primary font-medium">
            Se prognos <ChevronRight className="h-3 w-3" />
          </div>
        </div>

        {/* Stat cards – 6 columns */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard icon={Wallet} title="Saldo" value="342 000 kr" change="+12% från förra året" changeType="positive" delay={0} />
          <StatCard icon={TrendingUp} title="Resultat 2024" value="453 400 kr" change="+8% mot budget" changeType="positive" delay={50} />
          <StatCard icon={TreePine} title="Skogsareal" value="64.7 ha" change="6 bestånd" changeType="neutral" delay={100} />
          <StatCard icon={Receipt} title="Öppna fakturor" value="352 000 kr" change="3 obetalda" changeType="negative" delay={150} />
          <StatCard icon={Calculator} title="Skatt (prognos)" value="106 200 kr" change="Beräknad 2024" changeType="neutral" delay={200} />
          <StatCard icon={CalendarClock} title="Kommande intäkt" value="990 000 kr" change="Avverkning 2025" changeType="positive" delay={250} />
        </div>

        {/* Action cards row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Nästa åtgärd */}
          <div
            className="rounded-xl border border-border bg-card p-4 cursor-pointer hover:border-primary/30 transition-all"
            onClick={() => navigate("/skogsbruksplan")}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <TreePine className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm font-semibold text-card-foreground">Nästa i skogen</span>
            </div>
            <p className="text-base font-display font-bold text-foreground">Röjning – Avd 3</p>
            <p className="text-xs text-muted-foreground mt-0.5">Björkängen, 5.7 ha · planerad 2025</p>
            <div className="flex items-center gap-1 mt-2 text-xs text-primary font-medium">
              Öppna skogsbruksplan <ChevronRight className="h-3 w-3" />
            </div>
          </div>

          {/* Förfallna fakturor */}
          <div
            className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 cursor-pointer hover:border-destructive/40 transition-all"
            onClick={() => navigate("/fakturering")}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </div>
              <span className="text-sm font-semibold text-card-foreground">Förfallna fakturor</span>
            </div>
            <p className="text-base font-display font-bold text-destructive">107 000 kr</p>
            <p className="text-xs text-muted-foreground mt-0.5">2 fakturor har passerat förfallodatum</p>
            <div className="flex items-center gap-1 mt-2 text-xs text-destructive font-medium">
              Hantera fakturor <ChevronRight className="h-3 w-3" />
            </div>
          </div>

          {/* Skatteoptimering */}
          <div
            className="rounded-xl border border-accent/20 bg-accent/5 p-4 cursor-pointer hover:border-accent/40 transition-all"
            onClick={() => navigate("/skatteplanering")}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center">
                <Calculator className="h-4 w-4 text-accent" />
              </div>
              <span className="text-sm font-semibold text-card-foreground">Skattetips</span>
            </div>
            <p className="text-base font-display font-bold text-accent">Spara 85 000 kr</p>
            <p className="text-xs text-muted-foreground mt-0.5">Skjut avverkningen → lägre marginalskatt</p>
            <div className="flex items-center gap-1 mt-2 text-xs text-accent font-medium">
              Simulera <ChevronRight className="h-3 w-3" />
            </div>
          </div>
        </div>

        {/* Charts + Forest */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <CashFlowChart />
          <ForestOverview />
        </div>

        {/* Recent transactions */}
        <RecentTransactions />
      </main>
    </div>
  );
}
