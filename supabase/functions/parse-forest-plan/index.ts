import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_EXTRACTED_TEXT_LENGTH = 120_000;
const MIN_STRUCTURED_TEXT_LENGTH = 250;
const Y_TOLERANCE = 3;
const COLUMN_GAP_THRESHOLD = 10;
const SECTION_CONTEXT_RADIUS = 16;

type ExtractedStand = {
  name: string;
  tree_species: string | null;
  area_ha: number | null;
  age: number | null;
  volume_m3sk: number | null;
  site_index: string | null;
  huggningsklass: string | null;
  mean_diameter_cm: number | null;
  mean_height_m: number | null;
  goal_class: string | null;
  basal_area_m2: number | null;
  annual_growth_m3sk: number | null;
  description: string | null;
  planned_action: string | null;
  planned_year: number | null;
  notes: string | null;
  confidence: number | null;
};

type ParsedForestPlan = {
  stands: ExtractedStand[];
  overall_confidence: number;
  notes?: string | null;
};

type PdfTextItem = {
  str?: string;
  transform?: number[];
  width?: number;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;

  const intervalMatch = value.match(/(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)/);
  if (intervalMatch) {
    const start = Number(intervalMatch[1].replace(",", "."));
    const end = Number(intervalMatch[2].replace(",", "."));
    if (Number.isFinite(start) && Number.isFinite(end)) {
      return Number(((start + end) / 2).toFixed(1));
    }
  }

  const match = value.replace(/\s/g, "").match(/-?\d+(?:[.,]\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0].replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function toStringOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toIntegerOrNull(value: unknown): number | null {
  const parsed = parseNumber(value);
  return parsed === null ? null : Math.round(parsed);
}

function clampConfidence(value: unknown): number | null {
  const parsed = parseNumber(value);
  if (parsed === null) return null;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function normalizeStand(raw: Record<string, unknown>): ExtractedStand {
  return {
    name: toStringOrNull(raw.name) || "",
    tree_species: toStringOrNull(raw.tree_species),
    area_ha: parseNumber(raw.area_ha),
    age: toIntegerOrNull(raw.age),
    volume_m3sk: parseNumber(raw.volume_m3sk),
    site_index: toStringOrNull(raw.site_index),
    huggningsklass: toStringOrNull(raw.huggningsklass),
    mean_diameter_cm: parseNumber(raw.mean_diameter_cm),
    mean_height_m: parseNumber(raw.mean_height_m),
    goal_class: toStringOrNull(raw.goal_class),
    basal_area_m2: parseNumber(raw.basal_area_m2),
    annual_growth_m3sk: parseNumber(raw.annual_growth_m3sk),
    description: toStringOrNull(raw.description),
    planned_action: toStringOrNull(raw.planned_action),
    planned_year: toIntegerOrNull(raw.planned_year),
    notes: toStringOrNull(raw.notes),
    confidence: clampConfidence(raw.confidence),
  };
}

function bufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  const parts: string[] = [];

  for (let index = 0; index < bytes.length; index += chunkSize) {
    parts.push(String.fromCharCode(...bytes.subarray(index, index + chunkSize)));
  }

  return btoa(parts.join(""));
}

async function extractTextWithStructure(page: { getTextContent: () => Promise<{ items: unknown[] }> }) {
  const content = await page.getTextContent();
  const lineMap = new Map<number, Array<{ str: string; x: number; width: number }>>();

  for (const rawItem of content.items as PdfTextItem[]) {
    const str = typeof rawItem.str === "string" ? rawItem.str.replace(/\s+/g, " ").trim() : "";
    if (!str) continue;

    const x = Array.isArray(rawItem.transform) ? rawItem.transform[4] ?? 0 : 0;
    const yRaw = Array.isArray(rawItem.transform) ? rawItem.transform[5] ?? 0 : 0;
    const y = Math.round(yRaw / Y_TOLERANCE) * Y_TOLERANCE;

    if (!lineMap.has(y)) lineMap.set(y, []);
    lineMap.get(y)?.push({
      str,
      x,
      width: typeof rawItem.width === "number" ? rawItem.width : str.length * 5,
    });
  }

  return Array.from(lineMap.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([, items]) => {
      items.sort((a, b) => a.x - b.x);
      let line = "";

      for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        if (index > 0) {
          const previous = items[index - 1];
          const gap = item.x - (previous.x + previous.width);
          line += gap > COLUMN_GAP_THRESHOLD ? "  " : " ";
        }
        line += item.str;
      }

      return line.replace(/\s{3,}/g, "  ").trim();
    })
    .filter(Boolean)
    .join("\n");
}

async function extractStructuredPdfText(pdfBuffer: ArrayBuffer) {
  const pdf = await pdfjsLib.getDocument({
    data: new Uint8Array(pdfBuffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: true,
  }).promise;

  const pages: string[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const pageText = await extractTextWithStructure(page);
      if (pageText.trim()) {
        pages.push(`--- Sida ${pageNumber} ---\n${pageText}`);
      }
    }
  } finally {
    pdf.cleanup();
    pdf.destroy();
  }

  return pages.join("\n\n").slice(0, MAX_EXTRACTED_TEXT_LENGTH);
}

function buildStandMatcher(name: string) {
  const rawName = name.trim();
  const normalizedName = rawName.replace(/^avd(?:elning)?\.?\s*/i, "").trim();

  if (/^\d+[a-zåäö]?$/i.test(normalizedName)) {
    return new RegExp(`(?:^|\\b)(?:avd(?:elning)?\\.?\\s*)?${escapeRegExp(normalizedName)}(?:\\b|$)`, "i");
  }

  return new RegExp(escapeRegExp(rawName), "i");
}

function getStandSection(structuredText: string, standName: string) {
  if (!standName) return "";

  const lines = structuredText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const matcher = buildStandMatcher(standName);
  const matchIndex = lines.findIndex((line) => matcher.test(line));
  if (matchIndex === -1) return "";

  const start = Math.max(0, matchIndex - 2);
  const end = Math.min(lines.length, matchIndex + SECTION_CONTEXT_RADIUS + 1);
  return lines.slice(start, end).join("\n");
}

function matchFirstNumber(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return parseNumber(match[1]);
  }

  return null;
}

