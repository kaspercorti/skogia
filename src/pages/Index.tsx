import { Wallet, TrendingUp, TreePine, Receipt } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import CashFlowChart from "@/components/dashboard/CashFlowChart";
import ForestOverview from "@/components/dashboard/ForestOverview";
import RecentTransactions from "@/components/dashboard/RecentTransactions";
import UpcomingInvoices from "@/components/dashboard/UpcomingInvoices";

export default function Index() {
  return (
    <div className="flex-1 overflow-y-auto">
      <header className="px-6 py-5 border-b border-border">
        <h1 className="text-2xl font-display text-foreground">Översikt</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Ekonomisk sammanfattning för din skogsverksamhet</p>
      </header>

      <main className="p-6 space-y-6 max-w-7xl">
        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Wallet} title="Saldo" value="487 200 kr" change="+12% från förra året" changeType="positive" delay={0} />
          <StatCard icon={TrendingUp} title="Årets resultat" value="345 000 kr" change="+8% mot budget" changeType="positive" delay={50} />
          <StatCard icon={TreePine} title="Skogsareal" value="42.5 ha" change="4 bestånd" changeType="neutral" delay={100} />
          <StatCard icon={Receipt} title="Öppna fakturor" value="197 000 kr" change="2 obetalda" changeType="negative" delay={150} />
        </div>

        {/* Charts + Forest */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CashFlowChart />
          <ForestOverview />
        </div>

        {/* Transactions + Invoices */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RecentTransactions />
          <UpcomingInvoices />
        </div>
      </main>
    </div>
  );
}
