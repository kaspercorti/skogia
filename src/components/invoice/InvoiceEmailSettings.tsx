import { useState, useEffect } from "react";
import { Settings, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useUserSettings, useUpsertUserSettings } from "@/hooks/useUserSettings";

export default function InvoiceEmailSettings() {
  const { data: settings } = useUserSettings();
  const upsert = useUpsertUserSettings();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    company_name: "",
    sender_name: "",
    reply_to_email: "",
    default_email_message: "",
    email_signature: "",
  });

  useEffect(() => {
    if (settings) {
      setForm({
        company_name: settings.company_name || "",
        sender_name: settings.sender_name || "",
        reply_to_email: settings.reply_to_email || "",
        default_email_message: settings.default_email_message || "",
        email_signature: settings.email_signature || "",
      });
    }
  }, [settings]);

  const handleSave = async () => {
    try {
      await upsert.mutateAsync(form);
      toast.success("Inställningar sparade");
      setOpen(false);
    } catch (e: any) {
      toast.error("Kunde inte spara: " + e.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="h-4 w-4" />
          E-postinställningar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>E-postinställningar för fakturor</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-1.5">
            <Label>Företagsnamn</Label>
            <Input
              placeholder="Mitt Skogsföretag AB"
              value={form.company_name}
              onChange={(e) => setForm({ ...form, company_name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Avsändarnamn</Label>
            <Input
              placeholder="Anna Andersson"
              value={form.sender_name}
              onChange={(e) => setForm({ ...form, sender_name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Svarsadress (reply-to)</Label>
            <Input
              type="email"
              placeholder="anna@mittforetag.se"
              value={form.reply_to_email}
              onChange={(e) => setForm({ ...form, reply_to_email: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Standardmeddelande i e-post</Label>
            <Textarea
              rows={3}
              placeholder="Bifogat finner du faktura..."
              value={form.default_email_message}
              onChange={(e) => setForm({ ...form, default_email_message: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Signatur</Label>
            <Textarea
              rows={2}
              placeholder="Med vänlig hälsning, Anna"
              value={form.email_signature}
              onChange={(e) => setForm({ ...form, email_signature: e.target.value })}
            />
          </div>
          <Button onClick={handleSave} disabled={upsert.isPending} className="w-full gap-2">
            <Save className="h-4 w-4" />
            Spara inställningar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
