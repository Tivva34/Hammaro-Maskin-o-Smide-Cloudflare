/**
 * pushNotificationService.js
 *
 * Hanterar prenumeration och avprenumeration på Web Push-notifikationer
 * för adminpanelen. Lagrar subscriptions i Supabase push_subscriptions-tabellen.
 *
 * Säkerhet:
 * - VAPID public key hämtas från import.meta.env.VITE_VAPID_PUBLIC_KEY
 * - VAPID private key finns ALDRIG i frontend – enbart i Supabase Vault
 * - user_id bestäms aldrig av frontend (sätts via RLS: auth.uid() = user_id)
 */

import { supabase } from './supabase.js';

// ---------------------------------------------------------------------------
// Hjälpfunktion: konvertera VAPID public key (Base64URL) → Uint8Array
// Krävs av PushManager.subscribe({ applicationServerKey })
// ---------------------------------------------------------------------------
function urlBase64ToUint8Array(base64String) {
  if (!base64String) throw new Error('VAPID public key saknas i konfigurationen.');
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// ---------------------------------------------------------------------------
// Kolla om Web Push stöds i nuvarande browser/kontext
// ---------------------------------------------------------------------------
export function isPushSupported() {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

// ---------------------------------------------------------------------------
// Hämta aktuell PushSubscription för den här enheten (om den finns)
// Returnerar null om ej prenumererad.
// ---------------------------------------------------------------------------
export async function getPushSubscription(customRegistration = null) {
  if (!isPushSupported()) return null;
  try {
    const registration = customRegistration || await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Kolla om denna enhet är prenumererad och om subscription finns i DB
// Returnerar: 'unsupported' | 'denied' | 'active' | 'inactive'
// ---------------------------------------------------------------------------
export async function getPushSubscriptionStatus(userId) {
  if (!isPushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';

  const sub = await getPushSubscription();
  if (!sub) return 'inactive';

  // Dubbelkolla att den faktiskt finns i Supabase
  const { data } = await supabase
    .from('push_subscriptions')
    .select('id')
    .eq('user_id', userId)
    .eq('endpoint', sub.endpoint)
    .maybeSingle();

  return data ? 'active' : 'inactive';
}

// ---------------------------------------------------------------------------
// Prenumerera denna enhet på Web Push
// Sparar subscription i Supabase push_subscriptions (RLS: user_id = auth.uid())
//
// Returnerar: { success: true } | { success: false, error: string, code: string }
// Möjliga felkoder:
//   'unsupported'       – browsern stöder inte push
//   'permission_denied' – användaren nekade permission
//   'permission_error'  – något gick fel vid requestPermission
//   'sw_not_ready'      – service worker inte tillgänglig
//   'subscribe_error'   – PushManager.subscribe() misslyckades
//   'vapid_missing'     – VAPID public key saknas
//   'db_error'          – Supabase upsert misslyckades
// ---------------------------------------------------------------------------
export async function subscribeToPush(customRegistration = null) {
  if (!isPushSupported()) {
    return {
      success: false,
      error: 'Din webbläsare stöder inte push-notifikationer.',
      code: 'unsupported',
    };
  }

  // 1. Fråga om permission (visar native dialog om 'default')
  let permission;
  try {
    permission = await Notification.requestPermission();
  } catch (e) {
    return {
      success: false,
      error: 'Kunde inte begära notifikationstillstånd.',
      code: 'permission_error',
    };
  }

  if (permission !== 'granted') {
    return {
      success: false,
      error:
        'Du har inte gett tillstånd för push-notifikationer. Ändra inställningen i webbläsarens platsikon.',
      code: 'permission_denied',
    };
  }

  // 2. Vänta på att service worker är redo (om inte custom skickats in)
  let registration = customRegistration;
  if (!registration) {
    try {
      registration = await navigator.serviceWorker.ready;
    } catch (e) {
      return {
        success: false,
        error: 'Service worker är inte tillgänglig.',
        code: 'sw_not_ready',
      };
    }
  }

  // 3. Hämta VAPID public key
  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    return {
      success: false,
      error: 'Push-konfiguration saknas. Kontakta systemadministratören.',
      code: 'vapid_missing',
    };
  }

  // 4. Skapa PushSubscription
  let subscription;
  try {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  } catch (e) {
    console.error('[pushService] subscribe error:', e);
    // Vanligt fel: endpoint blockeras av browser
    return {
      success: false,
      error: 'Kunde inte skapa push-prenumeration. Försök igen eller kontrollera webbläsarinställningarna.',
      code: 'subscribe_error',
    };
  }

  // 5. Extrahera nycklar ur subscription-objektet
  const subscriptionJson = subscription.toJSON();
  const endpoint = subscriptionJson.endpoint;
  const p256dh   = subscriptionJson.keys?.p256dh;
  const auth     = subscriptionJson.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    return {
      success: false,
      error: 'Ofullständig push-prenumeration. Försök igen.',
      code: 'subscribe_error',
    };
  }

  // 5b. Hämta aktuell användare
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    return {
      success: false,
      error: 'Du måste vara inloggad för att prenumerera.',
      code: 'unauthorized',
    };
  }
  const userId = session.user.id;

  // 6. Spara i Supabase (RLS säkerställer att user_id = auth.uid())
  const { error: dbError } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        user_id: userId,
        endpoint,
        p256dh,
        auth,
        user_agent: navigator.userAgent.slice(0, 255), // begränsa längd
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,endpoint',
        ignoreDuplicates: false,
      }
    );

  if (dbError) {
    console.error('[pushService] DB upsert error:', dbError);
    // Avprenumerera om DB-sparning misslyckades (undvik ghost subscription)
    try { await subscription.unsubscribe(); } catch { /* ignore */ }
    return {
      success: false,
      error: (dbError.code ? dbError.code + ': ' : '') + (dbError.message || 'Okänt fel') + (dbError.details ? ' — ' + dbError.details : ''),
      code: 'db_error',
    };
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// Avprenumerera DENNA enhet (multi-device: påverkar bara aktuell enhet)
// ---------------------------------------------------------------------------
export async function unsubscribeCurrentDevice() {
  const sub = await getPushSubscription();
  if (!sub) return { success: true }; // Redan avprenumererad

  const endpoint = sub.endpoint;

  // 1. Avprenumerera i browsern
  try {
    await sub.unsubscribe();
  } catch (e) {
    console.error('[pushService] unsubscribe error:', e);
    // Fortsätt ändå och ta bort ur DB
  }

  // 2. Ta bort från Supabase
  const { error: dbError } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint);

  if (dbError) {
    console.error('[pushService] DB delete error:', dbError);
    return {
      success: false,
      error: 'Avprenumerationen sparades lokalt men kunde inte tas bort från servern.',
      code: 'db_error',
    };
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// Skicka testnotifikation till aktuell användare/enhet via Edge Function
// ---------------------------------------------------------------------------
export async function sendTestNotification() {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return { success: false, error: 'Inte inloggad.', code: 'unauthorized' };
  }

  const supabaseUrl    = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  try {
    const res = await fetch(
      `${supabaseUrl}/functions/v1/send-push-notification?test=true`,
      {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey':        supabaseAnonKey,
        },
        body: JSON.stringify({ event: 'test' }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      return {
        success: false,
        error: data.error || 'Testnotifikation misslyckades.',
        code: 'edge_function_error',
      };
    }

    if (data.sent === 0) {
      return {
        success: false,
        error: 'Inga aktiva prenumerationer hittades för ditt konto.',
        code: 'no_subscriptions',
      };
    }

    return { success: true, sent: data.sent };
  } catch (e) {
    console.error('[pushService] sendTestNotification error:', e);
    return {
      success: false,
      error: 'Nätverksfel vid skickande av testnotifikation.',
      code: 'network_error',
    };
  }
}
