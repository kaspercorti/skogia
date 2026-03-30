import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify the user
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { invoiceId } = await req.json();
    if (!invoiceId) {
      return new Response(JSON.stringify({ error: "invoiceId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch invoice
    const { data: invoice, error: invError } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .eq("user_id", user.id)
      .single();

    if (invError || !invoice) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch customer
    let customer = null;
    if (invoice.customer_id) {
      const { data } = await supabase
        .from("customers")
        .select("*")
        .eq("id", invoice.customer_id)
        .single();
      customer = data;
    }

    // Fetch user settings
    const { data: settings } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", user.id)
      .single();

    const companyName = settings?.company_name || "Skogia-användare";
    const senderName = settings?.sender_name || user.email;

    // Generate simple invoice HTML for PDF
    const html = `<!DOCTYPE html>
<html lang="sv">
<head><meta charset="UTF-8"><style>
  body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 40px; color: #1a1a1a; font-size: 14px; }
  .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
  .company { font-size: 22px; font-weight: bold; color: #2d5a3d; }
  .invoice-title { font-size: 28px; font-weight: bold; color: #2d5a3d; margin-bottom: 5px; }
  .meta { color: #666; font-size: 13px; }
  .customer-box { background: #f8f7f4; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
  .customer-box h3 { margin: 0 0 8px; font-size: 14px; color: #888; text-transform: uppercase; letter-spacing: 1px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
  th { text-align: left; padding: 12px 8px; border-bottom: 2px solid #2d5a3d; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #666; }
  td { padding: 12px 8px; border-bottom: 1px solid #eee; }
  .totals { text-align: right; margin-top: 20px; }
  .totals .row { display: flex; justify-content: flex-end; gap: 40px; padding: 4px 0; }
  .totals .total { font-size: 20px; font-weight: bold; color: #2d5a3d; border-top: 2px solid #2d5a3d; padding-top: 8px; margin-top: 8px; }
  .footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #ddd; color: #888; font-size: 12px; }
</style></head>
<body>
  <div class="header">
    <div>
      <div class="company">${escapeHtml(companyName)}</div>
      <div class="meta">${escapeHtml(senderName)}</div>
    </div>
    <div style="text-align: right;">
      <div class="invoice-title">FAKTURA</div>
      <div class="meta">Nr: ${escapeHtml(invoice.invoice_number)}</div>
      <div class="meta">Datum: ${invoice.invoice_date}</div>
      <div class="meta">Förfaller: ${invoice.due_date}</div>
    </div>
  </div>

  <div class="customer-box">
    <h3>Faktureras till</h3>
    <strong>${escapeHtml(customer?.name || "—")}</strong><br/>
    ${customer?.organization_number ? `Org.nr: ${escapeHtml(customer.organization_number)}<br/>` : ""}
    ${customer?.address ? `${escapeHtml(customer.address)}<br/>` : ""}
    ${customer?.email ? `${escapeHtml(customer.email)}` : ""}
  </div>

  <table>
    <thead><tr><th>Beskrivning</th><th style="text-align:right;">Belopp ex moms</th><th style="text-align:right;">Moms</th><th style="text-align:right;">Totalt</th></tr></thead>
    <tbody>
      <tr>
        <td>${escapeHtml(invoice.description || "—")}</td>
        <td style="text-align:right;">${formatSEK(invoice.amount_ex_vat)}</td>
        <td style="text-align:right;">${formatSEK(invoice.vat_amount)}</td>
        <td style="text-align:right;">${formatSEK(invoice.amount_inc_vat)}</td>
      </tr>
    </tbody>
  </table>

  <div class="totals">
    <div class="row"><span>Netto:</span><span>${formatSEK(invoice.amount_ex_vat)}</span></div>
    <div class="row"><span>Moms:</span><span>${formatSEK(invoice.vat_amount)}</span></div>
    <div class="row total"><span>Att betala:</span><span>${formatSEK(invoice.amount_inc_vat)}</span></div>
  </div>

  <div class="footer">
    <p>${escapeHtml(companyName)} · Genererad via Skogia</p>
  </div>
</body>
</html>`;

    // Store as HTML (can be converted to PDF client-side or opened in browser for print)
    const fileName = `${user.id}/faktura-${invoice.invoice_number}.html`;
    
    const { error: uploadError } = await supabase.storage
      .from("invoice-pdfs")
      .upload(fileName, new Blob([html], { type: "text/html" }), {
        contentType: "text/html",
        upsert: true,
      });

    if (uploadError) {
      return new Response(JSON.stringify({ error: "Upload failed: " + uploadError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: urlData } = supabase.storage
      .from("invoice-pdfs")
      .getPublicUrl(fileName);

    return new Response(
      JSON.stringify({
        url: urlData.publicUrl,
        customerEmail: customer?.email || null,
        customerName: customer?.name || null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatSEK(n: number): string {
  return n.toLocaleString("sv-SE") + " kr";
}
