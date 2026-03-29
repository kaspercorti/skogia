import { useState, useMemo } from "react";
import { BookOpen, Plus, Filter, ArrowDownLeft, ArrowUpRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

// ── Types ──────────────────────────────────────────────
type TxType = "income" | "expense";

const SKOGS_CATEGORIES = [
  "Avverkning",
  "Gallring",
  "Plantering",
  "Väg",
  "Maskiner",
  "Övrigt",
] as const;
type SkogsCategory = (typeof SKOGS_CATEGORIES)[number];

const FASTIGHETER = ["Norrskog 1:4", "Mellanbyn 2:7", "Södermark 3:1"] as const;

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: TxType;
  category: SkogsCategory;
  fastighet: string;
  momsPercent: number;
  linkedTo?: string; // faktura / aktivitet
}

// ── Seed data ──────────────────────────────────────────
const SEED: Transaction[] = [
  { id: "1", date: "2024-11-15", description: "Virkesförsäljning – Holmen", amount: 95000, type: "income", category: "Avverkning", fastighet: "Norrskog 1:4", momsPercent: 25 },
  { id: "2", date: "2024-11-10", description: "Planteringskostnad vår", amount: 18500, type: "expense", category: "Plantering", fastighet: "Mellanbyn 2:7", momsPercent: 25 },
  { id: "3", date: "2024-10-28", description: "Skördare service", amount: 7200, type: "expense", category: "Maskiner", fastighet: "Norrskog 1:4", momsPercent: 25 },
  { id: "4", date: "2024-10-15", description: "Gallring avd 12", amount: 42000, type: "income", category: "Gallring", fastighet: "Södermark 3:1", momsPercent: 25 },
  { id: "5", date: "2024-08-20", description: "Virkesförsäljning – SCA", amount: 320000, type: "income", category: "Avverkning", fastighet: "Norrskog 1:4", momsPercent: 25 },
  { id: "6", date: "2024-08-05", description: "Vägunderhåll sommar", amount: 15000, type: "expense", category: "Väg", fastighet: "Mellanbyn 2:7", momsPercent: 25 },
  { id: "7", date: "2024-07-12", description: "Röjning ungskog", amount: 9800, type: "expense", category: "Gallring", fastighet: "Södermark 3:1", momsPercent: 25 },
];

let nextId = 8;

