import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { ImapFlow } from "npm:imapflow";
import { simpleParser } from "npm:mailparser";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper for multipart traversal
function extractParts(node: any, result: { textPart: string | null, textCharset: string | null, htmlPart: string | null, htmlCharset: string | null, attachments: any[] } = { textPart: null, textCharset: null, htmlPart: null, htmlCharset: null, attachments: [] }) {
    if (!node) return result;

    // Ignore multipart containers, recurse children
    if (node.type && node.type.toLowerCase().startsWith('multipart/')) {
        if (node.childNodes && Array.isArray(node.childNodes)) {
            for (const child of node.childNodes) extractParts(child, result);
        }
        return result;
    }

    // Check if attachment
    const isAttachment =
        (node.disposition && node.disposition.toLowerCase() === 'attachment') ||
        (node.dispositionParameters && node.dispositionParameters.filename) ||
        (node.parameters && node.parameters.name) ||
        (node.type && !node.type.toLowerCase().startsWith('text/') && !node.type.toLowerCase().startsWith('multipart/'));

    if (isAttachment) {
        let filename = "unnamed_attachment";
        if (node.dispositionParameters && node.dispositionParameters.filename) {
            filename = node.dispositionParameters.filename;
        } else if (node.parameters && node.parameters.name) {
            filename = node.parameters.name;
        }

        result.attachments.push({
            partId: node.part,
            filename: filename,
            contentType: node.type || 'application/octet-stream',
            size: node.size || 0
        });
    } else if (node.type && node.type.toLowerCase() === 'text/plain') {
        if (!result.textPart) {
            result.textPart = node.part;
            result.textCharset = node.parameters?.charset || null;
        }
    } else if (node.type && node.type.toLowerCase() === 'text/html') {
        if (!result.htmlPart) {
            result.htmlPart = node.part;
            result.htmlCharset = node.parameters?.charset || null;
        }
    }
    return result;
}

