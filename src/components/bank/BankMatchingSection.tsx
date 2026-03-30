import { useState, useMemo } from "react";
import { ArrowDownToLine, ArrowUpRight, Check, X, Plus, Search, Link2, AlertCircle, CheckCircle2, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { fmt, useInvoices, useCustomers, useBankAccounts } from "@/hooks/useSkogskollData";
import {
  useBankTransactions,
  useMatchSuggestions,
  useBankMatchingActions,
  type BankTransaction,
} from "@/hooks/useBankMatching";

export default function BankMatchingSection() {
  const { data: bankTransactions = [] } = useBankTransactions();
  const { data: invoices = [] } = useInvoices();
  const { data: customers = [] } = useCustomers();
  const { data: bankAccounts = [] } = useBankAccounts();
  const suggestions = useMatchSuggestions(bankTransactions, invoices as any, customers);
  const { confirmMatch, dismissSuggestion, addBankTransaction } = useBankMatchingActions();

  const [tab, setTab] = useState("unmatched");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [manualMatchDialog, setManualMatchDialog] = useState<BankTransaction | null>(null);
  const [newBt, setNewBt] = useState({
    date: new Date().toISOString().slice(0, 10),
    amount: "",
    description: "",
    reference: "",
    direction: "in",
    bank_account_id: "",
  });

  const unmatched = useMemo(
    () => bankTransactions.filter((bt) => bt.match_status === "unmatched"),
    [bankTransactions]
  );
  const matched = useMemo(
    () => bankTransactions.filter((bt) => bt.match_status === "matched"),
    [bankTransactions]
  );

  // Suggested bank tx IDs for badge coloring
  const suggestedBtIds = new Set(suggestions.map((s) => s.bankTransaction.id));

  const openInvoices = useMemo(
    () => invoices.filter((i) => i.status === "unpaid" || i.status === "overdue"),
    [invoices]
  );

  const handleAdd = async () => {
    if (!newBt.amount || !newBt.description) return;
    await addBankTransaction({
      bank_account_id: newBt.bank_account_id,
      date: newBt.date,
      amount: Math.abs(Number(newBt.amount)),
      description: newBt.description,
      reference: newBt.reference,
      direction: newBt.direction,
    });
    setNewBt({ date: new Date().toISOString().slice(0, 10), amount: "", description: "", reference: "", direction: "in", bank_account_id: "" });
    setAddDialogOpen(false);
  };

  const handleManualMatch = async (bt: BankTransaction, invoiceId: string) => {
    const inv = invoices.find((i) => i.id === invoiceId);
    if (!inv) return;
    await confirmMatch(bt, inv as any);
    setManualMatchDialog(null);
  };

  const handleConfirmSuggestion = async (suggestion: typeof suggestions[0]) => {
    const inv = invoices.find((i) => i.id === suggestion.invoiceId);
    if (!inv) return;
    await confirmMatch(suggestion.bankTransaction, inv as any);
  };

  const customerName = (id: string | null) => customers.find((c) => c.id === id)?.name || "—";
  const invoiceById = (id: string | null) => invoices.find((i) => i.id === id);

  return (
    <div className="space-y-4 mt-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link2 className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-semibold text-foreground">Bankmatchning</h2>
          <Badge variant="secondary" className="text-xs">
            {unmatched.length} omatchade
          </Badge>
          {suggestions.length > 0 && (
            <Badge variant="outline" className="text-xs bg-accent/10 text-accent border-accent/20">
              {suggestions.length} förslag
            </Badge>
          )}
        </div>
        <Button size="sm" className="gap-1.5 text-xs" onClick={() => setAddDialogOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Lägg till
        </Button>
      </div>

      {/* Add bank transaction dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Lägg till banktransaktion</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Datum</Label>
                <Input type="date" value={newBt.date} onChange={(e) => setNewBt({ ...newBt, date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Riktning</Label>
                <Select value={newBt.direction} onValueChange={(v) => setNewBt({ ...newBt, direction: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in">Inbetalning</SelectItem>
                    <SelectItem value="out">Utbetalning</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Belopp (kr)</Label>
              <Input type="number" placeholder="0" value={newBt.amount} onChange={(e) => setNewBt({ ...newBt, amount: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Beskrivning</Label>
              <Input placeholder="T.ex. Norra Skog inbetalning" value={newBt.description} onChange={(e) => setNewBt({ ...newBt, description: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Referens</Label>
              <Input placeholder="T.ex. fakturanummer" value={newBt.reference} onChange={(e) => setNewBt({ ...newBt, reference: e.target.value })} />
            </div>
            {bankAccounts.length > 0 && (
              <div className="space-y-1.5">
                <Label>Bankkonto</Label>
                <Select value={newBt.bank_account_id} onValueChange={(v) => setNewBt({ ...newBt, bank_account_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Välj konto..." /></SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((ba) => (
                      <SelectItem key={ba.id} value={ba.id}>{ba.bank_name} – {ba.account_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button onClick={handleAdd} className="mt-2 w-full">Spara</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manual match dialog */}
      <Dialog open={!!manualMatchDialog} onOpenChange={() => setManualMatchDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Välj faktura att matcha</DialogTitle></DialogHeader>
          {manualMatchDialog && (
            <div className="space-y-3 py-2">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Banktransaktion</p>
                <p className="text-sm font-medium text-card-foreground">{manualMatchDialog.description}</p>
                <p className="text-sm font-semibold text-primary tabular-nums">{fmt(manualMatchDialog.amount)}</p>
                <p className="text-xs text-muted-foreground">{manualMatchDialog.date}</p>
              </div>
              {openInvoices.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Inga obetalda fakturor</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {openInvoices.map((inv) => (
                    <button
                      key={inv.id}
                      onClick={() => handleManualMatch(manualMatchDialog, inv.id)}
                      className="w-full text-left rounded-lg border border-border bg-card p-3 hover:border-primary/40 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-card-foreground">#{inv.invoice_number} – {customerName(inv.customer_id)}</span>
                        <span className="text-sm font-semibold tabular-nums text-card-foreground">{fmt(inv.amount_inc_vat)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{inv.description}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="unmatched">Omatchade ({unmatched.length})</TabsTrigger>
          <TabsTrigger value="suggestions">
            Förslag ({suggestions.length})
          </TabsTrigger>
          <TabsTrigger value="matched">Matchade ({matched.length})</TabsTrigger>
        </TabsList>

        {/* Unmatched */}
        <TabsContent value="unmatched" className="mt-3">
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Beskrivning</TableHead>
                  <TableHead className="hidden md:table-cell">Referens</TableHead>
                  <TableHead className="text-right">Belopp</TableHead>
                  <TableHead className="w-[120px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unmatched.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Inga omatchade transaktioner</TableCell></TableRow>
                ) : (
                  unmatched.map((bt) => (
                    <TableRow key={bt.id}>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{bt.date}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={cn("h-6 w-6 rounded-full flex items-center justify-center shrink-0", bt.direction === "in" ? "bg-primary/10" : "bg-destructive/10")}>
                            {bt.direction === "in" ? <ArrowDownToLine className="h-3 w-3 text-primary" /> : <ArrowUpRight className="h-3 w-3 text-destructive" />}
                          </div>
                          <span className="text-sm text-card-foreground">{bt.description || "—"}</span>
                          {suggestedBtIds.has(bt.id) && (
                            <Badge variant="outline" className="text-[10px] bg-accent/10 text-accent border-accent/20">Förslag finns</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground font-mono">{bt.reference || "—"}</TableCell>
                      <TableCell className={cn("text-right text-sm font-semibold tabular-nums", bt.direction === "in" ? "text-primary" : "text-card-foreground")}>
                        {bt.direction === "in" ? "+" : "−"}{bt.amount.toLocaleString("sv-SE")} kr
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setManualMatchDialog(bt)}>
                          <Search className="h-3 w-3" /> Matcha
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Suggestions */}
        <TabsContent value="suggestions" className="mt-3">
          <div className="space-y-3">
            {suggestions.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
                Inga matchningsförslag just nu
              </div>
            ) : (
              suggestions.map((s, i) => (
                <div key={`${s.bankTransaction.id}-${s.invoiceId}-${i}`} className={cn(
                  "rounded-xl border bg-card p-4 transition-all",
                  s.confidence === "high" ? "border-primary/30" : "border-accent/30"
                )}>
                  <div className="flex items-start gap-3">
                    <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", s.confidence === "high" ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent")}>
                      {s.confidence === "high" ? <CheckCircle2 className="h-5 w-5" /> : <HelpCircle className="h-5 w-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge variant="outline" className={cn("text-xs", s.confidence === "high" ? "bg-primary/10 text-primary border-primary/20" : "bg-accent/10 text-accent border-accent/20")}>
                          {s.confidence === "high" ? "Säker matchning" : "Möjlig matchning"}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                        <div className="rounded-lg border border-border bg-muted/30 p-2.5">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Banktransaktion</p>
                          <p className="text-sm text-card-foreground">{s.bankTransaction.description}</p>
                          <p className="text-sm font-semibold tabular-nums text-primary">{fmt(s.bankTransaction.amount)}</p>
                          <p className="text-xs text-muted-foreground">{s.bankTransaction.date}</p>
                        </div>
                        <div className="rounded-lg border border-border bg-muted/30 p-2.5">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Faktura</p>
                          <p className="text-sm text-card-foreground">#{s.invoiceNumber} – {s.customerName}</p>
                          <p className="text-sm font-semibold tabular-nums text-card-foreground">{fmt(s.invoiceAmount)}</p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">Matchad pga: {s.reasons.join(", ")}</p>
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <Button size="sm" className="h-7 text-xs gap-1" onClick={() => handleConfirmSuggestion(s)}>
                        <Check className="h-3 w-3" /> Godkänn
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" onClick={() => dismissSuggestion(s.bankTransaction.id)}>
                        <X className="h-3 w-3" /> Avvisa
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        {/* Matched */}
        <TabsContent value="matched" className="mt-3">
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Beskrivning</TableHead>
                  <TableHead>Kopplad faktura</TableHead>
                  <TableHead className="text-right">Belopp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matched.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Inga matchade transaktioner</TableCell></TableRow>
                ) : (
                  matched.map((bt) => {
                    const inv = invoiceById(bt.matched_invoice_id);
                    return (
                      <TableRow key={bt.id}>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{bt.date}</TableCell>
                        <TableCell className="text-sm text-card-foreground">{bt.description || "—"}</TableCell>
                        <TableCell>
                          {inv ? (
                            <div className="flex items-center gap-1.5">
                              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                              <span className="text-sm text-card-foreground">#{inv.invoice_number} – {customerName(inv.customer_id)}</span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm font-semibold tabular-nums text-primary">
                          +{bt.amount.toLocaleString("sv-SE")} kr
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
