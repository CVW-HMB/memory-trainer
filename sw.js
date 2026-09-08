// La Cave - service worker. Precaches the app shell and the deck so a flight
// runs with no network at all.
//
// Bump CACHE when the shell changes. Every same-origin request is network-first
// with the cache as an offline fallback, so a deploy is picked up on the next
// load whether or not this is bumped; bumping evicts the old cache.
const CACHE = "lacave-v25";

// Relative URLs resolve against this script's location, so the app still works
// when served from a subpath such as /memory-trainer/.
const SHELL = [
  "./",
  "./index.html",
  "./src/app.js",
  "./src/engine/schedule.js",
  "./src/decks/registry.js",
  "./src/decks/schema.js",
  "./src/decks/authoring.js",
  "./src/decks/specs.js",
  "./src/decks/wine.js",
  "./src/decks/vocab.js",
  "./src/decks/glossary.js",
  "./src/decks/botany.js",
  "./src/decks/figures.js",
  "./src/styles.css",
  "./data/decks.json",
  "./data/decks/wine.json",
  "./data/decks/spanish.json",
  "./data/decks/french.json",
  "./data/decks/payments.json",
  "./data/decks/botany.json",
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

// Network first, cache as the offline fallback.
//
// This used to be stale-while-revalidate for code and network-first for deck
// data, and that split was a bug: on the first load after a deploy the browser
// got the NEW deck JSON against the OLD renderer. A deck that had gained a card
// type rendered "No renderer for type ..." on every card of it, and a deck that
// had asked for a shorter flight got the old length. Code and data ship
// together, so they have to refresh together -- the app is a handful of small
// files behind a CDN, and it already blocks on a network-first fetch of a deck
// file far larger than all of them.
//
// `cache: "no-cache"` revalidates against the server rather than the browser's
// HTTP cache, for the same reason as the install above: GitHub Pages' max-age
// would otherwise hand back a copy of the file we just replaced.
async function networkFirst(req, fallback) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(new Request(req, { cache: "no-cache" }));
    if (res && res.ok) { cache.put(req, res.clone()); return res; }
  } catch (err) { /* offline: fall through to the cache */ }
  return (await cache.match(req)) || fallback ||
    new Response("", { status: 504, statusText: "offline" });
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

  // Deck data: an empty deck reads better than a broken one if we are offline
  // and have never cached this file.
  if (url.origin === self.location.origin && /\/data\/[^/]+\.json$/.test(url.pathname)) {
    e.respondWith(networkFirst(req,
      new Response("[]", { headers: { "Content-Type": "application/json" } })));
    return;
  }

  // Everything else the app is made of, on the same terms.
  if (url.origin === self.location.origin) e.respondWith(networkFirst(req));
});
