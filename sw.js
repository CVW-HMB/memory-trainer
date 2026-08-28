// La Cave - service worker. Precaches the app shell and the deck so a flight
// runs with no network at all.
//
// Bump CACHE when the shell changes. Stale-while-revalidate means a stale
// version self-heals on the next load even if this is forgotten, but bumping
// makes the update immediate.
const CACHE = "lacave-v8";

// Relative URLs resolve against this script's location, so the app still works
// when served from a subpath such as /memory-trainer/.
const SHELL = [
  "./",
  "./index.html",
  "./src/app.js",
  "./src/engine/schedule.js",
  "./src/styles.css",
  "./data/cards.json",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png",
];

const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Individually, so one bad entry cannot fail the whole install.
    await Promise.all(SHELL.map(u => cache.add(u).catch(err => console.warn("[sw] skip", u, err))));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  const fetching = fetch(req)
    .then(res => { if (res && res.ok) cache.put(req, res.clone()); return res; })
    .catch(() => null);
  return hit || (await fetching) || new Response("", { status: 504, statusText: "offline" });
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Navigations: network first so a deploy is picked up, cached shell offline.
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put("./index.html", res.clone());
        return res;
      } catch {
        const cache = await caches.open(CACHE);
        return (await cache.match("./index.html")) || (await cache.match("./")) ||
               new Response("Offline", { status: 503 });
      }
    })());
    return;
  }

  // Google Fonts: cache-first. They never change under a given URL, and this is
  // what makes the typography survive airplane mode.
  if (FONT_HOSTS.includes(url.hostname)) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        // Opaque (no-cors) font responses are still usable from cache.
        if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
        return res;
      } catch {
        return new Response("", { status: 504 });
      }
    })());
    return;
  }

  if (url.origin === self.location.origin) e.respondWith(staleWhileRevalidate(req));
});
