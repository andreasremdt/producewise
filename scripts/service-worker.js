/* Build-time constants VERSION, SHELL_URLS, GUIDES are prepended by build-offline.mjs. */
const SHELL = 'producewise-shell-' + VERSION;
const PREFIX = 'producewise-guide-';
const metaURL = (id) => '/__producewise_meta/' + id;
const guidePrefix = (id) => PREFIX + id + '-';
const guideCache = (id) => guidePrefix(id) + VERSION;
self.addEventListener('install', (event) =>
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      await cache.addAll(SHELL_URLS);
      await self.skipWaiting();
    })(),
  ),
);
self.addEventListener('activate', (event) =>
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys())
        if (name.startsWith('producewise-shell-') && name !== SHELL) await caches.delete(name);
      await self.clients.claim();
    })(),
  ),
);
async function guideStatus(id) {
  const names = (await caches.keys()).filter((n) => n.startsWith(guidePrefix(id))).reverse();
  for (const name of names) {
    const cache = await caches.open(name);
    const meta = await cache.match(metaURL(id));
    if (!meta) continue;
    const data = await meta.json();
    const results = await Promise.all(data.urls.map((url) => cache.match(url)));
    if (results.every(Boolean)) return { ok: true, ready: true, updatedAt: data.updatedAt };
  }
  return { ok: true, ready: false };
}
async function save(id) {
  const guide = GUIDES[id];
  if (!guide) throw new Error('Guide not found.');
  const name = guideCache(id);
  const cache = await caches.open(name);
  const previousMeta = await cache.match(metaURL(id));
  if (previousMeta) {
    const data = await previousMeta.json();
    const complete = await Promise.all(data.urls.map((url) => cache.match(url)));
    if (complete.every(Boolean)) return { ok: true, ready: true, updatedAt: data.updatedAt };
  }
  const urls = [guide.url, ...guide.assets];
  try {
    // Fetch and validate every response before touching this guide's cached resources.
    const responses = await Promise.all(
      urls.map(async (url) => {
        const response = await fetch(url, { cache: 'reload' });
        if (!response.ok || response.type === 'opaque')
          throw new Error('Could not download all guide files.');
        return response;
      }),
    );
    // A deployment may change the HTML before this worker has updated its manifest.
    const html = await responses[0].clone().text();
    const referenced = [...html.matchAll(/(?:src|href)="(\/_astro\/[^"?#]+)(?:\?[^"#]*)?"/g)].map(
      (m) => m[1],
    );
    if (referenced.some((url) => !urls.includes(url)))
      throw new Error('Guide version changed. Reload before downloading again.');
    for (let i = 0; i < urls.length; i++) await cache.put(urls[i], responses[i]);
    const updatedAt = new Date().toISOString();
    await cache.put(
      metaURL(id),
      new Response(JSON.stringify({ urls, updatedAt, version: VERSION }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    for (const old of await caches.keys())
      if (old.startsWith(guidePrefix(id)) && old !== name) await caches.delete(old);
    return { ok: true, ready: true, updatedAt };
  } catch (error) {
    if (!previousMeta) await caches.delete(name);
    throw error;
  }
}
async function remove(id) {
  for (const name of await caches.keys())
    if (name.startsWith(guidePrefix(id))) await caches.delete(name);
  return { ok: true };
}
// Serialize mutations, so rapidly saving/removing cannot leave a stray completed download.
let operations = Promise.resolve();
self.addEventListener('message', (event) => {
  const { action, id } = event.data ?? {};
  const port = event.ports[0];
  if (!port) return;
  const run = async () => {
    try {
      let result;
      if (action === 'SYNC') {
        const saved = JSON.parse(id);
        if (!Array.isArray(saved)) throw new Error('Invalid favorites');
        const names = await caches.keys();
        for (const name of names)
          if (name.startsWith(PREFIX)) {
            const slug = name.slice(PREFIX.length).replace(/-[a-f0-9]{12}$/, '');
            if (!saved.includes(slug)) await caches.delete(name);
          }
        result = { ok: true };
      } else {
        if (typeof id !== 'string' || !/^[a-z]+(?:-[a-z]+)*$/.test(id) || !GUIDES[id])
          throw new Error('Unknown guide');
        if (action === 'SAVE') result = await save(id);
        else if (action === 'REMOVE') result = await remove(id);
        else if (action === 'STATUS') result = await guideStatus(id);
        else throw new Error('Unknown action');
      }
      port.postMessage(result);
    } catch {
      port.postMessage({
        ok: false,
        error:
          'Offline storage could not complete. Check your connection and available browser storage.',
      });
    }
  };
  operations = operations.then(run, run);
  event.waitUntil(operations);
});
async function cached(request) {
  const shell = await caches.open(SHELL);
  const direct = await shell.match(request, { ignoreSearch: true });
  if (direct) return direct;
  for (const name of await caches.keys())
    if (name.startsWith(PREFIX)) {
      const cache = await caches.open(name);
      const response = await cache.match(request, { ignoreSearch: true });
      if (response) return response;
    }
}
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate')
    event.respondWith(
      (async () => {
        try {
          return await fetch(event.request);
        } catch {
          return (
            (await cached(event.request)) || (await caches.match('/offline/')) || Response.error()
          );
        }
      })(),
    );
  else if (
    url.pathname.startsWith('/_astro/') ||
    url.pathname.startsWith('/icons/') ||
    SHELL_URLS.includes(url.pathname)
  )
    event.respondWith((async () => (await cached(event.request)) || fetch(event.request))());
});
