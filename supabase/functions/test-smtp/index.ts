import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import nodemailer from "npm:nodemailer";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. SÄKERHET: Validera att anropet har rätt API Key (secret key modell).
    // Vi använder "apikey" headern för service-to-service anrop enligt bästa praxis.
    const apiKeyHeader = req.headers.get("apikey");
    const expectedApiKey = Deno.env.get("SMTP_TEST_API_KEY");
    
    if (!apiKeyHeader || !expectedApiKey || apiKeyHeader !== expectedApiKey) {
      console.error("Unauthorized access attempt: Invalid or missing API key.");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const testRecipient = body.email;

    // 2. Validera input (Mottagare)
    if (!testRecipient || typeof testRecipient !== "string" || !testRecipient.includes("@")) {
      return new Response(JSON.stringify({ error: "En giltig 'email' parameter krävs i payload." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Hämta SMTP Credentials (aldrig hårdkodade)
    const smtpUser = Deno.env.get("GMAIL_SMTP_USER");
    const smtpPassword = Deno.env.get("GMAIL_SMTP_PASSWORD");

    if (!smtpUser || !smtpPassword) {
      console.error("Missing SMTP credentials in secrets");
      return new Response(JSON.stringify({ error: "SMTP credentials saknas." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Ansluter till smtp.gmail.com som ${smtpUser}...`);

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true, // sant för port 465, annars falskt för 587
      auth: {
        user: smtpUser,
        pass: smtpPassword, // Loggas aldrig
      },
    });

    console.log("Ansluten. Skickar mail...");

    // Tvinga avsändaren till det autentiserade kontot
    await transporter.sendMail({
      from: `Hammarö Maskin Test <${smtpUser}>`,
      to: testRecipient,
      subject: "Hammarö Maskin – SMTP Test",
      text: "Detta är ett test av Google SMTP från Supabase Edge Functions.",
    });

    console.log("Mail skickat.");

    return new Response(JSON.stringify({ success: true, message: "Testmail skickat." }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    // Logga inte hela felet då SMTP-fel kan innehålla delar av auth/lösenord i traces
    console.error("SMTP Error:", error.message);
    
    return new Response(JSON.stringify({ 
      error: "Kunde inte skicka e-post.", 
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
