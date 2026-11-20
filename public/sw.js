// DormSphere service worker — makes the site installable and keeps the app
// shell (page, scripts, styles, images) loading instantly, even on a weak
// connection. Anything that talks to Supabase (auth, database, storage,
// edge functions) always goes to the network and is never cached, so
// bookings, statuses and curfew scans are always live.
const CACHE = "dormsphere-shell-v2";
const SHELL = ["./", "manifest.webmanifest", "logo.png", "icon-192.png", "icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Only handle our own origin; Supabase / Google Fonts etc. pass straight through.
  if (url.origin !== self.location.origin) return;

  // Page loads: network first (always the latest deploy), fall back to the
  // cached shell when offline so the installed app still opens.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("./", copy));
          return res;
        })
        .catch(() => caches.match("./"))
    );
    return;
  }

  // Static files: cache first, refresh in the background.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

// Tapping a DormSphere notification brings the app to the front (or opens
// it if it was closed) instead of doing nothing.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => "focus" in c);
      if (open) return open.focus();
      return self.clients.openWindow ? self.clients.openWindow("./") : undefined;
    })
  );
});
