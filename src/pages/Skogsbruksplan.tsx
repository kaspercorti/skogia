import { useState, useMemo, useRef, useEffect } from "react";
import { TreePine, ChevronRight, ChevronDown, ArrowLeft, Calendar, Trees, Plus, MapPin, Trash2, Leaf, Pencil, Upload, BadgeCheck } from "lucide-react";
import ForestPlanImport from "@/components/forest/ForestPlanImport";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { useProperties, useStands, useForestActivities, useTransactions, fmt as fmtKr } from "@/hooks/useSkogskollData";
import CarbonCreditsSection from "@/components/forest/CarbonCreditsSection";
import ActivityFormFields, { emptyActivityForm, HARVEST_TYPES, type ActivityFormData } from "@/components/forest/ActivityFormFields";
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
  const importTriggerRef = useRef<(() => void) | null>(null);
  const detailPanelRef = useRef<HTMLDivElement>(null);

  // Sort stands by numeric part of name
  const sortedStands = useMemo(() => {
    return [...stands].sort((a, b) => {
      const numA = parseInt(a.name.replace(/\D/g, '')) || 0;
      const numB = parseInt(b.name.replace(/\D/g, '')) || 0;
      return numA - numB;
    });
  }, [stands]);

  // Auto-scroll to detail panel when a stand is selected
  useEffect(() => {
    if (selectedId && detailPanelRef.current) {
      detailPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedId]);

  // Dialog state
  const [propDialogOpen, setPropDialogOpen] = useState(false);
  const [standDialogOpen, setStandDialogOpen] = useState(false);
  const [actDialogOpen, setActDialogOpen] = useState(false);
  const [editStandDialogOpen, setEditStandDialogOpen] = useState(false);
  const [editStandId, setEditStandId] = useState<string | null>(null);
  const [editActDialogOpen, setEditActDialogOpen] = useState(false);
  const [editActId, setEditActId] = useState<string | null>(null);
  const [editAct, setEditAct] = useState<ActivityFormData>(emptyActivityForm);

  // New property form
  const [newProp, setNewProp] = useState({ name: "", municipality: "", total_area_ha: "", productive_forest_ha: "" });
  // New stand form
  const emptyStand = {
    property_id: "", name: "", tree_species: "", area_ha: "", age: "", volume_m3sk: "", volume_per_ha: "",
    estimated_value: "", growth_rate_percent: "", planned_action: "", planned_year: "", notes: "",
    huggningsklass: "", site_index: "", mean_diameter_cm: "", mean_height_m: "", goal_class: "",
    basal_area_m2: "", annual_growth_m3sk: "", description: "", parcel_number: "", layer: "",
    vegetation_type: "", moisture_class: "", terrain_type: "", driving_conditions: "", slope_info: "",
    gyl_values: "", alternative_action: "", timing_code: "", removal_percent: "", removal_volume_m3sk: "",
    production_goal: "", general_comment: "", action_comment: "", special_values: "",
  };
  const [newStand, setNewStand] = useState(emptyStand);
  // Edit stand form
  const [editStand, setEditStand] = useState(emptyStand);
  // New activity form
  const [newAct, setNewAct] = useState<ActivityFormData>(emptyActivityForm);

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

  const handleDeleteProperty = async (propertyId: string, propertyName: string) => {
    if (!user) return;
    // Delete stands, activities, then property
    const { error: actErr } = await supabase.from("forest_activities").delete().eq("property_id", propertyId);
    if (actErr) { toast.error("Kunde inte ta bort aktiviteter: " + actErr.message); return; }
    const { error: standErr } = await supabase.from("stands").delete().eq("property_id", propertyId);
    if (standErr) { toast.error("Kunde inte ta bort bestånd: " + standErr.message); return; }
    const { error } = await supabase.from("properties").delete().eq("id", propertyId);
    if (error) { toast.error("Kunde inte ta bort: " + error.message); return; }
    queryClient.invalidateQueries({ queryKey: ["properties"] });
    queryClient.invalidateQueries({ queryKey: ["stands"] });
    queryClient.invalidateQueries({ queryKey: ["forest_activities"] });
    toast.success(`Fastighet "${propertyName}" borttagen`);
  };

  const handleAddStand = async () => {
    if (!newStand.name || !newStand.property_id || !user) return;
    const num = (v: string) => v ? Number(v) : null;
    const txt = (v: string) => v || null;
    const { error } = await supabase.from("stands").insert({
      property_id: newStand.property_id,
      name: newStand.name,
      tree_species: txt(newStand.tree_species),
      area_ha: Number(newStand.area_ha) || 0,
      age: num(newStand.age) as any,
      volume_m3sk: num(newStand.volume_m3sk),
      volume_per_ha: num(newStand.volume_per_ha),
      estimated_value: num(newStand.estimated_value),
      growth_rate_percent: num(newStand.growth_rate_percent),
      planned_action: txt(newStand.planned_action),
      planned_year: num(newStand.planned_year) as any,
      notes: txt(newStand.notes),
      huggningsklass: txt(newStand.huggningsklass),
      site_index: txt(newStand.site_index),
      mean_diameter_cm: num(newStand.mean_diameter_cm),
      mean_height_m: num(newStand.mean_height_m),
      goal_class: txt(newStand.goal_class),
      basal_area_m2: num(newStand.basal_area_m2),
      annual_growth_m3sk: num(newStand.annual_growth_m3sk),
      description: txt(newStand.description),
      parcel_number: txt(newStand.parcel_number),
      layer: txt(newStand.layer),
      vegetation_type: txt(newStand.vegetation_type),
      moisture_class: txt(newStand.moisture_class),
      terrain_type: txt(newStand.terrain_type),
      driving_conditions: txt(newStand.driving_conditions),
      slope_info: txt(newStand.slope_info),
      gyl_values: txt(newStand.gyl_values),
      alternative_action: txt(newStand.alternative_action),
      timing_code: txt(newStand.timing_code),
      removal_percent: num(newStand.removal_percent),
      removal_volume_m3sk: num(newStand.removal_volume_m3sk),
      production_goal: txt(newStand.production_goal),
      general_comment: txt(newStand.general_comment),
      action_comment: txt(newStand.action_comment),
      special_values: txt(newStand.special_values),
    });
    if (error) { toast.error("Kunde inte spara: " + error.message); return; }
    queryClient.invalidateQueries({ queryKey: ["stands"] });
    toast.success("Bestånd skapat");
    setNewStand(emptyStand);
    setStandDialogOpen(false);
  };

  const openEditStand = (b: typeof stands[0]) => {
    const s = (v: any) => v != null ? String(v) : "";
    setEditStandId(b.id);
    setEditStand({
      property_id: b.property_id, name: b.name, tree_species: s(b.tree_species), area_ha: s(b.area_ha),
      age: s(b.age), volume_m3sk: s(b.volume_m3sk), volume_per_ha: s(b.volume_per_ha),
      estimated_value: s(b.estimated_value), growth_rate_percent: s(b.growth_rate_percent),
      planned_action: s(b.planned_action), planned_year: s(b.planned_year), notes: s(b.notes),
      huggningsklass: s(b.huggningsklass), site_index: s(b.site_index), mean_diameter_cm: s(b.mean_diameter_cm),
      mean_height_m: s(b.mean_height_m), goal_class: s(b.goal_class), basal_area_m2: s(b.basal_area_m2),
      annual_growth_m3sk: s(b.annual_growth_m3sk), description: s(b.description), parcel_number: s(b.parcel_number),
      layer: s(b.layer), vegetation_type: s(b.vegetation_type), moisture_class: s(b.moisture_class),
      terrain_type: s(b.terrain_type), driving_conditions: s(b.driving_conditions), slope_info: s(b.slope_info),
      gyl_values: s(b.gyl_values), alternative_action: s(b.alternative_action), timing_code: s(b.timing_code),
      removal_percent: s(b.removal_percent), removal_volume_m3sk: s(b.removal_volume_m3sk),
      production_goal: s(b.production_goal), general_comment: s(b.general_comment),
      action_comment: s(b.action_comment), special_values: s(b.special_values),
    });
    setEditStandDialogOpen(true);
  };

  const handleUpdateStand = async () => {
    if (!editStandId || !editStand.name) return;
    const num = (v: string) => v ? Number(v) : null;
    const txt = (v: string) => v || null;
    const { error } = await supabase.from("stands").update({
      name: editStand.name, tree_species: txt(editStand.tree_species),
      area_ha: Number(editStand.area_ha) || 0, age: num(editStand.age) as any,
      volume_m3sk: num(editStand.volume_m3sk), volume_per_ha: num(editStand.volume_per_ha),
      estimated_value: num(editStand.estimated_value), growth_rate_percent: num(editStand.growth_rate_percent),
      planned_action: txt(editStand.planned_action), planned_year: num(editStand.planned_year) as any,
      notes: txt(editStand.notes), huggningsklass: txt(editStand.huggningsklass),
      site_index: txt(editStand.site_index), mean_diameter_cm: num(editStand.mean_diameter_cm),
      mean_height_m: num(editStand.mean_height_m), goal_class: txt(editStand.goal_class),
      basal_area_m2: num(editStand.basal_area_m2), annual_growth_m3sk: num(editStand.annual_growth_m3sk),
      description: txt(editStand.description), parcel_number: txt(editStand.parcel_number),
      layer: txt(editStand.layer), vegetation_type: txt(editStand.vegetation_type),
      moisture_class: txt(editStand.moisture_class), terrain_type: txt(editStand.terrain_type),
      driving_conditions: txt(editStand.driving_conditions), slope_info: txt(editStand.slope_info),
      gyl_values: txt(editStand.gyl_values), alternative_action: txt(editStand.alternative_action),
      timing_code: txt(editStand.timing_code), removal_percent: num(editStand.removal_percent),
      removal_volume_m3sk: num(editStand.removal_volume_m3sk), production_goal: txt(editStand.production_goal),
      general_comment: txt(editStand.general_comment), action_comment: txt(editStand.action_comment),
      special_values: txt(editStand.special_values),
    }).eq("id", editStandId);
    if (error) { toast.error("Kunde inte uppdatera: " + error.message); return; }
    queryClient.invalidateQueries({ queryKey: ["stands"] });
    toast.success("Bestånd uppdaterat");
    setEditStandDialogOpen(false);
    setEditStandId(null);
  };

  const handleAddActivity = async () => {
    if (!newAct.type || !newAct.property_id || !user) return;
    const income = Number(newAct.estimated_income) || 0;
    const cost = Number(newAct.estimated_cost) || Number(newAct.total_cost) || 0;
    const subsidyAmt = newAct.has_subsidy ? (Number(newAct.subsidy_amount) || 0) : 0;
    const isHarvest = HARVEST_TYPES.includes(newAct.type);
    const harvestedVol = isHarvest ? (Number(newAct.harvested_volume_m3sk) || 0) : 0;
    const soldVol = isHarvest ? (Number(newAct.sold_volume_m3sk) || harvestedVol) : 0;
    const pricePerM3 = isHarvest && newAct.price_per_m3sk ? Number(newAct.price_per_m3sk) : null;
    const totalRev = isHarvest ? (Number(newAct.total_revenue) || (pricePerM3 && soldVol ? pricePerM3 * soldVol : 0)) : 0;
    const finalIncome = totalRev > 0 ? totalRev : income;

    const selectedStand = newAct.stand_id && newAct.stand_id !== "none" ? stands.find(s => s.id === newAct.stand_id) : null;
    if (isHarvest && newAct.is_completed && newAct.affects_forest_plan && selectedStand && harvestedVol > 0) {
      const currentVol = selectedStand.volume_m3sk ?? 0;
      if (harvestedVol > currentVol) {
        toast.error(`Uttaget (${harvestedVol} m³sk) överstiger beståndets virkesförråd (${currentVol} m³sk)`);
        return;
      }
    }
    if (isHarvest && newAct.is_completed && newAct.affects_forest_plan && harvestedVol > 0 && (!newAct.stand_id || newAct.stand_id === "none")) {
      toast.error("Välj ett bestånd för att kunna uppdatera skogsbruksplanen");
      return;
    }

    const { error } = await supabase.from("forest_activities").insert({
      property_id: newAct.property_id,
      stand_id: newAct.stand_id && newAct.stand_id !== "none" ? newAct.stand_id : null,
      type: newAct.type === "övrigt" && newAct.custom_type ? newAct.custom_type : newAct.type,
      custom_type: newAct.type === "övrigt" ? newAct.custom_type || null : null,
      planned_date: newAct.planned_date || null,
      estimated_income: finalIncome,
      estimated_cost: cost,
      estimated_net: finalIncome - cost + subsidyAmt,
      status: newAct.is_completed ? "completed" : "planned",
      notes: newAct.notes || null,
      has_subsidy: newAct.has_subsidy,
      subsidy_type: newAct.has_subsidy ? newAct.subsidy_type || null : null,
      subsidy_amount: subsidyAmt,
      subsidy_status: newAct.has_subsidy ? newAct.subsidy_status || "planned" : null,
      subsidy_date: newAct.has_subsidy && newAct.subsidy_date ? newAct.subsidy_date : null,
      subsidy_notes: newAct.has_subsidy ? newAct.subsidy_notes || null : null,
      harvested_volume_m3sk: harvestedVol,
      sold_volume_m3sk: soldVol,
      price_per_m3sk: pricePerM3,
      total_revenue: totalRev,
      is_completed: newAct.is_completed,
      completed_date: newAct.is_completed ? (newAct.completed_date || new Date().toISOString().slice(0, 10)) : null,
      affects_forest_plan: isHarvest ? newAct.affects_forest_plan : false,
      plan_updated: false,
      // New type-specific fields
      area_ha: Number(newAct.area_ha) || null,
      length_meters: Number(newAct.length_meters) || null,
      plant_count: Number(newAct.plant_count) || null,
      plants_per_ha: Number(newAct.plants_per_ha) || null,
      fertilizer_amount: Number(newAct.fertilizer_amount) || null,
      fertilizer_unit: newAct.fertilizer_unit || null,
      cost_per_ha: Number(newAct.cost_per_ha) || null,
      cost_per_meter: Number(newAct.cost_per_meter) || null,
      total_cost: Number(newAct.total_cost) || null,
      work_description: newAct.work_description || null,
      quantity: Number(newAct.quantity) || null,
      quantity_unit: newAct.quantity_unit || null,
      tree_species: newAct.tree_species || null,
      work_type: newAct.work_type || null,
    } as any);
    if (error) { toast.error("Kunde inte spara: " + error.message); return; }

    // Auto-update stand volume only for harvest types
    if (isHarvest && newAct.is_completed && newAct.affects_forest_plan && selectedStand && harvestedVol > 0) {
      const currentVol = selectedStand.volume_m3sk ?? 0;
      const newVol = currentVol - harvestedVol;
      const { error: standErr } = await supabase.from("stands").update({
        volume_m3sk: newVol,
        volume_per_ha: selectedStand.area_ha > 0 ? Math.round((newVol / selectedStand.area_ha) * 10) / 10 : null,
      }).eq("id", selectedStand.id);
      if (standErr) {
        toast.error("Aktivitet sparad men kunde inte uppdatera beståndet: " + standErr.message);
      } else {
        await supabase.from("forest_activities").update({ plan_updated: true } as any).eq("stand_id", selectedStand.id).eq("is_completed", true).eq("plan_updated", false);
        toast.success(`Virkesförråd uppdaterat: ${fmt(currentVol)} → ${fmt(newVol)} m³sk`);
      }
      queryClient.invalidateQueries({ queryKey: ["stands"] });
    }

    queryClient.invalidateQueries({ queryKey: ["forest_activities"] });
    toast.success("Aktivitet skapad");
    setNewAct(emptyActivityForm);
    setActDialogOpen(false);
  };

  const handleDeleteActivity = async (activityId: string) => {
    const activity = activities.find(a => a.id === activityId);
    
    // Restore stand volume if the activity had reduced it
    if (activity && activity.is_completed && activity.affects_forest_plan && activity.stand_id && activity.harvested_volume_m3sk > 0) {
      const stand = stands.find(s => s.id === activity.stand_id);
      if (stand) {
        const restoredVol = (stand.volume_m3sk ?? 0) + activity.harvested_volume_m3sk;
        const { error: standErr } = await supabase.from("stands").update({
          volume_m3sk: restoredVol,
          volume_per_ha: stand.area_ha > 0 ? Math.round((restoredVol / stand.area_ha) * 10) / 10 : null,
        }).eq("id", stand.id);
        if (standErr) {
          toast.error("Kunde inte återställa beståndsvolym: " + standErr.message);
          return;
        }
        queryClient.invalidateQueries({ queryKey: ["stands"] });
        toast.success(`Virkesförråd återställt: ${fmt(stand.volume_m3sk ?? 0)} → ${fmt(restoredVol)} m³sk`);
      }
    }

    const { error } = await supabase.from("forest_activities").delete().eq("id", activityId);
    if (error) { toast.error("Kunde inte ta bort: " + error.message); return; }
    queryClient.invalidateQueries({ queryKey: ["forest_activities"] });
    queryClient.invalidateQueries({ queryKey: ["stands"] });
    toast.success("Aktivitet borttagen");
  };

  const handleToggleActivityStatus = async (activity: typeof activities[0]) => {
    const nowCompleted = !activity.is_completed;
    const stand = activity.stand_id ? stands.find(s => s.id === activity.stand_id) : null;
    const harvestedVol = activity.harvested_volume_m3sk || 0;
    const shouldUpdateVolume = activity.affects_forest_plan && stand && harvestedVol > 0;

    // Update activity status
    const { error } = await supabase.from("forest_activities").update({
      is_completed: nowCompleted,
      status: nowCompleted ? "completed" : "planned",
      completed_date: nowCompleted ? new Date().toISOString().slice(0, 10) : null,
      plan_updated: shouldUpdateVolume ? nowCompleted : false,
    }).eq("id", activity.id);
    if (error) { toast.error("Kunde inte uppdatera: " + error.message); return; }

    // Update stand volume if applicable
    if (shouldUpdateVolume && stand) {
      const currentVol = stand.volume_m3sk ?? 0;
      const newVol = nowCompleted ? currentVol - harvestedVol : currentVol + harvestedVol;

      if (nowCompleted && harvestedVol > currentVol) {
        toast.error(`Uttaget (${harvestedVol} m³sk) överstiger tillgängligt virkesförråd (${currentVol} m³sk)`);
        // Revert activity status
        await supabase.from("forest_activities").update({
          is_completed: !nowCompleted,
          status: !nowCompleted ? "completed" : "planned",
          completed_date: !nowCompleted ? activity.completed_date : null,
          plan_updated: false,
        }).eq("id", activity.id);
        return;
      }

      const { error: standErr } = await supabase.from("stands").update({
        volume_m3sk: Math.max(0, newVol),
        volume_per_ha: stand.area_ha > 0 ? Math.round((Math.max(0, newVol) / stand.area_ha) * 10) / 10 : null,
      }).eq("id", stand.id);

      if (standErr) {
        toast.error("Status ändrad men kunde inte uppdatera beståndsvolym: " + standErr.message);
      } else {
        toast.success(`Virkesförråd uppdaterat: ${fmt(currentVol)} → ${fmt(Math.max(0, newVol))} m³sk`);
      }
    }

    queryClient.invalidateQueries({ queryKey: ["forest_activities"] });
    queryClient.invalidateQueries({ queryKey: ["stands"] });
    toast.success(nowCompleted ? "Aktivitet markerad som genomförd" : "Aktivitet markerad som planerad");
  };

  const selectedStandPanel = selected ? (() => {
    const propName = properties.find(p => p.id === selected.property_id)?.name || "";
    const standActivities = activities.filter(a => a.stand_id === selected.id);
    const standTransactions = transactions.filter(t => t.stand_id === selected.id);

    return (
      <div className="mb-6 overflow-hidden rounded-2xl border border-primary/20 bg-card">
        <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-start md:justify-between md:p-6">
          <div className="flex items-center gap-3">
            <Trees className="h-7 w-7 text-primary" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Valt bestånd</p>
              <h2 className="font-display text-2xl font-bold text-foreground">{selected.name}</h2>
              <p className="text-sm text-muted-foreground">{propName}</p>
            </div>
          </div>
          <Button variant="ghost" className="gap-2 self-start text-muted-foreground" onClick={() => setSelectedId(null)}>
            <ArrowLeft className="h-4 w-4" /> Stäng detaljvy
          </Button>
        </div>

        <div className="p-4 md:p-6">
          <div className="grid grid-cols-2 gap-3 mb-6 md:grid-cols-4">
            <DetailCard label="Areal" value={`${selected.area_ha} ha`} />
            <DetailCard label="Ålder" value={`${selected.age ?? "—"} år`} />
            <DetailCard label="Volym" value={`${fmt(selected.volume_m3sk ?? 0)} m³sk`} />
            <DetailCard label="Trädslag" value={selected.tree_species || "—"} small />
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6 md:grid-cols-4">
            <DetailCard label="Huggningsklass" value={selected.huggningsklass || "—"} small />
            <DetailCard label="Bonitet (SI)" value={selected.site_index || "—"} small />
            <DetailCard label="Medeldiameter" value={selected.mean_diameter_cm ? `${selected.mean_diameter_cm} cm` : "—"} />
            <DetailCard label="Medelhöjd" value={selected.mean_height_m ? `${selected.mean_height_m} m` : "—"} />
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6 md:grid-cols-4">
            <DetailCard label="Målklass" value={selected.goal_class || "—"} small />
            <DetailCard label="Grundyta" value={selected.basal_area_m2 ? `${selected.basal_area_m2} m²/ha` : "—"} />
            <DetailCard label="Årlig tillväxt" value={selected.annual_growth_m3sk ? `${selected.annual_growth_m3sk} m³sk` : "—"} />
            <DetailCard label="Uppskattat värde" value={fmtKr(selected.estimated_value ?? 0)} />
          </div>

          {(selected.vegetation_type || selected.moisture_class || selected.terrain_type || selected.driving_conditions || selected.gyl_values || selected.slope_info) && (
            <div className="rounded-xl border border-border bg-card p-4 mb-6">
              <p className="text-xs font-semibold text-muted-foreground mb-2">Mark & terräng</p>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {selected.vegetation_type && <DetailCard label="Vegetationstyp" value={selected.vegetation_type} small />}
                {selected.moisture_class && <DetailCard label="Fuktighet" value={selected.moisture_class} small />}
                {selected.terrain_type && <DetailCard label="Terräng" value={selected.terrain_type} small />}
                {selected.driving_conditions && <DetailCard label="Drivning" value={selected.driving_conditions} small />}
                {selected.gyl_values && <DetailCard label="GYL" value={selected.gyl_values} small />}
                {selected.slope_info && <DetailCard label="Lutning" value={selected.slope_info} small />}
              </div>
            </div>
          )}

          {selected.species_breakdown && Array.isArray(selected.species_breakdown) && (selected.species_breakdown as any[]).length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4 mb-6">
              <p className="text-xs font-semibold text-muted-foreground mb-2">Trädslagsfördelning</p>
              <div className="flex flex-wrap gap-3">
                {(selected.species_breakdown as any[]).map((sp: any, i: number) => (
                  <div key={i} className="rounded-lg border border-border bg-muted/30 px-3 py-1.5">
                    <span className="text-sm font-medium text-foreground">{sp.species}</span>
                    {sp.percent != null && <span className="ml-1.5 text-xs text-muted-foreground">{sp.percent}%</span>}
                    {sp.volume_m3sk != null && <span className="ml-1.5 text-xs text-muted-foreground">({sp.volume_m3sk} m³sk)</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

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

          {selected.raw_description_text && (
            <div className="rounded-xl border border-border bg-card p-4 mb-6">
              <p className="text-xs text-muted-foreground mb-1">Råtext från skogsbruksplan</p>
              <p className="rounded-lg bg-muted/30 p-3 font-mono text-sm whitespace-pre-wrap text-card-foreground">{selected.raw_description_text}</p>
            </div>
          )}

          <div className="rounded-xl border border-border bg-card p-4 mb-6">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-card-foreground">Planerad åtgärd</span>
            </div>
            <p className="text-lg font-semibold text-foreground">{selected.planned_action || "Ingen"} <span className="font-normal text-muted-foreground">– {selected.planned_year || "—"}</span></p>
          </div>

          {standActivities.length > 0 && (
            <div className="rounded-xl border border-border bg-card overflow-hidden mb-6">
              <div className="border-b border-border p-4"><h3 className="font-display text-lg text-card-foreground">Aktiviteter & historik</h3></div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Typ</TableHead>
                    <TableHead>Datum</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Uttag (m³sk)</TableHead>
                    <TableHead className="text-right">Kostnad</TableHead>
                    <TableHead className="text-right">Intäkt</TableHead>
                    <TableHead className="text-right">Bidrag</TableHead>
                     <TableHead className="text-right">Netto</TableHead>
                     <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {standActivities.map(a => (
                    <TableRow key={a.id} className={a.is_completed ? "bg-muted/30" : ""}>
                      <TableCell className="text-sm capitalize text-card-foreground">{a.type}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{a.is_completed ? a.completed_date || a.planned_date || "—" : a.planned_date || "—"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={a.is_completed ? "default" : "secondary"}
                          className="text-xs cursor-pointer hover:opacity-80"
                          onClick={() => handleToggleActivityStatus(a)}
                          title={a.is_completed ? "Klicka för att ändra till planerad" : "Klicka för att markera som genomförd"}
                        >
                          {a.is_completed ? "Genomförd" : a.status === "planned" ? "Planerad" : a.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-card-foreground">{a.harvested_volume_m3sk > 0 ? `${fmt(a.harvested_volume_m3sk)}` : "—"}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-muted-foreground">{fmtKr(a.estimated_cost)}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-card-foreground">{a.total_revenue > 0 ? fmtKr(a.total_revenue) : a.estimated_income > 0 ? fmtKr(a.estimated_income) : "—"}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{a.has_subsidy && a.subsidy_amount > 0 ? <span className="flex items-center justify-end gap-1 text-primary"><BadgeCheck className="h-3 w-3" />{fmtKr(a.subsidy_amount)}</span> : "—"}</TableCell>
                      <TableCell className={cn("text-right text-sm font-semibold tabular-nums", a.estimated_net >= 0 ? "text-primary" : "text-card-foreground")}>
                        {a.estimated_net >= 0 ? "+" : "−"}{fmtKr(Math.abs(a.estimated_net))}
                      </TableCell>
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={e => e.stopPropagation()}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Ta bort aktivitet</AlertDialogTitle>
                              <AlertDialogDescription>Är du säker på att du vill ta bort denna {a.type}-aktivitet? Detta kan inte ångras.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Avbryt</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteActivity(a.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Ta bort</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="border-b border-border p-4"><h3 className="font-display text-lg text-card-foreground">Ekonomi – {selected.name}</h3></div>
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
        </div>
      </div>
    );
  })() : null;

  // Stands for activity form filtered by selected property
  const standsForAct = useMemo(() => {
    const filtered = newAct.property_id ? stands.filter(s => s.property_id === newAct.property_id) : [];
    return [...filtered].sort((a, b) => {
      const numA = parseInt(a.name.replace(/\D/g, '')) || 0;
      const numB = parseInt(b.name.replace(/\D/g, '')) || 0;
      return numA - numB;
    });
  }, [stands, newAct.property_id]);

  return (
    <main className="flex-1 p-4 md:p-8 overflow-auto">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div className="flex items-center gap-3">
          <TreePine className="h-7 w-7 text-primary" />
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Skogsbruksplan</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Import forest plan */}
          <ForestPlanImport properties={properties} triggerRef={importTriggerRef} />
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
                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">eller</span></div>
                </div>
                <Button variant="outline" className="w-full gap-2" onClick={() => { setPropDialogOpen(false); setTimeout(() => importTriggerRef.current?.(), 150); }}>
                  <Upload className="h-4 w-4" /> Importera skogsbruksplan
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Add Stand Dialog */}
          <Dialog open={standDialogOpen} onOpenChange={setStandDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2"><Trees className="h-4 w-4" /> Lägg till bestånd</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Nytt bestånd</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-2">
                {/* Grunddata */}
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Grunddata</p>
                <div className="space-y-1.5">
                  <Label>Fastighet *</Label>
                  <Select value={newStand.property_id} onValueChange={v => setNewStand({ ...newStand, property_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Välj fastighet..." /></SelectTrigger>
                    <SelectContent>
                      {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Namn / Avd *</Label>
                    <Input placeholder="T.ex. Avd 5 – Tallbacken" value={newStand.name} onChange={e => setNewStand({ ...newStand, name: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Skifte</Label>
                    <Input placeholder="T.ex. 1" value={newStand.parcel_number} onChange={e => setNewStand({ ...newStand, parcel_number: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>Areal (ha)</Label>
                    <Input type="number" step="0.1" placeholder="0" value={newStand.area_ha} onChange={e => setNewStand({ ...newStand, area_ha: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Ålder (år)</Label>
                    <Input type="number" placeholder="0" value={newStand.age} onChange={e => setNewStand({ ...newStand, age: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Skikt</Label>
                    <Input placeholder="T.ex. E, Ö" value={newStand.layer} onChange={e => setNewStand({ ...newStand, layer: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>Hkl</Label>
                    <Select value={newStand.huggningsklass} onValueChange={v => setNewStand({ ...newStand, huggningsklass: v })}>
                      <SelectTrigger><SelectValue placeholder="Välj..." /></SelectTrigger>
                      <SelectContent>
                        {["K1","K2","R1","R2","G1","G2","S1","S2","S3","E1","E2","E3"].map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>SI / Bonitet</Label>
                    <Input placeholder="T.ex. T24, G28" value={newStand.site_index} onChange={e => setNewStand({ ...newStand, site_index: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Målklass</Label>
                    <Select value={newStand.goal_class} onValueChange={v => setNewStand({ ...newStand, goal_class: v })}>
                      <SelectTrigger><SelectValue placeholder="Välj..." /></SelectTrigger>
                      <SelectContent>
                        {["PG","PF","NS","NO","K","Orört"].map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Virkesdata */}
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-2">Virkesdata</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Trädslag</Label>
                    <Input placeholder="T.ex. Tall" value={newStand.tree_species} onChange={e => setNewStand({ ...newStand, tree_species: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Volym (m³sk)</Label>
                    <Input type="number" placeholder="0" value={newStand.volume_m3sk} onChange={e => setNewStand({ ...newStand, volume_m3sk: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>Vol/ha (m³sk)</Label>
                    <Input type="number" placeholder="0" value={newStand.volume_per_ha} onChange={e => setNewStand({ ...newStand, volume_per_ha: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Medeldiam (cm)</Label>
                    <Input type="number" step="0.1" placeholder="0" value={newStand.mean_diameter_cm} onChange={e => setNewStand({ ...newStand, mean_diameter_cm: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Medelhöjd (m)</Label>
                    <Input type="number" step="0.1" placeholder="0" value={newStand.mean_height_m} onChange={e => setNewStand({ ...newStand, mean_height_m: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>G-yta (m²)</Label>
                    <Input type="number" step="0.1" placeholder="0" value={newStand.basal_area_m2} onChange={e => setNewStand({ ...newStand, basal_area_m2: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tillväxt (m³sk/år)</Label>
                    <Input type="number" step="0.1" placeholder="0" value={newStand.annual_growth_m3sk} onChange={e => setNewStand({ ...newStand, annual_growth_m3sk: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tillväxt (%)</Label>
                    <Input type="number" step="0.1" placeholder="0" value={newStand.growth_rate_percent} onChange={e => setNewStand({ ...newStand, growth_rate_percent: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Uppskattat värde (kr)</Label>
                    <Input type="number" placeholder="0" value={newStand.estimated_value} onChange={e => setNewStand({ ...newStand, estimated_value: e.target.value })} />
                  </div>
                </div>

                {/* Åtgärdsdata */}
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-2">Åtgärdsdata</p>
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
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Alternativ åtgärd</Label>
                    <Input placeholder="T.ex. gallring" value={newStand.alternative_action} onChange={e => setNewStand({ ...newStand, alternative_action: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>När / prioritet</Label>
                    <Input placeholder="T.ex. FF, 1, 2" value={newStand.timing_code} onChange={e => setNewStand({ ...newStand, timing_code: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Uttag (%)</Label>
                    <Input type="number" placeholder="0" value={newStand.removal_percent} onChange={e => setNewStand({ ...newStand, removal_percent: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Uttag inkl tillväxt (m³sk)</Label>
                    <Input type="number" placeholder="0" value={newStand.removal_volume_m3sk} onChange={e => setNewStand({ ...newStand, removal_volume_m3sk: e.target.value })} />
                  </div>
                </div>

                {/* Mark & terräng */}
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-2">Mark & terräng</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Vegetationstyp</Label>
                    <Input placeholder="T.ex. blåbärstyp" value={newStand.vegetation_type} onChange={e => setNewStand({ ...newStand, vegetation_type: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Fuktighet</Label>
                    <Input placeholder="T.ex. frisk, fuktig" value={newStand.moisture_class} onChange={e => setNewStand({ ...newStand, moisture_class: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Terrängtyp</Label>
                    <Input placeholder="T.ex. plan mark" value={newStand.terrain_type} onChange={e => setNewStand({ ...newStand, terrain_type: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Drivning</Label>
                    <Input placeholder="T.ex. normal" value={newStand.driving_conditions} onChange={e => setNewStand({ ...newStand, driving_conditions: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>GYL</Label>
                    <Input placeholder="T.ex. 1 1 1" value={newStand.gyl_values} onChange={e => setNewStand({ ...newStand, gyl_values: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Lutning</Label>
                    <Input placeholder="T.ex. svag lutning" value={newStand.slope_info} onChange={e => setNewStand({ ...newStand, slope_info: e.target.value })} />
                  </div>
                </div>

                {/* Beskrivningar */}
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-2">Beskrivningar</p>
                <div className="space-y-1.5">
                  <Label>Beskrivning</Label>
                  <Textarea placeholder="Fritext om beståndet..." value={newStand.description} onChange={e => setNewStand({ ...newStand, description: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Produktionsmål</Label>
                  <Input placeholder="T.ex. virkesproduktion" value={newStand.production_goal} onChange={e => setNewStand({ ...newStand, production_goal: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Generell kommentar</Label>
                    <Textarea rows={2} placeholder="" value={newStand.general_comment} onChange={e => setNewStand({ ...newStand, general_comment: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Åtgärdskommentar</Label>
                    <Textarea rows={2} placeholder="" value={newStand.action_comment} onChange={e => setNewStand({ ...newStand, action_comment: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Speciella värden</Label>
                  <Input placeholder="T.ex. nyckelbiotop" value={newStand.special_values} onChange={e => setNewStand({ ...newStand, special_values: e.target.value })} />
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
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
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
                        {[
                          "slutavverkning", "gallring", "röjning", "plantering", "markberedning",
                          "hyggesrensning", "naturvårdande skötsel", "skyddsdikning", "gödsling",
                          "vägunderhåll", "dikesrensning", "kantzonsskötsel", "naturvårdsåtgärd", "övrigt"
                        ].map(t => (
                          <SelectItem key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Planerat datum</Label>
                    <Input type="date" value={newAct.planned_date} onChange={e => setNewAct({ ...newAct, planned_date: e.target.value })} />
                  </div>
                </div>
                {newAct.type === "övrigt" && (
                  <div className="space-y-1.5">
                    <Label>Ange åtgärdstyp (fritext) *</Label>
                    <Input placeholder="Beskriv åtgärden..." value={newAct.custom_type} onChange={e => setNewAct({ ...newAct, custom_type: e.target.value })} />
                  </div>
                )}

                {/* Genomförd aktivitet */}
                <div className="rounded-lg border border-border p-3 space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={newAct.is_completed} onChange={e => setNewAct({ ...newAct, is_completed: e.target.checked })} className="rounded border-input h-4 w-4 accent-primary" />
                    <span className="text-sm font-medium text-foreground">Genomförd aktivitet</span>
                  </label>
                  {newAct.is_completed && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Genomförandedatum</Label>
                      <Input type="date" className="h-8 text-sm" value={newAct.completed_date} onChange={e => setNewAct({ ...newAct, completed_date: e.target.value })} />
                    </div>
                  )}
                </div>

                {/* Dynamic type-specific fields */}
                {newAct.type && (
                  <ActivityFormFields
                    data={newAct}
                    onChange={setNewAct}
                    stands={standsForAct}
                  />
                )}

                {/* Ekonomi – only for harvest types that use cost_per_m3sk */}
                {HARVEST_TYPES.includes(newAct.type) && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3">
                    <p className="text-xs font-semibold text-primary uppercase tracking-wide">Ekonomi</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Beräknad intäkt (kr)</Label>
                        <Input type="number" placeholder="0" value={newAct.estimated_income} onChange={e => setNewAct({ ...newAct, estimated_income: e.target.value })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Kostnad per m³sk (kr)</Label>
                        <Input type="number" placeholder="0" value={newAct.cost_per_m3sk ?? ""} onChange={e => {
                          const costPerM3 = e.target.value;
                          const vol = Number(newAct.harvested_volume_m3sk) || 0;
                          const totalCost = vol > 0 && Number(costPerM3) > 0 ? Math.round(vol * Number(costPerM3)) : Number(costPerM3) > 0 ? Number(costPerM3) : 0;
                          setNewAct({ ...newAct, cost_per_m3sk: costPerM3, estimated_cost: String(totalCost) });
                        }} />
                      </div>
                    </div>
                    {(Number(newAct.estimated_income) > 0 || Number(newAct.estimated_cost) > 0) && (() => {
                      const income = Number(newAct.estimated_income) || 0;
                      const cost = Number(newAct.estimated_cost) || 0;
                      const vol = Number(newAct.harvested_volume_m3sk) || 0;
                      const netto = income - cost;
                      const nettoPerM3 = vol > 0 ? netto / vol : null;
                      return (
                        <div className="rounded-md bg-muted/50 p-2 text-xs space-y-0.5">
                          <div className="flex justify-between"><span className="text-muted-foreground">Intäkt:</span><span className="text-foreground">{income.toLocaleString("sv-SE")} kr</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Kostnad ({Number(newAct.cost_per_m3sk) || 0} kr/m³sk × {vol} m³sk):</span><span className="text-destructive">−{cost.toLocaleString("sv-SE")} kr</span></div>
                          <div className="flex justify-between border-t border-border pt-0.5 font-semibold"><span className="text-muted-foreground">Netto:</span><span className={netto >= 0 ? "text-primary" : "text-destructive"}>{netto.toLocaleString("sv-SE")} kr</span></div>
                          {nettoPerM3 !== null && (
                            <div className="flex justify-between font-semibold"><span className="text-muted-foreground">Netto per m³sk:</span><span className={nettoPerM3 >= 0 ? "text-primary" : "text-destructive"}>{Math.round(nettoPerM3).toLocaleString("sv-SE")} kr/m³sk</span></div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Bidrag / Stöd */}
                <div className="rounded-lg border border-border p-3 space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newAct.has_subsidy}
                      onChange={e => setNewAct({ ...newAct, has_subsidy: e.target.checked })}
                      className="rounded border-input h-4 w-4 accent-primary"
                    />
                    <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                      <BadgeCheck className="h-4 w-4 text-primary" /> Har bidrag / stöd
                    </span>
                  </label>
                  {newAct.has_subsidy && (
                    <div className="grid gap-3 pt-1">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Bidragstyp</Label>
                          <Select value={newAct.subsidy_type} onValueChange={v => setNewAct({ ...newAct, subsidy_type: v })}>
                            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Välj..." /></SelectTrigger>
                            <SelectContent>
                              {["Skogsstyrelsen", "LONA", "NOKÅS", "Klimatstöd", "EU-stöd", "Allmänningsbidrag", "Annat"].map(t => (
                                <SelectItem key={t} value={t}>{t}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Belopp (kr)</Label>
                          <Input type="number" placeholder="0" className="h-8 text-sm" value={newAct.subsidy_amount} onChange={e => setNewAct({ ...newAct, subsidy_amount: e.target.value })} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Status</Label>
                          <Select value={newAct.subsidy_status} onValueChange={v => setNewAct({ ...newAct, subsidy_status: v })}>
                            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="planned">Planerat</SelectItem>
                              <SelectItem value="applied">Ansökt</SelectItem>
                              <SelectItem value="approved">Beviljat</SelectItem>
                              <SelectItem value="paid">Utbetalt</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Datum</Label>
                          <Input type="date" className="h-8 text-sm" value={newAct.subsidy_date} onChange={e => setNewAct({ ...newAct, subsidy_date: e.target.value })} />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Kommentar</Label>
                        <Input placeholder="T.ex. ansökningsnummer..." className="h-8 text-sm" value={newAct.subsidy_notes} onChange={e => setNewAct({ ...newAct, subsidy_notes: e.target.value })} />
                      </div>
                      {(Number(newAct.estimated_cost) > 0 || Number(newAct.subsidy_amount) > 0) && (
                        <div className="rounded-md bg-muted/50 p-2 text-xs space-y-0.5">
                          <div className="flex justify-between"><span className="text-muted-foreground">Kostnad:</span><span className="text-foreground">{(Number(newAct.estimated_cost) || Number(newAct.total_cost) || 0).toLocaleString("sv-SE")} kr</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Bidrag:</span><span className="text-primary">−{(Number(newAct.subsidy_amount) || 0).toLocaleString("sv-SE")} kr</span></div>
                          <div className="flex justify-between border-t border-border pt-0.5 font-semibold"><span className="text-muted-foreground">Nettokostnad:</span><span className="text-foreground">{((Number(newAct.estimated_cost) || Number(newAct.total_cost) || 0) - (Number(newAct.subsidy_amount) || 0)).toLocaleString("sv-SE")} kr</span></div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label>Anteckningar</Label>
                  <Textarea placeholder="Fritext..." value={newAct.notes} onChange={e => setNewAct({ ...newAct, notes: e.target.value })} />
                </div>
                <Button onClick={handleAddActivity} className="mt-2 w-full" disabled={!newAct.type || !newAct.property_id || (newAct.type === "övrigt" && !newAct.custom_type)}>Spara aktivitet</Button>
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
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    <p className="text-sm font-semibold text-card-foreground">{p.name}</p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Ta bort fastighet</AlertDialogTitle>
                        <AlertDialogDescription>
                          Är du säker på att du vill ta bort <strong>{p.name}</strong>? Alla bestånd och aktiviteter kopplade till fastigheten tas också bort. Detta går inte att ångra.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Avbryt</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteProperty(p.id, p.name)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Ta bort
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
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

      

      {/* Avdelningsbeskrivning - Collapsible */}
      <CollapsibleSection title="Avdelningsbeskrivning" icon={<Trees className="h-5 w-5 text-primary" />} defaultOpen>
        <div className="rounded-xl border border-border bg-card overflow-hidden overflow-x-auto">
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
              {sortedStands.length === 0 ? (
                <TableRow><TableCell colSpan={15} className="text-center text-muted-foreground py-8">Inga bestånd ännu – lägg till en fastighet och bestånd ovan</TableCell></TableRow>
              ) : (
                sortedStands.map(b => (
                  <TableRow
                    key={b.id}
                    className={cn("cursor-pointer", selectedId === b.id && "bg-primary/5")}
                    onClick={() => setSelectedId(b.id)}
                  >
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
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={(e) => { e.stopPropagation(); openEditStand(b); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", selectedId === b.id && "text-primary")}/>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {selectedStandPanel && (
          <div ref={detailPanelRef} className="mt-4">
            {selectedStandPanel}
          </div>
        )}
      </CollapsibleSection>

      {/* Kolkrediter - Collapsible */}
      <CollapsibleSection title="Kolkrediter" icon={<Leaf className="h-5 w-5 text-primary" />} className="mt-4">
        <CarbonCreditsSection stands={stands} />
      </CollapsibleSection>

      {/* Edit Stand Dialog */}
      <Dialog open={editStandDialogOpen} onOpenChange={setEditStandDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Redigera bestånd</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Grunddata</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Namn *</Label><Input value={editStand.name} onChange={e => setEditStand({ ...editStand, name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Skifte</Label><Input value={editStand.parcel_number} onChange={e => setEditStand({ ...editStand, parcel_number: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label>Areal (ha)</Label><Input type="number" value={editStand.area_ha} onChange={e => setEditStand({ ...editStand, area_ha: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Ålder</Label><Input type="number" value={editStand.age} onChange={e => setEditStand({ ...editStand, age: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Skikt</Label><Input value={editStand.layer} onChange={e => setEditStand({ ...editStand, layer: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label>Hkl</Label><Input value={editStand.huggningsklass} onChange={e => setEditStand({ ...editStand, huggningsklass: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Bonitet (SI)</Label><Input value={editStand.site_index} onChange={e => setEditStand({ ...editStand, site_index: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Målklass</Label><Input value={editStand.goal_class} onChange={e => setEditStand({ ...editStand, goal_class: e.target.value })} /></div>
            </div>

            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-2">Virkesdata</p>
            <div className="space-y-1.5"><Label>Trädslag</Label><Input value={editStand.tree_species} onChange={e => setEditStand({ ...editStand, tree_species: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Volym (m³sk)</Label><Input type="number" value={editStand.volume_m3sk} onChange={e => setEditStand({ ...editStand, volume_m3sk: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Volym/ha</Label><Input type="number" value={editStand.volume_per_ha} onChange={e => setEditStand({ ...editStand, volume_per_ha: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label>Diam (cm)</Label><Input type="number" value={editStand.mean_diameter_cm} onChange={e => setEditStand({ ...editStand, mean_diameter_cm: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Höjd (m)</Label><Input type="number" value={editStand.mean_height_m} onChange={e => setEditStand({ ...editStand, mean_height_m: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>G-yta (m²)</Label><Input type="number" value={editStand.basal_area_m2} onChange={e => setEditStand({ ...editStand, basal_area_m2: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label>Tillväxt (m³sk)</Label><Input type="number" value={editStand.annual_growth_m3sk} onChange={e => setEditStand({ ...editStand, annual_growth_m3sk: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Tillväxt (%)</Label><Input type="number" value={editStand.growth_rate_percent} onChange={e => setEditStand({ ...editStand, growth_rate_percent: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Värde (kr)</Label><Input type="number" value={editStand.estimated_value} onChange={e => setEditStand({ ...editStand, estimated_value: e.target.value })} /></div>
            </div>

            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-2">Åtgärdsdata</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Åtgärd</Label><Input value={editStand.planned_action} onChange={e => setEditStand({ ...editStand, planned_action: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Alt. åtgärd</Label><Input value={editStand.alternative_action} onChange={e => setEditStand({ ...editStand, alternative_action: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label>När/prioritet</Label><Input value={editStand.timing_code} onChange={e => setEditStand({ ...editStand, timing_code: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Planerat år</Label><Input type="number" value={editStand.planned_year} onChange={e => setEditStand({ ...editStand, planned_year: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Uttag (%)</Label><Input type="number" value={editStand.removal_percent} onChange={e => setEditStand({ ...editStand, removal_percent: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label>Uttag inkl. tillväxt (m³sk)</Label><Input type="number" value={editStand.removal_volume_m3sk} onChange={e => setEditStand({ ...editStand, removal_volume_m3sk: e.target.value })} /></div>

            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-2">Mark & terräng</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Vegetationstyp</Label><Input value={editStand.vegetation_type} onChange={e => setEditStand({ ...editStand, vegetation_type: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Fuktighet</Label><Input value={editStand.moisture_class} onChange={e => setEditStand({ ...editStand, moisture_class: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Terräng</Label><Input value={editStand.terrain_type} onChange={e => setEditStand({ ...editStand, terrain_type: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Drivning</Label><Input value={editStand.driving_conditions} onChange={e => setEditStand({ ...editStand, driving_conditions: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>GYL</Label><Input value={editStand.gyl_values} onChange={e => setEditStand({ ...editStand, gyl_values: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Lutning</Label><Input value={editStand.slope_info} onChange={e => setEditStand({ ...editStand, slope_info: e.target.value })} /></div>
            </div>

            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-2">Beskrivningar</p>
            <div className="space-y-1.5"><Label>Beskrivning</Label><Textarea value={editStand.description} onChange={e => setEditStand({ ...editStand, description: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Produktionsmål</Label><Input value={editStand.production_goal} onChange={e => setEditStand({ ...editStand, production_goal: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Generell kommentar</Label><Textarea value={editStand.general_comment} onChange={e => setEditStand({ ...editStand, general_comment: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Åtgärdskommentar</Label><Textarea value={editStand.action_comment} onChange={e => setEditStand({ ...editStand, action_comment: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Speciella värden</Label><Input value={editStand.special_values} onChange={e => setEditStand({ ...editStand, special_values: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Anteckningar</Label><Textarea value={editStand.notes || ""} onChange={e => setEditStand({ ...editStand, notes: e.target.value })} /></div>

            <Button onClick={handleUpdateStand} className="mt-2 w-full">Spara ändringar</Button>
          </div>
        </DialogContent>
      </Dialog>
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

function CollapsibleSection({ title, icon, children, defaultOpen, className }: { title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean; className?: string }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className={cn("mt-6", className)}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full rounded-xl border border-border bg-card px-4 py-3 hover:bg-muted/50 transition-colors">
        {icon}
        <span className="font-display text-lg font-bold text-foreground">{title}</span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground ml-auto transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
