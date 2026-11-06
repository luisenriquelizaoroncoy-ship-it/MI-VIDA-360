/* MI VIDA 360 - archivos de la aplicación solamente. No recoge datos personales. */
const CACHE = 'mi-vida-360-iphone-v10-all-reminders';
const SHELL = ['./','./index.html','./firebase-auth-ui.js','./firebase-cloud.js','./firebase-config.js','./manifest.webmanifest','./icon-192.png','./icon-512.png','./apple-touch-icon.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('mi-vida-360-iphone-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const target = new URL(event.request.url);
  if (target.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('./index.html')));
  } else {
    event.respondWith(caches.match(event.request).then(response => response || fetch(event.request)));
  }
});

/* Firebase Web Push: mostrar avisos de los pagos, incluso con la web cerrada.
   Solo muestra mensajes que llegan mediante un envío autorizado desde servidor. */
self.addEventListener('push', event => {
  let payload = {};
  try { payload=event.data?.json()||{}; }
  catch (_) { payload={data:{body:event.data?.text()||''}}; }
  const data=payload.data||payload.notification||{};
  const title=String(data.title||'MI VIDA 360 · Recordatorio');
  const body=String(data.body||'Revisa tus pagos pendientes.');
  const url=self.registration.scope;
  event.waitUntil(self.registration.showNotification(title,{
    body,
    tag:'mi-vida-360-reminder',
    renotify:false,
    icon:'./icon-192.png',
    badge:'./icon-192.png',
    data:{url}
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients => {
    const target=new URL(self.registration.scope);
    for(const client of clients){
      if(new URL(client.url).origin===target.origin){
        await client.focus();
        if(client.navigate)await client.navigate(target.href);
        return;
      }
    }
    if(self.clients.openWindow)return self.clients.openWindow(target.href);
  }));
});
