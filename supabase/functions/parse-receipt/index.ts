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
    const { imageUrl, receiptId } = await req.json();
    if (!imageUrl || !receiptId) {
      return new Response(JSON.stringify({ error: "imageUrl and receiptId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Get auth user from request
    const authHeader = req.headers.get("Authorization")!;
    const supabaseClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to get signed URL for the image
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Download the image to get base64
    const { data: signedData } = await adminClient.storage
      .from("receipt-images")
      .createSignedUrl(imageUrl, 600);

    if (!signedData?.signedUrl) throw new Error("Could not create signed URL");

    // Download image as base64
    const imageResp = await fetch(signedData.signedUrl);
    const imageBuffer = await imageResp.arrayBuffer();
    const base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));
    const mimeType = imageResp.headers.get("content-type") || "image/jpeg";

    // Call AI to parse receipt
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
            content: `Du är en kvittotolkare för svensk skogsbruksbokföring. Analysera kvittobilden och extrahera data. Svara BARA med det anropade verktyget.

Kategoriregler:
- Drivmedel/diesel/bensin → "drivmedel"
- Plantor/frön → "plantering"
- Verktyg/motorsåg/kedjor → "utrustning"
- Grus/sand/vägmaterial → "vägunderhåll"
- Försäkring → "försäkring"
- Mat/fika → "representation"
- Kontorsmaterial → "administration"
- Reservdelar/reparation → "underhåll"
- Övrigt → "övrigt"`,
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Tolka detta kvitto. Extrahera leverantör, datum, totalbelopp, moms, och föreslå en bokföringskategori." },
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_receipt",
              description: "Extract receipt data from image",
              parameters: {
                type: "object",
                properties: {
                  supplier_name: { type: "string", description: "Leverantör/butik" },
                  receipt_date: { type: "string", description: "Datum i format YYYY-MM-DD" },
                  total_amount: { type: "number", description: "Totalbelopp inklusive moms" },
                  vat_amount: { type: "number", description: "Momsbelopp. Om ej tydligt, uppskatta 25% av totalbeloppet" },
                  amount_ex_vat: { type: "number", description: "Belopp exklusive moms" },
                  suggested_category: { type: "string", enum: ["drivmedel", "plantering", "utrustning", "vägunderhåll", "försäkring", "representation", "administration", "underhåll", "övrigt"] },
                  confidence_score: { type: "number", description: "Säkerhet 0-100 på tolkningen" },
                  notes: { type: "string", description: "Kort sammanfattning av kvittot" },
                },
                required: ["supplier_name", "total_amount", "suggested_category", "confidence_score"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_receipt" } },
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "AI-tjänsten är tillfälligt överbelastad. Försök igen om en stund." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI-krediter slut. Kontakta administratören." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiResult = await aiResponse.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in AI response");

    const parsed = JSON.parse(toolCall.function.arguments);

    // Update receipt with parsed data
    const { error: updateError } = await adminClient
      .from("receipts")
      .update({
        supplier_name: parsed.supplier_name || null,
        receipt_date: parsed.receipt_date || null,
        total_amount: parsed.total_amount || 0,
        vat_amount: parsed.vat_amount || 0,
        amount_ex_vat: parsed.amount_ex_vat || (parsed.total_amount ? parsed.total_amount - (parsed.vat_amount || 0) : 0),
        suggested_category: parsed.suggested_category || "övrigt",
        confidence_score: parsed.confidence_score || 0,
        notes: parsed.notes || null,
        status: "review_pending",
      })
      .eq("id", receiptId)
      .eq("user_id", user.id);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true, data: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-receipt error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
