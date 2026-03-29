import { useState } from "react";
import { BarChart3, FileText, CheckCircle2, Download, ChevronRight, Scale, Receipt, FileCheck, Calculator } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

// ── Mock financial data (from bokföring) ───────────
const INTAKTER = [
  { konto: "3010", namn: "Virkesförsäljning", belopp: 457000 },
  { konto: "3011", namn: "Gallringsintäkter", belopp: 42000 },
  { konto: "3090", namn: "Övriga intäkter", belopp: 8500 },
];
const KOSTNADER = [
  { konto: "4010", namn: "Planteringskostnader", belopp: 18500 },
  { konto: "5010", namn: "Maskinunderhåll", belopp: 7200 },
  { konto: "5020", namn: "Skogsvårdsavgift", belopp: 3400 },
  { konto: "5030", namn: "Vägunderhåll", belopp: 15000 },
  { konto: "5040", namn: "Försäkring", belopp: 6000 },
  { konto: "6990", namn: "Övriga kostnader", belopp: 4200 },
];

const totalIntakter = INTAKTER.reduce((s, r) => s + r.belopp, 0);
const totalKostnader = KOSTNADER.reduce((s, r) => s + r.belopp, 0);
const resultat = totalIntakter - totalKostnader;

const TILLGANGAR = [
  { namn: "Skogsfastigheter", belopp: 2800000 },
  { namn: "Maskiner & inventarier", belopp: 185000 },
  { namn: "Skogskonto", belopp: 120000 },
  { namn: "Kassa & bank", belopp: 342000 },
  { namn: "Kundfordringar", belopp: 245000 },
];
const SKULDER = [
  { namn: "Banklån fastighet", belopp: 1200000 },
  { namn: "Leverantörsskulder", belopp: 28000 },
  { namn: "Skatteskuld", belopp: 85000 },
];

const totalTillgangar = TILLGANGAR.reduce((s, r) => s + r.belopp, 0);
const totalSkulder = SKULDER.reduce((s, r) => s + r.belopp, 0);
const egetKapital = totalTillgangar - totalSkulder;

const MOMS_DATA = {
  utgaendeMoms: Math.round(totalIntakter * 0.25 / 1.25),
  ingaendeMoms: Math.round(totalKostnader * 0.25 / 1.25),
};
const momsAttBetala = MOMS_DATA.utgaendeMoms - MOMS_DATA.ingaendeMoms;

const fmt = (n: number) => n.toLocaleString("sv-SE") + " kr";

type ReportType = "resultat" | "balans" | "moms" | "deklaration" | null;

const REPORTS: { type: ReportType; label: string; icon: React.ReactNode; desc: string; color: string }[] = [
  { type: "resultat", label: "Resultaträkning", icon: <FileText className="h-6 w-6" />, desc: "Intäkter, kostnader och resultat", color: "text-primary" },
  { type: "balans", label: "Balansrapport", icon: <Scale className="h-6 w-6" />, desc: "Tillgångar, skulder och eget kapital", color: "text-accent" },
  { type: "moms", label: "Momsrapport", icon: <Receipt className="h-6 w-6" />, desc: "Utgående och ingående moms", color: "text-primary" },
  { type: "deklaration", label: "Deklarationsunderlag", icon: <FileCheck className="h-6 w-6" />, desc: "Underlag för skogsnäringsverksamhet", color: "text-accent" },
];

