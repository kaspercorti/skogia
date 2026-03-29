import { useState, useMemo } from "react";
import { TreePine, ChevronRight, ArrowLeft, TrendingUp, Calendar, Ruler, Trees } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

// ── Types ──────────────────────────────────────────
interface Bestand {
  id: string;
  name: string;
  fastighet: string;
  areal: number; // ha
  alder: number; // år
  tradslag: string;
  volym: number; // m³sk
  planerad: string;
  atgardsAr: number;
  tillvaxtPercent: number; // årlig %
  prisPerM3: number;
  ekonomi: { year: number; type: string; amount: number }[];
}

const BESTAND: Bestand[] = [
  {
    id: "1", name: "Avd 1 – Tallmon", fastighet: "Norrskog 1:4", areal: 12.5, alder: 75, tradslag: "Tall 80%, Gran 20%",
    volym: 2200, planerad: "Slutavverkning", atgardsAr: 2025, tillvaxtPercent: 3.2, prisPerM3: 450,
    ekonomi: [
      { year: 2024, type: "Gallring", amount: 42000 },
      { year: 2022, type: "Röjning", amount: -8500 },
    ],
  },
  {
    id: "2", name: "Avd 2 – Granbacken", fastighet: "Norrskog 1:4", areal: 8.3, alder: 45, tradslag: "Gran 90%, Björk 10%",
    volym: 1400, planerad: "Gallring", atgardsAr: 2026, tillvaxtPercent: 4.1, prisPerM3: 420,
    ekonomi: [
      { year: 2023, type: "Röjning", amount: -6200 },
    ],
  },
  {
    id: "3", name: "Avd 3 – Björkängen", fastighet: "Mellanbyn 2:7", areal: 5.7, alder: 30, tradslag: "Björk 70%, Tall 30%",
    volym: 650, planerad: "Röjning", atgardsAr: 2025, tillvaxtPercent: 5.0, prisPerM3: 320,
    ekonomi: [],
  },
  {
    id: "4", name: "Avd 4 – Stormyran", fastighet: "Mellanbyn 2:7", areal: 18.2, alder: 90, tradslag: "Tall 60%, Gran 30%, Löv 10%",
    volym: 3800, planerad: "Slutavverkning", atgardsAr: 2025, tillvaxtPercent: 2.1, prisPerM3: 470,
    ekonomi: [
      { year: 2024, type: "Virkesförsäljning", amount: 320000 },
      { year: 2020, type: "Gallring", amount: 95000 },
      { year: 2018, type: "Vägunderhåll", amount: -15000 },
    ],
  },
  {
    id: "5", name: "Avd 5 – Nyplantering Syd", fastighet: "Södermark 3:1", areal: 6.0, alder: 5, tradslag: "Gran 100%",
    volym: 30, planerad: "Röjning", atgardsAr: 2028, tillvaxtPercent: 8.0, prisPerM3: 400,
    ekonomi: [
      { year: 2023, type: "Plantering", amount: -18500 },
    ],
  },
  {
    id: "6", name: "Avd 6 – Åskullen", fastighet: "Södermark 3:1", areal: 14.0, alder: 60, tradslag: "Tall 50%, Gran 50%",
    volym: 2600, planerad: "Gallring", atgardsAr: 2027, tillvaxtPercent: 3.5, prisPerM3: 440,
    ekonomi: [
      { year: 2021, type: "Gallring", amount: 67000 },
    ],
  },
];

