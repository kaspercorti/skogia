import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type ActivityFormData = {
  property_id: string;
  stand_id: string;
  type: string;
  custom_type: string;
  planned_date: string;
  estimated_income: string;
  estimated_cost: string;
  notes: string;
  has_subsidy: boolean;
  subsidy_type: string;
  subsidy_amount: string;
  subsidy_status: string;
  subsidy_date: string;
  subsidy_notes: string;
  // Harvest / volume fields
  harvested_volume_m3sk: string;
  sold_volume_m3sk: string;
  price_per_m3sk: string;
  total_revenue: string;
  cost_per_m3sk: string;
  // New type-specific fields
  area_ha: string;
  length_meters: string;
  plant_count: string;
  plants_per_ha: string;
  fertilizer_amount: string;
  fertilizer_unit: string;
  cost_per_ha: string;
  cost_per_meter: string;
  total_cost: string;
  work_description: string;
  quantity: string;
  quantity_unit: string;
  tree_species: string;
  work_type: string;
  // Completion
  is_completed: boolean;
  completed_date: string;
  affects_forest_plan: boolean;
};

export const emptyActivityForm: ActivityFormData = {
  property_id: "", stand_id: "", type: "", custom_type: "", planned_date: "",
  estimated_income: "", estimated_cost: "", notes: "",
  has_subsidy: false, subsidy_type: "", subsidy_amount: "", subsidy_status: "planned", subsidy_date: "", subsidy_notes: "",
  harvested_volume_m3sk: "", sold_volume_m3sk: "", price_per_m3sk: "", total_revenue: "", cost_per_m3sk: "",
  area_ha: "", length_meters: "", plant_count: "", plants_per_ha: "", fertilizer_amount: "", fertilizer_unit: "kg/ha",
  cost_per_ha: "", cost_per_meter: "", total_cost: "", work_description: "", quantity: "", quantity_unit: "",
  tree_species: "", work_type: "",
  is_completed: false, completed_date: "", affects_forest_plan: true,
};

type Stand = { id: string; name: string; volume_m3sk: number | null; area_ha: number };

// Which activity types affect stand volume (harvest)
export const HARVEST_TYPES = ["slutavverkning", "gallring"];

// Category groupings for section headers
type FieldCategory = "volume" | "area_cost" | "planting" | "length_cost" | "description_cost" | "fertilizer" | "road";

function getFieldCategory(type: string): FieldCategory | null {
  switch (type) {
    case "slutavverkning":
    case "gallring":
      return "volume";
    case "röjning":
    case "markberedning":
    case "hyggesrensning":
      return "area_cost";
    case "plantering":
      return "planting";
    case "dikesrensning":
    case "skyddsdikning":
      return "length_cost";
    case "vägunderhåll":
      return "road";
    case "gödsling":
      return "fertilizer";
    case "naturvårdande skötsel":
    case "naturvårdsåtgärd":
    case "kantzonsskötsel":
      return "description_cost";
    case "övrigt":
      return "description_cost";
    default:
      return null;
  }
}

const sectionTitles: Record<FieldCategory, string> = {
  volume: "Volym & intäkt",
  area_cost: "Areal & kostnad",
  planting: "Plantor & etablering",
  length_cost: "Längd & kostnad",
  description_cost: "Beskrivning & kostnad",
  fertilizer: "Gödsling & kostnad",
  road: "Vägarbete & kostnad",
};

const fmt = (n: number) => n.toLocaleString("sv-SE");

interface Props {
  data: ActivityFormData;
  onChange: (data: ActivityFormData) => void;
  stands: Stand[];
}

