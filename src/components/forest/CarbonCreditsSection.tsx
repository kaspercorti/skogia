import { useState } from "react";
import { Leaf, Info, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useCarbonCredits, DEFAULT_CARBON_PRICE, type CarbonSummary } from "@/hooks/useCarbonCredits";
import type { Stand } from "@/hooks/useSkogskollData";

interface CarbonCreditsSectionProps {
  stands: Stand[];
}

const fmt = (n: number) => n.toLocaleString("sv-SE");
const fmtKr = (n: number) => n.toLocaleString("sv-SE") + " kr";

export default function CarbonCreditsSection({ stands }: CarbonCreditsSectionProps) {
  const [carbonPrice, setCarbonPrice] = useState(DEFAULT_CARBON_PRICE);
  const carbon = useCarbonCredits(stands, carbonPrice);

  if (stands.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Leaf className="h-5 w-5 text-primary" />
        <h2 className="font-display text-lg font-bold text-foreground">Kolkrediter</h2>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Info className="h-4 w-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">
              <p>Detta är en uppskattning baserad på standardfaktorer. Faktiska kolkrediter beror på certifiering och marknad. 1 m³sk ≈ 0,9 ton CO₂.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <CarbonCard label="Årlig CO₂-inlagring" value={`${fmt(carbon.totalAnnualCO2)} ton`} accent />
        <CarbonCard label="Total CO₂ i skog" value={`${fmt(carbon.totalCO2Stock)} ton`} />
        <CarbonCard label="Potentiellt årligt värde" value={fmtKr(carbon.totalAnnualValue)} accent />
        <CarbonCard label="Totalt kolkreditvärde" value={fmtKr(carbon.totalStockValue)} />
      </div>

      {/* Price slider */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground">Antaget pris per ton CO₂</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                type="number"
                min={50}
                max={2000}
                step={50}
                value={carbonPrice}
                onChange={(e) => setCarbonPrice(Math.max(50, Math.min(2000, Number(e.target.value) || DEFAULT_CARBON_PRICE)))}
                className="w-28 h-8 text-sm"
              />
              <span className="text-sm text-muted-foreground">kr/ton</span>
            </div>
          </div>
          <div className="flex gap-2">
            {[200, 350, 500].map((p) => (
              <button
                key={p}
                onClick={() => setCarbonPrice(p)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  carbonPrice === p
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {p} kr
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Per-stand table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h3 className="font-display text-sm font-semibold text-card-foreground">CO₂-inlagring per bestånd</h3>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bestånd</TableHead>
                <TableHead className="text-right">Tillväxt (m³sk/år)</TableHead>
                <TableHead className="text-right">Årlig CO₂ (ton)</TableHead>
                <TableHead className="text-right">Total CO₂ (ton)</TableHead>
                <TableHead className="text-right">Årligt värde</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {carbon.stands.map((s) => (
                <TableRow key={s.standId}>
                  <TableCell className="text-sm font-medium text-card-foreground">{s.standName}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-muted-foreground">{fmt(s.annualGrowthM3sk)}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-primary font-medium">{fmt(s.annualCO2)}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-muted-foreground">{fmt(s.totalCO2)}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums font-semibold text-primary">{fmtKr(s.annualValue)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="rounded-xl border border-accent/20 bg-accent/5 p-4">
        <div className="flex gap-2">
          <Info className="h-4 w-4 text-accent mt-0.5 shrink-0" />
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Om beräkningen</p>
            <p>Detta är en uppskattning baserad på standardfaktorer (1 m³sk ≈ 0,9 ton CO₂). Faktiska kolkrediter beror på certifiering, skogens kondition och marknadsförhållanden.</p>
            <p>Beräkningen baseras på befintlig volym och uppskattad årlig tillväxt. Priset per ton CO₂ varierar beroende på marknad och certifieringsstandard.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function CarbonCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? "border-primary/20 bg-primary/5" : "border-border bg-card"}`}>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${accent ? "text-primary" : "text-card-foreground"}`}>{value}</p>
    </div>
  );
}