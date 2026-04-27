import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthProvider";
import { useQueryClient } from "@tanstack/react-query";
import { useBankAccounts } from "@/hooks/useSkogskollData";
import { useForestLiquidityAccounts } from "@/hooks/useEconomicData";
import { PAYMENT_STATUS_LABELS, type PaymentStatus } from "@/lib/economicSync";
import type { ActivityFormData } from "./ActivityFormFields";

interface Props {
  data: ActivityFormData;
  onChange: (data: ActivityFormData) => void;
  income: number;
  cost: number;
  subsidy: number;
}

const fmtKr = (n: number) => Math.round(n).toLocaleString("sv-SE") + " kr";

export default function ActivityPaymentSection({ data, onChange, income, cost, subsidy }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: bankAccounts = [] } = useBankAccounts();
  const { data: forestAccounts = [] } = useForestLiquidityAccounts();
  const [creatingAccount, setCreatingAccount] = useState(false);

  if (!data.is_completed) return null;

  const set = (patch: Partial<ActivityFormData>) => onChange({ ...data, ...patch });
  const status = data.payment_status as PaymentStatus | "";

  const effectiveDate = data.payment_date || data.completed_date || data.planned_date || new Date().toISOString().slice(0, 10);
  const taxYear = new Date(effectiveDate).getFullYear();

  const vatAmount = data.apply_vat ? Math.round(income * Number(data.vat_rate || "0.25")) : 0;
  const netIncome = income + subsidy - cost;

  const handleCreateForestAccount = async () => {
    if (!user || !data.forest_account_new_name.trim()) {
      toast.error("Ange ett namn på kontot");
      return;
    }
    setCreatingAccount(true);
    const today = new Date().toISOString().slice(0, 10);
    const { data: created, error } = await supabase
      .from("forest_liquidity_accounts")
      .insert({
        user_id: user.id,
        name: data.forest_account_new_name.trim(),
        opened_date: today,
        deposit_date: effectiveDate,
        original_deposit_amount: 0,
        remaining_amount: 0,
        status: "active",
      })
      .select()
      .single();
    setCreatingAccount(false);
    if (error || !created) {
      toast.error("Kunde inte skapa kontot: " + (error?.message ?? ""));
      return;
    }
    qc.invalidateQueries({ queryKey: ["forest_liquidity_accounts"] });
    set({ forest_account_id: created.id, forest_account_new_name: "" });
    toast.success("Skogslikvidkonto skapat");
  };

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3">
      <p className="text-xs font-semibold text-primary uppercase tracking-wide">Betalningshantering</p>

      <div className="space-y-1.5">
        <Label className="text-xs">Hur hanterades betalningen? *</Label>
        <Select value={status} onValueChange={(v) => set({ payment_status: v })}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="Välj alternativ…" />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(PAYMENT_STATUS_LABELS) as PaymentStatus[]).map((k) => (
              <SelectItem key={k} value={k}>{PAYMENT_STATUS_LABELS[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {status === "paid_to_bank" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Bankkonto</Label>
            <Select value={data.bank_account_id} onValueChange={(v) => set({ bank_account_id: v })}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Välj…" /></SelectTrigger>
              <SelectContent>
                {bankAccounts.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.bank_name} {b.account_name ? `· ${b.account_name}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Betalningsdatum</Label>
            <Input type="date" className="h-9 text-sm" value={data.payment_date} onChange={(e) => set({ payment_date: e.target.value })} />
          </div>
        </div>
      )}

      {status === "paid_to_forest_account" && (
        <div className="space-y-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Skogslikvidkonto</Label>
            <Select value={data.forest_account_id} onValueChange={(v) => set({ forest_account_id: v })}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Välj…" /></SelectTrigger>
              <SelectContent>
                {forestAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} (saldo {fmtKr(a.remaining_amount)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs">Eller skapa nytt konto</Label>
              <Input
                placeholder="T.ex. Skogskonto Handelsbanken"
                className="h-9 text-sm"
                value={data.forest_account_new_name}
                onChange={(e) => set({ forest_account_new_name: e.target.value })}
              />
            </div>
            <Button type="button" size="sm" variant="secondary" disabled={creatingAccount || !data.forest_account_new_name.trim()} onClick={handleCreateForestAccount}>
              <Plus className="h-3 w-3 mr-1" /> Skapa
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Pengarna ligger på skogslikvidkontot i upp till 10 år. De räknas som tillgång i balansrapporten men beskattas först vid uttag.
          </p>
        </div>
      )}

      {status === "pending_invoice" && (
        <p className="text-xs text-muted-foreground">
          En faktura skapas separat. Intäkten bokförs som kundfordran tills den betalas.
        </p>
      )}

      {status === "historical_already_paid" && (
        <p className="text-xs text-muted-foreground">
          Påverkar bara resultat och skatt för {taxYear}. Dagens banksaldo ändras inte.
        </p>
      )}

      {status === "not_paid" && (
        <p className="text-xs text-muted-foreground">
          Bokförs som väntande. Du registrerar betalningen senare.
        </p>
      )}

      {/* VAT toggle (only when income exists) */}
      {income > 0 && (
        <label className="flex items-center gap-2 cursor-pointer pt-1">
          <input type="checkbox" checked={data.apply_vat} onChange={(e) => set({ apply_vat: e.target.checked })} className="rounded border-input h-4 w-4 accent-primary" />
          <span className="text-xs font-medium text-foreground">Belopp inkluderar moms ({Math.round(Number(data.vat_rate) * 100)}%) — bryt ut automatiskt</span>
        </label>
      )}

      {/* Summary */}
      {status && (
        <div className="rounded-md bg-background border border-border p-2.5 text-xs space-y-1">
          <p className="font-semibold text-foreground mb-1">Sammanfattning</p>
          {income > 0 && (
            <div className="flex justify-between"><span className="text-muted-foreground">Intäkt:</span><span className="text-foreground">{fmtKr(income)}{vatAmount > 0 ? ` (varav moms ${fmtKr(vatAmount)})` : ""}</span></div>
          )}
          {cost > 0 && (
            <div className="flex justify-between"><span className="text-muted-foreground">Kostnad:</span><span className="text-foreground">−{fmtKr(cost)}</span></div>
          )}
          {subsidy > 0 && (
            <div className="flex justify-between"><span className="text-muted-foreground">Bidrag:</span><span className="text-foreground">{fmtKr(subsidy)}</span></div>
          )}
          <div className="flex justify-between border-t border-border pt-1 font-semibold">
            <span>Påverkar resultat {taxYear}:</span>
            <span className={netIncome >= 0 ? "text-primary" : "text-destructive"}>{fmtKr(netIncome)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground pt-0.5">
            <span>Påverkar bank/saldo nu:</span>
            <span>{status === "paid_to_bank" ? fmtKr(netIncome) : "Nej"}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Skogslikvidkonto:</span>
            <span>{status === "paid_to_forest_account" ? `+${fmtKr(income)}` : "Nej"}</span>
          </div>
        </div>
      )}
    </div>
  );
}
