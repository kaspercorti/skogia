import { useState, useMemo } from "react";
import { TreePine, ChevronRight, ArrowLeft, Calendar, Trees, Plus, MapPin, Trash2 } from "lucide-react";
import ForestPlanImport from "@/components/forest/ForestPlanImport";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { useProperties, useStands, useForestActivities, useTransactions, fmt as fmtKr } from "@/hooks/useSkogskollData";
import CarbonCreditsSection from "@/components/forest/CarbonCreditsSection";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useQueryClient } from "@tanstack/react-query";

export default function Skogsbruksplan() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: properties = [] } = useProperties();
  const { data: stands = [] } = useStands();
  const { data: activities = [] } = useForestActivities();
  const { data: transactions = [] } = useTransactions();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Dialog state
  const [propDialogOpen, setPropDialogOpen] = useState(false);
  const [standDialogOpen, setStandDialogOpen] = useState(false);
  const [actDialogOpen, setActDialogOpen] = useState(false);

  // New property form
  const [newProp, setNewProp] = useState({ name: "", municipality: "", total_area_ha: "", productive_forest_ha: "" });
  // New stand form
  const [newStand, setNewStand] = useState({ property_id: "", name: "", tree_species: "", area_ha: "", age: "", volume_m3sk: "", estimated_value: "", growth_rate_percent: "", planned_action: "", planned_year: "", notes: "" });
  // New activity form
  const [newAct, setNewAct] = useState({ property_id: "", stand_id: "", type: "", planned_date: "", estimated_income: "", estimated_cost: "", notes: "" });

  const selected = stands.find(b => b.id === selectedId);
  const fmt = (n: number) => n.toLocaleString("sv-SE");

  const totalStats = useMemo(() => {
    const areal = stands.reduce((s, b) => s + b.area_ha, 0);
    const volym = stands.reduce((s, b) => s + (b.volume_m3sk ?? 0), 0);
    const varde = stands.reduce((s, b) => s + (b.estimated_value ?? 0), 0);
    const tillvaxt = stands.reduce((s, b) => s + (b.volume_m3sk ?? 0) * ((b.growth_rate_percent ?? 0) / 100), 0);
    return { areal, volym, varde, tillvaxt: Math.round(tillvaxt) };
  }, [stands]);

  const handleAddProperty = async () => {
    if (!newProp.name || !user) return;
    const { error } = await supabase.from("properties").insert({
      user_id: user.id,
      name: newProp.name,
      municipality: newProp.municipality || null,
      total_area_ha: Number(newProp.total_area_ha) || 0,
      productive_forest_ha: Number(newProp.productive_forest_ha) || 0,
    });
    if (error) { toast.error("Kunde inte spara: " + error.message); return; }
    queryClient.invalidateQueries({ queryKey: ["properties"] });
    toast.success("Fastighet skapad");
    setNewProp({ name: "", municipality: "", total_area_ha: "", productive_forest_ha: "" });
    setPropDialogOpen(false);
  };

  const handleAddStand = async () => {
    if (!newStand.name || !newStand.property_id || !user) return;
    const { error } = await supabase.from("stands").insert({
      property_id: newStand.property_id,
      name: newStand.name,
      tree_species: newStand.tree_species || null,
      area_ha: Number(newStand.area_ha) || 0,
      age: newStand.age ? Number(newStand.age) : null,
      volume_m3sk: newStand.volume_m3sk ? Number(newStand.volume_m3sk) : null,
      estimated_value: newStand.estimated_value ? Number(newStand.estimated_value) : null,
      growth_rate_percent: newStand.growth_rate_percent ? Number(newStand.growth_rate_percent) : null,
      planned_action: newStand.planned_action || null,
      planned_year: newStand.planned_year ? Number(newStand.planned_year) : null,
      notes: newStand.notes || null,
    });
    if (error) { toast.error("Kunde inte spara: " + error.message); return; }
    queryClient.invalidateQueries({ queryKey: ["stands"] });
    toast.success("Bestånd skapat");
    setNewStand({ property_id: "", name: "", tree_species: "", area_ha: "", age: "", volume_m3sk: "", estimated_value: "", growth_rate_percent: "", planned_action: "", planned_year: "", notes: "" });
    setStandDialogOpen(false);
  };

  const handleAddActivity = async () => {
    if (!newAct.type || !newAct.property_id || !user) return;
    const income = Number(newAct.estimated_income) || 0;
    const cost = Number(newAct.estimated_cost) || 0;
    const { error } = await supabase.from("forest_activities").insert({
      property_id: newAct.property_id,
      stand_id: newAct.stand_id && newAct.stand_id !== "none" ? newAct.stand_id : null,
      type: newAct.type,
      planned_date: newAct.planned_date || null,
      estimated_income: income,
      estimated_cost: cost,
      estimated_net: income - cost,
      status: "planned",
      notes: newAct.notes || null,
    });
    if (error) { toast.error("Kunde inte spara: " + error.message); return; }
    queryClient.invalidateQueries({ queryKey: ["forest_activities"] });
    toast.success("Aktivitet skapad");
    setNewAct({ property_id: "", stand_id: "", type: "", planned_date: "", estimated_income: "", estimated_cost: "", notes: "" });
    setActDialogOpen(false);
  };

  // Stand detail view
  if (selected) {
    const propName = properties.find(p => p.id === selected.property_id)?.name || "";
    const standActivities = activities.filter(a => a.stand_id === selected.id);
    const standTransactions = transactions.filter(t => t.stand_id === selected.id);

    return (
      <main className="flex-1 p-4 md:p-8 overflow-auto">
        <Button variant="ghost" className="gap-2 mb-4 -ml-2 text-muted-foreground" onClick={() => setSelectedId(null)}>
          <ArrowLeft className="h-4 w-4" /> Tillbaka
        </Button>

        <div className="flex items-center gap-3 mb-6">
          <Trees className="h-7 w-7 text-primary" />
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">{selected.name}</h1>
            <p className="text-sm text-muted-foreground">{propName}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <DetailCard label="Areal" value={`${selected.area_ha} ha`} />
          <DetailCard label="Ålder" value={`${selected.age ?? "—"} år`} />
          <DetailCard label="Volym" value={`${fmt(selected.volume_m3sk ?? 0)} m³sk`} />
          <DetailCard label="Trädslag" value={selected.tree_species || "—"} small />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <DetailCard label="Huggningsklass" value={selected.huggningsklass || "—"} small />
          <DetailCard label="Bonitet (SI)" value={selected.site_index || "—"} small />
          <DetailCard label="Medeldiameter" value={selected.mean_diameter_cm ? `${selected.mean_diameter_cm} cm` : "—"} />
          <DetailCard label="Medelhöjd" value={selected.mean_height_m ? `${selected.mean_height_m} m` : "—"} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <DetailCard label="Målklass" value={selected.goal_class || "—"} small />
          <DetailCard label="Grundyta" value={selected.basal_area_m2 ? `${selected.basal_area_m2} m²/ha` : "—"} />
          <DetailCard label="Årlig tillväxt" value={selected.annual_growth_m3sk ? `${selected.annual_growth_m3sk} m³sk` : "—"} />
          <DetailCard label="Uppskattat värde" value={fmtKr(selected.estimated_value ?? 0)} />
        </div>

        {/* Mark & terräng */}
        {(selected.vegetation_type || selected.moisture_class || selected.terrain_type || selected.driving_conditions || selected.gyl_values || selected.slope_info) && (
          <div className="rounded-xl border border-border bg-card p-4 mb-6">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Mark & terräng</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {selected.vegetation_type && <DetailCard label="Vegetationstyp" value={selected.vegetation_type} small />}
              {selected.moisture_class && <DetailCard label="Fuktighet" value={selected.moisture_class} small />}
              {selected.terrain_type && <DetailCard label="Terräng" value={selected.terrain_type} small />}
              {selected.driving_conditions && <DetailCard label="Drivning" value={selected.driving_conditions} small />}
              {selected.gyl_values && <DetailCard label="GYL" value={selected.gyl_values} small />}
              {selected.slope_info && <DetailCard label="Lutning" value={selected.slope_info} small />}
            </div>
          </div>
        )}

        {/* Trädslagsfördelning */}
        {selected.species_breakdown && Array.isArray(selected.species_breakdown) && (selected.species_breakdown as any[]).length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4 mb-6">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Trädslagsfördelning</p>
            <div className="flex flex-wrap gap-3">
              {(selected.species_breakdown as any[]).map((sp: any, i: number) => (
                <div key={i} className="rounded-lg border border-border bg-muted/30 px-3 py-1.5">
                  <span className="text-sm font-medium text-foreground">{sp.species}</span>
                  {sp.percent != null && <span className="text-xs text-muted-foreground ml-1.5">{sp.percent}%</span>}
                  {sp.volume_m3sk != null && <span className="text-xs text-muted-foreground ml-1.5">({sp.volume_m3sk} m³sk)</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Descriptions */}
        {(selected.description || selected.production_goal || selected.general_comment || selected.special_values) && (
          <div className="rounded-xl border border-border bg-card p-4 mb-6 space-y-3">
            {selected.description && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Beskrivning</p>
                <p className="text-sm text-card-foreground">{selected.description}</p>
              </div>
            )}
            {selected.production_goal && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Produktionsmål</p>
                <p className="text-sm text-card-foreground">{selected.production_goal}</p>
              </div>
            )}
            {selected.general_comment && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Kommentar</p>
                <p className="text-sm text-card-foreground">{selected.general_comment}</p>
              </div>
            )}
            {selected.special_values && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Speciella värden</p>
                <p className="text-sm text-card-foreground">{selected.special_values}</p>
              </div>
            )}
          </div>
        )}

        {/* Raw text */}
        {selected.raw_description_text && (
          <div className="rounded-xl border border-border bg-card p-4 mb-6">
            <p className="text-xs text-muted-foreground mb-1">Råtext från skogsbruksplan</p>
            <p className="text-sm text-card-foreground whitespace-pre-wrap font-mono bg-muted/30 p-3 rounded-lg">{selected.raw_description_text}</p>
          </div>
        )}

        <div className="rounded-xl border border-border bg-card p-4 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-card-foreground">Planerad åtgärd</span>
          </div>
          <p className="text-lg font-semibold text-foreground">{selected.planned_action || "Ingen"} <span className="text-muted-foreground font-normal">– {selected.planned_year || "—"}</span></p>
        </div>

        {standActivities.length > 0 && (
          <div className="rounded-xl border border-border bg-card overflow-hidden mb-6">
            <div className="p-4 border-b border-border"><h3 className="font-display text-lg text-card-foreground">Aktiviteter</h3></div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Typ</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Netto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {standActivities.map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="text-sm text-card-foreground">{a.type}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{a.planned_date || "—"}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{a.status}</Badge></TableCell>
                    <TableCell className={cn("text-right text-sm font-semibold tabular-nums", a.estimated_net >= 0 ? "text-primary" : "text-card-foreground")}>
                      {a.estimated_net >= 0 ? "+" : "−"}{fmtKr(Math.abs(a.estimated_net))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="p-4 border-b border-border"><h3 className="font-display text-lg text-card-foreground">Ekonomi – {selected.name}</h3></div>
          {standTransactions.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Inga transaktioner kopplade ännu.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Beskrivning</TableHead>
                  <TableHead className="text-right">Belopp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {standTransactions.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="text-sm text-muted-foreground">{t.date}</TableCell>
                    <TableCell className="text-sm text-card-foreground">{t.description}</TableCell>
                    <TableCell className={cn("text-right text-sm font-semibold tabular-nums", t.type === "income" ? "text-primary" : "text-card-foreground")}>
                      {t.type === "income" ? "+" : "−"}{fmtKr(t.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </main>
    );
  }

  // Stands for activity form filtered by selected property
  const standsForAct = newAct.property_id ? stands.filter(s => s.property_id === newAct.property_id) : [];

  return (
    <main className="flex-1 p-4 md:p-8 overflow-auto">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div className="flex items-center gap-3">
          <TreePine className="h-7 w-7 text-primary" />
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Skogsbruksplan</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Import forest plan */}
          <ForestPlanImport properties={properties} />
          {/* Add Property Dialog */}
          <Dialog open={propDialogOpen} onOpenChange={setPropDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2"><MapPin className="h-4 w-4" /> Lägg till fastighet</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Ny fastighet</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="space-y-1.5">
                  <Label>Namn *</Label>
                  <Input placeholder="T.ex. Sörgården 1:24" value={newProp.name} onChange={e => setNewProp({ ...newProp, name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Kommun</Label>
                  <Input placeholder="T.ex. Ljusdal" value={newProp.municipality} onChange={e => setNewProp({ ...newProp, municipality: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Total areal (ha)</Label>
                    <Input type="number" placeholder="0" value={newProp.total_area_ha} onChange={e => setNewProp({ ...newProp, total_area_ha: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Produktiv skog (ha)</Label>
                    <Input type="number" placeholder="0" value={newProp.productive_forest_ha} onChange={e => setNewProp({ ...newProp, productive_forest_ha: e.target.value })} />
                  </div>
                </div>
                <Button onClick={handleAddProperty} className="mt-2 w-full">Spara fastighet</Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Add Stand Dialog */}
          <Dialog open={standDialogOpen} onOpenChange={setStandDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2"><Trees className="h-4 w-4" /> Lägg till bestånd</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Nytt bestånd</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="space-y-1.5">
                  <Label>Fastighet *</Label>
                  <Select value={newStand.property_id} onValueChange={v => setNewStand({ ...newStand, property_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Välj fastighet..." /></SelectTrigger>
                    <SelectContent>
                      {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Namn *</Label>
                  <Input placeholder="T.ex. Avd 5 – Tallbacken" value={newStand.name} onChange={e => setNewStand({ ...newStand, name: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Trädslag</Label>
                    <Input placeholder="T.ex. Tall" value={newStand.tree_species} onChange={e => setNewStand({ ...newStand, tree_species: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Areal (ha)</Label>
                    <Input type="number" placeholder="0" value={newStand.area_ha} onChange={e => setNewStand({ ...newStand, area_ha: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Ålder (år)</Label>
                    <Input type="number" placeholder="0" value={newStand.age} onChange={e => setNewStand({ ...newStand, age: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Volym (m³sk)</Label>
                    <Input type="number" placeholder="0" value={newStand.volume_m3sk} onChange={e => setNewStand({ ...newStand, volume_m3sk: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Uppskattat värde (kr)</Label>
                    <Input type="number" placeholder="0" value={newStand.estimated_value} onChange={e => setNewStand({ ...newStand, estimated_value: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tillväxt (%)</Label>
                    <Input type="number" step="0.1" placeholder="0" value={newStand.growth_rate_percent} onChange={e => setNewStand({ ...newStand, growth_rate_percent: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Planerad åtgärd</Label>
                    <Select value={newStand.planned_action} onValueChange={v => setNewStand({ ...newStand, planned_action: v })}>
                      <SelectTrigger><SelectValue placeholder="Välj..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="slutavverkning">Slutavverkning</SelectItem>
                        <SelectItem value="gallring">Gallring</SelectItem>
                        <SelectItem value="röjning">Röjning</SelectItem>
                        <SelectItem value="plantering">Plantering</SelectItem>
                        <SelectItem value="ingen åtgärd">Ingen åtgärd</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Planerat år</Label>
                    <Input type="number" placeholder="2025" value={newStand.planned_year} onChange={e => setNewStand({ ...newStand, planned_year: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Anteckningar</Label>
                  <Textarea placeholder="Fritext..." value={newStand.notes} onChange={e => setNewStand({ ...newStand, notes: e.target.value })} />
                </div>
                <Button onClick={handleAddStand} className="mt-2 w-full">Spara bestånd</Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Add Activity Dialog */}
          <Dialog open={actDialogOpen} onOpenChange={setActDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" /> Lägg till aktivitet</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Ny skogsaktivitet</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="space-y-1.5">
                  <Label>Fastighet *</Label>
                  <Select value={newAct.property_id} onValueChange={v => setNewAct({ ...newAct, property_id: v, stand_id: "" })}>
                    <SelectTrigger><SelectValue placeholder="Välj fastighet..." /></SelectTrigger>
                    <SelectContent>
                      {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Bestånd</Label>
                  <Select value={newAct.stand_id} onValueChange={v => setNewAct({ ...newAct, stand_id: v })} disabled={!newAct.property_id}>
                    <SelectTrigger><SelectValue placeholder={newAct.property_id ? "Välj bestånd..." : "Välj fastighet först"} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Inget specifikt</SelectItem>
                      {standsForAct.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Typ *</Label>
                    <Select value={newAct.type} onValueChange={v => setNewAct({ ...newAct, type: v })}>
                      <SelectTrigger><SelectValue placeholder="Välj..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="slutavverkning">Slutavverkning</SelectItem>
                        <SelectItem value="gallring">Gallring</SelectItem>
                        <SelectItem value="röjning">Röjning</SelectItem>
                        <SelectItem value="plantering">Plantering</SelectItem>
                        <SelectItem value="markberedning">Markberedning</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Planerat datum</Label>
                    <Input type="date" value={newAct.planned_date} onChange={e => setNewAct({ ...newAct, planned_date: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Beräknad intäkt (kr)</Label>
                    <Input type="number" placeholder="0" value={newAct.estimated_income} onChange={e => setNewAct({ ...newAct, estimated_income: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Beräknad kostnad (kr)</Label>
                    <Input type="number" placeholder="0" value={newAct.estimated_cost} onChange={e => setNewAct({ ...newAct, estimated_cost: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Anteckningar</Label>
                  <Textarea placeholder="Fritext..." value={newAct.notes} onChange={e => setNewAct({ ...newAct, notes: e.target.value })} />
                </div>
                <Button onClick={handleAddActivity} className="mt-2 w-full">Spara aktivitet</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Properties section */}
      {properties.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          {properties.map(p => {
            const propStands = stands.filter(s => s.property_id === p.id);
            const propArea = propStands.reduce((s, st) => s + st.area_ha, 0);
            return (
              <div key={p.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold text-card-foreground">{p.name}</p>
                </div>
                <p className="text-xs text-muted-foreground">{p.municipality || "—"}</p>
                <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                  <span>{p.total_area_ha} ha total</span>
                  <span>{propStands.length} bestånd</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <SummaryCard label="Total areal" value={`${fmt(totalStats.areal)} ha`} />
        <SummaryCard label="Totalt virkesförråd" value={`${fmt(totalStats.volym)} m³sk`} />
        <SummaryCard label="Uppskattat värde" value={`${fmtKr(totalStats.varde)}`} highlight />
        <SummaryCard label="Årlig tillväxt" value={`${fmt(totalStats.tillvaxt)} m³sk`} />
      </div>

      {/* Carbon Credits Section */}
      <div className="mt-6">
        <CarbonCreditsSection stands={stands} />
      </div>

      <div className="mt-6 rounded-xl border border-border bg-card overflow-hidden overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bestånd</TableHead>
              <TableHead>Areal</TableHead>
              <TableHead>Ålder</TableHead>
              <TableHead>Hkl</TableHead>
              <TableHead>Bonitet</TableHead>
              <TableHead>Trädslag</TableHead>
              <TableHead className="text-right">Volym</TableHead>
              <TableHead className="text-right">Diam (cm)</TableHead>
              <TableHead className="text-right">Höjd (m)</TableHead>
              <TableHead>Målklass</TableHead>
              <TableHead className="text-right">G-yta</TableHead>
              <TableHead className="text-right">Tillväxt</TableHead>
              <TableHead>Åtgärd</TableHead>
              <TableHead className="text-right">Värde</TableHead>
              <TableHead className="w-8"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stands.length === 0 ? (
              <TableRow><TableCell colSpan={15} className="text-center text-muted-foreground py-8">Inga bestånd ännu – lägg till en fastighet och bestånd ovan</TableCell></TableRow>
            ) : (
              stands.map(b => (
                <TableRow key={b.id} className="cursor-pointer" onClick={() => setSelectedId(b.id)}>
                  <TableCell>
                    <p className="text-sm font-medium text-card-foreground whitespace-nowrap">{b.name}</p>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{b.area_ha} ha</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{b.age ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{b.huggningsklass || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{b.site_index || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{b.tree_species || "—"}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-card-foreground">{fmt(b.volume_m3sk ?? 0)}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-muted-foreground">{b.mean_diameter_cm ?? "—"}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-muted-foreground">{b.mean_height_m ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{b.goal_class || "—"}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-muted-foreground">{b.basal_area_m2 ?? "—"}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-muted-foreground">{b.annual_growth_m3sk ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs font-normal whitespace-nowrap">{b.planned_action || "—"} {b.planned_year || ""}</Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm font-semibold tabular-nums text-primary">{fmtKr(b.estimated_value ?? 0)}</TableCell>
                  <TableCell><ChevronRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}

function SummaryCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={cn("text-lg md:text-xl font-bold tabular-nums", highlight ? "text-primary" : "text-card-foreground")}>{value}</p>
    </div>
  );
}

function DetailCard({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={cn("font-bold tabular-nums text-card-foreground", small ? "text-sm" : "text-lg")}>{value}</p>
    </div>
  );
}
