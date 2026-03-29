import { Link } from "lucide-react";

export default function Integrationer() {
  return (
    <main className="flex-1 p-6 md:p-10">
      <div className="flex items-center gap-3 mb-8">
        <Link className="h-8 w-8 text-primary" />
        <h1 className="font-display text-3xl font-bold text-foreground">Integrationer</h1>
      </div>
      <div className="rounded-xl border border-border bg-card p-8 text-card-foreground">
        <p className="text-muted-foreground">Koppla ihop Skogskoll med banker, Skatteverket och andra tjänster.</p>
      </div>
    </main>
  );
}
