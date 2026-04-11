import { useState, useRef, useEffect } from "react";
import { Upload, FileText, Loader2, Check, AlertTriangle, X, Edit2, ChevronDown, ChevronUp, Plus, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useQueryClient } from "@tanstack/react-query";
import type { Property } from "@/hooks/useSkogskollData";

interface SpeciesBreakdown {
  species: string;
  percent?: number;
  volume_m3sk?: number;
}

interface ExtractedStand {
  name: string;
  tree_species: string | null;
  area_ha: number | null;
  age: number | null;
  volume_m3sk: number | null;
  volume_per_ha: number | null;
  site_index: string | null;
  huggningsklass: string | null;
  mean_diameter_cm: number | null;
  mean_height_m: number | null;
  goal_class: string | null;
  basal_area_m2: number | null;
  annual_growth_m3sk: number | null;
  description: string | null;
  planned_action: string | null;
  planned_year: number | null;
  notes: string | null;
  confidence: number | null;
  parcel_number: string | null;
  layer: string | null;
  species_breakdown: SpeciesBreakdown[] | null;
  alternative_action: string | null;
  timing_code: string | null;
  removal_percent: number | null;
  removal_volume_m3sk: number | null;
  vegetation_type: string | null;
  moisture_class: string | null;
  terrain_type: string | null;
  driving_conditions: string | null;
  slope_info: string | null;
  gyl_values: string | null;
  production_goal: string | null;
  general_comment: string | null;
  action_comment: string | null;
  special_values: string | null;
  raw_description_text: string | null;
  raw_full_text: string | null;
  field_confidence_map: Record<string, string> | null;
}

interface ForestPlanImportProps {
  properties: Property[];
  triggerRef?: React.MutableRefObject<(() => void) | null>;
}

type ImportStep = "idle" | "uploading" | "processing" | "review" | "importing" | "done" | "error";

