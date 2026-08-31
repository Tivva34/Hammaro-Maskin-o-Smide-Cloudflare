// =============================================================================
// sw.js – Custom Service Worker för Hammarö Maskin & Smide
// Hanteras av VitePWA med strategies: 'injectManifest'.
// Workbox injicerar precache-manifest via self.__WB_MANIFEST nedan.
// =============================================================================

import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { clientsClaim } from "workbox-core";

// Workbox injicerar precache-listan här vid build
// eslint-disable-next-line no-undef
precacheAndRoute(self.__WB_MANIFEST || []);
cleanupOutdatedCaches();

// Ta över gamla service workers direkt (matchar vite.config workbox.clientsClaim + skipWaiting)
self.skipWaiting();
clientsClaim();

// =============================================================================
// PUSH – ta emot Web Push-notifikationer
// Körs även när appen är stängd. Ingen fetch eller React-kontext behövs.
// =============================================================================
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    console.error("[sw] push: failed to parse payload");
    return;
  }

  const title = data.title || "Hammarö Maskin & Smide";
  const options = {
    body:              data.body || "",
    icon:              data.icon || "/pwa-192x192.png",
    badge:             data.badge || "/pwa-192x192.png",
    tag:               data.tag  || "hms-push",
    data:              { url: data.url || "/admin.html#/admin" },
    requireInteraction: false,
    silent:            false,
    vibrate:           [200, 100, 200],
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// =============================================================================
// NOTIFICATION CLICK – öppna/fokusera adminpanelen på rätt förfrågan
// =============================================================================
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url
    || "/admin.html#/admin";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Kolla om adminpanelen redan är öppen
        for (const client of clientList) {
          if (
            client.url.includes("admin") &&
            "focus" in client &&
            "navigate" in client
          ) {
            // Fokusera befintlig klient utan att navigera/ladda om
            return client.focus();
          }
        }
        // Öppna nytt fönster med adminpanelen
        return self.clients.openWindow(targetUrl);
      })
  );
});
