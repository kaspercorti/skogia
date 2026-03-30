import { useState, useMemo } from "react";
import { FileText, Plus, Send, CheckCircle2, AlertTriangle, Clock, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useInvoices, useCustomers, useProperties, fmt } from "@/hooks/useSkogskollData";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useQueryClient } from "@tanstack/react-query";
import SendInvoiceButton from "@/components/invoice/SendInvoiceButton";
import InvoiceEmailSettings from "@/components/invoice/InvoiceEmailSettings";

export default function Fakturering() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: invoices = [] } = useInvoices();
  const { data: customers = [] } = useCustomers();
  const { data: properties = [] } = useProperties();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [tab, setTab] = useState("all");

  const [customerForm, setCustomerForm] = useState({
    name: "", organization_number: "", email: "", phone: "", address: "",
  });
  const resetCustomerForm = () => setCustomerForm({ name: "", organization_number: "", email: "", phone: "", address: "" });

  const handleAddCustomer = async () => {
    if (!customerForm.name.trim() || !user) return;
    const { data, error } = await supabase.from("customers").insert({
      user_id: user.id,
      name: customerForm.name.trim(),
      organization_number: customerForm.organization_number || null,
      email: customerForm.email || null,
      phone: customerForm.phone || null,
      address: customerForm.address || null,
    }).select().single();
    if (error) { toast.error("Kunde inte skapa kund: " + error.message); return; }
    await queryClient.invalidateQueries({ queryKey: ["customers"] });
    setForm(f => ({ ...f, customer_id: data.id }));
    resetCustomerForm();
    setCustomerDialogOpen(false);
    toast.success(`Kund "${data.name}" skapad`);
  };

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    dueDate: "",
    customer_id: "",
    property_id: "",
    description: "",
    amount: "",
    momsPercent: "25",
  });

  const totals = useMemo(() => {
    const unpaid = invoices.filter(i => i.status === "unpaid").reduce((s, i) => s + i.amount_inc_vat, 0);
    const overdue = invoices.filter(i => i.status === "overdue").reduce((s, i) => s + i.amount_inc_vat, 0);
    return { unpaid, overdue, outstanding: unpaid + overdue };
  }, [invoices]);

  const filtered = useMemo(() => {
    if (tab === "all") return invoices;
    return invoices.filter(i => i.status === tab);
  }, [invoices, tab]);

  const handleAdd = async () => {
    if (!form.description || !form.amount || !user) return;
    const amountIncVat = Math.abs(Number(form.amount));
    const vatPercent = Number(form.momsPercent);
    const vatAmount = Math.round(amountIncVat * vatPercent / (100 + vatPercent));
    const amountExVat = amountIncVat - vatAmount;

    // Generate invoice number
    const maxNum = invoices.reduce((max, i) => Math.max(max, parseInt(i.invoice_number) || 0), 1000);
    const invoiceNumber = String(maxNum + 1);

    const { error } = await supabase.from("invoices").insert({
      user_id: user.id,
      invoice_number: invoiceNumber,
      invoice_date: form.date,
      due_date: form.dueDate || form.date,
      customer_id: form.customer_id || null,
      property_id: form.property_id || null,
      description: form.description,
      amount_ex_vat: amountExVat,
      vat_amount: vatAmount,
      amount_inc_vat: amountIncVat,
      status: "unpaid",
    });

    if (error) {
      toast.error("Kunde inte skapa faktura: " + error.message);
      return;
    }

    queryClient.invalidateQueries({ queryKey: ["invoices"] });
    toast.success("Faktura skapad");
    setForm({ date: new Date().toISOString().slice(0, 10), dueDate: "", customer_id: "", property_id: "", description: "", amount: "", momsPercent: "25" });
    setDialogOpen(false);
  };

  const markAsPaid = async (invoice: typeof invoices[0]) => {
    if (!user) return;

    // Update invoice status
    const { error: updateError } = await supabase
      .from("invoices")
      .update({ status: "paid" })
      .eq("id", invoice.id);

    if (updateError) {
      toast.error("Kunde inte uppdatera: " + updateError.message);
      return;
    }

    // Create corresponding income transaction
    const { error: txError } = await supabase.from("transactions").insert({
      user_id: user.id,
      date: new Date().toISOString().slice(0, 10),
      type: "income",
      category: invoice.category || "virkesförsäljning",
      description: `Betald faktura ${invoice.invoice_number} – ${invoice.description || ""}`,
      amount: invoice.amount_ex_vat,
      vat_amount: invoice.vat_amount,
      invoice_id: invoice.id,
      property_id: invoice.property_id,
      payment_method: "bank",
      status: "booked",
    });

    if (txError) {
      toast.error("Faktura uppdaterad men transaktion kunde inte skapas: " + txError.message);
    }

    queryClient.invalidateQueries({ queryKey: ["invoices"] });
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    toast.success("Faktura markerad som betald – transaktion skapad");
  };

  const markAsUnpaid = async (invoiceId: string) => {
    await supabase.from("invoices").update({ status: "unpaid" }).eq("id", invoiceId);
    queryClient.invalidateQueries({ queryKey: ["invoices"] });
    toast.info("Faktura markerad som obetald");
  };

  const statusConfig = {
    paid: { label: "Betald", cls: "bg-primary/10 text-primary border-primary/20", icon: <CheckCircle2 className="h-3 w-3" /> },
    unpaid: { label: "Obetald", cls: "bg-accent/10 text-accent border-accent/20", icon: <Clock className="h-3 w-3" /> },
    overdue: { label: "Förfallen", cls: "bg-destructive/10 text-destructive border-destructive/20", icon: <AlertTriangle className="h-3 w-3" /> },
  } as const;

  const customerName = (id: string | null) => customers.find(c => c.id === id)?.name || "—";

  return (
    <main className="flex-1 p-4 md:p-8 overflow-auto">
      {/* Hero banner */}
      <div className="rounded-xl border border-accent/30 bg-accent/5 p-5 mb-6">
        <p className="text-sm text-muted-foreground mb-1">Att få in</p>
        <p className="text-3xl md:text-4xl font-display font-bold text-accent">{fmt(totals.outstanding)}</p>
        <div className="flex flex-wrap gap-4 mt-2 text-sm">
          <span className="text-muted-foreground"><Clock className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />Obetalda: <span className="font-semibold text-card-foreground">{fmt(totals.unpaid)}</span></span>
          <span className="text-muted-foreground"><AlertTriangle className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />Förfallna: <span className="font-semibold text-destructive">{fmt(totals.overdue)}</span></span>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-5">
        <div className="flex items-center gap-3">
          <FileText className="h-7 w-7 text-primary" />
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Fakturering</h1>
        </div>
        <div className="flex items-center gap-2">
          <InvoiceEmailSettings />
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
                  <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Förfallodatum</Label>
                  <Input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Kund</Label>
                <div className="flex gap-2">
                  <Select value={form.customer_id} onValueChange={v => setForm({ ...form, customer_id: v })}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Välj kund..." /></SelectTrigger>
                    <SelectContent>
                      {customers.length === 0 && (
                        <p className="px-3 py-2 text-sm text-muted-foreground">Inga kunder finns</p>
                      )}
                      {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => setCustomerDialogOpen(true)} title="Ny kund">
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Ny kund dialog */}
              <Dialog open={customerDialogOpen} onOpenChange={setCustomerDialogOpen}>
                <DialogContent className="max-w-sm">
                  <DialogHeader><DialogTitle>Ny kund</DialogTitle></DialogHeader>
                  <div className="grid gap-3 py-2">
                    <div className="space-y-1.5">
                      <Label>Namn *</Label>
                      <Input placeholder="Företagsnamn" value={customerForm.name} onChange={e => setCustomerForm({ ...customerForm, name: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Organisationsnummer</Label>
                      <Input placeholder="556xxx-xxxx" value={customerForm.organization_number} onChange={e => setCustomerForm({ ...customerForm, organization_number: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>E-post</Label>
                      <Input type="email" placeholder="faktura@foretag.se" value={customerForm.email} onChange={e => setCustomerForm({ ...customerForm, email: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Telefon</Label>
                        <Input placeholder="070-xxx xx xx" value={customerForm.phone} onChange={e => setCustomerForm({ ...customerForm, phone: e.target.value })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Adress</Label>
                        <Input placeholder="Gata, ort" value={customerForm.address} onChange={e => setCustomerForm({ ...customerForm, address: e.target.value })} />
                      </div>
                    </div>
                    <Button onClick={handleAddCustomer} disabled={!customerForm.name.trim()} className="mt-1 w-full gap-2">
                      <Plus className="h-4 w-4" />Spara kund
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              <div className="space-y-1.5">
                <Label>Fastighet</Label>
                <Select value={form.property_id} onValueChange={v => setForm({ ...form, property_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Välj fastighet..." /></SelectTrigger>
                  <SelectContent>
                    {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Beskrivning</Label>
                <Input placeholder="T.ex. Timmer gran avd 7" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Belopp (inkl. moms)</Label>
                  <Input type="number" placeholder="0" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Moms %</Label>
                  <Select value={form.momsPercent} onValueChange={v => setForm({ ...form, momsPercent: v })}>
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
      </div>

      {/* Tabs & Table */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="all">Alla ({invoices.length})</TabsTrigger>
          <TabsTrigger value="unpaid">Obetalda ({invoices.filter(i => i.status === "unpaid").length})</TabsTrigger>
          <TabsTrigger value="overdue">Förfallna ({invoices.filter(i => i.status === "overdue").length})</TabsTrigger>
          <TabsTrigger value="paid">Betalda ({invoices.filter(i => i.status === "paid").length})</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-0">
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nr</TableHead>
                  <TableHead>Kund</TableHead>
                  <TableHead className="hidden md:table-cell">Beskrivning</TableHead>
                  <TableHead className="hidden md:table-cell">Förfaller</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Belopp</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Inga fakturor</TableCell></TableRow>
                ) : (
                  filtered.map(inv => {
                    const sc = statusConfig[inv.status as keyof typeof statusConfig] || statusConfig.unpaid;
                    return (
                      <TableRow key={inv.id}>
                        <TableCell className="text-sm font-mono text-muted-foreground">{inv.invoice_number}</TableCell>
                        <TableCell className="text-sm font-medium text-card-foreground">{customerName(inv.customer_id)}</TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-[200px] truncate">{inv.description}</TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{inv.due_date}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("gap-1 text-xs", sc.cls)}>{sc.icon}{sc.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm font-semibold tabular-nums whitespace-nowrap text-card-foreground">{fmt(inv.amount_inc_vat)}</TableCell>
                        <TableCell>
                          {inv.status === "paid" ? (
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => markAsUnpaid(inv.id)}>Ångra</Button>
                          ) : (
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => markAsPaid(inv)}>Betald</Button>
                          )}
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
