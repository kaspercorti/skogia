import { useState, useRef } from "react";
import { Upload, FileText, Loader2, Check, AlertTriangle, X, Edit2 } from "lucide-react";
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

interface ExtractedStand {
  name: string;
  tree_species: string | null;
  area_ha: number | null;
  age: number | null;
  volume_m3sk: number | null;
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
}

interface ForestPlanImportProps {
  properties: Property[];
}

type ImportStep = "idle" | "uploading" | "processing" | "review" | "importing" | "done" | "error";

export default function ForestPlanImport({ properties }: ForestPlanImportProps) {
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
      // Upload PDF to storage
      const filePath = `${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from("forest-plans")
        .upload(filePath, file);
      if (uploadErr) throw uploadErr;

      // Create import record
      const { data: importRec, error: insertErr } = await supabase
        .from("forest_plan_imports")
        .insert({
          user_id: user.id,
          file_name: file.name,
          file_url: filePath,
          status: "uploaded",
        })
        .select("id")
        .single();
      if (insertErr) throw insertErr;

      setImportId(importRec.id);
      setStep("processing");

      // Call edge function to parse
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

    // Reset file input
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
      // Create stands in the database
      const standsToInsert = stands.map(s => ({
        property_id: selectedPropertyId,
        name: s.name || "Okänd avdelning",
        tree_species: s.tree_species || null,
        area_ha: s.area_ha || 0,
        age: s.age || null,
        volume_m3sk: s.volume_m3sk || null,
        site_index: s.site_index || null,
        huggningsklass: s.huggningsklass || null,
        mean_diameter_cm: s.mean_diameter_cm || null,
        mean_height_m: s.mean_height_m || null,
        goal_class: s.goal_class || null,
        basal_area_m2: s.basal_area_m2 || null,
        annual_growth_m3sk: s.annual_growth_m3sk || null,
        notes: [s.description, s.notes].filter(Boolean).join(". ") || null,
        planned_action: s.planned_action || null,
        planned_year: s.planned_year || null,
      }));

      const { data: createdStands, error: standErr } = await supabase
        .from("stands")
        .insert(standsToInsert)
        .select("id, name, planned_action, planned_year");
      if (standErr) throw standErr;

      // Create forest activities for stands with planned actions
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

      // Update import record
      if (importId) {
        await supabase.from("forest_plan_imports").update({
          status: "approved",
          approved_at: new Date().toISOString(),
          extracted_stands_count: stands.length,
        }).eq("id", importId);
      }

      // Refresh data
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

  return (
    <>
      <Button variant="outline" className="gap-2" onClick={() => fileRef.current?.click()}>
        <Upload className="h-4 w-4" /> Importera skogsbruksplan
      </Button>
      <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleFileSelect} />

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o && (step === "done" || step === "error" || step === "idle")) { setDialogOpen(false); reset(); } }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Importera skogsbruksplan
            </DialogTitle>
            {fileName && <DialogDescription>{fileName}</DialogDescription>}
          </DialogHeader>

          {/* Uploading */}
          {step === "uploading" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Laddar upp PDF...</p>
            </div>
          )}

          {/* Processing */}
          {step === "processing" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-accent" />
              <p className="text-sm text-muted-foreground">Läser av avdelningsbeskrivning...</p>
              <p className="text-xs text-muted-foreground">Detta kan ta upp till en minut</p>
            </div>
          )}

          {/* Error */}
          {step === "error" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <p className="text-sm text-destructive">{errorMsg}</p>
              <Button variant="outline" onClick={() => { setDialogOpen(false); reset(); }}>Stäng</Button>
            </div>
          )}

          {/* Done */}
          {step === "done" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Check className="h-8 w-8 text-primary" />
              <p className="text-sm text-foreground font-medium">Import klar!</p>
              <p className="text-xs text-muted-foreground">{stands.length} bestånd importerades till din skogsbruksplan.</p>
              <Button onClick={() => { setDialogOpen(false); reset(); }}>Stäng</Button>
            </div>
          )}

          {/* Importing */}
          {step === "importing" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Importerar bestånd...</p>
            </div>
          )}

          {/* Review */}
          {step === "review" && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="flex flex-wrap gap-3">
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs text-muted-foreground">Avdelningar hittade</p>
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

              {/* Property selection */}
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <label className="text-sm font-medium text-foreground block mb-2">
                  Välj fastighet att importera till *
                </label>
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

              {/* Stands table */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">
                  Granska importerade avdelningar
                </h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Kontrollera uppgifter innan import. Du kan redigera, ta bort eller komplettera varje rad.
                </p>
                <div className="overflow-x-auto rounded-xl border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[100px]">Avdelning</TableHead>
                        <TableHead>Trädslag</TableHead>
                        <TableHead className="text-right">Areal (ha)</TableHead>
                        <TableHead className="text-right">Ålder</TableHead>
                        <TableHead className="text-right">Volym (m³sk)</TableHead>
                        <TableHead>Bonitet</TableHead>
                        <TableHead>Åtgärd</TableHead>
                        <TableHead>År</TableHead>
                        <TableHead>Säkerhet</TableHead>
                        <TableHead className="w-16"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stands.map((s, idx) => (
                        <TableRow key={idx} className={s.confidence !== null && s.confidence < 50 ? "bg-destructive/5" : ""}>
                          <TableCell>
                            {editingIdx === idx ? (
                              <Input value={s.name} onChange={e => updateStand(idx, "name", e.target.value)} className="h-7 text-xs w-24" />
                            ) : (
                              <span className="text-sm font-medium text-card-foreground">{s.name || "—"}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {editingIdx === idx ? (
                              <Input value={s.tree_species || ""} onChange={e => updateStand(idx, "tree_species", e.target.value)} className="h-7 text-xs w-20" />
                            ) : (
                              <span className="text-sm text-muted-foreground">{s.tree_species || "—"}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {editingIdx === idx ? (
                              <Input type="number" value={s.area_ha ?? ""} onChange={e => updateStand(idx, "area_ha", e.target.value ? Number(e.target.value) : null)} className="h-7 text-xs w-16" />
                            ) : (
                              <span className="text-sm tabular-nums text-card-foreground">{s.area_ha ?? "—"}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {editingIdx === idx ? (
                              <Input type="number" value={s.age ?? ""} onChange={e => updateStand(idx, "age", e.target.value ? Number(e.target.value) : null)} className="h-7 text-xs w-16" />
                            ) : (
                              <span className="text-sm tabular-nums text-muted-foreground">{s.age ?? "—"}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {editingIdx === idx ? (
                              <Input type="number" value={s.volume_m3sk ?? ""} onChange={e => updateStand(idx, "volume_m3sk", e.target.value ? Number(e.target.value) : null)} className="h-7 text-xs w-16" />
                            ) : (
                              <span className="text-sm tabular-nums text-card-foreground">{s.volume_m3sk ?? "—"}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {editingIdx === idx ? (
                              <Input value={s.site_index || ""} onChange={e => updateStand(idx, "site_index", e.target.value)} className="h-7 text-xs w-16" />
                            ) : (
                              <span className="text-sm text-muted-foreground">{s.site_index || "—"}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {editingIdx === idx ? (
                              <Select value={s.planned_action || ""} onValueChange={v => updateStand(idx, "planned_action", v)}>
                                <SelectTrigger className="h-7 text-xs w-28"><SelectValue placeholder="Välj..." /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="slutavverkning">Slutavverkning</SelectItem>
                                  <SelectItem value="gallring">Gallring</SelectItem>
                                  <SelectItem value="röjning">Röjning</SelectItem>
                                  <SelectItem value="plantering">Plantering</SelectItem>
                                  <SelectItem value="markberedning">Markberedning</SelectItem>
                                  <SelectItem value="ingen åtgärd">Ingen åtgärd</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge variant="secondary" className="text-xs">{s.planned_action || "—"}</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {editingIdx === idx ? (
                              <Input type="number" value={s.planned_year ?? ""} onChange={e => updateStand(idx, "planned_year", e.target.value ? Number(e.target.value) : null)} className="h-7 text-xs w-16" />
                            ) : (
                              <span className="text-sm tabular-nums text-muted-foreground">{s.planned_year ?? "—"}</span>
                            )}
                          </TableCell>
                          <TableCell>{confidenceBadge(s.confidence)}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingIdx(editingIdx === idx ? null : idx)}>
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeStand(idx)}>
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
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
