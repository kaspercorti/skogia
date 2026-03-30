import { useState } from "react";
import { Send, Mail, ExternalLink, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useUserSettings } from "@/hooks/useUserSettings";
import type { Invoice, Customer } from "@/hooks/useSkogskollData";

interface Props {
  invoice: Invoice & { sent_at?: string | null; sent_to_email?: string | null };
  customer: Customer | undefined;
}

export default function SendInvoiceButton({ invoice, customer }: Props) {
  const queryClient = useQueryClient();
  const { data: settings } = useUserSettings();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [message, setMessage] = useState("");

  const alreadySent = !!invoice.sent_at;

  const handleOpen = async () => {
    setRecipientEmail(customer?.email || "");
    setMessage(settings?.default_email_message || "Bifogat finner du faktura. Vänligen betala inom angiven förfallotid.");
    setPdfUrl(null);
    setOpen(true);

    // Generate PDF
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Du måste vara inloggad"); return; }

      const { data, error } = await supabase.functions.invoke("generate-invoice-pdf", {
        body: { invoiceId: invoice.id },
      });

      if (error) throw error;
      setPdfUrl(data.url);
    } catch (e: any) {
      toast.error("Kunde inte generera faktura: " + e.message);
    }
  };

  const handleSend = async () => {
    if (!recipientEmail) {
      toast.error("Ange en e-postadress");
      return;
    }
    if (!pdfUrl) {
      toast.error("Fakturan genereras fortfarande...");
      return;
    }

    setSending(true);
    try {
      // For now: open mailto with link (email infra can be wired later)
      const subject = encodeURIComponent(
        `Faktura ${invoice.invoice_number} från ${settings?.company_name || "Skogia"}`
      );
      const signature = settings?.email_signature ? `\n\n${settings.email_signature}` : "";
      const body = encodeURIComponent(
        `${message}\n\nLadda ner fakturan här:\n${pdfUrl}${signature}`
      );

      window.open(`mailto:${recipientEmail}?subject=${subject}&body=${body}`, "_blank");

      // Update invoice with sent info
      await supabase
        .from("invoices")
        .update({
          sent_at: new Date().toISOString(),
          sent_to_email: recipientEmail,
        })
        .eq("id", invoice.id);

      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success(`Faktura förberedd att skicka till ${recipientEmail}`);
      setOpen(false);
    } catch (e: any) {
      toast.error("Något gick fel: " + e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs gap-1"
        onClick={handleOpen}
        title={alreadySent ? `Skickad ${new Date(invoice.sent_at!).toLocaleDateString("sv-SE")} till ${invoice.sent_to_email}` : "Skicka faktura"}
      >
        {alreadySent ? (
          <CheckCircle2 className="h-3 w-3 text-primary" />
        ) : (
          <Mail className="h-3 w-3" />
        )}
        {alreadySent ? "Skickad" : "Skicka"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              Skicka faktura {invoice.invoice_number}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {alreadySent && (
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-sm">
                <p className="text-primary font-medium">Redan skickad</p>
                <p className="text-muted-foreground text-xs mt-1">
                  {new Date(invoice.sent_at!).toLocaleDateString("sv-SE")} till {invoice.sent_to_email}
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Till (e-post)</Label>
              <Input
                type="email"
                placeholder="kund@foretag.se"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
              />
              {!customer?.email && (
                <p className="text-xs text-muted-foreground">
                  Kunden har ingen e-post registrerad. Ange manuellt.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Meddelande</Label>
              <Textarea
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>

            {pdfUrl && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span>Faktura genererad</span>
                <a href={pdfUrl} target="_blank" rel="noopener" className="text-primary underline ml-auto flex items-center gap-1">
                  Förhandsgranska <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}

            {!pdfUrl && (
              <p className="text-sm text-muted-foreground animate-pulse">
                Genererar faktura...
              </p>
            )}

            <Button
              onClick={handleSend}
              disabled={sending || !pdfUrl || !recipientEmail}
              className="w-full gap-2"
            >
              <Send className="h-4 w-4" />
              {alreadySent ? "Skicka igen" : "Skicka faktura"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