serve(async (req) => {
  const RUN_ID = crypto.randomUUID().split('-')[0].toUpperCase();
  const perfStartTime = Date.now();
  console.log(`[RUN ${RUN_ID}] [PERF] START RUN: Inkommande webhook-anrop mottaget.`);
  console.log(`[RUN ${RUN_ID}] [PERF] TIMING START: 0ms`);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // --- SÄKERHET ---
  const apiKeyHeader = req.headers.get("apikey");
  const expectedApiKey = Deno.env.get("IMAP_TEST_API_KEY")?.trim();

  if (!apiKeyHeader || !expectedApiKey || apiKeyHeader !== expectedApiKey) {
    console.error("Unauthorized access attempt: Invalid or missing API key.");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let dryRun = false;
  let sinceDate: Date | null = null;
  let fromFilter: string | null = null;
  try {
    const body = await req.json();
    if (body) {
      if (typeof body.dry_run === "boolean") dryRun = body.dry_run;
      if (typeof body.from === "string") fromFilter = body.from.trim();
      if (typeof body.since === "string") {
        const parsedDate = new Date(body.since);
        if (!isNaN(parsedDate.getTime())) {
          sinceDate = parsedDate;
        }
      }
    }
  } catch (e) {
    // ignore
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const smtpUser = Deno.env.get("GMAIL_SMTP_USER") ?? "";
  const smtpPassword = Deno.env.get("GMAIL_SMTP_PASSWORD") ?? "";

  if (!supabaseUrl || !serviceRoleKey || !smtpUser || !smtpPassword) {
    console.error("Missing required environment variables.");
    return new Response(JSON.stringify({ error: "Server configuration error." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: {
      user: smtpUser,
      pass: smtpPassword,
    },
    disableAutoIdle: true,
    logger: false,
  });

  console.log(`[RUN ${RUN_ID}] [PERF] ImapFlow-klient skapad.`);

  client.on('error', (err: any) => {
    console.error(`[RUN ${RUN_ID}] [PERF] Background IMAP Error: ${err.message}`);
  });
  
  client.on('close', () => {
    console.log(`[RUN ${RUN_ID}] [PERF] IMAP Connection closed.`);
  });

  let processed = 0;
  let matched = 0;
  let inserted = 0;

  try {
    console.log(`[RUN ${RUN_ID}] [PERF] BEFORE client.connect()`);
    await client.connect();
    console.log(`[RUN ${RUN_ID}] [PERF] AFTER client.connect()`);
    console.log(`[RUN ${RUN_ID}] [PERF] TIMING AFTER CONNECT: ${Date.now() - perfStartTime}ms`);
    const lock = await client.getMailboxLock("INBOX");
    console.log(`[RUN ${RUN_ID}] [PERF] TIMING AFTER LOCK: ${Date.now() - perfStartTime}ms`);
    try {
      let searchCriteria: any = { seen: false };
      if (sinceDate) {
        searchCriteria.since = sinceDate;
      }

      let searchResult = [];
      console.log(`[RUN ${RUN_ID}] [PERF] BEFORE search()`);
      searchResult = await client.search(searchCriteria, { uid: true });
      console.log(`[RUN ${RUN_ID}] [PERF] AFTER search()`);
      console.log(`[RUN ${RUN_ID}] [PERF] TIMING AFTER SEARCH: ${Date.now() - perfStartTime}ms`);

      console.log(`[RUN ${RUN_ID}] [PERF] START RUN: search() hittade ${searchResult ? searchResult.length : 0} UNSEEN mail.`);

      if (!searchResult || searchResult.length === 0) {
        return new Response(JSON.stringify({
          success: true,
          message: "No emails found matching criteria.",
          processed, matched, inserted, dry_run: dryRun, from: fromFilter
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const maxMessages = 10;
      let uidsToProcess = searchResult.slice(-maxMessages);
      console.log(`[PERF] UIDs som ska processas (max ${maxMessages}): ${uidsToProcess.join(', ')}`);

      for (const uid of uidsToProcess) {
        processed++;
        console.log(`[PERF] --- START UID: ${uid} ---`);
        const t_start = performance.now();
        const t_db_start = t_start;

        try {
            console.log(`[RUN ${RUN_ID}] [PERF] UID: ${uid} | BEFORE fetchOne (metadata)`);
            const msgMeta = await client.fetchOne(uid, { size: true, envelope: true }, { uid: true });
            console.log(`[RUN ${RUN_ID}] [PERF] UID: ${uid} | AFTER fetchOne (metadata)`);

            if (!msgMeta || typeof msgMeta.size !== 'number') {
                console.error(`[PERF] UID: ${uid} | KUNDE INTE VERIFIERA STORLEK. Lämnar som UNSEEN (fail-safe).`);
                continue;
            }

            const sizeKB = (msgMeta.size / 1024).toFixed(2);
            let envIdRaw = msgMeta?.envelope?.messageId || "none";
            let envFrom = "unknown@customer.com";
            if (msgMeta?.envelope?.from && Array.isArray(msgMeta.envelope.from) && msgMeta.envelope.from.length > 0) {
                envFrom = msgMeta.envelope.from[0].address || "unknown@customer.com";
            }

            console.log(`[PERF] UID: ${uid} | Size: ${sizeKB} KB | Env-MsgID: ${envIdRaw}`);

            let messageId = envIdRaw.startsWith('<') ? envIdRaw : `<${envIdRaw}>`;
            if (envIdRaw === "none") {
                console.error(`[PERF] UID: ${uid} | Saknar Message-ID i envelope. Lämnar UNSEEN pga idempotency-risk.`);
                continue;
            }

            // --- TIDIG IDEMPOTENCY CHECK ---
            const { data: existingMsg, error: exErr } = await adminClient
                .from("quote_messages")
                .select("id")
                .eq("email_message_id", messageId)
                .maybeSingle();

            if (exErr) {
                console.error(`[PERF] UID: ${uid} | DB Error vid idempotency check: ${exErr.message}. Lämnar UNSEEN.`);
                continue;
            }

            if (existingMsg) {
                console.log(`Email already processed. Skipping.`);
                if (!dryRun) await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
                console.log(`[RUN ${RUN_ID}] [PERF] TIMING AFTER messageFlagsAdd: ${Date.now() - perfStartTime}ms`);
                continue;
            }

            let inReplyToRaw = msgMeta?.envelope?.inReplyTo;
            let inReplyTo = inReplyToRaw ? (inReplyToRaw.startsWith('<') ? inReplyToRaw : `<${inReplyToRaw}>`) : null;

            // Variabler att fylla oavsett gren
            let bodyText = "";
            let bodyHtml: string | null = null;
            let attachmentsToUpload: any[] = [];
            let senderEmail = envFrom;
            let references: string[] | null = null;
            let quoteRequestId: string | null = null;
            let matchedOriginalMessageId: string | null = null;

            // POISON PILL: > 20 MB
            if (msgMeta.size > 20 * 1024 * 1024) {
                console.warn(`[PERF] UID: ${uid} | EXTREMT STORT MAIL (>20 MB). Klassas som poison-pill.`);

                if (inReplyTo) {
                    const { data: parentMsg, error: lookupErr } = await adminClient
                        .from("quote_messages")
                        .select("quote_request_id")
                        .eq("email_message_id", inReplyTo)
                        .limit(1)
                        .maybeSingle();

                    if (lookupErr) {
                        console.error(`[PERF] UID: ${uid} | DB Error vid In-Reply-To uppslagning: ${lookupErr.message}. Lämnar UNSEEN.`);
                        continue;
                    }
                    if (parentMsg) quoteRequestId = parentMsg.quote_request_id;
                }

                if (!quoteRequestId && senderEmail !== "unknown@customer.com") {
                    const { data: fallbackMatch, error: fallbackErr } = await adminClient
                        .from("quote_requests")
                        .select("id")
                        .eq("email", senderEmail)
                        .in("status", ["new", "contacted"])
                        .order("created_at", { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    if (fallbackErr) {
                        console.error(`[PERF] UID: ${uid} | DB Error vid email-fallback: ${fallbackErr.message}. Lämnar UNSEEN.`);
                        continue;
                    }
                    if (fallbackMatch) quoteRequestId = fallbackMatch.id;
                }

                if (!quoteRequestId) {
                    console.error(`[PERF] UID: ${uid} | >20MB-mail kunde inte matchas. Lämnar UNSEEN.`);
                    continue;
                }

                if (!dryRun) {
                    const { error: insErr } = await adminClient.from("quote_messages").insert({
                        quote_request_id: quoteRequestId,
                        sender_type: "customer",
                        sender_email: senderEmail,
                        body_text: `[SYSTEM-MEDDELANDE]\nEtt mycket stort kundsvar mottogs (${sizeKB} KB) som överskrider systemets gräns för automatisk hantering (>20 MB).\n\nVänligen kontrollera den manuella Gmail-inkorgen för att läsa meddelandet och se bilagor.`,
                        email_message_id: messageId,
                        has_attachments: true,
                        is_read: false
                    });

                    if (insErr) {
                        if (insErr.code === '23505') {
                            console.log(`[PERF] UID: ${uid} | >20MB notis redan sparad (23505). Idempotent ok.`);
                            await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
                        } else {
                            console.error(`[PERF] UID: ${uid} | Misslyckades spara >20MB notis: ${insErr.message}. Lämnar UNSEEN.`);
                        }
                    } else {
                        console.log(`[PERF] UID: ${uid} | >20MB notis sparad.`);
                        await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
                    }
                }
                console.log(`[PERF] --- END UID: ${uid} | Total tid: ${(performance.now() - t_start).toFixed(2)} ms ---`);
                continue;
            }

            // HYBRID IMAP EXTRACTOR: Inaktiverad (tröskel höjd till 20MB). Alla mail <= 20MB går till NORMAL.
            if (msgMeta.size > 20 * 1024 * 1024) {
                console.log(`[PERF] UID: ${uid} | HYBRID: Stort mail (${sizeKB} KB), extraherar via bodyStructure.`);

                // Matchning FÖRE download
                if (inReplyTo) {
                    const { data: parentMsg, error: lookupErr } = await adminClient
                        .from("quote_messages")
                        .select("quote_request_id")
                        .eq("email_message_id", inReplyTo)
                        .limit(1)
                        .maybeSingle();

                    if (lookupErr) {
                        console.error(`[PERF] UID: ${uid} | DB Error vid In-Reply-To uppslagning: ${lookupErr.message}. Lämnar UNSEEN.`);
                        continue;
                    }
                    if (parentMsg) {
                        quoteRequestId = parentMsg.quote_request_id;
                        console.log(`[PERF] UID: ${uid} | HYBRID matched by In-Reply-To | quote_request_id: ${quoteRequestId}`);
                    }
                }

                if (!quoteRequestId && senderEmail !== "unknown@customer.com") {
                    const { data: fallbackMatch, error: fallbackErr } = await adminClient
                        .from("quote_requests")
                        .select("id")
                        .eq("email", senderEmail)
                        .in("status", ["new", "contacted"])
                        .order("created_at", { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    if (fallbackErr) {
                        console.error(`[PERF] UID: ${uid} | DB Error vid email-fallback: ${fallbackErr.message}. Lämnar UNSEEN.`);
                        continue;
                    }
                    if (fallbackMatch) {
                        quoteRequestId = fallbackMatch.id;
                        console.log(`[PERF] UID: ${uid} | HYBRID matched by email fallback | quote_request_id: ${quoteRequestId}`);
                    }
                }

                if (!quoteRequestId) {
                    console.error(`[PERF] UID: ${uid} | HYBRID kunde inte matchas. Lämnar UNSEEN.`);
                    continue;
                }

                // Extrahera parts via bodyStructure
                console.log(`[RUN ${RUN_ID}] [PERF] UID: ${uid} | BEFORE extractParts`);
                const parts = extractParts(msgMeta.bodyStructure);
                console.log(`[RUN ${RUN_ID}] [PERF] UID: ${uid} | AFTER extractParts`);

                // Hjälpfunktion för att ladda ner part som Uint8Array
                const downloadPart = async (pId: string): Promise<Uint8Array | null> => {
                    try {
                        const { content } = await client.download(uid, pId, { uid: true });
                        const chunks: Uint8Array[] = [];
                        let totalLength = 0;
                        
                        await new Promise<void>((resolve, reject) => {
                            content.on('data', (chunk: any) => {
                                chunks.push(chunk as Uint8Array);
                                totalLength += (chunk as Uint8Array).length;
                            });
                            content.on('end', () => resolve());
                            content.on('error', (err: any) => reject(err));
                        });

                        const buffer = new Uint8Array(totalLength);
                        let offset = 0;
                        for (const chunk of chunks) {
                            buffer.set(chunk, offset);
                            offset += chunk.length;
                        }
                        return buffer;
                    } catch (e: any) {
                        console.error(`[RUN ${RUN_ID}] [PERF] UID: ${uid} | Fel vid download av part ${pId}: ${e.message}`);
                        return null;
                    }
                };

                if (parts.textPart) {
                    console.log(`[RUN ${RUN_ID}] [PERF] UID: ${uid} | BEFORE download text (partId: ${parts.textPart}, charset: ${parts.textCharset})`);
                    const buf = await downloadPart(parts.textPart);
                    console.log(`[RUN ${RUN_ID}] [PERF] UID: ${uid} | AFTER download text (bytes: ${buf ? buf.length : 'NULL'})`);
                    if (buf) {
                        bodyText = new TextDecoder(parts.textCharset || "utf-8").decode(buf);
                    } else {
                        bodyText = "[System: Kunde inte ladda ner textdelen. Se eventuell bilaga.]";
                    }
                } else if (parts.htmlPart) {
                    console.log(`[RUN ${RUN_ID}] [PERF] UID: ${uid} | BEFORE download html (partId: ${parts.htmlPart}, charset: ${parts.htmlCharset})`);
                    const buf = await downloadPart(parts.htmlPart);
                    console.log(`[RUN ${RUN_ID}] [PERF] UID: ${uid} | AFTER download html (bytes: ${buf ? buf.length : 'NULL'})`);
                    if (buf) {
                        bodyHtml = new TextDecoder(parts.htmlCharset || "utf-8").decode(buf);
                    }
                }

                if (!bodyText && bodyHtml) {
                    bodyText = bodyHtml.replace(/<[^>]+>/g, ' ').trim(); // Simple HTML to text
                }

                // Ladda ner bilagor
                for (const att of parts.attachments) {
                    if (!att.partId) continue;
                    console.log(`[RUN ${RUN_ID}] [PERF] UID: ${uid} | BEFORE download attachment: ${att.filename} (partId: ${att.partId})`);
                    const buf = await downloadPart(att.partId);
                    console.log(`[RUN ${RUN_ID}] [PERF] UID: ${uid} | AFTER download attachment: ${att.filename} (bytes: ${buf ? buf.length : 'NULL'})`);
                    if (!buf) {
                        throw new Error(`Kunde inte ladda ner bilaga ${att.filename}`);
                    }
                    attachmentsToUpload.push({
                        filename: att.filename,
                        contentType: att.contentType,
                        size: att.size || buf.length,
                        content: buf
                    });
                }
            }
            // NORMAL FLÖDE: <= 2 MB
            else {
                console.log(`[PERF] UID: ${uid} | Normalt mail (${sizeKB} KB), extraherar via simpleParser.`);
                console.log(`[RUN ${RUN_ID}] [PERF] UID: ${uid} | BEFORE fetchOne (source)`);
                const message = await client.fetchOne(uid, { source: true }, { uid: true });
                console.log(`[RUN ${RUN_ID}] [PERF] UID: ${uid} | AFTER fetchOne (source)`);
                if (!message || !message.source) {
                    console.log(`[PERF] UID: ${uid} | No source found, skipping.`);
                    continue;
                }
                console.log(`[RUN ${RUN_ID}] [PERF] UID: ${uid} | BEFORE simpleParser`);
                const parsedMail = await simpleParser(message.source);
                console.log(`[RUN ${RUN_ID}] [PERF] UID: ${uid} | AFTER simpleParser`);

                bodyText = parsedMail.text || "";
                bodyHtml = parsedMail.html || null;

                let pMsgId = parsedMail.messageId;
                if (Array.isArray(pMsgId)) pMsgId = pMsgId[0];
                if (pMsgId) {
                    pMsgId = String(pMsgId).trim();
                    messageId = pMsgId.startsWith('<') ? pMsgId : `<${pMsgId}>`;
                }

                let pReplyTo = parsedMail.inReplyTo;
                if (Array.isArray(pReplyTo)) pReplyTo = pReplyTo[0];
                if (pReplyTo) {
                    pReplyTo = String(pReplyTo).trim();
                    inReplyTo = pReplyTo.startsWith('<') ? pReplyTo : `<${pReplyTo}>`;
                }

                let refRaw = parsedMail.references;
                if (typeof refRaw === 'string') refRaw = refRaw.split(/\s+/).filter(Boolean);
                if (Array.isArray(refRaw)) {
                    references = refRaw.map(ref => {
                        let r = String(ref).trim();
                        return r.startsWith('<') ? r : `<${r}>`;
                    });
                }

                senderEmail = parsedMail.from?.value[0]?.address ?? envFrom;

                if (parsedMail.attachments) {
                    console.log(`[RUN ${RUN_ID}] [PERF] UID: ${uid} | BEFORE attachments loop (Count: ${parsedMail.attachments.length})`);
                    for (const att of parsedMail.attachments) {
                        if (att.content) {
                            const size = att.size || att.content.length;
                            console.log(`[RUN ${RUN_ID}] [PERF] UID: ${uid} | Processing attachment: ${att.filename} (${size} bytes, ${att.contentType})`);
                            attachmentsToUpload.push({
                                filename: att.filename || "unnamed_attachment",
                                contentType: att.contentType || 'application/octet-stream',
                                size: size,
                                content: new Uint8Array(att.content)
                            });
                        }
                    }
                    console.log(`[RUN ${RUN_ID}] [PERF] UID: ${uid} | AFTER attachments loop`);
                }
            }

            // GEMENSAM LOGIK FÖR BÅDE HYBRID OCH NORMAL (match, upload, insert)

            // --- STEG 5 & 6: Match quote_request (körs igen för normala mail, eller återanvänds om hybrid redan gjort det) ---
            if (!matchedOriginalMessageId) matchedOriginalMessageId = inReplyTo;

            if (!quoteRequestId && inReplyTo) {
                const { data: matchData, error: mErr } = await adminClient
                    .from("quote_messages")
                    .select("quote_request_id")
                    .eq("email_message_id", inReplyTo)
                    .maybeSingle();
                if (mErr) {
                    console.error(`[PERF] UID: ${uid} | DB Error vid In-Reply-To uppslagning: ${mErr.message}. Lämnar UNSEEN.`);
                    continue;
                }
                if (matchData) quoteRequestId = matchData.quote_request_id;
            }

            if (!quoteRequestId && references && Array.isArray(references)) {
                for (const ref of references) {
                    const { data: matchData } = await adminClient
                        .from("quote_messages")
                        .select("quote_request_id")
                        .eq("email_message_id", ref)
                        .maybeSingle();
                    if (matchData) {
                        quoteRequestId = matchData.quote_request_id;
                        matchedOriginalMessageId = ref;
                        break;
                    }
                }
            }

            if (!quoteRequestId && senderEmail && senderEmail !== "unknown@customer.com") {
                const { data: fallbackMatch, error: fbErr } = await adminClient
                    .from("quote_requests")
                    .select("id")
                    .eq("email", senderEmail)
                    .in("status", ["new", "contacted"])
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .maybeSingle();
                if (fbErr) {
                    console.error(`[PERF] UID: ${uid} | DB Error vid email-fallback: ${fbErr.message}. Lämnar UNSEEN.`);
                    continue;
                }
                if (fallbackMatch) quoteRequestId = fallbackMatch.id;
            }

            if (!quoteRequestId) {
                console.log(`[PERF] UID: ${uid} | Kunde inte matchas till en konversation. Lämnar UNSEEN.`);
                continue; // Lämna UNSEEN om det inte är matchat
            }

            matched++;

            // --- STEG 7: Ladda upp bilagor ---
            let uploadedAttachments: any[] = [];
            let uploadFailed = false;

            if (attachmentsToUpload.length > 0) {
                console.log(`[PERF] UID: ${uid} | Laddar upp ${attachmentsToUpload.length} bilagor.`);
                if (!dryRun) {
                    for (const att of attachmentsToUpload) {
                        try {
                            const safeFilename = (att.filename || "unnamed_attachment").replace(/[^a-zA-Z0-9.\-_]/g, '_');
                            const uniqueId = crypto.randomUUID();
                            const filePath = `customer_reply/${quoteRequestId}/${uniqueId}-${safeFilename}`;

                            const bufferSize = att.content ? att.content.length : 0;
                            console.log(`[RUN ${RUN_ID}] [PERF] UID: ${uid} | BEFORE Storage upload: ${safeFilename} (Size: ${bufferSize} bytes, Type: ${att.contentType})`);
                            
                            const { error: uploadError } = await adminClient.storage
                                .from("quote-attachments")
                                .upload(filePath, att.content, {
                                    contentType: att.contentType,
                                    upsert: false
                                });
                                
                            console.log(`[RUN ${RUN_ID}] [PERF] UID: ${uid} | AFTER Storage upload: ${safeFilename} | Success: ${!uploadError}`);

                            if (uploadError) {
                                console.error(`[PERF] UID: ${uid} | Failed to upload attachment ${safeFilename}: ${uploadError.message}`);
                                uploadFailed = true;
                                break;
                            } else {
                                uploadedAttachments.push({
                                    name: att.filename || "unnamed_attachment",
                                    size: att.size,
                                    type: att.contentType,
                                    path: filePath
                                });
                            }
                        } catch (err: any) {
                            console.error(`[PERF] UID: ${uid} | Exception while uploading attachment ${att.filename}:`, err.message);
                            uploadFailed = true;
                            break;
                        }
                    }
                }
            }

            if (uploadFailed) {
                console.error(`[PERF] UID: ${uid} | Uppladdning av bilaga misslyckades. Avbryter hela transaktionen. Lämnar UNSEEN.`);
                continue; // Lämna UNSEEN
            }

            // --- STEG 9: Spara i databas ---
            if (!dryRun) {
                console.log(`[RUN ${RUN_ID}] [PERF] UID: ${uid} | BEFORE quote_messages insert`);
                const { error: insertError } = await adminClient
                    .from("quote_messages")
                    .insert({
                        quote_request_id: quoteRequestId,
                        sender_type: "customer",
                        sender_email: senderEmail,
                        body_text: bodyText || "",
                        body_html: bodyHtml || null,
                        email_message_id: messageId,
                        in_reply_to: matchedOriginalMessageId,
                        has_attachments: uploadedAttachments.length > 0,
                        attachments: uploadedAttachments,
                        is_read: false
                    });
                console.log(`[RUN ${RUN_ID}] [PERF] UID: ${uid} | AFTER quote_messages insert`);

                if (insertError) {
                    if (insertError.code === '23505') {
                        console.log(`[PERF] UID: ${uid} | 23505 Unique Violation vid insert. Idempotent ok. Sätter \\Seen.`);
                        await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
                    } else {
                        console.error(`[PERF] UID: ${uid} | Failed to insert quote_message: ${insertError.message}. Lämnar UNSEEN.`);
                    }
                    continue;
                }

                inserted++;

                // --- STEG 10: Markera som läst efter lyckad lagring ---
                console.log(`[RUN ${RUN_ID}] [PERF] UID: ${uid} | BEFORE messageFlagsAdd (\\Seen)`);
                await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
                console.log(`[RUN ${RUN_ID}] [PERF] UID: ${uid} | AFTER messageFlagsAdd (\\Seen)`);
                console.log(`[RUN ${RUN_ID}] [PERF] UID: ${uid} | Marked as \\Seen (Success)`);
            }

            console.log(`[PERF] --- END UID: ${uid} | Total tid för mail: ${(performance.now() - t_start).toFixed(2)} ms ---`);

        } catch (metaErr: any) {
            console.error(`[PERF] UID: ${uid} | Oväntat fel i loop: ${metaErr.message}. Lämnar som UNSEEN (fail-safe).`);
            continue;
        }
      }
      console.log(`[PERF] END RUN: ${processed} processed, ${matched} matched, ${inserted} inserted.`);
    } finally {
      lock.release();
    }
  } catch (error: any) {
    console.error("IMAP Error:", error.message);
    return new Response(JSON.stringify({ error: "Ett fel uppstod vid hämtning av e-post." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } finally {
    console.log(`[RUN ${RUN_ID}] [PERF] Entering global finally cleanup block.`);
    console.log(`[RUN ${RUN_ID}] [PERF] Forcing client.close() for instant termination`);
    try { client.close(); } catch (e) {}
    console.log(`[RUN ${RUN_ID}] [PERF] TIMING AFTER client.close: ${Date.now() - perfStartTime}ms`);
  }

  console.log(`[RUN ${RUN_ID}] [PERF] TIMING BEFORE RESPONSE: ${Date.now() - perfStartTime}ms`);
  return new Response(JSON.stringify({
    success: true,
    processed,
    matched,
    inserted,
    dry_run: dryRun
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
