import { TrendingUp } from "lucide-react";

export default function Prognoser() {
  return (
    <main className="flex-1 p-6 md:p-10">
      <div className="flex items-center gap-3 mb-8">
        <TrendingUp className="h-8 w-8 text-primary" />
        <h1 className="font-display text-3xl font-bold text-foreground">Prognoser</h1>
      </div>
      <div className="rounded-xl border border-border bg-card p-8 text-card-foreground">
        <p className="text-muted-foreground">Ekonomiska prognoser baserade på skogsbruksplanen, virkespriser och planerade avverkningar.</p>
      </div>
    </main>
  );
}
