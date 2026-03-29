import { Wallet, TrendingUp, TreePine, Receipt, Calculator, CalendarClock, Zap, ArrowRight, ChevronRight, AlertTriangle, Clock } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import CashFlowChart from "@/components/dashboard/CashFlowChart";
import ForestOverview from "@/components/dashboard/ForestOverview";
import RecentTransactions from "@/components/dashboard/RecentTransactions";
import { useNavigate } from "react-router-dom";
import {
  useProperties, useStands, useTransactions, useInvoices, useForestActivities,
  useBankAccounts, useTaxAccounts,
  fmt, calcSaldo, calcResultat, calcTotalArea, calcOpenInvoices, calcOverdueInvoices, calcUpcomingIncome, calcEstimatedTax,
} from "@/hooks/useSkogskollData";

export default function Index() {
  const navigate = useNavigate();
  const { data: properties = [] } = useProperties();
  const { data: stands = [] } = useStands();
  const { data: transactions = [] } = useTransactions();
  const { data: invoices = [] } = useInvoices();
  const { data: activities = [] } = useForestActivities();
  const { data: bankAccounts = [] } = useBankAccounts();
  const { data: taxAccounts = [] } = useTaxAccounts();

  const year = new Date().getFullYear();
  const saldo = bankAccounts.reduce((s, a) => s + a.current_balance, 0);
  const resultat = calcResultat(transactions, year);
  const totalArea = calcTotalArea(properties);
  const openInvoiceAmount = calcOpenInvoices(invoices);
  const overdueInvoices = calcOverdueInvoices(invoices);
  const upcomingIncome = calcUpcomingIncome(activities);
  const estimatedTax = calcEstimatedTax(resultat);

  // Find biggest planned activity for decision banner
  const biggestActivity = activities
    .filter(a => a.status === "planned")
    .sort((a, b) => b.estimated_income - a.estimated_income)[0];

  const overdueTotal = overdueInvoices.reduce((s, i) => s + i.amount_inc_vat, 0);

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="px-4 md:px-6 py-5 border-b border-border">
        <h1 className="text-2xl font-display text-foreground">Översikt</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Din skogsverksamhet – beslut & status</p>
      </header>

      <main className="p-4 md:p-6 space-y-5 max-w-7xl">
        {/* Decision banner */}
        {biggestActivity && (
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
              {biggestActivity.type} <ArrowRight className="inline h-5 w-5 text-accent mx-1" /> <span className="text-primary">+{fmt(biggestActivity.estimated_income)}</span>
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {biggestActivity.notes || "Planerad åtgärd"}
            </p>
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard icon={Wallet} title="Saldo" value={fmt(saldo)} change={`${bankAccounts.length} konton`} changeType="neutral" delay={0} />
          <StatCard icon={TrendingUp} title={`Resultat ${year}`} value={fmt(resultat)} change={resultat >= 0 ? "Positivt" : "Negativt"} changeType={resultat >= 0 ? "positive" : "negative"} delay={50} />
          <StatCard icon={TreePine} title="Skogsareal" value={`${totalArea.toFixed(1)} ha`} change={`${stands.length} bestånd`} changeType="neutral" delay={100} />
          <StatCard icon={Receipt} title="Öppna fakturor" value={fmt(openInvoiceAmount)} change={`${invoices.filter(i => i.status === "unpaid" || i.status === "overdue").length} obetalda`} changeType="negative" delay={150} />
          <StatCard icon={Calculator} title="Skatt (prognos)" value={fmt(estimatedTax)} change={`Beräknad ${year}`} changeType="neutral" delay={200} />
          <StatCard icon={CalendarClock} title="Kommande intäkt" value={fmt(upcomingIncome)} change={`${activities.filter(a => a.status === "planned").length} planerade`} changeType="positive" delay={250} />
        </div>

        {/* Action cards row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Nästa åtgärd */}
          {activities.filter(a => a.status === "planned").length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4 cursor-pointer hover:border-primary/30 transition-all" onClick={() => navigate("/skogsbruksplan")}>
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center"><TreePine className="h-4 w-4 text-primary" /></div>
                <span className="text-sm font-semibold text-card-foreground">Nästa i skogen</span>
              </div>
              <p className="text-base font-display font-bold text-foreground">{activities.filter(a => a.status === "planned")[0]?.type}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{activities.filter(a => a.status === "planned")[0]?.notes}</p>
              <div className="flex items-center gap-1 mt-2 text-xs text-primary font-medium">Öppna skogsbruksplan <ChevronRight className="h-3 w-3" /></div>
            </div>
          )}

          {/* Förfallna fakturor */}
          {overdueInvoices.length > 0 && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 cursor-pointer hover:border-destructive/40 transition-all" onClick={() => navigate("/fakturering")}>
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center"><AlertTriangle className="h-4 w-4 text-destructive" /></div>
                <span className="text-sm font-semibold text-card-foreground">Förfallna fakturor</span>
              </div>
              <p className="text-base font-display font-bold text-destructive">{fmt(overdueTotal)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{overdueInvoices.length} fakturor har passerat förfallodatum</p>
              <div className="flex items-center gap-1 mt-2 text-xs text-destructive font-medium">Hantera fakturor <ChevronRight className="h-3 w-3" /></div>
            </div>
          )}

          {/* Skatteoptimering */}
          <div className="rounded-xl border border-accent/20 bg-accent/5 p-4 cursor-pointer hover:border-accent/40 transition-all" onClick={() => navigate("/skatteplanering")}>
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center"><Calculator className="h-4 w-4 text-accent" /></div>
              <span className="text-sm font-semibold text-card-foreground">Skattetips</span>
            </div>
            <p className="text-base font-display font-bold text-accent">Beräknad skatt: {fmt(estimatedTax)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Se simuleringar och optimera</p>
            <div className="flex items-center gap-1 mt-2 text-xs text-accent font-medium">Simulera <ChevronRight className="h-3 w-3" /></div>
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
