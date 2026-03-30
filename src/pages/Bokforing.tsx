import { useState, useMemo } from "react";
import { BookOpen, Plus, Filter, ArrowDownLeft, ArrowUpRight, X } from "lucide-react";
import { ReceiptSection } from "@/components/receipt/ReceiptSection";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useTransactions, useProperties, fmt } from "@/hooks/useSkogskollData";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useQueryClient } from "@tanstack/react-query";

export default function Bokforing() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: transactions = [] } = useTransactions();
  const { data: properties = [] } = useProperties();

  const [filterCategory, setFilterCategory] = useState("all");
  const [filterProperty, setFilterProperty] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const [newTx, setNewTx] = useState({
    date: new Date().toISOString().slice(0, 10),
    description: "",
    amount: "",
    type: "expense" as "income" | "expense",
    category: "",
    property_id: "",
    vat_amount: "25",
  });

  const categories = useMemo(() => {
    const cats = new Set(transactions.map(t => t.category).filter(Boolean));
    return Array.from(cats) as string[];
  }, [transactions]);

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      if (filterCategory !== "all" && tx.category !== filterCategory) return false;
      if (filterProperty !== "all" && tx.property_id !== filterProperty) return false;
      if (filterDateFrom && tx.date < filterDateFrom) return false;
      if (filterDateTo && tx.date > filterDateTo) return false;
      return true;
    });
  }, [transactions, filterCategory, filterProperty, filterDateFrom, filterDateTo]);

  const totals = useMemo(() => {
    const income = filtered.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expense = filtered.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const momsIn = filtered.filter(t => t.type === "income").reduce((s, t) => s + t.vat_amount, 0);
    const momsOut = filtered.filter(t => t.type === "expense").reduce((s, t) => s + t.vat_amount, 0);
    return { income, expense, result: income - expense, momsNet: momsIn - momsOut };
  }, [filtered]);

  const handleAdd = async () => {
    if (!newTx.description || !newTx.amount || !user) return;
    const amount = Math.abs(Number(newTx.amount));
    const vatPercent = Number(newTx.vat_amount);
    const vatAmount = Math.round(amount * vatPercent / (100 + vatPercent));
    
    const { error } = await supabase.from("transactions").insert({
      user_id: user.id,
      date: newTx.date,
      description: newTx.description,
      amount,
      type: newTx.type,
      category: newTx.category || null,
      property_id: newTx.property_id || null,
      vat_amount: vatAmount,
      status: "booked",
    });

    if (error) {
      toast.error("Kunde inte spara: " + error.message);
      return;
    }

    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    toast.success("Transaktion sparad");
    setNewTx({ date: new Date().toISOString().slice(0, 10), description: "", amount: "", type: "expense", category: "", property_id: "", vat_amount: "25" });
    setDialogOpen(false);
  };

  const clearFilters = () => {
    setFilterCategory("all");
    setFilterProperty("all");
    setFilterDateFrom("");
    setFilterDateTo("");
  };

  const hasActiveFilters = filterCategory !== "all" || filterProperty !== "all" || filterDateFrom || filterDateTo;
  const propertyName = (id: string | null) => properties.find(p => p.id === id)?.name || "—";

  return (
    <main className="flex-1 p-4 md:p-8 overflow-auto">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div className="flex items-center gap-3">
          <BookOpen className="h-7 w-7 text-primary" />
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Bokföring</h1>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Ny transaktion</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Skapa transaktion</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Datum</Label>
                  <Input type="date" value={newTx.date} onChange={e => setNewTx({ ...newTx, date: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Typ</Label>
                  <Select value={newTx.type} onValueChange={v => setNewTx({ ...newTx, type: v as "income" | "expense" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">Intäkt</SelectItem>
                      <SelectItem value="expense">Kostnad</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Beskrivning</Label>
                <Input placeholder="T.ex. Virkesförsäljning" value={newTx.description} onChange={e => setNewTx({ ...newTx, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Belopp (kr)</Label>
                  <Input type="number" placeholder="0" value={newTx.amount} onChange={e => setNewTx({ ...newTx, amount: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Moms %</Label>
                  <Select value={newTx.vat_amount} onValueChange={v => setNewTx({ ...newTx, vat_amount: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0%</SelectItem>
                      <SelectItem value="6">6%</SelectItem>
                      <SelectItem value="12">12%</SelectItem>
                      <SelectItem value="25">25%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Kategori</Label>
                  <Input placeholder="T.ex. virkesförsäljning" value={newTx.category} onChange={e => setNewTx({ ...newTx, category: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Fastighet</Label>
                  <Select value={newTx.property_id} onValueChange={v => setNewTx({ ...newTx, property_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Välj..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Ingen</SelectItem>
                      {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleAdd} className="mt-2 w-full">Spara transaktion</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <SummaryCard label="Intäkter" value={fmt(totals.income)} variant="income" />
        <SummaryCard label="Kostnader" value={fmt(totals.expense)} variant="expense" />
        <SummaryCard label="Resultat" value={fmt(totals.result)} variant={totals.result >= 0 ? "income" : "expense"} />
        <SummaryCard label="Moms (netto)" value={fmt(totals.momsNet)} variant="neutral" />
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-border bg-card p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-card-foreground">Filter</span>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-3 w-3" /> Rensa
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="text-sm"><SelectValue placeholder="Kategori" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alla kategorier</SelectItem>
              {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterProperty} onValueChange={setFilterProperty}>
            <SelectTrigger className="text-sm"><SelectValue placeholder="Fastighet" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alla fastigheter</SelectItem>
              {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="text-sm" />
          <Input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="text-sm" />
        </div>
      </div>

      {/* Receipts */}
      <div className="mb-6">
        <ReceiptSection />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Datum</TableHead>
              <TableHead>Beskrivning</TableHead>
              <TableHead className="hidden md:table-cell">Kategori</TableHead>
              <TableHead className="hidden lg:table-cell">Fastighet</TableHead>
              <TableHead className="text-right">Belopp</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Inga transaktioner matchar filtret</TableCell></TableRow>
            ) : (
              filtered.map(tx => (
                <TableRow key={tx.id}>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{tx.date}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className={cn("h-7 w-7 rounded-full flex items-center justify-center shrink-0", tx.type === "income" ? "bg-primary/10" : "bg-destructive/10")}>
                        {tx.type === "income" ? <ArrowDownLeft className="h-3.5 w-3.5 text-primary" /> : <ArrowUpRight className="h-3.5 w-3.5 text-destructive" />}
                      </div>
                      <span className="text-sm font-medium text-card-foreground">{tx.description}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell"><Badge variant="secondary" className="text-xs font-normal">{tx.category || "—"}</Badge></TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{propertyName(tx.property_id)}</TableCell>
                  <TableCell className={cn("text-right text-sm font-semibold tabular-nums whitespace-nowrap", tx.type === "income" ? "text-primary" : "text-card-foreground")}>
                    {tx.type === "income" ? "+" : "−"}{tx.amount.toLocaleString("sv-SE")} kr
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}

function SummaryCard({ label, value, variant }: { label: string; value: string; variant: "income" | "expense" | "neutral" }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={cn("text-lg md:text-xl font-bold tabular-nums", variant === "income" && "text-primary", variant === "expense" && "text-destructive", variant === "neutral" && "text-card-foreground")}>{value}</p>
    </div>
  );
}
