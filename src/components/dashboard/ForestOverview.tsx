import { TreePine, Axe, Sprout } from "lucide-react";
import { useStands } from "@/hooks/useSkogskollData";

const iconMap: Record<string, any> = {
  slutavverkning: Axe,
  gallring: TreePine,
  röjning: Sprout,
};

export default function ForestOverview() {
  const { data: stands = [] } = useStands();

  return (
    <div className="bg-card rounded-xl border border-border p-5 opacity-0 animate-fade-in" style={{ animationDelay: "300ms" }}>
      <h3 className="font-display text-lg text-card-foreground mb-4">Skogsinnehav</h3>
      <div className="space-y-3">
        {stands.length === 0 && <p className="text-sm text-muted-foreground">Inga bestånd.</p>}
        {stands.map((stand) => {
          const Icon = iconMap[stand.planned_action || ""] || TreePine;
          return (
            <div key={stand.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-card-foreground">{stand.name}</p>
                <p className="text-xs text-muted-foreground">{stand.area_ha} ha · {stand.volume_m3sk ?? 0} m³sk</p>
              </div>
              <span className="text-xs text-muted-foreground bg-background px-2 py-1 rounded-md border border-border shrink-0">
                {stand.planned_action ? `${stand.planned_action} ${stand.planned_year || ""}` : "Ingen åtgärd"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
