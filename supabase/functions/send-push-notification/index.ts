import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// ---------------------------------------------------------------------------
// Web Push / VAPID implementation using the Web Crypto API (Deno built-in).
// We avoid external npm dependencies for maximum compatibility with Supabase.
// ---------------------------------------------------------------------------

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-push-trigger-secret",
};

// ---------------------------------------------------------------------------
// Notification preference mapping: request_type → preference column name
// ---------------------------------------------------------------------------
const PREFERENCE_MAP: Record<string, string> = {
  machine_inquiry:   "machine_inquiries",
  machine:           "machine_inquiries",
  buy_machine:       "machine_inquiries",
  sell_machine:      "machine_inquiries",
  inventory_inquiry: "inventory_inquiries",
  inventory:         "inventory_inquiries",
  requested:         "inventory_inquiries",
  workshop:          "workshop_inquiries",
  metalwork:         "workshop_inquiries",
  custom:            "workshop_inquiries",
  repair:            "workshop_inquiries",
  boat_trailer:      "workshop_inquiries",
  special_trailer:   "workshop_inquiries",
  transport:         "transport_inquiries",
  general:           "general_inquiries",
  contact:           "general_inquiries",
  other:             "general_inquiries",
  customer_reply:    "customer_replies",
};

// ---------------------------------------------------------------------------
// VAPID / Web Push helpers
// ---------------------------------------------------------------------------

function base64UrlDecode(str: string): Uint8Array {
  // Normalize padding
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4;
  const padded2 = pad ? padded + "=".repeat(4 - pad) : padded;
  const binary = atob(padded2);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function importVapidPrivateKey(privateKeyB64: string, publicKeyB64: string): Promise<CryptoKey> {
  const pubBytes = base64UrlDecode(publicKeyB64);
  if (pubBytes.length !== 65 || pubBytes[0] !== 0x04) {
    throw new Error("Invalid VAPID public key format. Expected 65-byte uncompressed point.");
  }

  const xBytes = new Uint8Array(pubBytes.slice(1, 33));
  const yBytes = new Uint8Array(pubBytes.slice(33, 65));
  const dBytes = new Uint8Array(base64UrlDecode(privateKeyB64).slice(0, 32));

  const jwk = {
    kty: "EC",
    crv: "P-256",
    ext: true,
    key_ops: ["sign"],
    x: base64UrlEncode(xBytes.buffer),
    y: base64UrlEncode(yBytes.buffer),
    d: base64UrlEncode(dBytes.buffer),
  };

  return await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
}

async function importVapidPublicKey(publicKeyB64: string): Promise<CryptoKey> {
  const keyBytes = base64UrlDecode(publicKeyB64);
  return await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    []
  );
}

/** Build a VAPID JWT for the given audience (push service origin) */
async function buildVapidJwt(
  audience: string,
  vapidPublicKeyB64: string,
  vapidPrivateKey: CryptoKey,
  subject: string
): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 3600,
    sub: subject,
  };

  const headerB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    vapidPrivateKey,
    new TextEncoder().encode(signingInput)
  );

  return `${signingInput}.${base64UrlEncode(signature)}`;
}

