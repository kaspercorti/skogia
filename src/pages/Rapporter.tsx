import { useState, useMemo } from "react";
import { BarChart3, FileText, CheckCircle2, Download, ChevronRight, Scale, Receipt, FileCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTransactions, useBankAccounts, useInvoices, fmt, calcResultat, calcVat } from "@/hooks/useSkogskollData";

type ReportType = "resultat" | "balans" | "moms" | "deklaration" | null;

export default function Rapporter() {
  const [activeReport, setActiveReport] = useState<ReportType>(null);
  const { data: transactions = [] } = useTransactions();
  const { data: bankAccounts = [] } = useBankAccounts();
  const { data: invoices = [] } = useInvoices();

  const year = new Date().getFullYear();

  const yearTx = useMemo(() => transactions.filter(t => new Date(t.date).getFullYear() === year), [transactions, year]);

  const intaktsKategorier = useMemo(() => {
    const map: Record<string, number> = {};
    yearTx.filter(t => t.type === "income").forEach(t => {
      const cat = t.category || "Övrigt";
      map[cat] = (map[cat] || 0) + t.amount;
    });
    return Object.entries(map).map(([namn, belopp]) => ({ namn, belopp }));
  }, [yearTx]);

  const kostnadsKategorier = useMemo(() => {
    const map: Record<string, number> = {};
    yearTx.filter(t => t.type === "expense").forEach(t => {
      const cat = t.category || "Övrigt";
      map[cat] = (map[cat] || 0) + t.amount;
    });
    return Object.entries(map).map(([namn, belopp]) => ({ namn, belopp }));
  }, [yearTx]);

  const totalIntakter = intaktsKategorier.reduce((s, r) => s + r.belopp, 0);
  const totalKostnader = kostnadsKategorier.reduce((s, r) => s + r.belopp, 0);
  const resultat = totalIntakter - totalKostnader;

  const totalTillgangar = bankAccounts.reduce((s, a) => s + a.current_balance, 0) + invoices.filter(i => i.status !== "paid").reduce((s, i) => s + i.amount_inc_vat, 0);

  const vat = calcVat(transactions, year);

  const REPORTS: { type: ReportType; label: string; icon: React.ReactNode; desc: string; color: string }[] = [
    { type: "resultat", label: "Resultaträkning", icon: <FileText className="h-6 w-6" />, desc: "Intäkter, kostnader och resultat", color: "text-primary" },
    { type: "balans", label: "Balansrapport", icon: <Scale className="h-6 w-6" />, desc: "Tillgångar och saldon", color: "text-accent" },
    { type: "moms", label: "Momsrapport", icon: <Receipt className="h-6 w-6" />, desc: "Utgående och ingående moms", color: "text-primary" },
    { type: "deklaration", label: "Deklarationsunderlag", icon: <FileCheck className="h-6 w-6" />, desc: "Underlag för skogsnäringsverksamhet", color: "text-accent" },
  ];

  const handleExport = (name: string) => {
    let content = `${name.toUpperCase()} ${year}\n${"=".repeat(40)}\n\n`;
    if (activeReport === "resultat") {
      content += "INTÄKTER\n";
      intaktsKategorier.forEach(r => { content += `  ${r.namn}: ${fmt(r.belopp)}\n`; });
      content += `\n  Summa intäkter: ${fmt(totalIntakter)}\n\nKOSTNADER\n`;
      kostnadsKategorier.forEach(r => { content += `  ${r.namn}: ${fmt(r.belopp)}\n`; });
      content += `\n  Summa kostnader: ${fmt(totalKostnader)}\n\n  RESULTAT: ${fmt(resultat)}\n`;
    } else if (activeReport === "moms") {
      content += `  Utgående moms: ${fmt(vat.inVat)}\n  Ingående moms: ${fmt(vat.outVat)}\n\n  Moms att betala: ${fmt(vat.netVat)}\n`;
    }
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}_${year}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="flex-1 p-4 md:p-8 overflow-auto">
      <div className="rounded-xl border-2 border-primary/30 bg-gradient-to-r from-primary/5 to-accent/5 p-5 mb-6 flex items-center gap-4">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <CheckCircle2 className="h-6 w-6 text-primary" />
        </div>
        <div>
          <p className="font-display text-lg md:text-xl font-bold text-foreground">Rapporter baserade på bokföringsdata ✅</p>
          <p className="text-sm text-muted-foreground">Alla belopp beräknas från dina transaktioner.</p>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <BarChart3 className="h-7 w-7 text-primary" />
        <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Rapporter</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Resultat {year}</p>
          <p className={cn("text-lg font-bold tabular-nums", resultat >= 0 ? "text-primary" : "text-destructive")}>{fmt(resultat)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Banksaldo</p>
          <p className="text-lg font-bold tabular-nums text-card-foreground">{fmt(totalTillgangar)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Moms att betala</p>
          <p className="text-lg font-bold tabular-nums text-accent">{fmt(vat.netVat)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Intäkter</p>
          <p className="text-lg font-bold tabular-nums text-card-foreground">{fmt(totalIntakter)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        {REPORTS.map(r => (
          <button key={r.type} onClick={() => setActiveReport(r.type)} className="rounded-xl border border-border bg-card p-5 text-left hover:border-primary/30 hover:shadow-sm transition-all group">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={cn("h-10 w-10 rounded-lg bg-muted flex items-center justify-center", r.color)}>{r.icon}</div>
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

      <Dialog open={activeReport !== null} onOpenChange={open => !open && setActiveReport(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              {activeReport === "resultat" && `Resultaträkning ${year}`}
              {activeReport === "balans" && `Balansrapport ${year}`}
              {activeReport === "moms" && `Momsrapport ${year}`}
              {activeReport === "deklaration" && `Deklarationsunderlag ${year}`}
            </DialogTitle>
          </DialogHeader>

          {activeReport === "resultat" && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-card-foreground mb-2">Intäkter</h4>
                <Table><TableBody>
                  {intaktsKategorier.map(r => (
                    <TableRow key={r.namn}><TableCell className="text-sm py-1.5">{r.namn}</TableCell><TableCell className="text-right text-sm tabular-nums font-medium text-primary py-1.5">{fmt(r.belopp)}</TableCell></TableRow>
                  ))}
                  <TableRow><TableCell className="text-sm font-semibold py-1.5">Summa intäkter</TableCell><TableCell className="text-right text-sm tabular-nums font-bold text-primary py-1.5">{fmt(totalIntakter)}</TableCell></TableRow>
                </TableBody></Table>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-card-foreground mb-2">Kostnader</h4>
                <Table><TableBody>
                  {kostnadsKategorier.map(r => (
                    <TableRow key={r.namn}><TableCell className="text-sm py-1.5">{r.namn}</TableCell><TableCell className="text-right text-sm tabular-nums font-medium py-1.5">{fmt(r.belopp)}</TableCell></TableRow>
                  ))}
                  <TableRow><TableCell className="text-sm font-semibold py-1.5">Summa kostnader</TableCell><TableCell className="text-right text-sm tabular-nums font-bold py-1.5">{fmt(totalKostnader)}</TableCell></TableRow>
                </TableBody></Table>
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
                <h4 className="text-sm font-semibold text-card-foreground mb-2">Bankkonton</h4>
                <Table><TableBody>
                  {bankAccounts.map(a => (
                    <TableRow key={a.id}><TableCell className="text-sm py-1.5">{a.bank_name} – {a.account_name}</TableCell><TableCell className="text-right text-sm tabular-nums font-medium py-1.5">{fmt(a.current_balance)}</TableCell></TableRow>
                  ))}
                </TableBody></Table>
              </div>
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 flex justify-between items-center">
                <span className="font-display font-semibold text-card-foreground">Totalt banksaldo</span>
                <span className="text-xl font-bold tabular-nums text-primary">{fmt(bankAccounts.reduce((s, a) => s + a.current_balance, 0))}</span>
              </div>
            </div>
          )}

          {activeReport === "moms" && (
            <div className="space-y-4">
              <Table><TableBody>
                <TableRow><TableCell className="text-sm py-2">Utgående moms</TableCell><TableCell className="text-right text-sm tabular-nums font-medium py-2">{fmt(vat.inVat)}</TableCell></TableRow>
                <TableRow><TableCell className="text-sm py-2">Ingående moms</TableCell><TableCell className="text-right text-sm tabular-nums font-medium py-2">−{fmt(vat.outVat)}</TableCell></TableRow>
              </TableBody></Table>
              <div className="rounded-lg bg-accent/5 border border-accent/20 p-3 flex justify-between items-center">
                <span className="font-display font-semibold text-card-foreground">Moms att betala</span>
                <span className="text-xl font-bold tabular-nums text-accent">{fmt(vat.netVat)}</span>
              </div>
              <Button onClick={() => handleExport("momsrapport")} className="w-full gap-2"><Download className="h-4 w-4" />Exportera</Button>
            </div>
          )}

          {activeReport === "deklaration" && (
            <div className="space-y-4">
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                <p className="text-sm text-card-foreground">Alla uppgifter sammanställda från bokföringen.</p>
              </div>
              <Table><TableHeader><TableRow><TableHead>Post</TableHead><TableHead className="text-right">Belopp</TableHead></TableRow></TableHeader>
                <TableBody>
                  <TableRow><TableCell className="text-sm py-2">Intäkter av näringsverksamhet (skog)</TableCell><TableCell className="text-right text-sm tabular-nums font-medium py-2">{fmt(totalIntakter)}</TableCell></TableRow>
                  <TableRow><TableCell className="text-sm py-2">Kostnader av näringsverksamhet</TableCell><TableCell className="text-right text-sm tabular-nums font-medium py-2">{fmt(totalKostnader)}</TableCell></TableRow>
                  <TableRow><TableCell className="text-sm font-semibold py-2">Resultat före avdrag</TableCell><TableCell className="text-right text-sm tabular-nums font-bold text-primary py-2">{fmt(resultat)}</TableCell></TableRow>
                  <TableRow><TableCell className="text-sm py-2">Skogsavdrag (max 50%)</TableCell><TableCell className="text-right text-sm tabular-nums font-medium py-2">−{fmt(Math.round(totalIntakter * 0.3))}</TableCell></TableRow>
                  <TableRow><TableCell className="text-sm py-2">Insättning skogskonto (max 60%)</TableCell><TableCell className="text-right text-sm tabular-nums font-medium py-2">−{fmt(Math.round(totalIntakter * 0.4))}</TableCell></TableRow>
                  <TableRow><TableCell className="text-sm font-semibold py-2">Beskattningsbar inkomst</TableCell><TableCell className="text-right text-sm tabular-nums font-bold text-accent py-2">{fmt(Math.max(0, resultat - Math.round(totalIntakter * 0.7)))}</TableCell></TableRow>
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
