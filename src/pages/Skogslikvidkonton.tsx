import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, ArrowDownToLine, AlertTriangle, Wallet, Calendar } from "lucide-react";
import { toast } from "sonner";
import { useForestLiquidityAccounts } from "@/hooks/useEconomicData";
import { withdrawFromForestAccount } from "@/lib/economicSync";

const fmt = (n: number) =>
  new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK", maximumFractionDigits: 0 }).format(n);

const fmtDate = (d: string) => new Date(d).toLocaleDateString("sv-SE");

function statusBadge(status: string) {
  switch (status) {
    case "active":
      return <Badge variant="default">Aktivt</Badge>;
    case "partially_withdrawn":
      return <Badge variant="secondary">Delvis uttaget</Badge>;
    case "withdrawn":
      return <Badge variant="outline">Uttaget</Badge>;
    case "expired":
      return <Badge variant="destructive">Utgånget</Badge>;
    default:
      return <Badge>{status}</Badge>;
  }
}

function yearsLeft(expiry: string | null) {
  if (!expiry) return null;
  const ms = new Date(expiry).getTime() - Date.now();
  return Math.max(0, Math.round((ms / (1000 * 60 * 60 * 24 * 365)) * 10) / 10);
}

export default function Skogslikvidkonton() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: accounts = [], isLoading } = useForestLiquidityAccounts();

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["bank_accounts"],
    queryFn: async () => {
      const { data } = await supabase.from("bank_accounts").select("*").order("bank_name");
      return data ?? [];
    },
  });

  const totals = useMemo(() => {
    const total = accounts.reduce((s, a) => s + Number(a.remaining_amount), 0);
    const expiringSoon = accounts.filter(
      (a) => a.expiry_date && (yearsLeft(a.expiry_date) ?? 99) < 2 && a.status !== "withdrawn"
    );
    const original = accounts.reduce((s, a) => s + Number(a.original_deposit_amount), 0);
    return { total, original, expiringCount: expiringSoon.length };
  }, [accounts]);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newBank, setNewBank] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10));
  const [newNumber, setNewNumber] = useState("");
  const [newNotes, setNewNotes] = useState("");

  async function handleCreate() {
    if (!user) return;
    const amount = Number(newAmount);
    if (!newName || amount <= 0) {
      toast.error("Fyll i namn och belopp");
      return;
    }
    const deposit = newDate;
    const expiry = new Date(deposit);
    expiry.setFullYear(expiry.getFullYear() + 10);
    const { error } = await supabase.from("forest_liquidity_accounts").insert({
      user_id: user.id,
      name: newName,
      bank_name: newBank || null,
      account_number_masked: newNumber || null,
      original_deposit_amount: amount,
      remaining_amount: amount,
      opened_date: deposit,
      deposit_date: deposit,
      expiry_date: expiry.toISOString().slice(0, 10),
      status: "active",
      notes: newNotes || null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Skogslikvidkonto skapat");
    setCreateOpen(false);
    setNewName(""); setNewBank(""); setNewAmount(""); setNewNumber(""); setNewNotes("");
    qc.invalidateQueries({ queryKey: ["forest_liquidity_accounts"] });
  }

  // Withdraw dialog
  const [withdrawAcc, setWithdrawAcc] = useState<string | null>(null);
  const [wAmount, setWAmount] = useState("");
  const [wBank, setWBank] = useState("");
  const [wDate, setWDate] = useState(new Date().toISOString().slice(0, 10));
  const [wNotes, setWNotes] = useState("");

  const accObj = accounts.find((a) => a.id === withdrawAcc);

  async function handleWithdraw() {
    if (!user || !withdrawAcc) return;
    if (!wBank) { toast.error("Välj bankkonto"); return; }
    const amount = Number(wAmount);
    if (amount <= 0) { toast.error("Ange belopp"); return; }
    const res = await withdrawFromForestAccount({
      userId: user.id,
      forestAccountId: withdrawAcc,
      bankAccountId: wBank,
      amount,
      date: wDate,
      notes: wNotes || undefined,
    });
    if (!res.ok) { toast.error(res.error ?? "Fel vid uttag"); return; }
    toast.success("Uttag registrerat – beskattas i år och har ökat banksaldot");
    setWithdrawAcc(null); setWAmount(""); setWBank(""); setWNotes("");
    qc.invalidateQueries({ queryKey: ["forest_liquidity_accounts"] });
    qc.invalidateQueries({ queryKey: ["bank_accounts"] });
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl text-foreground">Skogslikvidkonton</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Skogskonto och skogsskadekonto – skjut upp skatten i upp till 10 år.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nytt konto</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Lägg till skogslikvidkonto</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Namn *</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="t.ex. Skogskonto Handelsbanken" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Bank</Label>
                  <Input value={newBank} onChange={(e) => setNewBank(e.target.value)} placeholder="Handelsbanken" />
                </div>
                <div>
                  <Label>Kontonr (maskat)</Label>
                  <Input value={newNumber} onChange={(e) => setNewNumber(e.target.value)} placeholder="6112 xxx xxx 7" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Insatt belopp (kr) *</Label>
                  <Input type="number" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} />
                </div>
                <div>
                  <Label>Insättningsdatum</Label>
                  <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Förfaller automatiskt 10 år efter insättningsdatum enligt skattereglerna.
              </p>
              <div>
                <Label>Anteckningar</Label>
                <Textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Avbryt</Button>
              <Button onClick={handleCreate}>Skapa konto</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-normal text-muted-foreground flex items-center gap-2"><Wallet className="h-4 w-4" />Totalt saldo</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-display">{fmt(totals.total)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-normal text-muted-foreground flex items-center gap-2"><ArrowDownToLine className="h-4 w-4" />Ursprungligen insatt</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-display">{fmt(totals.original)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-normal text-muted-foreground flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Snart förfallna</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-display">{totals.expiringCount}</p>
            <p className="text-xs text-muted-foreground">förfaller inom 2 år</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Mina konton</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Laddar...</p>
          ) : accounts.length === 0 ? (
            <div className="text-center py-10 space-y-3">
              <Wallet className="h-10 w-10 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">Inga skogslikvidkonton ännu.</p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Skapa ett konto manuellt här, eller välj "Insatt på skogslikvidkonto" när du registrerar
                en virkesförsäljning i Skogsbruksplanen.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {accounts.map((a) => {
                const yl = yearsLeft(a.expiry_date);
                const expiringSoon = yl !== null && yl < 2 && a.status !== "withdrawn";
                return (
                  <div key={a.id} className="rounded-lg border border-border p-4 hover:bg-muted/30 transition">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium text-foreground">{a.name}</h3>
                          {statusBadge(a.status)}
                          {expiringSoon && <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />{yl} år kvar</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {a.bank_name ?? "—"} {a.account_number_masked ? `· ${a.account_number_masked}` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Calendar className="h-3 w-3" />
                          Insatt {fmtDate(a.deposit_date)}
                          {a.expiry_date && <> · Förfaller {fmtDate(a.expiry_date)}</>}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-display">{fmt(Number(a.remaining_amount))}</p>
                        <p className="text-xs text-muted-foreground">av {fmt(Number(a.original_deposit_amount))}</p>
                      </div>
                    </div>
                    {a.status !== "withdrawn" && Number(a.remaining_amount) > 0 && (
                      <div className="flex justify-end mt-3">
                        <Button size="sm" variant="outline" onClick={() => { setWithdrawAcc(a.id); setWAmount(String(a.remaining_amount)); }}>
                          <ArrowDownToLine className="h-4 w-4 mr-2" />Gör uttag
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!withdrawAcc} onOpenChange={(o) => !o && setWithdrawAcc(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Uttag från skogslikvidkonto</DialogTitle></DialogHeader>
          {accObj && (
            <div className="space-y-3">
              <div className="rounded-md bg-muted/50 p-3 text-sm">
                <p className="font-medium">{accObj.name}</p>
                <p className="text-muted-foreground">Tillgängligt: {fmt(Number(accObj.remaining_amount))}</p>
              </div>
              <div>
                <Label>Belopp (kr) *</Label>
                <Input type="number" value={wAmount} onChange={(e) => setWAmount(e.target.value)} />
              </div>
              <div>
                <Label>Till bankkonto *</Label>
                <Select value={wBank} onValueChange={setWBank}>
                  <SelectTrigger><SelectValue placeholder="Välj bankkonto" /></SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((b: any) => (
                      <SelectItem key={b.id} value={b.id}>{b.bank_name} {b.account_name ? `– ${b.account_name}` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Datum</Label>
                <Input type="date" value={wDate} onChange={(e) => setWDate(e.target.value)} />
              </div>
              <div>
                <Label>Anteckningar</Label>
                <Textarea value={wNotes} onChange={(e) => setWNotes(e.target.value)} rows={2} />
              </div>
              <div className="rounded-md border border-border p-3 text-xs text-muted-foreground space-y-1">
                <p>📋 Uttaget bokförs som <strong>skattepliktig intäkt {new Date(wDate).getFullYear()}</strong>.</p>
                <p>💰 Banksaldot ökar med {fmt(Number(wAmount) || 0)}.</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setWithdrawAcc(null)}>Avbryt</Button>
            <Button onClick={handleWithdraw}>Bekräfta uttag</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