interface PushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Encrypt the push message payload using RFC 8291 (aes128gcm) */
async function encryptPushPayload(
  subscription: PushSubscription,
  payloadStr: string
): Promise<{ body: Uint8Array; salt: Uint8Array; serverPublicKey: CryptoKey }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );

  const clientPublicKey = await importVapidPublicKey(subscription.p256dh);
  const authSecret = base64UrlDecode(subscription.auth);

  const sharedSecret = await crypto.subtle.deriveBits(
    { name: "ECDH", public: clientPublicKey },
    serverKeyPair.privateKey,
    256
  );

  const serverPublicKeyRaw = await crypto.subtle.exportKey("raw", serverKeyPair.publicKey);
  const clientPublicKeyRaw = await crypto.subtle.exportKey("raw", clientPublicKey);

  // HKDF for auth
  const prk = await crypto.subtle.importKey("raw", new Uint8Array(sharedSecret), "HKDF", false, ["deriveBits"]);

  const authInfoBuf = new TextEncoder().encode("WebPush: info\0");
  const authInfo = new Uint8Array(authInfoBuf.length + clientPublicKeyRaw.byteLength + serverPublicKeyRaw.byteLength);
  authInfo.set(authInfoBuf);
  authInfo.set(new Uint8Array(clientPublicKeyRaw), authInfoBuf.length);
  authInfo.set(new Uint8Array(serverPublicKeyRaw), authInfoBuf.length + clientPublicKeyRaw.byteLength);

  const ikm = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: authSecret, info: authInfo },
    prk,
    256
  );

  // HKDF for content encryption key and nonce
  const ikmKey = await crypto.subtle.importKey("raw", new Uint8Array(ikm), "HKDF", false, ["deriveBits"]);

  const keyInfoBuf = new TextEncoder().encode("Content-Encoding: aes128gcm\0");
  const contentEncKey = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info: keyInfoBuf },
    ikmKey,
    128
  );

  const nonceInfoBuf = new TextEncoder().encode("Content-Encoding: nonce\0");
  const nonce = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info: nonceInfoBuf },
    ikmKey,
    96
  );

  const aesKey = await crypto.subtle.importKey(
    "raw", new Uint8Array(contentEncKey), { name: "AES-GCM" }, false, ["encrypt"]
  );

  const payloadBytes = new TextEncoder().encode(payloadStr);
  // Add padding delimiter byte (0x02 = padding followed by content)
  const plaintext = new Uint8Array(payloadBytes.length + 1);
  plaintext.set(payloadBytes, 0); // Data first
  plaintext[payloadBytes.length] = 2; // record delimiter

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: new Uint8Array(nonce), tagLength: 128 },
    aesKey,
    plaintext
  );

  // Build RFC 8291 encrypted body:
  // salt (16) + rs (4 = 0x00001001 = 4097) + idlen (1) + server pub key (65) + ciphertext
  const serverPublicKeyBytes = new Uint8Array(serverPublicKeyRaw);
  const rs = new Uint8Array([0x00, 0x00, 0x10, 0x01]); // record size 4097
  const idLen = new Uint8Array([serverPublicKeyBytes.length]);
  const body = new Uint8Array(
    16 + 4 + 1 + serverPublicKeyBytes.length + ciphertext.byteLength
  );
  let offset = 0;
  body.set(salt, offset); offset += 16;
  body.set(rs, offset); offset += 4;
  body.set(idLen, offset); offset += 1;
  body.set(serverPublicKeyBytes, offset); offset += serverPublicKeyBytes.length;
  body.set(new Uint8Array(ciphertext), offset);

  return { body, salt, serverPublicKey: serverKeyPair.publicKey };
}

