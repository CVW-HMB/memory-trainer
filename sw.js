// La Cave - service worker. Precaches the app shell and the deck so a flight
// runs with no network at all.
//
// Bump CACHE when the shell changes. Stale-while-revalidate means a stale
// version self-heals on the next load even if this is forgotten, but bumping
// makes the update immediate.
const CACHE = "lacave-v20";

// Relative URLs resolve against this script's location, so the app still works
// when served from a subpath such as /memory-trainer/.
const SHELL = [
  "./",
  "./index.html",
  "./src/app.js",
  "./src/engine/schedule.js",
  "./src/decks/registry.js",
  "./src/decks/specs.js",
  "./src/decks/wine.js",
  "./src/decks/vocab.js",
  "./src/styles.css",
  "./data/decks.json",
  "./data/cards.json",
  "./data/spanish.json",
  "./data/french.json",
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
    // `cache: "reload"` bypasses the browser's own HTTP cache. Without it,
    // cache.add() can happily precache a copy that is still inside GitHub
    // Pages' max-age, so a freshly deployed worker installs stale files and the
    // app keeps showing the previous version. Individually, so one bad entry
    // cannot fail the whole install.
    await Promise.all(SHELL.map(async (u) => {
      try {
        const res = await fetch(new Request(u, { cache: "reload" }));
        if (res && res.ok) await cache.put(u, res);
        else console.warn("[sw] skip", u, res && res.status);
      } catch (err) { console.warn("[sw] skip", u, err); }
    }));
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
  // Revalidate against the server rather than the HTTP cache, for the same
  // reason as the install above.
  const fetching = fetch(new Request(req, { cache: "no-cache" }))
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

  // Deck data is network-first: a stale deck is the one staleness a user
  // actually notices ("it still says 200 cards"). Falls back to cache when
  // offline, so airplane mode is unaffected.
  if (url.origin === self.location.origin && /\/data\/[^/]+\.json$/.test(url.pathname)) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await fetch(new Request(req, { cache: "no-cache" }));
        if (res && res.ok) { cache.put(req, res.clone()); return res; }
      } catch (err) {}
      return (await cache.match(req)) || new Response("[]", { headers: { "Content-Type": "application/json" } });
    })());
    return;
  }

  if (url.origin === self.location.origin) e.respondWith(staleWhileRevalidate(req));
});
