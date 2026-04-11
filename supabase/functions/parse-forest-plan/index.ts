import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { importId, fileUrl } = await req.json();
    if (!importId || !fileUrl) {
      return new Response(JSON.stringify({ error: "importId and fileUrl required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth check
    const authHeader = req.headers.get("Authorization")!;
    const supabaseClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Update status to processing
    await adminClient.from("forest_plan_imports")
      .update({ status: "processing" })
      .eq("id", importId).eq("user_id", user.id);

    // Get signed URL for the PDF
    const { data: signedData } = await adminClient.storage
      .from("forest-plans")
      .createSignedUrl(fileUrl, 600);

    if (!signedData?.signedUrl) throw new Error("Could not create signed URL");

    // Download PDF as base64
    const pdfResp = await fetch(signedData.signedUrl);
    const pdfBuffer = await pdfResp.arrayBuffer();
    const bytes = new Uint8Array(pdfBuffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64Pdf = btoa(binary);

    // Call AI to extract stand data from the forest plan PDF
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Du är en expert på svenska skogsbruksplaner. Din uppgift är att läsa av avdelningsbeskrivningar från en skogsbruksplan-PDF och extrahera BARA de viktigaste uppgifterna per avdelning/bestånd.

Fokusera ENBART på:
- Avdelningsnummer eller namn
- Huvudträdslag (tall, gran, björk, löv, blandskog etc.)
- Areal i hektar
- Ålder (medelålder eller dominerande ålder)
- Virkesförråd/volym (m³sk)
- Bonitet/ståndortsindex (t.ex. T24, G28, B20)
- Planerad/föreslagen åtgärd (slutavverkning, gallring, röjning, plantering, ingen åtgärd)
- Planerat år eller tidsperiod för åtgärden
- Viktiga anteckningar (t.ex. stormskador, speciella hänsyn)

VIKTIGT:
- Om ett värde inte kan utläsas säkert, lämna det som null
- Sätt confidence till lägre värde om du är osäker
- Tolka INTE oviktiga detaljer
- En avdelning kan ha blandträdslag – ange det dominerande
- Svara BARA med det anropade verktyget`,
          },
          {
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
                        volume_m3sk: { type: "number", description: "Virkesförråd i m³sk" },
                        site_index: { type: "string", description: "Bonitet/ståndortsindex, t.ex. 'T24', 'G28'" },
                        planned_action: { type: "string", description: "Planerad åtgärd: slutavverkning, gallring, röjning, plantering, markberedning, ingen åtgärd" },
                        planned_year: { type: "number", description: "Planerat år för åtgärden" },
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

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      await adminClient.from("forest_plan_imports")
        .update({ status: "failed", notes: `AI error: ${status}` })
        .eq("id", importId);

      if (status === 429) {
        return new Response(JSON.stringify({ error: "AI-tjänsten är tillfälligt överbelastad. Försök igen." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI-krediter slut." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiResult = await aiResponse.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      await adminClient.from("forest_plan_imports")
        .update({ status: "failed", notes: "AI kunde inte tolka PDF:en" })
        .eq("id", importId);
      throw new Error("No tool call in AI response");
    }

    const parsed = JSON.parse(toolCall.function.arguments);

    // Save extracted data
    const { error: updateError } = await adminClient
      .from("forest_plan_imports")
      .update({
        status: "review_pending",
        extracted_stands_count: parsed.stands?.length || 0,
        extracted_data: parsed.stands || [],
        confidence_score: parsed.overall_confidence || 0,
        notes: parsed.notes || null,
      })
      .eq("id", importId)
      .eq("user_id", user.id);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true, data: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-forest-plan error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
