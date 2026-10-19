/* Service worker do Sistema de escalas.
 * Segurança: guarda SOMENTE os arquivos do próprio app (HTML, JS, CSS, ícones).
 * Nunca guarda respostas do Supabase (dados pessoais, fotos, login) nem pedidos que não sejam GET.
 */
const VERSION = "__BUILD_ID__";
const CACHE = `escala-app-${VERSION}`;
const SHELL = "/_shell.html";
const PRECACHE = [SHELL, "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/favicon.ico"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("escala-app-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase, fontes etc. vão direto à rede

  // Páginas: tenta a rede; sem internet, abre o app guardado.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(SHELL)));
    return;
  }

  // Arquivos com hash no nome nunca mudam: cache primeiro.
  if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok && res.type === "basic") {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
});