export default function ActivityFormFields({ data, onChange, stands }: Props) {
  const category = getFieldCategory(data.type);
  if (!category) return null;

  const set = (patch: Partial<ActivityFormData>) => onChange({ ...data, ...patch });

  const selectedStand = data.stand_id && data.stand_id !== "none" ? stands.find(s => s.id === data.stand_id) : null;

  return (
    <div className="rounded-lg border border-border p-3 space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{sectionTitles[category]}</p>

      {category === "volume" && <VolumeFields data={data} set={set} selectedStand={selectedStand} />}
      {category === "area_cost" && <AreaCostFields data={data} set={set} />}
      {category === "planting" && <PlantingFields data={data} set={set} />}
      {category === "length_cost" && <LengthCostFields data={data} set={set} showArea={data.type === "skyddsdikning"} />}
      {category === "road" && <RoadFields data={data} set={set} />}
      {category === "fertilizer" && <FertilizerFields data={data} set={set} />}
      {category === "description_cost" && <DescriptionCostFields data={data} set={set} isOvrigt={data.type === "övrigt"} showSubsidy={["naturvårdande skötsel", "naturvårdsåtgärd"].includes(data.type)} />}

      {/* Impact preview for harvest types */}
      {category === "volume" && data.is_completed && selectedStand && Number(data.harvested_volume_m3sk) > 0 && (() => {
        const currentVol = selectedStand.volume_m3sk ?? 0;
        const harvested = Number(data.harvested_volume_m3sk) || 0;
        const newVol = currentVol - harvested;
        const overLimit = harvested > currentVol;
        return (
          <div className={cn("rounded-md p-2 text-xs space-y-0.5", overLimit ? "bg-destructive/10 border border-destructive/30" : "bg-muted/50")}>
            <p className="font-semibold text-muted-foreground mb-1">Påverkan på bestånd: {selectedStand.name}</p>
            <div className="flex justify-between"><span className="text-muted-foreground">Nuvarande virkesförråd:</span><span className="text-foreground">{fmt(currentVol)} m³sk</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Uttag:</span><span className="text-foreground">−{fmt(harvested)} m³sk</span></div>
            <div className={cn("flex justify-between border-t border-border pt-0.5 font-semibold", overLimit ? "text-destructive" : "text-primary")}>
              <span>Kvar i beståndet:</span><span>{fmt(Math.max(0, newVol))} m³sk</span>
            </div>
            {overLimit && <p className="text-destructive font-medium mt-1">⚠ Uttaget överstiger tillgängligt virkesförråd!</p>}
          </div>
        );
      })()}

      {category === "volume" && data.is_completed && (
        <label className="flex items-center gap-2 cursor-pointer pt-1">
          <input type="checkbox" checked={data.affects_forest_plan} onChange={e => set({ affects_forest_plan: e.target.checked })} className="rounded border-input h-4 w-4 accent-primary" />
          <span className="text-xs font-medium text-foreground">Uppdatera skogsbruksplan automatiskt</span>
        </label>
      )}
    </div>
  );
}

// ─── Volume fields (slutavverkning, gallring) ───
function VolumeFields({ data, set, selectedStand }: { data: ActivityFormData; set: (p: Partial<ActivityFormData>) => void; selectedStand: Stand | null | undefined }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Uttag / såld volym (m³sk)</Label>
          <Input type="number" placeholder="0" className="h-8 text-sm" value={data.harvested_volume_m3sk} onChange={e => {
            const v = e.target.value;
            const price = Number(data.price_per_m3sk) || 0;
            const autoRev = price && Number(v) ? (price * Number(v)).toString() : data.total_revenue;
            set({ harvested_volume_m3sk: v, sold_volume_m3sk: v, total_revenue: autoRev });
          }} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Pris per m³sk (kr)</Label>
          <Input type="number" placeholder="Valfritt" className="h-8 text-sm" value={data.price_per_m3sk} onChange={e => {
            const p = e.target.value;
            const vol = Number(data.harvested_volume_m3sk) || 0;
            const autoRev = Number(p) && vol ? (Number(p) * vol).toString() : "";
            set({ price_per_m3sk: p, total_revenue: autoRev, estimated_income: autoRev });
          }} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Total intäkt (kr)</Label>
        <Input type="number" placeholder="Beräknas automatiskt" className="h-8 text-sm" value={data.total_revenue} onChange={e => set({ total_revenue: e.target.value, estimated_income: e.target.value })} />
      </div>
    </>
  );
}

// ─── Area + cost fields (röjning, markberedning, hyggesrensning) ───
function AreaCostFields({ data, set }: { data: ActivityFormData; set: (p: Partial<ActivityFormData>) => void }) {
  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Areal (ha)</Label>
          <Input type="number" step="0.1" placeholder="0" className="h-8 text-sm" value={data.area_ha} onChange={e => {
            const area = e.target.value;
            const cph = Number(data.cost_per_ha) || 0;
            const tc = Number(area) && cph ? Math.round(Number(area) * cph).toString() : data.total_cost;
            set({ area_ha: area, total_cost: tc, estimated_cost: tc });
          }} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Kostnad per ha (kr)</Label>
          <Input type="number" placeholder="0" className="h-8 text-sm" value={data.cost_per_ha} onChange={e => {
            const cph = e.target.value;
            const area = Number(data.area_ha) || 0;
            const tc = area && Number(cph) ? Math.round(area * Number(cph)).toString() : "";
            set({ cost_per_ha: cph, total_cost: tc, estimated_cost: tc });
          }} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Total kostnad (kr)</Label>
          <Input type="number" placeholder="Beräknas" className="h-8 text-sm" value={data.total_cost} onChange={e => set({ total_cost: e.target.value, estimated_cost: e.target.value })} />
        </div>
      </div>
      {Number(data.total_cost) > 0 && (
        <div className="rounded-md bg-muted/50 p-2 text-xs">
          <div className="flex justify-between"><span className="text-muted-foreground">Total kostnad:</span><span className="text-foreground">{Number(data.total_cost).toLocaleString("sv-SE")} kr</span></div>
        </div>
      )}
    </>
  );
}