// ── Component ──────────────────────────────────────
export default function Rapporter() {
  const [activeReport, setActiveReport] = useState<ReportType>(null);

  const handleExport = (name: string) => {
    // Build a simple text export
    let content = "";
    if (activeReport === "resultat") {
      content = `RESULTATRÄKNING 2024\n${"=".repeat(40)}\n\nINTÄKTER\n`;
      INTAKTER.forEach((r) => { content += `  ${r.konto} ${r.namn}: ${fmt(r.belopp)}\n`; });
      content += `\n  Summa intäkter: ${fmt(totalIntakter)}\n\nKOSTNADER\n`;
      KOSTNADER.forEach((r) => { content += `  ${r.konto} ${r.namn}: ${fmt(r.belopp)}\n`; });
      content += `\n  Summa kostnader: ${fmt(totalKostnader)}\n\n${"=".repeat(40)}\n  RESULTAT: ${fmt(resultat)}\n`;
    } else if (activeReport === "balans") {
      content = `BALANSRAPPORT 2024\n${"=".repeat(40)}\n\nTILLGÅNGAR\n`;
      TILLGANGAR.forEach((r) => { content += `  ${r.namn}: ${fmt(r.belopp)}\n`; });
      content += `\n  Summa tillgångar: ${fmt(totalTillgangar)}\n\nSKULDER\n`;
      SKULDER.forEach((r) => { content += `  ${r.namn}: ${fmt(r.belopp)}\n`; });
      content += `\n  Summa skulder: ${fmt(totalSkulder)}\n\n  EGET KAPITAL: ${fmt(egetKapital)}\n`;
    } else if (activeReport === "moms") {
      content = `MOMSRAPPORT 2024\n${"=".repeat(40)}\n\n  Utgående moms: ${fmt(MOMS_DATA.utgaendeMoms)}\n  Ingående moms: ${fmt(MOMS_DATA.ingaendeMoms)}\n\n  Moms att betala: ${fmt(momsAttBetala)}\n`;
    }
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}_2024.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="flex-1 p-4 md:p-8 overflow-auto">
      {/* Status banner */}
      <div className="rounded-xl border-2 border-primary/30 bg-gradient-to-r from-primary/5 to-accent/5 p-5 mb-6 flex items-center gap-4">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <CheckCircle2 className="h-6 w-6 text-primary" />
        </div>
        <div>
          <p className="font-display text-lg md:text-xl font-bold text-foreground">Redo för deklaration ✅</p>
          <p className="text-sm text-muted-foreground">Alla rapporter är uppdaterade med senaste bokföringsdata.</p>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <BarChart3 className="h-7 w-7 text-primary" />
        <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Rapporter</h1>
      </div>

      {/* Quick summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Resultat 2024</p>
          <p className={cn("text-lg font-bold tabular-nums", resultat >= 0 ? "text-primary" : "text-destructive")}>{fmt(resultat)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Eget kapital</p>
          <p className="text-lg font-bold tabular-nums text-card-foreground">{fmt(egetKapital)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Moms att betala</p>
          <p className="text-lg font-bold tabular-nums text-accent">{fmt(momsAttBetala)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Tillgångar</p>
          <p className="text-lg font-bold tabular-nums text-card-foreground">{fmt(totalTillgangar)}</p>
        </div>
      </div>

      {/* Report cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        {REPORTS.map((r) => (
          <button
            key={r.type}
            onClick={() => setActiveReport(r.type)}
            className="rounded-xl border border-border bg-card p-5 text-left hover:border-primary/30 hover:shadow-sm transition-all group"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={cn("h-10 w-10 rounded-lg bg-muted flex items-center justify-center", r.color)}>
                  {r.icon}
                </div>
                <div>
                  <p className="font-display text-base font-semibold text-card-foreground">{r.label}</p>
                  <p className="text-xs text-muted-foreground">{r.desc}</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors mt-1" />
            </div>
          </button>
        ))}
      </div>

      {/* Report dialog */}
      <Dialog open={activeReport !== null} onOpenChange={(open) => !open && setActiveReport(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              {activeReport === "resultat" && "Resultaträkning 2024"}
              {activeReport === "balans" && "Balansrapport 2024"}
              {activeReport === "moms" && "Momsrapport 2024"}
              {activeReport === "deklaration" && "Deklarationsunderlag 2024"}
            </DialogTitle>
          </DialogHeader>

          {activeReport === "resultat" && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-card-foreground mb-2">Intäkter</h4>
                <Table>
                  <TableBody>
                    {INTAKTER.map((r) => (
                      <TableRow key={r.konto}>
                        <TableCell className="text-xs text-muted-foreground font-mono py-1.5">{r.konto}</TableCell>
                        <TableCell className="text-sm py-1.5">{r.namn}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums font-medium text-primary py-1.5">{fmt(r.belopp)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={2} className="text-sm font-semibold py-1.5">Summa intäkter</TableCell>
                      <TableCell className="text-right text-sm tabular-nums font-bold text-primary py-1.5">{fmt(totalIntakter)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-card-foreground mb-2">Kostnader</h4>
                <Table>
                  <TableBody>
                    {KOSTNADER.map((r) => (
                      <TableRow key={r.konto}>
                        <TableCell className="text-xs text-muted-foreground font-mono py-1.5">{r.konto}</TableCell>
                        <TableCell className="text-sm py-1.5">{r.namn}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums font-medium py-1.5">{fmt(r.belopp)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={2} className="text-sm font-semibold py-1.5">Summa kostnader</TableCell>
                      <TableCell className="text-right text-sm tabular-nums font-bold py-1.5">{fmt(totalKostnader)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 flex justify-between items-center">
                <span className="font-display font-semibold text-card-foreground">Resultat</span>
                <span className={cn("text-xl font-bold tabular-nums", resultat >= 0 ? "text-primary" : "text-destructive")}>{fmt(resultat)}</span>
              </div>
              <Button onClick={() => handleExport("resultatrakning")} className="w-full gap-2"><Download className="h-4 w-4" />Exportera</Button>
            </div>
          )}

          {activeReport === "balans" && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-card-foreground mb-2">Tillgångar</h4>
                <Table>
                  <TableBody>
                    {TILLGANGAR.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm py-1.5">{r.namn}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums font-medium py-1.5">{fmt(r.belopp)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell className="text-sm font-semibold py-1.5">Summa tillgångar</TableCell>
                      <TableCell className="text-right text-sm tabular-nums font-bold py-1.5">{fmt(totalTillgangar)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-card-foreground mb-2">Skulder</h4>
                <Table>
                  <TableBody>
                    {SKULDER.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm py-1.5">{r.namn}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums font-medium py-1.5">{fmt(r.belopp)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell className="text-sm font-semibold py-1.5">Summa skulder</TableCell>
                      <TableCell className="text-right text-sm tabular-nums font-bold py-1.5">{fmt(totalSkulder)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 flex justify-between items-center">
                <span className="font-display font-semibold text-card-foreground">Eget kapital</span>
                <span className="text-xl font-bold tabular-nums text-primary">{fmt(egetKapital)}</span>
              </div>
              <Button onClick={() => handleExport("balansrapport")} className="w-full gap-2"><Download className="h-4 w-4" />Exportera</Button>
            </div>
          )}

          {activeReport === "moms" && (
            <div className="space-y-4">
              <Table>
                <TableBody>
                  <TableRow>
                    <TableCell className="text-sm py-2">Utgående moms (25%)</TableCell>
                    <TableCell className="text-right text-sm tabular-nums font-medium py-2">{fmt(MOMS_DATA.utgaendeMoms)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-sm py-2">Ingående moms (25%)</TableCell>
                    <TableCell className="text-right text-sm tabular-nums font-medium py-2">−{fmt(MOMS_DATA.ingaendeMoms)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <div className="rounded-lg bg-accent/5 border border-accent/20 p-3 flex justify-between items-center">
                <span className="font-display font-semibold text-card-foreground">Moms att betala</span>
                <span className="text-xl font-bold tabular-nums text-accent">{fmt(momsAttBetala)}</span>
              </div>
              <Button onClick={() => handleExport("momsrapport")} className="w-full gap-2"><Download className="h-4 w-4" />Exportera</Button>
            </div>
          )}

          {activeReport === "deklaration" && (
            <div className="space-y-4">
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                <p className="text-sm text-card-foreground">Alla uppgifter är sammanställda och klara för deklaration.</p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Post</TableHead>
                    <TableHead className="text-right">Belopp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="text-sm py-2">Intäkter av näringsverksamhet (skog)</TableCell>
                    <TableCell className="text-right text-sm tabular-nums font-medium py-2">{fmt(totalIntakter)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-sm py-2">Kostnader av näringsverksamhet</TableCell>
                    <TableCell className="text-right text-sm tabular-nums font-medium py-2">{fmt(totalKostnader)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-sm font-semibold py-2">Resultat före avdrag</TableCell>
                    <TableCell className="text-right text-sm tabular-nums font-bold text-primary py-2">{fmt(resultat)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-sm py-2">Skogsavdrag (max 50%)</TableCell>
                    <TableCell className="text-right text-sm tabular-nums font-medium py-2">−{fmt(Math.round(totalIntakter * 0.3))}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-sm py-2">Insättning skogskonto (max 60%)</TableCell>
                    <TableCell className="text-right text-sm tabular-nums font-medium py-2">−{fmt(Math.round(totalIntakter * 0.4))}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-sm font-semibold py-2">Beskattningsbar inkomst (efter avdrag)</TableCell>
                    <TableCell className="text-right text-sm tabular-nums font-bold text-accent py-2">
                      {fmt(Math.max(0, resultat - Math.round(totalIntakter * 0.3) - Math.round(totalIntakter * 0.4)))}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <p className="text-xs text-muted-foreground">* Beloppen är beräknade utifrån bokföringen. Kontrollera med din skatterådgivare.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
