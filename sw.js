/* Service Worker: macht die App offline nutzbar und holt Updates zuverlässig */
const CACHE = "stundenzettel-v3";
const ASSETS = ["./", "./index.html", "./manifest.webmanifest", "./jspdf.umd.min.js",
                "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png"];

self.addEventListener("install", e => {
  // cache:"reload" umgeht den Browser-Cache, damit wirklich die neue Version gespeichert wird
  e.waitUntil(caches.open(CACHE)
    .then(c => Promise.all(ASSETS.map(u =>
      fetch(u, { cache: "reload" }).then(r => r.ok ? c.put(u, r) : null).catch(() => null))))
    .then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function withTimeout(p, ms) {
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej("timeout"), ms))]);
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const isPage = req.mode === "navigate" || req.url.endsWith(".html") || req.url.endsWith("/");

  if (isPage) {
    // App-Seite: erst online versuchen (max. 3 Sekunden), sonst die gespeicherte Version
    e.respondWith(
      withTimeout(fetch(req, { cache: "no-store" }), 3000).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put("./index.html", copy)).catch(() => {});
        return res;
      }).catch(() => caches.match("./index.html").then(r => r || caches.match("./")))
    );
    return;
  }

  // Alles andere (Icons, PDF-Bibliothek): aus dem Speicher, sonst aus dem Netz
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }))
  );
});
