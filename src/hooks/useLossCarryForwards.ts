import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "sonner";

export type LossCarryForward = {
  id: string;
  user_id: string;
  year: number;
  original_amount: number;
  remaining_amount: number;
  created_at: string;
  updated_at: string;
};

export function useLossCarryForwards() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["loss_carry_forwards"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loss_carry_forwards")
        .select("*")
        .order("year", { ascending: true });
      if (error) throw error;
      return data as LossCarryForward[];
    },
    enabled: !!user,
  });
}

/** Calculate taxable result after applying carry-forwards */
export function applyLossCarryForwards(
  resultat: number,
  losses: LossCarryForward[]
): {
  originalResultat: number;
  lossUsed: number;
  taxableResultat: number;
  remainingLosses: number;
  lossDetails: { year: number; used: number; remaining: number }[];
} {
  const originalResultat = resultat;

  if (resultat <= 0) {
    // Negative result → no losses to apply, this year creates a new loss
    const totalRemaining = losses.reduce((s, l) => s + l.remaining_amount, 0);
    return {
      originalResultat,
      lossUsed: 0,
      taxableResultat: 0,
      remainingLosses: totalRemaining + Math.abs(resultat),
      lossDetails: losses.map(l => ({ year: l.year, used: 0, remaining: l.remaining_amount })),
    };
  }

  // Positive result → use oldest losses first
  let remaining = resultat;
  let totalUsed = 0;
  const details: { year: number; used: number; remaining: number }[] = [];

  for (const loss of losses) {
    if (remaining <= 0 || loss.remaining_amount <= 0) {
      details.push({ year: loss.year, used: 0, remaining: loss.remaining_amount });
      continue;
    }
    const used = Math.min(remaining, loss.remaining_amount);
    remaining -= used;
    totalUsed += used;
    details.push({ year: loss.year, used, remaining: loss.remaining_amount - used });
  }

  return {
    originalResultat,
    lossUsed: totalUsed,
    taxableResultat: Math.max(0, remaining),
    remainingLosses: details.reduce((s, d) => s + d.remaining, 0),
    lossDetails: details,
  };
}

export function useSaveLossCarryForward() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ year, amount }: { year: number; amount: number }) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("loss_carry_forwards").upsert(
        {
          user_id: user.id,
          year,
          original_amount: amount,
          remaining_amount: amount,
        },
        { onConflict: "user_id,year" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loss_carry_forwards"] });
      toast.success("Underskott sparat");
    },
    onError: () => {
      toast.error("Kunde inte spara underskott");
    },
  });
}

export function useUpdateLossRemaining() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: { id: string; remaining_amount: number }[]) => {
      for (const u of updates) {
        const { error } = await supabase
          .from("loss_carry_forwards")
          .update({ remaining_amount: u.remaining_amount })
          .eq("id", u.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loss_carry_forwards"] });
    },
  });
}