function detectTreeSpecies(text: string) {
  const lower = text.toLowerCase();
  const hits = [
    lower.includes("gran") ? "Gran" : null,
    lower.includes("tall") ? "Tall" : null,
    lower.includes("björk") ? "Björk" : null,
    lower.includes("löv") ? "Löv" : null,
    lower.includes("lärk") ? "Lärk" : null,
  ].filter(Boolean) as string[];

  if (lower.includes("blandskog") || hits.length > 1) return "Blandskog";
  return hits[0] ?? null;
}

function detectPlannedAction(text: string) {
  if (/slutavverk/i.test(text)) return "slutavverkning";
  if (/gallr/i.test(text)) return "gallring";
  if (/röjn/i.test(text)) return "röjning";
  if (/planter/i.test(text)) return "plantering";
  if (/markbered/i.test(text)) return "markberedning";
  return null;
}

function enrichStandFromSection(stand: ExtractedStand, section: string) {
  if (!section) return stand;

  let supplementedFields = 0;
  let nextStand = { ...stand };

  const age = nextStand.age ?? toIntegerOrNull(matchFirstNumber(section, [
    /(?:medelålder|medelåld|ålder|åld)\s*[:=]?\s*(\d{1,3}(?:\s*[-–]\s*\d{1,3})?)/i,
    /(?:beståndsålder|dominantålder)\s*[:=]?\s*(\d{1,3}(?:\s*[-–]\s*\d{1,3})?)/i,
  ]));
  if (nextStand.age === null && age !== null) {
    nextStand.age = age;
    supplementedFields += 1;
  }

  const area = nextStand.area_ha ?? matchFirstNumber(section, [
    /areal\s*[:=]?\s*(\d+(?:[.,]\d+)?)/i,
    /(\d+(?:[.,]\d+)?)\s*ha\b/i,
  ]);
  if (nextStand.area_ha === null && area !== null) {
    nextStand.area_ha = area;
    supplementedFields += 1;
  }

  const volume = nextStand.volume_m3sk ?? matchFirstNumber(section, [
    /(?:virkesförråd|förråd|volym)\s*[:=]?\s*(\d+(?:[.,]\d+)?)/i,
    /(\d+(?:[.,]\d+)?)\s*(?:m³sk|m3sk|m³|m3)\b/i,
  ]);
  if (nextStand.volume_m3sk === null && volume !== null) {
    nextStand.volume_m3sk = volume;
    supplementedFields += 1;
  }

  const siteIndex = nextStand.site_index ?? (section.match(/\b([TGFBL]\s?\d{1,2})\b/i)?.[1]?.replace(/\s+/g, "") ?? null);
  if (nextStand.site_index === null && siteIndex) {
    nextStand.site_index = siteIndex.toUpperCase();
    supplementedFields += 1;
  }

  const plannedYear = nextStand.planned_year ?? toIntegerOrNull(matchFirstNumber(section, [
    /(?:plan(?:erat|erad)?\s*(?:år|tid)?|åtgärd(?:sår)?)\s*[:=]?\s*(20\d{2})/i,
    /(?:slutavverkning|gallring|röjning|plantering|markberedning)[^\n]{0,30}?(20\d{2})/i,
  ]));
  if (nextStand.planned_year === null && plannedYear !== null) {
    nextStand.planned_year = plannedYear;
    supplementedFields += 1;
  }

  const plannedAction = nextStand.planned_action ?? detectPlannedAction(section);
  if (nextStand.planned_action === null && plannedAction) {
    nextStand.planned_action = plannedAction;
    supplementedFields += 1;
  }

  const treeSpecies = nextStand.tree_species ?? detectTreeSpecies(section);
  if (nextStand.tree_species === null && treeSpecies) {
    nextStand.tree_species = treeSpecies;
    supplementedFields += 1;
  }

  if (supplementedFields > 0) {
    nextStand.confidence = Math.max(nextStand.confidence ?? 0, 60);
  }

  return nextStand;
}

