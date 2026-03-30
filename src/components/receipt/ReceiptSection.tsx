import { useState } from "react";
import { Camera, Upload, FileCheck, Clock, CheckCircle2, Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ReceiptReviewDialog } from "./ReceiptReviewDialog";

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

export function ReceiptSection() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [reviewReceipt, setReviewReceipt] = useState<Receipt | null>(null);

  const { data: receipts = [] } = useQuery({
    queryKey: ["receipts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("receipts")
        .select("*")
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return data as Receipt[];
    },
  });

  const newReceipts = receipts.filter((r) => r.status === "uploaded" || r.status === "parsed");
  const pendingReceipts = receipts.filter((r) => r.status === "review_pending");
  const bookedReceipts = receipts.filter((r) => r.status === "booked" || r.status === "approved");

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("receipt-images")
        .upload(path, file);
      if (uploadError) throw uploadError;

      // Create receipt record
      const { data: receipt, error: insertError } = await supabase
        .from("receipts")
        .insert({ user_id: user.id, image_url: path, status: "uploaded" })
        .select()
        .single();
      if (insertError) throw insertError;

      toast.success("Kvitto uppladdat! Tolkar...");

      // Trigger AI parsing
      const { error: fnError } = await supabase.functions.invoke("parse-receipt", {
        body: { imageUrl: path, receiptId: receipt.id },
      });

      if (fnError) {
        toast.error("Kunde inte tolka kvittot automatiskt. Du kan fylla i manuellt.");
      } else {
        toast.success("Kvittot har tolkats!");
      }

      queryClient.invalidateQueries({ queryKey: ["receipts"] });
    } catch (err: any) {
      toast.error("Uppladdning misslyckades: " + err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "uploaded":
        return <Badge variant="secondary">Uppladdad</Badge>;
      case "parsed":
        return <Badge variant="secondary">Tolkad</Badge>;
      case "review_pending":
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-200">Granska</Badge>;
      case "approved":
      case "booked":
        return <Badge className="bg-primary/10 text-primary border-primary/20">Bokförd</Badge>;
      case "rejected":
        return <Badge variant="destructive">Avvisad</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const ReceiptRow = ({ receipt }: { receipt: Receipt }) => (
    <div className="flex items-center justify-between py-3 px-4 border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <FileCheck className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-card-foreground truncate">
            {receipt.supplier_name || "Okänd leverantör"}
          </p>
          <p className="text-xs text-muted-foreground">
            {receipt.receipt_date || receipt.uploaded_at.slice(0, 10)}
            {receipt.suggested_category && ` · ${receipt.suggested_category}`}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-semibold tabular-nums text-card-foreground">
            {receipt.total_amount > 0 ? `${receipt.total_amount.toLocaleString("sv-SE")} kr` : "—"}
          </p>
          {receipt.vat_amount > 0 && (
            <p className="text-xs text-muted-foreground">
              moms {receipt.vat_amount.toLocaleString("sv-SE")} kr
            </p>
          )}
        </div>
        {statusBadge(receipt.status)}
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={() => setReviewReceipt(receipt)}
        >
          <Eye className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Camera className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-card-foreground">Kvitton</h2>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 relative" disabled={uploading}>
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Ladda upp
            <input
              type="file"
              accept="image/*,application/pdf"
              className="absolute inset-0 opacity-0 cursor-pointer"
              onChange={handleUpload}
              disabled={uploading}
            />
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 relative" disabled={uploading}>
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
            Scanna
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="absolute inset-0 opacity-0 cursor-pointer"
              onChange={handleUpload}
              disabled={uploading}
            />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent px-4 h-auto py-0">
          <TabsTrigger value="new" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-2.5 text-xs">
            Nya ({newReceipts.length})
          </TabsTrigger>
          <TabsTrigger value="pending" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-2.5 text-xs">
            Granska ({pendingReceipts.length})
          </TabsTrigger>
          <TabsTrigger value="booked" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-2.5 text-xs">
            Bokförda ({bookedReceipts.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="new" className="m-0">
          {newReceipts.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">Inga nya kvitton</p>
          ) : (
            newReceipts.map((r) => <ReceiptRow key={r.id} receipt={r} />)
          )}
        </TabsContent>
        <TabsContent value="pending" className="m-0">
          {pendingReceipts.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">Inga kvitton att granska</p>
          ) : (
            pendingReceipts.map((r) => <ReceiptRow key={r.id} receipt={r} />)
          )}
        </TabsContent>
        <TabsContent value="booked" className="m-0">
          {bookedReceipts.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">Inga bokförda kvitton</p>
          ) : (
            bookedReceipts.map((r) => <ReceiptRow key={r.id} receipt={r} />)
          )}
        </TabsContent>
      </Tabs>

      {reviewReceipt && (
        <ReceiptReviewDialog
          receipt={reviewReceipt}
          onClose={() => setReviewReceipt(null)}
        />
      )}
    </div>
  );
}