// ─── Planting fields ───
function PlantingFields({ data, set }: { data: ActivityFormData; set: (p: Partial<ActivityFormData>) => void }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Areal (ha)</Label>
          <Input type="number" step="0.1" placeholder="0" className="h-8 text-sm" value={data.area_ha} onChange={e => {
            const area = e.target.value;
            const count = Number(data.plant_count) || 0;
            const pph = Number(area) > 0 && count > 0 ? Math.round(count / Number(area)).toString() : data.plants_per_ha;
            set({ area_ha: area, plants_per_ha: pph });
          }} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Trädslag</Label>
          <Input placeholder="T.ex. Gran, Tall" className="h-8 text-sm" value={data.tree_species} onChange={e => set({ tree_species: e.target.value })} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Antal plantor</Label>
          <Input type="number" placeholder="0" className="h-8 text-sm" value={data.plant_count} onChange={e => {
            const count = e.target.value;
            const area = Number(data.area_ha) || 0;
            const pph = area > 0 && Number(count) > 0 ? Math.round(Number(count) / area).toString() : "";
            set({ plant_count: count, plants_per_ha: pph });
          }} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Plantor per ha</Label>
          <Input type="number" placeholder="Beräknas" className="h-8 text-sm bg-muted/30" value={data.plants_per_ha} readOnly />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Total kostnad (kr)</Label>
          <Input type="number" placeholder="0" className="h-8 text-sm" value={data.total_cost} onChange={e => set({ total_cost: e.target.value, estimated_cost: e.target.value })} />
        </div>
      </div>
      {(Number(data.plant_count) > 0 || Number(data.total_cost) > 0) && (
        <div className="rounded-md bg-muted/50 p-2 text-xs space-y-0.5">
          {Number(data.plant_count) > 0 && Number(data.total_cost) > 0 && (
            <div className="flex justify-between"><span className="text-muted-foreground">Kostnad per planta:</span><span className="text-foreground">{(Number(data.total_cost) / Number(data.plant_count)).toFixed(2)} kr</span></div>
          )}
          {Number(data.plants_per_ha) > 0 && (
            <div className="flex justify-between"><span className="text-muted-foreground">Plantor per ha:</span><span className="text-foreground">{Number(data.plants_per_ha).toLocaleString("sv-SE")} st</span></div>
          )}
        </div>
      )}
    </>
  );
}

// ─── Length + cost fields (dikesrensning, skyddsdikning) ───
function LengthCostFields({ data, set, showArea }: { data: ActivityFormData; set: (p: Partial<ActivityFormData>) => void; showArea: boolean }) {
  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Längd (meter)</Label>
          <Input type="number" placeholder="0" className="h-8 text-sm" value={data.length_meters} onChange={e => {
            const len = e.target.value;
            const cpm = Number(data.cost_per_meter) || 0;
            const tc = Number(len) && cpm ? Math.round(Number(len) * cpm).toString() : data.total_cost;
            set({ length_meters: len, total_cost: tc, estimated_cost: tc });
          }} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Kostnad per meter (kr)</Label>
          <Input type="number" placeholder="0" className="h-8 text-sm" value={data.cost_per_meter} onChange={e => {
            const cpm = e.target.value;
            const len = Number(data.length_meters) || 0;
            const tc = len && Number(cpm) ? Math.round(len * Number(cpm)).toString() : "";
            set({ cost_per_meter: cpm, total_cost: tc, estimated_cost: tc });
          }} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Total kostnad (kr)</Label>
          <Input type="number" placeholder="Beräknas" className="h-8 text-sm" value={data.total_cost} onChange={e => set({ total_cost: e.target.value, estimated_cost: e.target.value })} />
        </div>
      </div>
      {showArea && (
        <div className="space-y-1.5">
          <Label className="text-xs">Areal (ha) – om relevant</Label>
          <Input type="number" step="0.1" placeholder="0" className="h-8 text-sm" value={data.area_ha} onChange={e => set({ area_ha: e.target.value })} />
        </div>
      )}
      {Number(data.total_cost) > 0 && (
        <div className="rounded-md bg-muted/50 p-2 text-xs">
          <div className="flex justify-between"><span className="text-muted-foreground">Total kostnad:</span><span className="text-foreground">{Number(data.total_cost).toLocaleString("sv-SE")} kr</span></div>
        </div>
      )}
    </>
  );
}