// ── Component ──────────────────────────────────────
export default function Skogsbruksplan() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = BESTAND.find((b) => b.id === selectedId);

  const totalStats = useMemo(() => {
    const areal = BESTAND.reduce((s, b) => s + b.areal, 0);
    const volym = BESTAND.reduce((s, b) => s + b.volym, 0);
    const varde = BESTAND.reduce((s, b) => s + b.volym * b.prisPerM3, 0);
    const tillvaxt = BESTAND.reduce((s, b) => s + b.volym * (b.tillvaxtPercent / 100), 0);
    return { areal, volym, varde, tillvaxt: Math.round(tillvaxt) };
  }, []);

  const fmt = (n: number) => n.toLocaleString("sv-SE");

  if (selected) {
    const varde = selected.volym * selected.prisPerM3;
    const arligTillvaxt = Math.round(selected.volym * (selected.tillvaxtPercent / 100));
    const framtidaIntakt = (selected.volym + arligTillvaxt * (selected.atgardsAr - 2024)) * selected.prisPerM3;

    return (
      <main className="flex-1 p-4 md:p-8 overflow-auto">
        <Button variant="ghost" className="gap-2 mb-4 -ml-2 text-muted-foreground" onClick={() => setSelectedId(null)}>
          <ArrowLeft className="h-4 w-4" /> Tillbaka
        </Button>

        <div className="flex items-center gap-3 mb-6">
          <Trees className="h-7 w-7 text-primary" />
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">{selected.name}</h1>
            <p className="text-sm text-muted-foreground">{selected.fastighet}</p>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <DetailCard label="Areal" value={`${selected.areal} ha`} />
          <DetailCard label="Ålder" value={`${selected.alder} år`} />
          <DetailCard label="Volym" value={`${fmt(selected.volym)} m³sk`} />
          <DetailCard label="Trädslag" value={selected.tradslag} small />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <p className="text-xs text-muted-foreground mb-1">Uppskattat värde</p>
            <p className="text-xl font-bold text-primary tabular-nums">{fmt(varde)} kr</p>
          </div>
          <div className="rounded-xl border border-accent/20 bg-accent/5 p-4">
            <p className="text-xs text-muted-foreground mb-1">Framtida intäkt ({selected.atgardsAr})</p>
            <p className="text-xl font-bold text-accent tabular-nums">{fmt(Math.round(framtidaIntakt))} kr</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">Årlig tillväxt</p>
            <p className="text-xl font-bold text-card-foreground tabular-nums">{fmt(arligTillvaxt)} m³sk/år <span className="text-sm font-normal text-muted-foreground">({selected.tillvaxtPercent}%)</span></p>
          </div>
        </div>

        {/* Planerad åtgärd */}
        <div className="rounded-xl border border-border bg-card p-4 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-card-foreground">Planerad åtgärd</span>
          </div>
          <p className="text-lg font-semibold text-foreground">{selected.planerad} <span className="text-muted-foreground font-normal">– {selected.atgardsAr}</span></p>
        </div>

        {/* Ekonomi kopplad till beståndet */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="font-display text-lg text-card-foreground">Ekonomi – {selected.name}</h3>
          </div>
          {selected.ekonomi.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Inga transaktioner kopplade ännu.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>År</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead className="text-right">Belopp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selected.ekonomi.map((e, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm text-muted-foreground">{e.year}</TableCell>
                    <TableCell className="text-sm text-card-foreground">{e.type}</TableCell>
                    <TableCell className={cn("text-right text-sm font-semibold tabular-nums", e.amount >= 0 ? "text-primary" : "text-card-foreground")}>
                      {e.amount >= 0 ? "+" : "−"}{fmt(Math.abs(e.amount))} kr
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

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <SummaryCard label="Total areal" value={`${fmt(totalStats.areal)} ha`} />
        <SummaryCard label="Totalt virkesförråd" value={`${fmt(totalStats.volym)} m³sk`} />
        <SummaryCard label="Uppskattat värde" value={`${fmt(totalStats.varde)} kr`} highlight />
        <SummaryCard label="Årlig tillväxt" value={`${fmt(totalStats.tillvaxt)} m³sk`} />
      </div>

      {/* Beståndslista */}
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
            {BESTAND.map((b) => (
              <TableRow key={b.id} className="cursor-pointer" onClick={() => setSelectedId(b.id)}>
                <TableCell>
                  <div>
                    <p className="text-sm font-medium text-card-foreground">{b.name}</p>
                    <p className="text-xs text-muted-foreground md:hidden">{b.areal} ha · {b.alder} år</p>
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{b.areal} ha</TableCell>
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{b.alder} år</TableCell>
                <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{b.tradslag}</TableCell>
                <TableCell className="text-sm tabular-nums text-card-foreground">{fmt(b.volym)} m³sk</TableCell>
                <TableCell className="hidden md:table-cell">
                  <Badge variant="secondary" className="text-xs font-normal">{b.planerad} {b.atgardsAr}</Badge>
                </TableCell>
                <TableCell className="text-right text-sm font-semibold tabular-nums text-primary">{fmt(b.volym * b.prisPerM3)} kr</TableCell>
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