function enrichParsedResult(rawParsed: Record<string, unknown>, structuredText: string): ParsedForestPlan {
  const stands = Array.isArray(rawParsed.stands)
    ? rawParsed.stands.map((stand) => normalizeStand((stand ?? {}) as Record<string, unknown>)).filter((stand) => stand.name)
    : [];

  const enrichedStands = structuredText
    ? stands.map((stand) => enrichStandFromSection(stand, getStandSection(structuredText, stand.name) || structuredText))
    : stands;

  const originalAges = stands.filter((stand) => stand.age !== null).length;
  const enrichedAges = enrichedStands.filter((stand) => stand.age !== null).length;
  const notes: string[] = [];

  const originalNotes = toStringOrNull(rawParsed.notes);
  if (originalNotes) notes.push(originalNotes);
  if (structuredText && enrichedAges > originalAges) {
    notes.push("Vissa fält kompletterades från PDF:ens avdelningsbeskrivning, bland annat ålder där den gick att läsa ut säkert.");
  }

  return {
    stands: enrichedStands,
    overall_confidence: clampConfidence(rawParsed.overall_confidence) ?? 0,
    notes: notes.length > 0 ? notes.join(" ") : null,
  };
}

async function callExtractionAI(apiKey: string, structuredText: string, base64Pdf: string) {
  const hasStructuredText = structuredText.trim().length >= MIN_STRUCTURED_TEXT_LENGTH;

  return await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `Du är en expert på svenska skogsbruksplaner. Din uppgift är att läsa av avdelningsbeskrivningar från en skogsbruksplan och extrahera uppgifterna per avdelning/bestånd.

Fält att extrahera per avdelning:
- Avdelningsnummer eller namn (Avd nr)
- Huvudträdslag (tall, gran, björk, löv, blandskog etc.)
- Areal i hektar
- Ålder (medelålder, åld, dominantålder)
- Huggningsklass (Hkl) – t.ex. K1, K2, S1, S2, S3, R1, R2, E1, E2, E3
- Ståndortsindex/Bonitet (SI) – t.ex. T24, G28, B20
- Virkesförråd/volym (m³sk) – total volym per avdelning
- Medeldiameter (cm) – medeldiam
- Medelhöjd (m)
- Målklass – t.ex. PG, NS, NO, K, PF
- Grundyta (G-yta) i m²
- Årlig tillväxt (m³sk)
- Beskrivning – fri text om beståndet
- Åtgärd – planerad/föreslagen åtgärd
- År/När – planerat år eller period för åtgärden
- Uttag (m³sk) – planerat uttag vid åtgärd
- Anteckningar – övriga viktiga noteringar

VIKTIGT:
- Läs främst av avdelningsbeskrivningen, inte övriga sammanställningar
- Kolumnrubrikerna kan vara förkortade: "Åld" = ålder, "SI" = ståndortsindex, "Hkl" = huggningsklass, "Med diam" = medeldiameter, "Med höjd" = medelhöjd
- Om ett värde inte kan utläsas säkert, lämna det som null
- Sätt confidence till lägre värde om du är osäker
- En avdelning kan ha blandträdslag – ange det dominerande
- Svara BARA med det anropade verktyget`,
        },
        hasStructuredText
          ? {
              role: "user",
              content: `Här är strukturerad text extraherad från PDF:ens avdelningsbeskrivning. Rad- och kolumnstruktur är bevarad för att göra värden som ålder lättare att hitta. Extrahera de viktigaste uppgifterna per avdelning/bestånd och fyll i ålder när den står tydligt angiven.\n\n${structuredText}`,
            }
          : {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Läs av avdelningsbeskrivningen i denna skogsbruksplan. Extrahera de viktigaste uppgifterna per avdelning/bestånd.",
                },
                {
                  type: "image_url",
                  image_url: { url: `data:application/pdf;base64,${base64Pdf}` },
                },
              ],
            },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "extract_forest_stands",
            description: "Extract stand/compartment data from a Swedish forest management plan",
            parameters: {
              type: "object",
              properties: {
                stands: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string", description: "Avdelningsnummer eller namn, t.ex. 'Avd 1' eller '1a'" },
                      tree_species: { type: "string", description: "Huvudträdslag, t.ex. 'Tall', 'Gran', 'Björk'" },
                      area_ha: { type: "number", description: "Areal i hektar" },
                      age: { type: "number", description: "Ålder i år" },
                      volume_m3sk: { type: "number", description: "Virkesförråd i m³sk (total per avdelning)" },
                      site_index: { type: "string", description: "Bonitet/ståndortsindex, t.ex. 'T24', 'G28'" },
                      huggningsklass: { type: "string", description: "Huggningsklass, t.ex. 'K1', 'S1', 'S2', 'S3', 'R1', 'R2', 'E1'" },
                      mean_diameter_cm: { type: "number", description: "Medeldiameter i cm" },
                      mean_height_m: { type: "number", description: "Medelhöjd i meter" },
                      goal_class: { type: "string", description: "Målklass, t.ex. 'PG', 'NS', 'NO', 'K', 'PF'" },
                      basal_area_m2: { type: "number", description: "Grundyta (G-yta) i m² per ha" },
                      annual_growth_m3sk: { type: "number", description: "Årlig tillväxt i m³sk" },
                      description: { type: "string", description: "Beskrivning av beståndet" },
                      planned_action: { type: "string", description: "Planerad åtgärd: slutavverkning, gallring, röjning, plantering, markberedning, ingen åtgärd" },
                      planned_year: { type: "number", description: "Planerat år för åtgärden" },
                      harvest_volume_m3sk: { type: "number", description: "Planerat uttag i m³sk vid åtgärd" },
                      notes: { type: "string", description: "Viktiga anteckningar" },
                      confidence: { type: "number", description: "Säkerhet 0-100 på denna avdelnings data" },
                    },
                    required: ["name"],
                    additionalProperties: false,
                  },
                },
                overall_confidence: { type: "number", description: "Övergripande säkerhet 0-100 på hela tolkningen" },
                notes: { type: "string", description: "Övergripande anteckningar om tolkningen" },
              },
              required: ["stands", "overall_confidence"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "extract_forest_stands" } },
    }),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let importId: string | null = null;
  let userId: string | null = null;
  let adminClient: any = null;

  try {
    const body = await req.json();
    importId = typeof body.importId === "string" ? body.importId : null;
    const fileUrl = typeof body.fileUrl === "string" ? body.fileUrl : null;

    if (!importId || !fileUrl) {
      return jsonResponse({ error: "importId and fileUrl required" }, 400);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      throw new Error("Missing backend environment variables");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    userId = user.id;
    adminClient = createClient(supabaseUrl, supabaseServiceKey);

    await (adminClient.from("forest_plan_imports") as any)
      .update({ status: "processing" })
      .eq("id", importId)
      .eq("user_id", user.id);

    const { data: signedData } = await adminClient.storage
      .from("forest-plans")
      .createSignedUrl(fileUrl, 600);

    if (!signedData?.signedUrl) throw new Error("Could not create signed URL");

    const pdfResp = await fetch(signedData.signedUrl);
    if (!pdfResp.ok) throw new Error("Could not download PDF");

    const pdfBuffer = await pdfResp.arrayBuffer();

    let structuredText = "";
    try {
      structuredText = await extractStructuredPdfText(pdfBuffer);
    } catch (error) {
      console.error("Structured PDF extraction failed:", error);
    }

    const base64Pdf = bufferToBase64(pdfBuffer);
    const aiResponse = await callExtractionAI(LOVABLE_API_KEY, structuredText, base64Pdf);

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      await (adminClient.from("forest_plan_imports") as any)
        .update({ status: "failed", notes: `AI error: ${status}` })
        .eq("id", importId)
        .eq("user_id", user.id);

      if (status === 429) {
        return jsonResponse({ error: "AI-tjänsten är tillfälligt överbelastad. Försök igen." }, 429);
      }
      if (status === 402) {
        return jsonResponse({ error: "AI-krediter slut." }, 402);
      }
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiResult = await aiResponse.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      await (adminClient.from("forest_plan_imports") as any)
        .update({ status: "failed", notes: "AI kunde inte tolka PDF:en" })
        .eq("id", importId)
        .eq("user_id", user.id);
      throw new Error("No tool call in AI response");
    }

    const parsed = enrichParsedResult(JSON.parse(toolCall.function.arguments), structuredText);

    const { error: updateError } = await (adminClient.from("forest_plan_imports") as any)
      .update({
        status: "review_pending",
        extracted_stands_count: parsed.stands.length,
        extracted_data: parsed.stands,
        confidence_score: parsed.overall_confidence,
        notes: parsed.notes || null,
      })
      .eq("id", importId)
      .eq("user_id", user.id);

    if (updateError) throw updateError;

    return jsonResponse({ success: true, data: parsed });
  } catch (error) {
    console.error("parse-forest-plan error:", error);

    if (adminClient && importId && userId) {
      await (adminClient.from("forest_plan_imports") as any)
        .update({
          status: "failed",
          notes: error instanceof Error ? error.message : "Unknown error",
        })
        .eq("id", importId)
        .eq("user_id", userId);
    }

    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