// ─── Road fields (vägunderhåll) ───
function RoadFields({ data, set }: { data: ActivityFormData; set: (p: Partial<ActivityFormData>) => void }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Sträcka (meter)</Label>
          <Input type="number" placeholder="0" className="h-8 text-sm" value={data.length_meters} onChange={e => set({ length_meters: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Typ av arbete</Label>
          <Input placeholder="T.ex. grusning, dikning" className="h-8 text-sm" value={data.work_type} onChange={e => set({ work_type: e.target.value })} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Total kostnad (kr)</Label>
        <Input type="number" placeholder="0" className="h-8 text-sm" value={data.total_cost} onChange={e => set({ total_cost: e.target.value, estimated_cost: e.target.value })} />
      </div>
    </>
  );
}

// ─── Fertilizer fields (gödsling) ───
function FertilizerFields({ data, set }: { data: ActivityFormData; set: (p: Partial<ActivityFormData>) => void }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Areal (ha)</Label>
          <Input type="number" step="0.1" placeholder="0" className="h-8 text-sm" value={data.area_ha} onChange={e => {
            const area = e.target.value;
            const cph = Number(data.cost_per_ha) || 0;
            const tc = Number(area) && cph ? Math.round(Number(area) * cph).toString() : data.total_cost;
            set({ area_ha: area, total_cost: tc, estimated_cost: tc });
          }} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Mängd gödsel</Label>
          <Input type="number" placeholder="0" className="h-8 text-sm" value={data.fertilizer_amount} onChange={e => set({ fertilizer_amount: e.target.value })} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Enhet</Label>
          <Select value={data.fertilizer_unit} onValueChange={v => set({ fertilizer_unit: v })}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="kg/ha">kg/ha</SelectItem>
              <SelectItem value="total kg">Total kg</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Kostnad per ha (kr)</Label>
          <Input type="number" placeholder="0" className="h-8 text-sm" value={data.cost_per_ha} onChange={e => {
            const cph = e.target.value;
            const area = Number(data.area_ha) || 0;
            const tc = area && Number(cph) ? Math.round(area * Number(cph)).toString() : "";
            set({ cost_per_ha: cph, total_cost: tc, estimated_cost: tc });
          }} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Total kostnad (kr)</Label>
          <Input type="number" placeholder="Beräknas" className="h-8 text-sm" value={data.total_cost} onChange={e => set({ total_cost: e.target.value, estimated_cost: e.target.value })} />
        </div>
      </div>
    </>
  );
}

// ─── Description + cost fields (naturvård, kantzonsskötsel, övrigt) ───
function DescriptionCostFields({ data, set, isOvrigt, showSubsidy }: { data: ActivityFormData; set: (p: Partial<ActivityFormData>) => void; isOvrigt: boolean; showSubsidy: boolean }) {
  return (
    <>
      {isOvrigt && (
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Mängd</Label>
            <Input type="number" placeholder="0" className="h-8 text-sm" value={data.quantity} onChange={e => set({ quantity: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Enhet</Label>
            <Input placeholder="T.ex. st, m, ha" className="h-8 text-sm" value={data.quantity_unit} onChange={e => set({ quantity_unit: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Total kostnad (kr)</Label>
            <Input type="number" placeholder="0" className="h-8 text-sm" value={data.total_cost} onChange={e => set({ total_cost: e.target.value, estimated_cost: e.target.value })} />
          </div>
        </div>
      )}
      {!isOvrigt && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Areal (ha){data.type === "kantzonsskötsel" ? " eller längd (m)" : ""}</Label>
              <Input type="number" step="0.1" placeholder="0" className="h-8 text-sm" value={data.area_ha} onChange={e => set({ area_ha: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Kostnad (kr)</Label>
              <Input type="number" placeholder="0" className="h-8 text-sm" value={data.total_cost} onChange={e => set({ total_cost: e.target.value, estimated_cost: e.target.value })} />
            </div>
          </div>
          {data.type === "kantzonsskötsel" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Längd (meter) – alternativt</Label>
              <Input type="number" placeholder="0" className="h-8 text-sm" value={data.length_meters} onChange={e => set({ length_meters: e.target.value })} />
            </div>
          )}
        </>
      )}
      <div className="space-y-1.5">
        <Label className="text-xs">Beskrivning av åtgärd</Label>
        <Textarea placeholder="Beskriv åtgärden..." rows={2} className="text-sm" value={data.work_description} onChange={e => set({ work_description: e.target.value })} />
      </div>
    </>
  );
}
