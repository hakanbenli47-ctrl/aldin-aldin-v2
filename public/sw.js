/* eslint-disable no-restricted-globals */
// --- Versiyon numarasını her önemli değişimde artırın ---
const VERSION = "v5";
const STATIC_CACHE  = `80bir-static-${VERSION}`;
const RUNTIME_CACHE = `80bir-runtime-${VERSION}`;

// Precache temel varlıklar
const PRECACHE = [
  "/",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

// Runtime cache sınırları
const MAX_RUNTIME_ENTRIES = 120; // runtime cache en fazla kaç istek tutsun
const RUNTIME_PRUNE_BATCH = 10;  // aşıldığında kaç tanesini silelim

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

// Yardımcı: runtime cache boyutu kontrolü (en basit prune)
async function pruneRuntimeCache() {
  const cache = await caches.open(RUNTIME_CACHE);
  const keys = await cache.keys();
  if (keys.length > MAX_RUNTIME_ENTRIES) {
    // eskiden yeniye doğru sil
    const toDelete = keys.slice(0, Math.min(RUNTIME_PRUNE_BATCH, keys.length));
    await Promise.all(toDelete.map((req) => cache.delete(req)));
  }
}

// Basit timeout'lu fetch (Network First için)
function fetchWithTimeout(request, ms = 4000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return fetch(request, { signal: controller.signal })
    .finally(() => clearTimeout(id));
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // API isteklerini asla cache’leme
  if (sameOrigin && url.pathname.startsWith("/api/")) return;

  // Next.js hash’li statikler -> Cache First
  if (sameOrigin && url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(req).then((hit) =>
        hit || fetch(req).then(async (res) => {
          const copy = res.clone();
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(req, copy);
          pruneRuntimeCache();
          return res;
        })
      )
    );
    return;
  }

  // Görseller / fontlar -> Stale-While-Revalidate (same-origin + CDN)
  const isAsset = /\.(?:png|jpg|jpeg|gif|webp|svg|ico|avif|ttf|woff2?)$/i.test(url.pathname);
  if (isAsset) {
    event.respondWith(
      caches.match(req).then((hit) => {
        const fetchPromise = fetch(req).then(async (res) => {
          const copy = res.clone();
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(req, copy);
          pruneRuntimeCache();
          return res;
        }).catch(() => hit || caches.match("/")); // ağ yoksa cache ya da ana sayfa
        return hit || fetchPromise;
      })
    );
    return;
  }

  // Sayfalar ve kalan GET’ler -> Network First (+ timeout) / offline fallback
  event.respondWith(
    (async () => {
      try {
        const res = await fetchWithTimeout(req, 5000);
        // yalnızca başarılı/valid yanıtları cache’e koy
        if (sameOrigin && res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(req, copy);
          pruneRuntimeCache();
        }
        return res;
      } catch {
        // offline: cache’de varsa onu kullan, yoksa ana sayfa
        const hit = await caches.match(req);
        return hit || caches.match("/");
      }
    })()
  );
});
