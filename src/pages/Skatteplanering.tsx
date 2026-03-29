import { Calculator } from "lucide-react";

export default function Skatteplanering() {
  return (
    <main className="flex-1 p-6 md:p-10">
      <div className="flex items-center gap-3 mb-8">
        <Calculator className="h-8 w-8 text-primary" />
        <h1 className="font-display text-3xl font-bold text-foreground">Skatteplanering</h1>
      </div>
      <div className="rounded-xl border border-border bg-card p-8 text-card-foreground">
        <p className="text-muted-foreground">Planera skogskonto, räntefördelning, periodiseringsfonder och andra skatteoptimeringar.</p>
      </div>
    </main>
  );
}
