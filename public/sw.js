/*
 * BKC service worker: keeps the operator app and the TV screen available without internet.
 * - /_next/static/* (hashed, immutable): cache first.
 * - The operator and TV pages: network first, falling back to the cached copy when offline.
 * Data never goes through here: it lives in IndexedDB on the device.
 */
// Set per deploy by the registration (`/sw.js?v=<commit>`), so each deploy gets fresh caches.
const VERSION = `bkc-${new URL(self.location.href).searchParams.get("v") ?? "v1"}`;
const SHELL_CACHE = `${VERSION}-shell`;
const STATIC_CACHE = `${VERSION}-static`;
const SHELL_PAGES = ["/operator/live", "/tv"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    warm()
      .catch(() => 0)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

/** Fetches the shell pages and every static asset they reference, so a cold start works offline. */
async function warm() {
  const shell = await caches.open(SHELL_CACHE);
  const statics = await caches.open(STATIC_CACHE);
  const assets = new Set();
  for (const page of SHELL_PAGES) {
    const res = await fetch(page, { cache: "no-store" });
    if (!res.ok) throw new Error(`${page}: ${res.status}`);
    const html = await res.clone().text();
    await shell.put(page, res);
    for (const match of html.matchAll(/\/_next\/static\/[^"'\s)\\]+/g)) assets.add(match[0]);
  }
  await Promise.all(
    [...assets].map(async (url) => {
      if (await statics.match(url)) return;
      const res = await fetch(url);
      if (res.ok) await statics.put(url, res);
    }),
  );
  return assets.size;
}

self.addEventListener("message", (event) => {
  if (event.data?.type !== "warm") return;
  const port = event.ports[0];
  event.waitUntil(
    warm().then(
      (assets) => port?.postMessage({ ok: true, assets }),
      (err) => port?.postMessage({ ok: false, error: String(err) }),
    ),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(req));
  } else if (req.mode === "navigate" && SHELL_PAGES.includes(url.pathname)) {
    event.respondWith(networkFirst(req, url.pathname));
  }
});

async function cacheFirst(req) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) await cache.put(req, res.clone());
  return res;
}

async function networkFirst(req, path) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(req, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) await cache.put(path, res.clone());
    return res;
  } catch {
    const hit = await cache.match(path);
    if (hit) return hit;
    return new Response("Offline, en deze pagina is nog niet op dit toestel bewaard.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
