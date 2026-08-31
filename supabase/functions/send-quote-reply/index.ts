import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import nodemailer from "npm:nodemailer";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // --- DIAGNOSTIC START ---
    const authHeader = req.headers.get("Authorization");
    console.log("[send-quote-reply] auth diagnostic", {
      hasAuthorizationHeader: !!authHeader,
      authHeaderPrefix: authHeader ? authHeader.substring(0, 10) + "..." : "none",
    });
    // --- DIAGNOSTIC END ---

    // ── 1. Create user-context client (respects RLS throughout) ──────────────
    // We use the user's JWT for ALL operations. No service-role needed because:
    // - user_profiles: RLS allows "SELECT WHERE auth.uid() = id" (own profile)
    // - quote_requests: RBAC RLS allows SELECT/UPDATE for quotes:write roles
    // - quote_messages: RBAC RLS allows INSERT for quotes:write roles
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: authHeader ? { Authorization: authHeader } : {},
        },
      }
    );

    // ── 2. Verify JWT and get user identity ───────────────────────────────────
    const token = authHeader?.replace(/^Bearer\s+/i, "");

    // Explicitly pass the token to getUser() to ensure it's verified correctly
    const { data: { user }, error: userError } = await userClient.auth.getUser(token);

    if (userError || !user) {
      console.error("[send-quote-reply] userError or no user:", userError, !!user);
      return new Response(JSON.stringify({ error: "Unauthorized: invalid or missing session." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    // ── 3. Fetch own profile for RBAC check (RLS: users can read own profile) ─
    const { data: profile, error: profileError } = await userClient
      .from("user_profiles")
      .select("role, permissions, is_active")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      console.error("Profile fetch error:", profileError);
      return new Response(JSON.stringify({ error: "Unauthorized: user profile not found." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    if (!profile.is_active) {
      return new Response(JSON.stringify({ error: "Unauthorized: account is inactive." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    // ── 4. RBAC: Require quotes:write permission ──────────────────────────────
    // Explicitly allowed: superadmin, admin, employee (all have implicit quotes:*)
    // Explicitly denied: intern and any role not listed above
    // This mirrors the has_permission() function in the database exactly.
    const { role, permissions } = profile;
    const hasQuotesWrite =
      role === "superadmin" ||
      role === "admin" ||
      role === "employee" ||
      (Array.isArray(permissions) && permissions.includes("quotes:write"));

    if (!hasQuotesWrite) {
      return new Response(
        JSON.stringify({ error: "Forbidden: insufficient permissions to reply to quote requests." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    // ── 5. Parse and validate request body ───────────────────────────────────
    const body = await req.json().catch(() => null);
    // Allow empty message if there are attachments
    const hasMessage = body && body.message && body.message.trim();
    const hasAttachments = body && Array.isArray(body.attachments) && body.attachments.length > 0;
    if (!body || !body.quote_request_id || (!hasMessage && !hasAttachments)) {
      return new Response(JSON.stringify({ error: "Missing quote_request_id, message, or attachments." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }
    const { quote_request_id, message, attachments = [] } = body;

    // ── 6. Fetch the quote request via userClient ─────────────────────────────
    // RLS "RBAC Read quote requests" policy enforces that only roles with
    // quotes:read can SELECT. Since employee has quotes:*, this passes.
    // If the RLS policy denies access, this returns an error, acting as a
    // second layer of protection beyond step 4.
    const { data: quote, error: quoteError } = await userClient
      .from("quote_requests")
      .select("id, email, status, name, machine:machines(name), inventory_item:inventory_items(name), request_type")
      .eq("id", quote_request_id)
      .single();

    if (quoteError || !quote) {
      console.error("Quote fetch error:", quoteError);
      return new Response(JSON.stringify({ error: "Quote request not found or access denied." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    // ── 7. Save message to quote_messages (always runs, DB is source of truth) ─
    // RLS "RBAC Insert quote messages" requires quotes:write – passes for employee.
    const senderEmail = user.email ?? "no-reply@hammaromaskin.se";
    const { data: savedMessage, error: insertError } = await userClient
      .from("quote_messages")
      .insert({
        quote_request_id,
        sender_type: "admin",
        sender_email: senderEmail,
        body_text: message ? message.trim() : "",
        attachments: attachments,
      })
      .select()
      .single();

    if (insertError || !savedMessage) {
      console.error("Failed to save message:", insertError);
      return new Response(
        JSON.stringify({ error: "Kunde inte spara svaret i databasen. Försök igen." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // ── 8. Update quote status → 'contacted' if currently 'new' ──────────────
    // Only runs after message is successfully saved.
    // RLS "RBAC Update quote requests" requires quotes:write – passes for employee.
    if (quote.status === "new") {
      const { error: updateError } = await userClient
        .from("quote_requests")
        .update({ status: "contacted" })
        .eq("id", quote_request_id);

      if (updateError) {
        // Non-fatal: message is saved, status just didn't flip. Logged for ops.
        console.error("Failed to update status to contacted:", updateError);
      }
    }

    // ── 9. Best-effort email via Google SMTP (optional, non-blocking) ────────
    // DB operations above are always the source of truth.
    let emailStatus = "not_configured";
    const smtpUser = Deno.env.get("GMAIL_SMTP_USER");
    const smtpPassword = Deno.env.get("GMAIL_SMTP_PASSWORD");

    if (smtpUser && smtpPassword) {
      try {
        const testMode = Deno.env.get("EMAIL_TEST_MODE") === "true";
        const testRecipient = Deno.env.get("EMAIL_TEST_RECIPIENT");
        const recipientEmail = testMode && testRecipient ? testRecipient : quote.email;

        let subjectItem = "Hammarö Maskin & Smide";
        if (quote.machine?.name) subjectItem = quote.machine.name;
        else if (quote.inventory_item?.name) subjectItem = quote.inventory_item.name;
        else if (quote.request_type) subjectItem = quote.request_type;

        const transporter = nodemailer.createTransport({
          host: "smtp.gmail.com",
          port: 465,
          secure: true,
          auth: {
            user: smtpUser,
            pass: smtpPassword, // Loggas aldrig
          },
        });

        // Download attachments for Nodemailer
        const mailAttachments = [];
        if (Array.isArray(attachments) && attachments.length > 0) {
          for (const att of attachments) {
            const { data: fileData, error: downloadError } = await userClient
              .storage
              .from('quote-attachments')
              .download(att.path);
              
            if (downloadError || !fileData) {
              console.error(`Failed to download attachment ${att.path}:`, downloadError);
              continue;
            }
            
            // Convert Blob to Uint8Array for Nodemailer
            const arrayBuffer = await fileData.arrayBuffer();
            mailAttachments.push({
              filename: att.name,
              content: new Uint8Array(arrayBuffer),
            });
          }
        }

        const info = await transporter.sendMail({
          from: `Hammarö Maskin <${smtpUser}>`, // Måste använda auth-kontot
          replyTo: smtpUser,                    // Systemets gemensamma email som "svara till"
          to: recipientEmail,
          subject: `Re: Förfrågan angående ${subjectItem}`,
          text: message ? message.trim() : "Bifogat dokument angående din förfrågan.",
          attachments: mailAttachments,
        });

        // --- DIAGNOSTIC START ---
        if (!info.messageId) {
          console.error("SMTP succeeded but Nodemailer returned no Message-ID.");
        } else {
          console.log(`SMTP send successful. Message-ID present: ${!!info.messageId}`);
        }

        if (info.messageId && savedMessage?.id) {
          // Använd service-role client uteslutande för denna interna systemuppdatering
          // för att kringgå eventuella RLS-begränsningar som döljer den nyskapade raden.
          const adminClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
          );

          const { data: updatedRows, error: msgUpdateError } = await adminClient
            .from("quote_messages")
            .update({ email_message_id: info.messageId })
            .eq("id", savedMessage.id)
            .select("id, email_message_id");

          if (msgUpdateError) {
            console.error("Failed to save SMTP Message-ID:", msgUpdateError.message);
          } else if (!updatedRows || updatedRows.length === 0) {
            console.error("SMTP succeeded but quote_messages UPDATE affected 0 rows.");
          } else {
            console.log("SMTP Message-ID successfully saved to quote_messages.");
          }
        }
        // --- DIAGNOSTIC END ---

        emailStatus = testMode ? "sent_test_mode" : "sent";
        console.log(`Email sent. Status: ${emailStatus}`);
      } catch (emailErr: any) {
        // Loggar endast felmeddelandet, aldrig credentials
        console.error("Email send exception:", emailErr.message);
        emailStatus = "failed";
      }
    } else {
      console.log("Email not configured (no GMAIL_SMTP_USER/PASSWORD). Message saved to DB only.");
    }

    // ── 10. Return success ────────────────────────────────────────────────────
    const emailMessage =
      emailStatus === "sent"            ? "Svaret sparades och skickades till kunden." :
      emailStatus === "sent_test_mode"  ? "Svaret sparades. Testläge: e-post skickades till testadress." :
      emailStatus === "failed"          ? "Svaret sparades i systemet, men e-post kunde inte skickas." :
      /* not_configured */                "Svaret sparades i systemet. E-post är inte konfigurerat.";

    return new Response(
      JSON.stringify({
        success: true,
        message: savedMessage,
        email_status: emailStatus,
        email_message: emailMessage,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (err: any) {
    console.error("Unhandled error in send-quote-reply:", err.message);
    return new Response(JSON.stringify({ error: "Ett oväntat fel uppstod. Försök igen." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
