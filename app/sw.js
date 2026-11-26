// Peineta: abre la app aunque no haya internet.
// Siempre intenta traer la versión nueva; si no hay conexión, usa la última guardada.
const CACHE = 'peineta-app-v1';
const FILES = ['/app/', '/app/db.js', '/app/supabase.js', '/app/manifest.webmanifest', '/app/icon-192.png', '/app/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || !u.pathname.startsWith('/app/')) return;
  const key = r.mode === 'navigate' ? '/app/' : u.pathname;
  e.respondWith(
    fetch(r).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(key, copy)) }
      return res;
    }).catch(() => caches.match(key).then(m => m || caches.match('/app/')))
  );
});