/** Send a single Web Push message using VAPID */
async function sendWebPush(
  subscription: PushSubscription,
  payloadJson: Record<string, unknown>,
  vapidPublicKeyB64: string,
  vapidPrivateKey: CryptoKey,
  vapidSubject: string
): Promise<{ ok: boolean; status: number; permanent: boolean }> {
  const endpoint = subscription.endpoint;
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;

  let vapidJwt: string;
  try {
    vapidJwt = await buildVapidJwt(audience, vapidPublicKeyB64, vapidPrivateKey, vapidSubject);
  } catch (e) {
    console.error("[send-push] JWT build failed:", (e as Error).message);
    return { ok: false, status: 0, permanent: false, errorText: "JWT build failed: " + (e as Error).message };
  }

  let encryptedBody: Uint8Array;
  try {
    const { body } = await encryptPushPayload(subscription, JSON.stringify(payloadJson));
    encryptedBody = body;
  } catch (e) {
    console.error("[send-push] Encryption failed:", (e as Error).message);
    return { ok: false, status: 0, permanent: false, errorText: "Encryption failed: " + (e as Error).message };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/octet-stream",
    "Content-Encoding": "aes128gcm",
    "TTL": "86400",
    "Authorization": `vapid t=${vapidJwt},k=${vapidPublicKeyB64}`,
    "Urgency": "high",
  };

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: encryptedBody,
    });
    const permanent = res.status === 410 || res.status === 404;
    let errText = "";
    if (!res.ok) {
      errText = await res.text();
      console.log(`[send-push] Push failed: HTTP ${res.status} - ${errText}`);
    }
    return { ok: res.ok, status: res.status, permanent, errorText: errText };
  } catch (e) {
    console.error("[send-push] Network error:", (e as Error).message);
    return { ok: false, status: 0, permanent: false, errorText: (e as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Notification text builders
// ---------------------------------------------------------------------------
function buildNotificationPayload(
  event: string,
  requestType: string,
  customerName: string,
  quoteRequestId: string,
  basePath: string
): Record<string, unknown> {
  const BASE_URL = basePath.endsWith("/") ? basePath : basePath + "/";
  const quoteUrl = `${BASE_URL}admin.html#/admin?tab=quotes&quote=${quoteRequestId}`;

  if (event === "customer_reply") {
    return {
      type: "customer_reply",
      title: "Nytt kundsvar",
      body: customerName ? `${customerName} har svarat på en förfrågan` : "En kund har svarat på en förfrågan",
      url: quoteUrl,
      quote_request_id: quoteRequestId,
      tag: `quote-reply-${quoteRequestId}`,
      icon: `${BASE_URL}pwa-192x192.png`,
      badge: `${BASE_URL}pwa-192x192.png`,
    };
  }

  // new_quote_request – customize title by type
  const titleMap: Record<string, string> = {
    machine_inquiry:   "Ny maskinförfrågan",
    buy_machine:       "Ny köpförfrågan",
    sell_machine:      "Ny säljförfrågan",
    inventory_inquiry: "Ny lösöresförfrågan",
    workshop:          "Ny verkstadsförfrågan",
    transport:         "Ny transportförfrågan",
    general:           "Ny kundförfrågan",
    contact:           "Nytt kontaktmeddelande",
  };

  const title = titleMap[requestType] ?? "Ny förfrågan";
  const body  = customerName
    ? `${customerName} har skickat en förfrågan`
    : "En kund har skickat en förfrågan";

  return {
    type: "new_quote_request",
    title,
    body,
    url: `/Hammar-Maskin-Smide/admin.html#/admin?tab=quotes&quote=${quoteRequestId}`,
    quote_request_id: quoteRequestId,
    tag: `quote-new-${quoteRequestId}`,
  };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // ── 1. Verify trigger secret ──────────────────────────────────────────────
  const triggerSecret = Deno.env.get("PUSH_TRIGGER_SECRET") ?? Deno.env.get("push_trigger_secret");
  const requestSecret = req.headers.get("x-push-trigger-secret");

  // Also allow user JWT for test-notification endpoint
  const authHeader = req.headers.get("Authorization");
  const isUserJwt  = authHeader?.startsWith("Bearer ");
  const isTestRequest = req.url.includes("test=true");

  if (isTestRequest) {
    if (!isUserJwt) {
      console.error("[send-push] Unauthorized test attempt (missing JWT)");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }
  } else {
    if (!triggerSecret || requestSecret !== triggerSecret) {
      console.error("[send-push] Unauthorized trigger attempt (invalid secret)");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }
  }

  // ── 2. Parse body ─────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }

  const event            = body.event as string;
  const quoteRequestId   = body.quote_request_id as string;
  const requestType      = (body.request_type as string) ?? "";
  const customerName     = (body.customer_name as string) ?? (body.sender_email as string) ?? "";

  // ── 3. Load VAPID keys ────────────────────────────────────────────────────
  const vapidPublicKeyB64  = Deno.env.get("VAPID_PUBLIC_KEY") ?? Deno.env.get("vapid_public_key") ?? "";
  const vapidPrivateKeyB64 = Deno.env.get("VAPID_PRIVATE_KEY") ?? Deno.env.get("vapid_private_key") ?? "";
  const vapidSubject       = Deno.env.get("VAPID_SUBJECT") ?? Deno.env.get("vapid_subject") ?? "mailto:info@hammaromaskin.se";
  const basePath           = Deno.env.get("BASE_PATH") ?? "/Hammar-Maskin-Smide";

  if (!vapidPublicKeyB64 || !vapidPrivateKeyB64) {
    console.error("[send-push] VAPID keys not configured");
    return new Response(JSON.stringify({ error: "VAPID keys not configured" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }

  let vapidPrivateKey: CryptoKey;
  try {
    vapidPrivateKey = await importVapidPrivateKey(vapidPrivateKeyB64, vapidPublicKeyB64);
  } catch (e) {
    console.error("[send-push] Failed to import VAPID private key:", (e as Error).message);
    return new Response(JSON.stringify({ error: "VAPID key import failed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }

  // ── 4. Init Supabase admin client ─────────────────────────────────────────
  const supabaseUrl        = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey     = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabaseAdmin      = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── 5. TEST notification (only for authenticated users, current device) ───
  if (isTestRequest && isUserJwt) {
    const token = authHeader!.replace(/^Bearer\s+/i, "");
    const { data: { user }, error: userError } = await createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader! } } }
    ).auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    // Get subscriptions for this user only
    const { data: subs, error: dbError } = await supabaseAdmin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", user.id);

    if (dbError) {
      console.error("[send-push] DB Error in test request:", dbError);
      return new Response(JSON.stringify({ error: `DIAGNOSTIC - DB Error: ${dbError.code} - ${dbError.message} - ${dbError.details}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ error: "DIAGNOSTIC - subscriptions_found: 0, push_attempted: 0 (Kunde inte hitta prenumeration för detta user_id i databasen!)" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const testPayload = {
      type: "test",
      title: "Testnotifikation ✓",
      body: "Push-notifikationer fungerar! Du är nu konfigurerad.",
      url: `${basePath.endsWith("/") ? basePath : basePath + "/"}admin.html#/admin`,
      tag: `test-${Date.now()}`,
      icon: `${basePath.endsWith("/") ? basePath : basePath + "/"}pwa-192x192.png`,
      badge: `${basePath.endsWith("/") ? basePath : basePath + "/"}pwa-192x192.png`,
    };

    let sent = 0;
    const expiredEndpoints: string[] = [];
    const pushErrors: string[] = [];
    let pushAttempted = 0;

    for (const sub of subs) {
      pushAttempted++;
      const result = await sendWebPush(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        testPayload,
        vapidPublicKeyB64,
        vapidPrivateKey,
        vapidSubject
      );
      if (result.ok) {
        sent++;
        // Update last_used_at
        await supabaseAdmin
          .from("push_subscriptions")
          .update({ last_used_at: new Date().toISOString() })
          .eq("endpoint", sub.endpoint);
      } else {
        pushErrors.push(`[Status: ${result.status}, Error: ${result.errorText}]`);
        if (result.permanent) {
          expiredEndpoints.push(sub.endpoint);
        }
      }
    }

    // Remove expired subscriptions
    if (expiredEndpoints.length > 0) {
      await supabaseAdmin
        .from("push_subscriptions")
        .delete()
        .in("endpoint", expiredEndpoints);
      console.log(`[send-push] Removed ${expiredEndpoints.length} expired test subscriptions`);
    }

    if (pushErrors.length > 0) {
      return new Response(JSON.stringify({ error: `DIAGNOSTIC - subscriptions_found: ${subs.length}, push_attempted: ${pushAttempted}, push_succeeded: ${sent}, push_failed: ${pushErrors.length} | Provider Error(s): ${pushErrors.join(" | ")}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    return new Response(JSON.stringify({ sent, removed: expiredEndpoints.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }

  // ── 6. Determine preference column ───────────────────────────────────────
  let preferenceColumn: string;
  if (event === "customer_reply") {
    preferenceColumn = "customer_replies";
  } else {
    preferenceColumn = PREFERENCE_MAP[requestType];
    if (!preferenceColumn) {
      console.log(`[send-push] Unknown request_type '${requestType}', skipping.`);
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
  }

  // ── 7. Find users with this preference enabled ────────────────────────────
  const { data: prefs, error: prefsError } = await supabaseAdmin
    .from("user_notification_preferences")
    .select(`user_id, ${preferenceColumn}`)
    .eq(preferenceColumn, true);

  if (prefsError) {
    console.error("[send-push] Error fetching preferences:", prefsError.message);
    return new Response(JSON.stringify({ error: "DB error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }

  if (!prefs || prefs.length === 0) {
    console.log(`[send-push] No users with ${preferenceColumn}=true`);
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }

  const userIds = prefs.map((p: Record<string, unknown>) => p.user_id as string);

  // ── 8. Fetch push subscriptions for those users ───────────────────────────
  const { data: subscriptions, error: subsError } = await supabaseAdmin
    .from("push_subscriptions")
    .select("user_id, endpoint, p256dh, auth")
    .in("user_id", userIds);

  if (subsError) {
    console.error("[send-push] Error fetching subscriptions:", subsError.message);
    return new Response(JSON.stringify({ error: "DB error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }

  if (!subscriptions || subscriptions.length === 0) {
    console.log("[send-push] No push subscriptions found for eligible users");
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }

  // ── 9. Build notification payload ─────────────────────────────────────────
  const notificationPayload = buildNotificationPayload(
    event,
    requestType,
    customerName,
    quoteRequestId,
    basePath
  );

  // ── 10. Send push to each subscription ────────────────────────────────────
  let sent = 0;
  let failed = 0;
  const expiredEndpoints: string[] = [];

  for (const sub of subscriptions) {
    const result = await sendWebPush(
      { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
      notificationPayload,
      vapidPublicKeyB64,
      vapidPrivateKey,
      vapidSubject
    );

    if (result.ok) {
      sent++;
      // Update last_used_at (non-fatal if it fails)
      supabaseAdmin
        .from("push_subscriptions")
        .update({ last_used_at: new Date().toISOString() })
        .eq("endpoint", sub.endpoint)
        .then(({ error }) => {
          if (error) console.log("[send-push] last_used_at update failed:", error.message);
        });
    } else if (result.permanent) {
      expiredEndpoints.push(sub.endpoint);
      failed++;
    } else {
      failed++;
    }
  }

  // ── 11. Remove permanently invalid subscriptions ──────────────────────────
  if (expiredEndpoints.length > 0) {
    const { error: deleteError } = await supabaseAdmin
      .from("push_subscriptions")
      .delete()
      .in("endpoint", expiredEndpoints);
    if (deleteError) {
      console.error("[send-push] Failed to delete expired subscriptions:", deleteError.message);
    } else {
      console.log(`[send-push] Removed ${expiredEndpoints.length} expired subscriptions`);
    }
  }

  // ── 12. Mark queue item as processed ─────────────────────────────────────
  if (quoteRequestId && event) {
    const queueEventType = event === "customer_reply" ? "customer_reply" : "new_quote_request";
    await supabaseAdmin
      .from("push_notification_queue")
      .update({ processed_at: new Date().toISOString(), attempts: 1 })
      .eq("event_type", queueEventType)
      .is("processed_at", null)
      .order("created_at", { ascending: false })
      .limit(1);
  }

  console.log(`[send-push] Done: sent=${sent} failed=${failed} expired=${expiredEndpoints.length}`);

  return new Response(JSON.stringify({ sent, failed, expired: expiredEndpoints.length }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
});
