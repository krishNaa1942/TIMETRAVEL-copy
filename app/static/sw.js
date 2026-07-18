// ──────────────────────────────────────────────────────────
// Time Travel — Service Worker (PWA Offline Support)
// Caches critical assets so users can access their trip data
// even with poor connectivity while traveling.
// ──────────────────────────────────────────────────────────

const CACHE_NAME = "timetravel-v1";
const RUNTIME_CACHE = "timetravel-runtime-v1";

// Critical assets to pre-cache on install
const PRECACHE_URLS = [
  "/",
  "/static/css/style.css",
  "/static/js/app.js",
  "/static/manifest.json",
  "https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap",
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css",
];

// ── Install: pre-cache critical assets ──────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

// ── Activate: clean up old caches ───────────────────────
self.addEventListener("activate", (event) => {
  const keep = new Set([CACHE_NAME, RUNTIME_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// ── Fetch strategy ──────────────────────────────────────
// Static assets: Cache-First (fast loads)
// API calls: Network-First with cache fallback (fresh data preferred)
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // API requests → Network-First
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Static assets → Cache-First
  event.respondWith(cacheFirstStrategy(request));
});

// ── Cache-First: serve from cache, fall back to network ─
async function cacheFirstStrategy(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Offline and not cached → return offline fallback
    return new Response("Offline – cached content unavailable", {
      status: 503,
      headers: { "Content-Type": "text/plain" },
    });
  }
}

// ── Network-First: try network, fall back to cache ──────
async function networkFirstStrategy(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;

    return new Response(
      JSON.stringify({
        error: "Offline",
        message: "You appear to be offline. Showing last cached data.",
      }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
