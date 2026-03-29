import { useState, useMemo } from "react";
import { TreePine, ChevronRight, ArrowLeft, Calendar, Trees } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useProperties, useStands, useForestActivities, useTransactions, fmt as fmtKr } from "@/hooks/useSkogskollData";

export default function Skogsbruksplan() {
  const { data: properties = [] } = useProperties();
  const { data: stands = [] } = useStands();
  const { data: activities = [] } = useForestActivities();
  const { data: transactions = [] } = useTransactions();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = stands.find(b => b.id === selectedId);
  const fmt = (n: number) => n.toLocaleString("sv-SE");

  const totalStats = useMemo(() => {
    const areal = stands.reduce((s, b) => s + b.area_ha, 0);
    const volym = stands.reduce((s, b) => s + (b.volume_m3sk ?? 0), 0);
    const varde = stands.reduce((s, b) => s + (b.estimated_value ?? 0), 0);
    const tillvaxt = stands.reduce((s, b) => s + (b.volume_m3sk ?? 0) * ((b.growth_rate_percent ?? 0) / 100), 0);
    return { areal, volym, varde, tillvaxt: Math.round(tillvaxt) };
  }, [stands]);

  if (selected) {
    const propName = properties.find(p => p.id === selected.property_id)?.name || "";
    const standActivities = activities.filter(a => a.stand_id === selected.id);
    const standTransactions = transactions.filter(t => t.stand_id === selected.id);

    return (
      <main className="flex-1 p-4 md:p-8 overflow-auto">
        <Button variant="ghost" className="gap-2 mb-4 -ml-2 text-muted-foreground" onClick={() => setSelectedId(null)}>
          <ArrowLeft className="h-4 w-4" /> Tillbaka
        </Button>

        <div className="flex items-center gap-3 mb-6">
          <Trees className="h-7 w-7 text-primary" />
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">{selected.name}</h1>
            <p className="text-sm text-muted-foreground">{propName}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <DetailCard label="Areal" value={`${selected.area_ha} ha`} />
          <DetailCard label="Ålder" value={`${selected.age ?? "—"} år`} />
          <DetailCard label="Volym" value={`${fmt(selected.volume_m3sk ?? 0)} m³sk`} />
          <DetailCard label="Trädslag" value={selected.tree_species || "—"} small />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <p className="text-xs text-muted-foreground mb-1">Uppskattat värde</p>
            <p className="text-xl font-bold text-primary tabular-nums">{fmtKr(selected.estimated_value ?? 0)}</p>
          </div>
          <div className="rounded-xl border border-accent/20 bg-accent/5 p-4">
            <p className="text-xs text-muted-foreground mb-1">Ståndortsindex</p>
            <p className="text-xl font-bold text-accent">{selected.site_index || "—"}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">Årlig tillväxt</p>
            <p className="text-xl font-bold text-card-foreground tabular-nums">
              {fmt(Math.round((selected.volume_m3sk ?? 0) * ((selected.growth_rate_percent ?? 0) / 100)))} m³sk/år
              <span className="text-sm font-normal text-muted-foreground"> ({selected.growth_rate_percent ?? 0}%)</span>
            </p>
          </div>
        </div>

        {/* Planerad åtgärd */}
        <div className="rounded-xl border border-border bg-card p-4 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-card-foreground">Planerad åtgärd</span>
          </div>
          <p className="text-lg font-semibold text-foreground">{selected.planned_action || "Ingen"} <span className="text-muted-foreground font-normal">– {selected.planned_year || "—"}</span></p>
        </div>

        {/* Aktiviteter */}
        {standActivities.length > 0 && (
          <div className="rounded-xl border border-border bg-card overflow-hidden mb-6">
            <div className="p-4 border-b border-border"><h3 className="font-display text-lg text-card-foreground">Aktiviteter</h3></div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Typ</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Netto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {standActivities.map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="text-sm text-card-foreground">{a.type}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{a.planned_date || "—"}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{a.status}</Badge></TableCell>
                    <TableCell className={cn("text-right text-sm font-semibold tabular-nums", a.estimated_net >= 0 ? "text-primary" : "text-card-foreground")}>
                      {a.estimated_net >= 0 ? "+" : "−"}{fmtKr(Math.abs(a.estimated_net))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Transaktioner kopplade till beståndet */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="p-4 border-b border-border"><h3 className="font-display text-lg text-card-foreground">Ekonomi – {selected.name}</h3></div>
          {standTransactions.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Inga transaktioner kopplade ännu.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Beskrivning</TableHead>
                  <TableHead className="text-right">Belopp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {standTransactions.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="text-sm text-muted-foreground">{t.date}</TableCell>
                    <TableCell className="text-sm text-card-foreground">{t.description}</TableCell>
                    <TableCell className={cn("text-right text-sm font-semibold tabular-nums", t.type === "income" ? "text-primary" : "text-card-foreground")}>
                      {t.type === "income" ? "+" : "−"}{fmtKr(t.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 p-4 md:p-8 overflow-auto">
      <div className="flex items-center gap-3 mb-6">
        <TreePine className="h-7 w-7 text-primary" />
        <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Skogsbruksplan</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <SummaryCard label="Total areal" value={`${fmt(totalStats.areal)} ha`} />
        <SummaryCard label="Totalt virkesförråd" value={`${fmt(totalStats.volym)} m³sk`} />
        <SummaryCard label="Uppskattat värde" value={`${fmtKr(totalStats.varde)}`} highlight />
        <SummaryCard label="Årlig tillväxt" value={`${fmt(totalStats.tillvaxt)} m³sk`} />
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bestånd</TableHead>
              <TableHead className="hidden md:table-cell">Areal</TableHead>
              <TableHead className="hidden md:table-cell">Ålder</TableHead>
              <TableHead className="hidden lg:table-cell">Trädslag</TableHead>
              <TableHead>Volym</TableHead>
              <TableHead className="hidden md:table-cell">Åtgärd</TableHead>
              <TableHead className="text-right">Värde</TableHead>
              <TableHead className="w-8"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stands.map(b => (
              <TableRow key={b.id} className="cursor-pointer" onClick={() => setSelectedId(b.id)}>
                <TableCell>
                  <div>
                    <p className="text-sm font-medium text-card-foreground">{b.name}</p>
                    <p className="text-xs text-muted-foreground md:hidden">{b.area_ha} ha · {b.age ?? "—"} år</p>
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{b.area_ha} ha</TableCell>
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{b.age ?? "—"} år</TableCell>
                <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{b.tree_species}</TableCell>
                <TableCell className="text-sm tabular-nums text-card-foreground">{fmt(b.volume_m3sk ?? 0)} m³sk</TableCell>
                <TableCell className="hidden md:table-cell">
                  <Badge variant="secondary" className="text-xs font-normal">{b.planned_action || "—"} {b.planned_year || ""}</Badge>
                </TableCell>
                <TableCell className="text-right text-sm font-semibold tabular-nums text-primary">{fmtKr(b.estimated_value ?? 0)}</TableCell>
                <TableCell><ChevronRight className="h-4 w-4 text-muted-foreground" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}

function SummaryCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={cn("text-lg md:text-xl font-bold tabular-nums", highlight ? "text-primary" : "text-card-foreground")}>{value}</p>
    </div>
  );
}

function DetailCard({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={cn("font-bold tabular-nums text-card-foreground", small ? "text-sm" : "text-lg")}>{value}</p>
    </div>
  );
}
