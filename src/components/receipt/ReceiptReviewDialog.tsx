import { useState, useEffect } from "react";
import { CheckCircle2, X, Edit3, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useProperties } from "@/hooks/useSkogskollData";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type Receipt = {
  id: string;
  user_id: string;
  image_url: string | null;
  uploaded_at: string;
  receipt_date: string | null;
  supplier_name: string | null;
  total_amount: number;
  vat_amount: number;
  amount_ex_vat: number;
  suggested_category: string | null;
  suggested_account: string | null;
  property_id: string | null;
  stand_id: string | null;
  forest_activity_id: string | null;
  status: string;
  confidence_score: number | null;
  notes: string | null;
  approved_at: string | null;
  approved_by: string | null;
  linked_transaction_id: string | null;
};

const CATEGORIES = [
  "drivmedel", "plantering", "utrustning", "vägunderhåll",
  "försäkring", "representation", "administration", "underhåll", "övrigt",
];

interface Props {
  receipt: Receipt;
  onClose: () => void;
}

export function ReceiptReviewDialog({ receipt, onClose }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: properties = [] } = useProperties();
  const [saving, setSaving] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const [form, setForm] = useState({
    supplier_name: receipt.supplier_name || "",
    receipt_date: receipt.receipt_date || new Date().toISOString().slice(0, 10),
    total_amount: receipt.total_amount.toString(),
    vat_amount: receipt.vat_amount.toString(),
    amount_ex_vat: receipt.amount_ex_vat.toString(),
    suggested_category: receipt.suggested_category || "övrigt",
    property_id: receipt.property_id || "",
    notes: receipt.notes || "",
    payment_method: "card",
  });

  useEffect(() => {
    if (receipt.image_url) {
      supabase.storage
        .from("receipt-images")
        .createSignedUrl(receipt.image_url, 600)
        .then(({ data }) => {
          if (data?.signedUrl) setImageUrl(data.signedUrl);
        });
    }
  }, [receipt.image_url]);

  const handleApprove = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const amount = Math.abs(Number(form.amount_ex_vat));
      const vatAmount = Math.abs(Number(form.vat_amount));

      // Create transaction
      const { data: tx, error: txError } = await supabase
        .from("transactions")
        .insert({
          user_id: user.id,
          date: form.receipt_date,
          type: "expense",
          amount,
          vat_amount: vatAmount,
          category: form.suggested_category,
          description: `Kvitto från ${form.supplier_name || "okänd"}`,
          property_id: form.property_id || null,
          payment_method: form.payment_method,
          status: "booked",
        })
        .select()
        .single();
      if (txError) throw txError;

      // Update receipt
      const { error: rError } = await supabase
        .from("receipts")
        .update({
          supplier_name: form.supplier_name,
          receipt_date: form.receipt_date,
          total_amount: Number(form.total_amount),
          vat_amount: vatAmount,
          amount_ex_vat: amount,
          suggested_category: form.suggested_category,
          property_id: form.property_id || null,
          notes: form.notes,
          status: "booked",
          approved_at: new Date().toISOString(),
          approved_by: user.id,
          linked_transaction_id: tx.id,
        })
        .eq("id", receipt.id);
      if (rError) throw rError;

      // Update bank balance
      const { data: bankAccounts } = await supabase
        .from("bank_accounts")
        .select("*")
        .eq("user_id", user.id)
        .limit(1);
      if (bankAccounts && bankAccounts.length > 0) {
        await supabase
          .from("bank_accounts")
          .update({ current_balance: bankAccounts[0].current_balance - Number(form.total_amount) })
          .eq("id", bankAccounts[0].id);
      }

      queryClient.invalidateQueries({ queryKey: ["receipts"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["bank_accounts"] });
      toast.success("Kvitto godkänt och bokfört!");
      onClose();
    } catch (err: any) {
      toast.error("Kunde inte bokföra: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    await supabase.from("receipts").update({ status: "rejected" }).eq("id", receipt.id);
    queryClient.invalidateQueries({ queryKey: ["receipts"] });
    toast.info("Kvitto avvisat");
    onClose();
  };

  const isBooked = receipt.status === "booked" || receipt.status === "approved";
  const confidenceColor = (receipt.confidence_score ?? 0) >= 80 ? "text-primary" : (receipt.confidence_score ?? 0) >= 50 ? "text-amber-600" : "text-destructive";

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isBooked ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <Edit3 className="h-5 w-5" />}
            {isBooked ? "Bokfört kvitto" : "Granska kvitto"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Image */}
          <div className="rounded-lg border border-border bg-muted/30 p-2 flex items-center justify-center min-h-[200px]">
            {imageUrl ? (
              <img src={imageUrl} alt="Kvitto" className="max-w-full max-h-[300px] rounded object-contain" />
            ) : (
              <p className="text-sm text-muted-foreground">Ingen bild</p>
            )}
          </div>

          {/* Form */}
          <div className="space-y-3">
            {receipt.confidence_score != null && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={confidenceColor}>
                  Säkerhet: {receipt.confidence_score}%
                </Badge>
                {receipt.confidence_score < 70 && (
                  <span className="text-xs text-muted-foreground">Kontrollera uppgifterna</span>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Leverantör</Label>
              <Input value={form.supplier_name} onChange={(e) => setForm({ ...form, supplier_name: e.target.value })} disabled={isBooked} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Datum</Label>
                <Input type="date" value={form.receipt_date} onChange={(e) => setForm({ ...form, receipt_date: e.target.value })} disabled={isBooked} />
              </div>
              <div className="space-y-1.5">
                <Label>Totalbelopp (kr)</Label>
                <Input type="number" value={form.total_amount} onChange={(e) => {
                  const total = Number(e.target.value);
                  const vat = Math.round(total * 25 / 125);
                  setForm({ ...form, total_amount: e.target.value, vat_amount: vat.toString(), amount_ex_vat: (total - vat).toString() });
                }} disabled={isBooked} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Moms (kr)</Label>
                <Input type="number" value={form.vat_amount} onChange={(e) => setForm({ ...form, vat_amount: e.target.value })} disabled={isBooked} />
              </div>
              <div className="space-y-1.5">
                <Label>Exkl. moms (kr)</Label>
                <Input type="number" value={form.amount_ex_vat} onChange={(e) => setForm({ ...form, amount_ex_vat: e.target.value })} disabled={isBooked} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Kategori</Label>
                <Select value={form.suggested_category} onValueChange={(v) => setForm({ ...form, suggested_category: v })} disabled={isBooked}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Fastighet</Label>
                <Select value={form.property_id} onValueChange={(v) => setForm({ ...form, property_id: v })} disabled={isBooked}>
                  <SelectTrigger><SelectValue placeholder="Välj..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Ingen</SelectItem>
                    {properties.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Betalmetod</Label>
              <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })} disabled={isBooked}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="card">Kort</SelectItem>
                  <SelectItem value="bank">Bank</SelectItem>
                  <SelectItem value="cash">Kontant</SelectItem>
                  <SelectItem value="swish">Swish</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isBooked && receipt.approved_at && (
              <p className="text-xs text-muted-foreground">
                Godkänt {new Date(receipt.approved_at).toLocaleDateString("sv-SE")}
              </p>
            )}
          </div>
        </div>

        {!isBooked && (
          <div className="flex gap-2 mt-4 justify-end">
            <Button variant="outline" onClick={handleReject}>Avvisa</Button>
            <Button onClick={handleApprove} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Godkänn och bokför
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
