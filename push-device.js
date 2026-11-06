// La app y el service worker comparten la vinculación de esta instalación.
(function () {
  'use strict';
  const cacheName = 'mi360-device-binding-v1';
  const key = new URL('./__mi360_device__', self.registration?.scope || self.location.href).href;
  async function binding() {
    const response = await (await caches.open(cacheName)).match(key);
    return response ? response.json() : null;
  }
  async function bind(uid) {
    await (await caches.open(cacheName)).put(key, new Response(JSON.stringify({uid})));
  }
  self.MI360Device = { binding, bind };
})();
