import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type ExtractedStand = {
  name: string;
  tree_species: string | null;
  area_ha: number | null;
  age: number | null;
  volume_m3sk: number | null;
  volume_per_ha: number | null;
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
  // New extended fields
  parcel_number: string | null;
  layer: string | null;
  species_breakdown: any[] | null;
  alternative_action: string | null;
  timing_code: string | null;
  removal_percent: number | null;
  removal_volume_m3sk: number | null;
  vegetation_type: string | null;
  moisture_class: string | null;
  terrain_type: string | null;
  driving_conditions: string | null;
  slope_info: string | null;
  gyl_values: string | null;
  production_goal: string | null;
  general_comment: string | null;
  action_comment: string | null;
  special_values: string | null;
  raw_description_text: string | null;
  raw_full_text: string | null;
  field_confidence_map: Record<string, string> | null;
};

type ParsedForestPlan = {
  stands: ExtractedStand[];
  overall_confidence: number;
  notes?: string | null;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const intervalMatch = value.match(/(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)/);
  if (intervalMatch) {
    const start = Number(intervalMatch[1].replace(",", "."));
    const end = Number(intervalMatch[2].replace(",", "."));
    if (Number.isFinite(start) && Number.isFinite(end)) return Number(((start + end) / 2).toFixed(1));
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
    volume_per_ha: parseNumber(raw.volume_per_ha),
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
    // Extended fields
    parcel_number: toStringOrNull(raw.parcel_number),
    layer: toStringOrNull(raw.layer),
    species_breakdown: Array.isArray(raw.species_breakdown) ? raw.species_breakdown : null,
    alternative_action: toStringOrNull(raw.alternative_action),
    timing_code: toStringOrNull(raw.timing_code),
    removal_percent: parseNumber(raw.removal_percent),
    removal_volume_m3sk: parseNumber(raw.removal_volume_m3sk),
    vegetation_type: toStringOrNull(raw.vegetation_type),
    moisture_class: toStringOrNull(raw.moisture_class),
    terrain_type: toStringOrNull(raw.terrain_type),
    driving_conditions: toStringOrNull(raw.driving_conditions),
    slope_info: toStringOrNull(raw.slope_info),
    gyl_values: toStringOrNull(raw.gyl_values),
    production_goal: toStringOrNull(raw.production_goal),
    general_comment: toStringOrNull(raw.general_comment),
    action_comment: toStringOrNull(raw.action_comment),
    special_values: toStringOrNull(raw.special_values),
    raw_description_text: toStringOrNull(raw.raw_description_text),
    raw_full_text: toStringOrNull(raw.raw_full_text),
    field_confidence_map: (raw.field_confidence_map && typeof raw.field_confidence_map === "object" && !Array.isArray(raw.field_confidence_map))
      ? raw.field_confidence_map as Record<string, string>
      : null,
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

function enrichParsedResult(rawParsed: Record<string, unknown>): ParsedForestPlan {
  const stands = Array.isArray(rawParsed.stands)
    ? rawParsed.stands.map((s) => normalizeStand((s ?? {}) as Record<string, unknown>)).filter((s) => s.name)
    : [];

  return {
    stands,
    overall_confidence: clampConfidence(rawParsed.overall_confidence) ?? 0,
    notes: toStringOrNull(rawParsed.notes),
  };
}

async function callExtractionAI(apiKey: string, base64Pdf: string) {
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
          content: `Du är en expert på svenska skogsbruksplaner. Din uppgift är att läsa HELA avdelningsbeskrivningen och extrahera SÅ MYCKET DATA SOM MÖJLIGT per avdelning.

Du ska extrahera ALLA följande fält när de finns:

GRUNDDATA:
- Avdelningsnummer (name)
- Skifte (parcel_number)
- Skikt (layer)
- Areal i hektar (area_ha)
- Ålder i år (age)
- Huggningsklass/Hkl – t.ex. K1, K2, S1, S2, S3, R1, R2, E1, E2, E3 (huggningsklass)
- Ståndortsindex/Bonitet (SI) – t.ex. T24, G28, B20 (site_index)
- Virkesförråd total m³sk (volume_m3sk)
- Virkesförråd per ha (volume_per_ha)
- Huvudträdslag (tree_species)
- Medeldiameter cm (mean_diameter_cm)
- Medelhöjd m (mean_height_m)
- Målklass – PG, NS, NO, K, PF (goal_class)
- Grundyta G-yta m² (basal_area_m2)
- Årlig tillväxt m³sk (annual_growth_m3sk)

TRÄDSLAGSFÖRDELNING (species_breakdown):
Array med objekt: { species: "Tall", percent: 60, volume_m3sk: 120 }
Inkludera alla trädslag som nämns med andel och/eller volym.

ÅTGÄRDSDATA:
- Planerad åtgärd (planned_action)
- Alternativ åtgärd (alternative_action)
- När/prioritet/timing (timing_code)
- Planerat år (planned_year)
- Uttag i procent (removal_percent)
- Uttag inklusive tillväxt m³sk (removal_volume_m3sk)

MARK OCH TERRÄNG:
- Vegetationstyp – blåbärstyp, smalbladig grästyp, lingontyp etc (vegetation_type)
- Fuktighet – frisk, fuktig, torr, blöt, myr (moisture_class)
- Terrängtyp (terrain_type)
- Drivningsförutsättningar (driving_conditions)
- Lutning / plan mark (slope_info)
- G, Y, L-värden (gyl_values)

BESKRIVNINGAR:
- Produktionsmål (production_goal)
- Generell kommentar (general_comment)
- Åtgärdskommentar (action_comment)
- Speciella värden – naturvärden, kulturvärden etc (special_values)
- Anteckningar/noteringar (notes)
- Beskrivning/fri text om beståndet (description)

RÅTEXT:
- raw_description_text: HELA beskrivningstexten för avdelningen, ordagrant kopierad
- raw_full_text: All text som hör till avdelningen, inklusive tabellvärden formaterade som text

OSÄKERHET PER FÄLT (field_confidence_map):
Ange osäkerhet per fält som objekt, t.ex.:
{ "area_ha": "high", "site_index": "medium", "moisture_class": "low", "production_goal": "extracted_from_raw" }
Nivåer: "high", "medium", "low", "extracted_from_raw"

VIKTIGT:
- Läs HELA avdelningsbeskrivningen, inte bara tabellens huvudkolumner
- Fånga även löptext, kommentarer, noteringar under/efter varje avdelning
- Inkludera marktyp, myr, fuktighet, vegetationstyp, terräng, drivning, GYL
- Om ett värde inte kan tolkas säkert, lämna strukturerat fält som null men inkludera det i raw_description_text
- Spara HELLRE FÖR MYCKET än för lite – ingen information ska kastas bort
- Kolumnrubrikerna kan vara förkortade: "Åld" = ålder, "SI" = bonitet, "Hkl" = huggningsklass, "Med diam" = medeldiameter, "Med höjd" = medelhöjd, "G-yta" = grundyta, "Trp" = terrängklass
- Svara BARA med det anropade verktyget`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Läs av HELA avdelningsbeskrivningen i denna skogsbruksplan. Extrahera ALL data per avdelning – grunddata, trädslagsfördelning, mark/terräng, kommentarer, åtgärder och råtext. Missa INGET.",
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
            description: "Extract complete compartment data from a Swedish forest management plan including terrain, species breakdown, raw text and per-field confidence",
            parameters: {
              type: "object",
              properties: {
                stands: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string", description: "Avdelningsnummer, t.ex. '1' eller '2a'" },
                      parcel_number: { type: "string", description: "Skifte" },
                      layer: { type: "string", description: "Skikt" },
                      tree_species: { type: "string", description: "Huvudträdslag" },
                      area_ha: { type: "number", description: "Areal ha" },
                      age: { type: "number", description: "Ålder år" },
                      huggningsklass: { type: "string", description: "Hkl – K1, K2, S1, S2, S3, R1, R2, E1, E2, E3" },
                      site_index: { type: "string", description: "Bonitet/SI, t.ex. T24, G28" },
                      volume_m3sk: { type: "number", description: "Total volym m³sk" },
                      volume_per_ha: { type: "number", description: "Volym per ha m³sk" },
                      mean_diameter_cm: { type: "number", description: "Medeldiameter cm" },
                      mean_height_m: { type: "number", description: "Medelhöjd m" },
                      goal_class: { type: "string", description: "Målklass – PG, NS, NO, K, PF" },
                      basal_area_m2: { type: "number", description: "Grundyta m²/ha" },
                      annual_growth_m3sk: { type: "number", description: "Årlig tillväxt m³sk" },
                      species_breakdown: {
                        type: "array",
                        description: "Trädslagsfördelning",
                        items: {
                          type: "object",
                          properties: {
                            species: { type: "string" },
                            percent: { type: "number" },
                            volume_m3sk: { type: "number" },
                          },
                        },
                      },
                      planned_action: { type: "string", description: "Planerad åtgärd" },
                      alternative_action: { type: "string", description: "Alternativ åtgärd" },
                      timing_code: { type: "string", description: "När/prioritet/timing" },
                      planned_year: { type: "number", description: "Planerat år" },
                      removal_percent: { type: "number", description: "Uttag i %" },
                      removal_volume_m3sk: { type: "number", description: "Uttag inkl tillväxt m³sk" },
                      vegetation_type: { type: "string", description: "Vegetationstyp – blåbärstyp, smalbladig grästyp, lingontyp" },
                      moisture_class: { type: "string", description: "Fuktighet – frisk, fuktig, torr, blöt, myr" },
                      terrain_type: { type: "string", description: "Terrängtyp" },
                      driving_conditions: { type: "string", description: "Drivningsförutsättningar" },
                      slope_info: { type: "string", description: "Lutning / plan mark" },
                      gyl_values: { type: "string", description: "G, Y, L-värden" },
                      production_goal: { type: "string", description: "Produktionsmål" },
                      general_comment: { type: "string", description: "Generell kommentar" },
                      action_comment: { type: "string", description: "Åtgärdskommentar" },
                      special_values: { type: "string", description: "Speciella värden – naturvärden, kulturvärden" },
                      description: { type: "string", description: "Beskrivning / fri text" },
                      notes: { type: "string", description: "Anteckningar / noteringar" },
                      raw_description_text: { type: "string", description: "HELA beskrivningstexten ordagrant" },
                      raw_full_text: { type: "string", description: "All text som hör till avdelningen" },
                      field_confidence_map: {
                        type: "object",
                        description: "Osäkerhet per fält: { fältnamn: 'high'|'medium'|'low'|'extracted_from_raw' }",
                        additionalProperties: { type: "string" },
                      },
                      confidence: { type: "number", description: "Övergripande säkerhet 0-100" },
                    },
                    required: ["name"],
                  },
                },
                overall_confidence: { type: "number", description: "Övergripande säkerhet 0-100" },
                notes: { type: "string", description: "Övergripande anteckningar" },
              },
              required: ["stands", "overall_confidence"],
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
    const base64Pdf = bufferToBase64(pdfBuffer);
    const aiResponse = await callExtractionAI(LOVABLE_API_KEY, base64Pdf);

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      await (adminClient.from("forest_plan_imports") as any)
        .update({ status: "failed", notes: `AI error: ${status}` })
        .eq("id", importId)
        .eq("user_id", user.id);

      if (status === 429) return jsonResponse({ error: "AI-tjänsten är tillfälligt överbelastad. Försök igen." }, 429);
      if (status === 402) return jsonResponse({ error: "AI-krediter slut." }, 402);
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

    const parsed = enrichParsedResult(JSON.parse(toolCall.function.arguments));

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