// ── Component ──────────────────────────────────────────
export default function Bokforing() {
  const [transactions, setTransactions] = useState<Transaction[]>(SEED);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterFastighet, setFilterFastighet] = useState<string>("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  // New transaction form state
  const [newTx, setNewTx] = useState({
    date: new Date().toISOString().slice(0, 10),
    description: "",
    amount: "",
    type: "expense" as TxType,
    category: "Övrigt" as SkogsCategory,
    fastighet: FASTIGHETER[0] as string,
    momsPercent: "25",
    linkedTo: "",
  });

  // ── Filters ────────────────────────────────────────
  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      if (filterCategory !== "all" && tx.category !== filterCategory) return false;
      if (filterFastighet !== "all" && tx.fastighet !== filterFastighet) return false;
      if (filterDateFrom && tx.date < filterDateFrom) return false;
      if (filterDateTo && tx.date > filterDateTo) return false;
      return true;
    });
  }, [transactions, filterCategory, filterFastighet, filterDateFrom, filterDateTo]);

  // ── Calculations ───────────────────────────────────
  const totals = useMemo(() => {
    const income = filtered.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expense = filtered.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const momsIn = filtered.filter((t) => t.type === "income").reduce((s, t) => s + (t.amount * t.momsPercent) / (100 + t.momsPercent), 0);
    const momsOut = filtered.filter((t) => t.type === "expense").reduce((s, t) => s + (t.amount * t.momsPercent) / (100 + t.momsPercent), 0);
    return {
      income,
      expense,
      result: income - expense,
      momsIn: Math.round(momsIn),
      momsOut: Math.round(momsOut),
      momsNet: Math.round(momsIn - momsOut),
      cashFlow: income - expense,
    };
  }, [filtered]);

  // ── Add transaction ────────────────────────────────
  const handleAdd = () => {
    if (!newTx.description || !newTx.amount) return;
    const tx: Transaction = {
      id: String(nextId++),
      date: newTx.date,
      description: newTx.description,
      amount: Math.abs(Number(newTx.amount)),
      type: newTx.type,
      category: newTx.category,
      fastighet: newTx.fastighet,
      momsPercent: Number(newTx.momsPercent),
      linkedTo: newTx.linkedTo || undefined,
    };
    setTransactions((prev) => [tx, ...prev]);
    setNewTx({
      date: new Date().toISOString().slice(0, 10),
      description: "",
      amount: "",
      type: "expense",
      category: "Övrigt",
      fastighet: FASTIGHETER[0],
      momsPercent: "25",
      linkedTo: "",
    });
    setDialogOpen(false);
  };

  const fmt = (n: number) => n.toLocaleString("sv-SE") + " kr";

  const clearFilters = () => {
    setFilterCategory("all");
    setFilterFastighet("all");
    setFilterDateFrom("");
    setFilterDateTo("");
  };

  const hasActiveFilters = filterCategory !== "all" || filterFastighet !== "all" || filterDateFrom || filterDateTo;

  return (
    <main className="flex-1 p-4 md:p-8 overflow-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div className="flex items-center gap-3">
          <BookOpen className="h-7 w-7 text-primary" />
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Bokföring</h1>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Ny transaktion
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Skapa transaktion</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Datum</Label>
                  <Input type="date" value={newTx.date} onChange={(e) => setNewTx({ ...newTx, date: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Typ</Label>
                  <Select value={newTx.type} onValueChange={(v) => setNewTx({ ...newTx, type: v as TxType })}>
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
                <Input placeholder="T.ex. Virkesförsäljning" value={newTx.description} onChange={(e) => setNewTx({ ...newTx, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Belopp (kr)</Label>
                  <Input type="number" placeholder="0" value={newTx.amount} onChange={(e) => setNewTx({ ...newTx, amount: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Moms %</Label>
                  <Select value={newTx.momsPercent} onValueChange={(v) => setNewTx({ ...newTx, momsPercent: v })}>
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
                  <Select value={newTx.category} onValueChange={(v) => setNewTx({ ...newTx, category: v as SkogsCategory })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SKOGS_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Fastighet</Label>
                  <Select value={newTx.fastighet} onValueChange={(v) => setNewTx({ ...newTx, fastighet: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FASTIGHETER.map((f) => (
                        <SelectItem key={f} value={f}>{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Kopplad till (valfritt)</Label>
                <Input placeholder="Fakturanr / aktivitet, t.ex. Gallring avd 5" value={newTx.linkedTo} onChange={(e) => setNewTx({ ...newTx, linkedTo: e.target.value })} />
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
              {SKOGS_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterFastighet} onValueChange={setFilterFastighet}>
            <SelectTrigger className="text-sm"><SelectValue placeholder="Fastighet" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alla fastigheter</SelectItem>
              {FASTIGHETER.map((f) => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="date" placeholder="Från" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="text-sm" />
          <Input type="date" placeholder="Till" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="text-sm" />
        </div>
      </div>

      {/* Transaction table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Datum</TableHead>
              <TableHead>Beskrivning</TableHead>
              <TableHead className="hidden md:table-cell">Kategori</TableHead>
              <TableHead className="hidden lg:table-cell">Fastighet</TableHead>
              <TableHead className="hidden lg:table-cell">Kopplad</TableHead>
              <TableHead className="text-right">Belopp</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Inga transaktioner matchar filtret
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{tx.date}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "h-7 w-7 rounded-full flex items-center justify-center shrink-0",
                        tx.type === "income" ? "bg-primary/10" : "bg-destructive/10"
                      )}>
                        {tx.type === "income" ? (
                          <ArrowDownLeft className="h-3.5 w-3.5 text-primary" />
                        ) : (
                          <ArrowUpRight className="h-3.5 w-3.5 text-destructive" />
                        )}
                      </div>
                      <span className="text-sm font-medium text-card-foreground">{tx.description}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant="secondary" className="text-xs font-normal">{tx.category}</Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{tx.fastighet}</TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{tx.linkedTo || "—"}</TableCell>
                  <TableCell className={cn(
                    "text-right text-sm font-semibold tabular-nums whitespace-nowrap",
                    tx.type === "income" ? "text-primary" : "text-card-foreground"
                  )}>
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

// ── Summary Card ─────────────────────────────────────
function SummaryCard({ label, value, variant }: { label: string; value: string; variant: "income" | "expense" | "neutral" }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={cn(
        "text-lg md:text-xl font-bold tabular-nums",
        variant === "income" && "text-primary",
        variant === "expense" && "text-destructive",
        variant === "neutral" && "text-card-foreground",
      )}>
        {value}
      </p>
    </div>
  );
}
