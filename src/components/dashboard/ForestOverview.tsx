import { TreePine, Axe, Sprout } from "lucide-react";

const stands = [
  { name: "Norra skiftet", area: "12.5 ha", volume: "2 400 m³sk", action: "Gallring 2025", type: "gallring" as const },
  { name: "Södra skiftet", area: "8.2 ha", volume: "1 850 m³sk", action: "Slutavverkning 2026", type: "avverkning" as const },
  { name: "Västra skiftet", area: "15.0 ha", volume: "950 m³sk", action: "Plantering klar", type: "plantering" as const },
  { name: "Östra skiftet", area: "6.8 ha", volume: "3 100 m³sk", action: "Ingen åtgärd", type: "gallring" as const },
];

const iconMap = {
  gallring: TreePine,
  avverkning: Axe,
  plantering: Sprout,
};

export default function ForestOverview() {
  return (
    <div className="bg-card rounded-xl border border-border p-5 opacity-0 animate-fade-in" style={{ animationDelay: "300ms" }}>
      <h3 className="font-display text-lg text-card-foreground mb-4">Skogsinnehav</h3>
      <div className="space-y-3">
        {stands.map((stand) => {
          const Icon = iconMap[stand.type];
          return (
            <div
              key={stand.name}
              className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
            >
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-card-foreground">{stand.name}</p>
                <p className="text-xs text-muted-foreground">{stand.area} · {stand.volume}</p>
              </div>
              <span className="text-xs text-muted-foreground bg-background px-2 py-1 rounded-md border border-border shrink-0">
                {stand.action}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