export default function ForestPlanImport({ properties, triggerRef }: ForestPlanImportProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<ImportStep>("idle");
  const [fileName, setFileName] = useState("");
  const [importId, setImportId] = useState<string | null>(null);
  const [stands, setStands] = useState<ExtractedStand[]>([]);
  const [overallConfidence, setOverallConfidence] = useState(0);
  const [importNotes, setImportNotes] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const reset = () => {
    setStep("idle");
    setFileName("");
    setImportId(null);
    setStands([]);
    setOverallConfidence(0);
    setImportNotes("");
    setSelectedPropertyId("");
    setEditingIdx(null);
    setExpandedIdx(null);
    setErrorMsg("");
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Endast PDF-filer stöds");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Filen är för stor (max 20 MB)");
      return;
    }

    setFileName(file.name);
    setStep("uploading");
    setDialogOpen(true);

    try {
      const filePath = `${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage.from("forest-plans").upload(filePath, file);
      if (uploadErr) throw uploadErr;

      const { data: importRec, error: insertErr } = await supabase
        .from("forest_plan_imports")
        .insert({ user_id: user.id, file_name: file.name, file_url: filePath, status: "uploaded" })
        .select("id")
        .single();
      if (insertErr) throw insertErr;

      setImportId(importRec.id);
      setStep("processing");

      const { data: fnData, error: fnErr } = await supabase.functions.invoke("parse-forest-plan", {
        body: { importId: importRec.id, fileUrl: filePath },
      });

      if (fnErr) throw new Error(fnErr.message || "Kunde inte tolka PDF:en");
      if (fnData?.error) throw new Error(fnData.error);

      const extracted = fnData.data;
      setStands(extracted.stands || []);
      setOverallConfidence(extracted.overall_confidence || 0);
      setImportNotes(extracted.notes || "");
      setStep("review");
    } catch (err: any) {
      console.error("Import error:", err);
      setErrorMsg(err.message || "Ett fel uppstod");
      setStep("error");
    }

    if (fileRef.current) fileRef.current.value = "";
  };

  const updateStand = (idx: number, field: keyof ExtractedStand, value: any) => {
    setStands(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  const removeStand = (idx: number) => {
    setStands(prev => prev.filter((_, i) => i !== idx));
  };

  const handleApprove = async () => {
    if (!user || !selectedPropertyId || stands.length === 0) {
      toast.error("Välj en fastighet och se till att det finns avdelningar att importera");
      return;
    }

    setStep("importing");

    try {
      const standsToInsert = stands.map(s => ({
        property_id: selectedPropertyId,
        name: s.name || "Okänd avdelning",
        tree_species: s.tree_species || null,
        area_ha: s.area_ha || 0,
        age: s.age || null,
        volume_m3sk: s.volume_m3sk || null,
        volume_per_ha: s.volume_per_ha || null,
        site_index: s.site_index || null,
        huggningsklass: s.huggningsklass || null,
        mean_diameter_cm: s.mean_diameter_cm || null,
        mean_height_m: s.mean_height_m || null,
        goal_class: s.goal_class || null,
        basal_area_m2: s.basal_area_m2 || null,
        annual_growth_m3sk: s.annual_growth_m3sk || null,
        description: s.description || null,
        notes: [s.notes, s.general_comment].filter(Boolean).join(". ") || null,
        planned_action: s.planned_action || null,
        planned_year: s.planned_year || null,
        parcel_number: s.parcel_number || null,
        layer: s.layer || null,
        species_breakdown: s.species_breakdown || [],
        alternative_action: s.alternative_action || null,
        timing_code: s.timing_code || null,
        removal_percent: s.removal_percent || null,
        removal_volume_m3sk: s.removal_volume_m3sk || null,
        vegetation_type: s.vegetation_type || null,
        moisture_class: s.moisture_class || null,
        terrain_type: s.terrain_type || null,
        driving_conditions: s.driving_conditions || null,
        slope_info: s.slope_info || null,
        gyl_values: s.gyl_values || null,
        production_goal: s.production_goal || null,
        general_comment: s.general_comment || null,
        action_comment: s.action_comment || null,
        special_values: s.special_values || null,
        raw_description_text: s.raw_description_text || null,
        raw_full_text: s.raw_full_text || null,
        field_confidence_map: s.field_confidence_map || {},
      }));

      const { data: createdStands, error: standErr } = await supabase
        .from("stands")
        .insert(standsToInsert as any)
        .select("id, name, planned_action, planned_year");
      if (standErr) throw standErr;

      const activitiesToInsert = (createdStands || [])
        .filter(cs => {
          const original = stands.find(s => s.name === cs.name);
          return original?.planned_action && original.planned_action !== "ingen åtgärd";
        })
        .map(cs => {
          const original = stands.find(s => s.name === cs.name);
          return {
            property_id: selectedPropertyId,
            stand_id: cs.id,
            type: original?.planned_action || "gallring",
            planned_date: original?.planned_year ? `${original.planned_year}-01-01` : null,
            estimated_income: 0,
            estimated_cost: 0,
            estimated_net: 0,
            status: "planned",
            notes: `Importerad från skogsbruksplan: ${fileName}`,
          };
        });

      if (activitiesToInsert.length > 0) {
        const { error: actErr } = await supabase.from("forest_activities").insert(activitiesToInsert);
        if (actErr) console.error("Activity creation error:", actErr);
      }

      if (importId) {
        await supabase.from("forest_plan_imports").update({
          status: "approved",
          approved_at: new Date().toISOString(),
          extracted_stands_count: stands.length,
        }).eq("id", importId);
      }

      queryClient.invalidateQueries({ queryKey: ["stands"] });
      queryClient.invalidateQueries({ queryKey: ["forest_activities"] });
      queryClient.invalidateQueries({ queryKey: ["properties"] });

      setStep("done");
      toast.success(`${createdStands?.length || 0} bestånd importerade!`);
    } catch (err: any) {
      console.error("Approve error:", err);
      setErrorMsg(err.message || "Kunde inte importera");
      setStep("error");
    }
  };

  const confidenceBadge = (score: number | null) => {
    if (!score) return <Badge variant="outline" className="text-xs">Osäkert</Badge>;
    if (score >= 80) return <Badge className="bg-primary/10 text-primary text-xs border-primary/20">Hög ({score}%)</Badge>;
    if (score >= 50) return <Badge className="bg-accent/10 text-accent text-xs border-accent/20">Medel ({score}%)</Badge>;
    return <Badge variant="destructive" className="text-xs">Låg ({score}%)</Badge>;
  };

  const DetailItem = ({ label, value }: { label: string; value: string | null | undefined }) => {
    if (!value) return null;
    return (
      <div className="flex justify-between text-xs py-0.5">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-foreground font-medium text-right max-w-[60%]">{value}</span>
      </div>
    );
  };

  const hasExtendedData = (s: ExtractedStand) => {
    return !!(s.vegetation_type || s.moisture_class || s.terrain_type || s.driving_conditions ||
      s.gyl_values || s.slope_info || s.production_goal || s.general_comment || s.action_comment ||
      s.special_values || s.alternative_action || s.removal_percent || s.removal_volume_m3sk ||
      s.species_breakdown?.length || s.raw_description_text || s.description || s.notes);
  };

  return (
    <>
      <Button variant="outline" className="gap-2" onClick={() => fileRef.current?.click()}>
        <Upload className="h-4 w-4" /> Importera skogsbruksplan
      </Button>
      <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleFileSelect} />

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o && (step === "done" || step === "error" || step === "idle")) { setDialogOpen(false); reset(); } }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Importera skogsbruksplan
            </DialogTitle>
            {fileName && <DialogDescription>{fileName}</DialogDescription>}
          </DialogHeader>

          {step === "uploading" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Laddar upp PDF...</p>
            </div>
          )}

          {step === "processing" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-accent" />
              <p className="text-sm text-muted-foreground">Läser av hela avdelningsbeskrivningen...</p>
              <p className="text-xs text-muted-foreground">Detta kan ta upp till en minut</p>
            </div>
          )}

          {step === "error" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <p className="text-sm text-destructive">{errorMsg}</p>
              <Button variant="outline" onClick={() => { setDialogOpen(false); reset(); }}>Stäng</Button>
            </div>
          )}

          {step === "done" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Check className="h-8 w-8 text-primary" />
              <p className="text-sm text-foreground font-medium">Import klar!</p>
              <p className="text-xs text-muted-foreground">{stands.length} bestånd importerades.</p>
              <Button onClick={() => { setDialogOpen(false); reset(); }}>Stäng</Button>
            </div>
          )}

          {step === "importing" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Importerar bestånd...</p>
            </div>
          )}

          {step === "review" && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs text-muted-foreground">Avdelningar</p>
                  <p className="text-lg font-bold text-card-foreground">{stands.length}</p>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs text-muted-foreground">Säkerhet</p>
                  <p className="text-lg font-bold text-card-foreground">{confidenceBadge(overallConfidence)}</p>
                </div>
                {importNotes && (
                  <div className="rounded-lg border border-accent/20 bg-accent/5 p-3 flex-1 min-w-[200px]">
                    <p className="text-xs text-muted-foreground mb-1">Anteckningar</p>
                    <p className="text-xs text-foreground">{importNotes}</p>
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <label className="text-sm font-medium text-foreground block mb-2">Välj fastighet att importera till *</label>
                <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
                  <SelectTrigger className="max-w-xs">
                    <SelectValue placeholder="Välj fastighet..." />
                  </SelectTrigger>
                  <SelectContent>
                    {properties.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">Granska importerade avdelningar</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Klicka på en rad för att se fullständig data. Du kan redigera, ta bort eller komplettera varje avdelning.
                </p>
                <div className="overflow-x-auto rounded-xl border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8"></TableHead>
                        <TableHead className="min-w-[70px]">Avd</TableHead>
                        <TableHead>Trädslag</TableHead>
                        <TableHead className="text-right">Areal</TableHead>
                        <TableHead className="text-right">Ålder</TableHead>
                        <TableHead>SI</TableHead>
                        <TableHead className="text-right">Volym</TableHead>
                        <TableHead>Åtgärd</TableHead>
                        <TableHead>År</TableHead>
                        <TableHead>Säkerhet</TableHead>
                        <TableHead className="w-16"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stands.map((s, idx) => (
                        <>
                          <TableRow
                            key={`row-${idx}`}
                            className={`cursor-pointer ${s.confidence !== null && s.confidence < 50 ? "bg-destructive/5" : ""} ${expandedIdx === idx ? "border-b-0" : ""}`}
                            onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                          >
                            <TableCell className="px-2">
                              {hasExtendedData(s) ? (
                                expandedIdx === idx ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                              ) : null}
                            </TableCell>
                            <TableCell>
                              {editingIdx === idx ? (
                                <Input value={s.name} onChange={e => updateStand(idx, "name", e.target.value)} className="h-7 text-xs w-16" onClick={e => e.stopPropagation()} />
                              ) : (
                                <span className="text-sm font-medium text-card-foreground">{s.name || "—"}</span>
                              )}
                            </TableCell>
                            <TableCell><span className="text-sm text-muted-foreground">{s.tree_species || "—"}</span></TableCell>
                            <TableCell className="text-right"><span className="text-sm tabular-nums">{s.area_ha ?? "—"}</span></TableCell>
                            <TableCell className="text-right"><span className="text-sm tabular-nums">{s.age ?? "—"}</span></TableCell>
                            <TableCell><span className="text-sm text-muted-foreground">{s.site_index || "—"}</span></TableCell>
                            <TableCell className="text-right"><span className="text-sm tabular-nums">{s.volume_m3sk ?? "—"}</span></TableCell>
                            <TableCell><Badge variant="secondary" className="text-xs">{s.planned_action || "—"}</Badge></TableCell>
                            <TableCell><span className="text-sm tabular-nums text-muted-foreground">{s.planned_year ?? "—"}</span></TableCell>
                            <TableCell>{confidenceBadge(s.confidence)}</TableCell>
                            <TableCell>
                              <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingIdx(editingIdx === idx ? null : idx)}>
                                  <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeStand(idx)}>
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>

                          {expandedIdx === idx && (
                            <TableRow key={`detail-${idx}`} className="bg-muted/30 hover:bg-muted/30">
                              <TableCell colSpan={11} className="p-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  {/* Column 1: Extended measurements */}
                                  <div className="space-y-1">
                                    <p className="text-xs font-semibold text-foreground mb-1.5">Beståndsmått</p>
                                    <DetailItem label="Hkl" value={s.huggningsklass} />
                                    <DetailItem label="Målklass" value={s.goal_class} />
                                    <DetailItem label="Medeldiameter" value={s.mean_diameter_cm ? `${s.mean_diameter_cm} cm` : null} />
                                    <DetailItem label="Medelhöjd" value={s.mean_height_m ? `${s.mean_height_m} m` : null} />
                                    <DetailItem label="Grundyta" value={s.basal_area_m2 ? `${s.basal_area_m2} m²/ha` : null} />
                                    <DetailItem label="Tillväxt" value={s.annual_growth_m3sk ? `${s.annual_growth_m3sk} m³sk/år` : null} />
                                    <DetailItem label="Volym/ha" value={s.volume_per_ha ? `${s.volume_per_ha} m³sk` : null} />
                                    <DetailItem label="Skifte" value={s.parcel_number} />
                                    <DetailItem label="Skikt" value={s.layer} />

                                    {s.species_breakdown && s.species_breakdown.length > 0 && (
                                      <div className="mt-2">
                                        <p className="text-xs font-semibold text-foreground mb-1">Trädslagsfördelning</p>
                                        {s.species_breakdown.map((sp, i) => (
                                          <div key={i} className="flex justify-between text-xs py-0.5">
                                            <span className="text-muted-foreground">{sp.species}</span>
                                            <span className="text-foreground">
                                              {sp.percent != null ? `${sp.percent}%` : ""}
                                              {sp.volume_m3sk != null ? ` (${sp.volume_m3sk} m³sk)` : ""}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  {/* Column 2: Terrain & actions */}
                                  <div className="space-y-1">
                                    <p className="text-xs font-semibold text-foreground mb-1.5">Mark & terräng</p>
                                    <DetailItem label="Vegetationstyp" value={s.vegetation_type} />
                                    <DetailItem label="Fuktighet" value={s.moisture_class} />
                                    <DetailItem label="Terräng" value={s.terrain_type} />
                                    <DetailItem label="Drivning" value={s.driving_conditions} />
                                    <DetailItem label="Lutning" value={s.slope_info} />
                                    <DetailItem label="GYL" value={s.gyl_values} />

                                    <p className="text-xs font-semibold text-foreground mt-3 mb-1.5">Åtgärder</p>
                                    <DetailItem label="Åtgärd" value={s.planned_action} />
                                    <DetailItem label="Alternativ" value={s.alternative_action} />
                                    <DetailItem label="Timing" value={s.timing_code} />
                                    <DetailItem label="Uttag %" value={s.removal_percent != null ? `${s.removal_percent}%` : null} />
                                    <DetailItem label="Uttag m³sk" value={s.removal_volume_m3sk != null ? `${s.removal_volume_m3sk}` : null} />
                                  </div>

                                  {/* Column 3: Descriptions */}
                                  <div className="space-y-1">
                                    <p className="text-xs font-semibold text-foreground mb-1.5">Beskrivningar</p>
                                    <DetailItem label="Produktionsmål" value={s.production_goal} />
                                    <DetailItem label="Speciella värden" value={s.special_values} />
                                    {s.description && (
                                      <div className="mt-1">
                                        <p className="text-xs text-muted-foreground">Beskrivning</p>
                                        <p className="text-xs text-foreground mt-0.5">{s.description}</p>
                                      </div>
                                    )}
                                    {s.general_comment && (
                                      <div className="mt-1">
                                        <p className="text-xs text-muted-foreground">Kommentar</p>
                                        <p className="text-xs text-foreground mt-0.5">{s.general_comment}</p>
                                      </div>
                                    )}
                                    {s.action_comment && (
                                      <div className="mt-1">
                                        <p className="text-xs text-muted-foreground">Åtgärdskommentar</p>
                                        <p className="text-xs text-foreground mt-0.5">{s.action_comment}</p>
                                      </div>
                                    )}
                                    {s.notes && (
                                      <div className="mt-1">
                                        <p className="text-xs text-muted-foreground">Anteckningar</p>
                                        <p className="text-xs text-foreground mt-0.5">{s.notes}</p>
                                      </div>
                                    )}
                                    {s.raw_description_text && (
                                      <div className="mt-2 p-2 rounded bg-muted/50 border border-border">
                                        <p className="text-xs text-muted-foreground mb-1">Råtext från PDF</p>
                                        <p className="text-xs text-foreground whitespace-pre-wrap font-mono">{s.raw_description_text}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Per-field confidence */}
                                {s.field_confidence_map && Object.keys(s.field_confidence_map).length > 0 && (
                                  <div className="mt-3 pt-3 border-t border-border">
                                    <p className="text-xs text-muted-foreground mb-1.5">Osäkerhet per fält</p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {Object.entries(s.field_confidence_map).map(([field, level]) => (
                                        <Badge
                                          key={field}
                                          variant="outline"
                                          className={`text-[10px] ${
                                            level === "high" ? "border-primary/30 text-primary" :
                                            level === "medium" ? "border-accent/30 text-accent" :
                                            level === "low" ? "border-destructive/30 text-destructive" :
                                            "border-muted-foreground/30 text-muted-foreground"
                                          }`}
                                        >
                                          {field}: {level}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => { setDialogOpen(false); reset(); }}>Avbryt</Button>
                <Button
                  onClick={handleApprove}
                  disabled={!selectedPropertyId || stands.length === 0}
                  className="gap-1.5"
                >
                  <Check className="h-4 w-4" /> Godkänn och importera ({stands.length} avdelningar)
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
