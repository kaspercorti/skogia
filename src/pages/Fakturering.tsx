import { useState, useMemo } from "react";
import { FileText, Plus, Send, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type InvoiceStatus = "paid" | "unpaid" | "overdue";

interface Invoice {
  id: string;
  number: string;
  date: string;
  dueDate: string;
  customer: string;
  activity: string;
  description: string;
  amount: number;
  momsPercent: number;
  status: InvoiceStatus;
}

const CUSTOMERS = ["Holmen Skog AB", "SCA Timber", "Södra Skogsägarna", "Sveaskog", "Privat köpare"] as const;
const ACTIVITIES = ["Virkesförsäljning", "Gallring", "Avverkning", "Massaved", "Timmer", "Övrigt"] as const;

const SEED: Invoice[] = [
  { id: "1", number: "F-2024-001", date: "2024-11-01", dueDate: "2024-11-30", customer: "Holmen Skog AB", activity: "Virkesförsäljning", description: "Slutavverkning avd 7, timmer gran", amount: 245000, momsPercent: 25, status: "unpaid" },
  { id: "2", number: "F-2024-002", date: "2024-10-15", dueDate: "2024-11-15", customer: "SCA Timber", activity: "Gallring", description: "Gallringsvirke tall, avd 12", amount: 67000, momsPercent: 25, status: "overdue" },
  { id: "3", number: "F-2024-003", date: "2024-10-01", dueDate: "2024-10-31", customer: "Södra Skogsägarna", activity: "Virkesförsäljning", description: "Massaved björk", amount: 40000, momsPercent: 25, status: "overdue" },
  { id: "4", number: "F-2024-004", date: "2024-09-20", dueDate: "2024-10-20", customer: "Holmen Skog AB", activity: "Avverkning", description: "Slutavverkning avd 3, tall", amount: 320000, momsPercent: 25, status: "paid" },
  { id: "5", number: "F-2024-005", date: "2024-09-05", dueDate: "2024-10-05", customer: "Privat köpare", activity: "Timmer", description: "Husbehovsvirke gran", amount: 18500, momsPercent: 25, status: "paid" },
  { id: "6", number: "F-2024-006", date: "2024-08-15", dueDate: "2024-09-15", customer: "Sveaskog", activity: "Virkesförsäljning", description: "Timmer och massaved, avd 9", amount: 189000, momsPercent: 25, status: "paid" },
];

let nextNum = 7;

export default function Fakturering() {
  const [invoices, setInvoices] = useState<Invoice[]>(SEED);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tab, setTab] = useState("all");

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    dueDate: "",
    customer: CUSTOMERS[0] as string,
    activity: ACTIVITIES[0] as string,
    description: "",
    amount: "",
    momsPercent: "25",
  });

  const totals = useMemo(() => {
    const unpaid = invoices.filter((i) => i.status === "unpaid").reduce((s, i) => s + i.amount, 0);
    const overdue = invoices.filter((i) => i.status === "overdue").reduce((s, i) => s + i.amount, 0);
    return { unpaid, overdue, outstanding: unpaid + overdue };
  }, [invoices]);

  const filtered = useMemo(() => {
    if (tab === "all") return invoices;
    return invoices.filter((i) => i.status === tab);
  }, [invoices, tab]);

  const handleAdd = () => {
    if (!form.description || !form.amount) return;
    const inv: Invoice = {
      id: String(nextNum),
      number: `F-2024-${String(nextNum).padStart(3, "0")}`,
      date: form.date,
      dueDate: form.dueDate || form.date,
      customer: form.customer,
      activity: form.activity,
      description: form.description,
      amount: Math.abs(Number(form.amount)),
      momsPercent: Number(form.momsPercent),
      status: "unpaid",
    };
    nextNum++;
    setInvoices((prev) => [inv, ...prev]);
    setForm({ date: new Date().toISOString().slice(0, 10), dueDate: "", customer: CUSTOMERS[0], activity: ACTIVITIES[0], description: "", amount: "", momsPercent: "25" });
    setDialogOpen(false);
  };

  const togglePaid = (id: string) => {
    setInvoices((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: (i.status === "paid" ? "unpaid" : "paid") as InvoiceStatus } : i))
    );
  };

  const fmt = (n: number) => n.toLocaleString("sv-SE") + " kr";

  const statusConfig: Record<InvoiceStatus, { label: string; cls: string; icon: React.ReactNode }> = {
    paid: { label: "Betald", cls: "bg-primary/10 text-primary border-primary/20", icon: <CheckCircle2 className="h-3 w-3" /> },
    unpaid: { label: "Obetald", cls: "bg-accent/10 text-accent border-accent/20", icon: <Clock className="h-3 w-3" /> },
    overdue: { label: "Förfallen", cls: "bg-destructive/10 text-destructive border-destructive/20", icon: <AlertTriangle className="h-3 w-3" /> },
  };

  return (
    <main className="flex-1 p-4 md:p-8 overflow-auto">
      {/* Hero banner */}
      <div className="rounded-xl border border-accent/30 bg-accent/5 p-5 mb-6">
        <p className="text-sm text-muted-foreground mb-1">Att få in</p>
        <p className="text-3xl md:text-4xl font-display font-bold text-accent">{fmt(totals.outstanding)}</p>
        <div className="flex flex-wrap gap-4 mt-2 text-sm">
          <span className="text-muted-foreground">
            <Clock className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />Obetalda: <span className="font-semibold text-card-foreground">{fmt(totals.unpaid)}</span>
          </span>
          <span className="text-muted-foreground">
            <AlertTriangle className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />Förfallna: <span className="font-semibold text-destructive">{fmt(totals.overdue)}</span>
          </span>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-5">
        <div className="flex items-center gap-3">
          <FileText className="h-7 w-7 text-primary" />
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Fakturering</h1>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Ny faktura</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Skapa faktura</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Fakturadatum</Label>
                  <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Förfallodatum</Label>
                  <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Kund</Label>
                <Select value={form.customer} onValueChange={(v) => setForm({ ...form, customer: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CUSTOMERS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Kopplad aktivitet</Label>
                <Select value={form.activity} onValueChange={(v) => setForm({ ...form, activity: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACTIVITIES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Beskrivning</Label>
                <Input placeholder="T.ex. Timmer gran avd 7" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Belopp (kr inkl. moms)</Label>
                  <Input type="number" placeholder="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Moms %</Label>
                  <Select value={form.momsPercent} onValueChange={(v) => setForm({ ...form, momsPercent: v })}>
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
              <Button onClick={handleAdd} className="mt-2 w-full gap-2"><Send className="h-4 w-4" />Skapa faktura</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabs & Table */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="all">Alla ({invoices.length})</TabsTrigger>
          <TabsTrigger value="unpaid">Obetalda ({invoices.filter((i) => i.status === "unpaid").length})</TabsTrigger>
          <TabsTrigger value="overdue">Förfallna ({invoices.filter((i) => i.status === "overdue").length})</TabsTrigger>
          <TabsTrigger value="paid">Betalda ({invoices.filter((i) => i.status === "paid").length})</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-0">
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nr</TableHead>
                  <TableHead>Kund</TableHead>
                  <TableHead className="hidden md:table-cell">Beskrivning</TableHead>
                  <TableHead className="hidden lg:table-cell">Aktivitet</TableHead>
                  <TableHead className="hidden md:table-cell">Förfaller</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Belopp</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">Inga fakturor</TableCell>
                  </TableRow>
                ) : (
                  filtered.map((inv) => {
                    const sc = statusConfig[inv.status];
                    return (
                      <TableRow key={inv.id}>
                        <TableCell className="text-sm font-mono text-muted-foreground">{inv.number}</TableCell>
                        <TableCell className="text-sm font-medium text-card-foreground">{inv.customer}</TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-[200px] truncate">{inv.description}</TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <Badge variant="secondary" className="text-xs font-normal">{inv.activity}</Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{inv.dueDate}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("gap-1 text-xs", sc.cls)}>
                            {sc.icon}{sc.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm font-semibold tabular-nums whitespace-nowrap text-card-foreground">
                          {fmt(inv.amount)}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => togglePaid(inv.id)}>
                            {inv.status === "paid" ? "Ångra" : "Betald"}
                          </Button>
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
    </main>
  );
}
