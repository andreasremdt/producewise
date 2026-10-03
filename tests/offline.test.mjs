import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs/promises';
const template = await fs.readFile(
  new URL('../scripts/service-worker.js', import.meta.url),
  'utf8',
);
function cacheStore() {
  const store = new Map();
  return {
    store,
    async keys() {
      return [...store.keys()];
    },
    async delete(key) {
      return store.delete(key);
    },
    async open(key) {
      if (!store.has(key)) store.set(key, new Map());
      const map = store.get(key);
      return {
        async match(key) {
          return map.get(typeof key === 'string' ? key : key.url)?.clone();
        },
        async put(key, response) {
          map.set(key, response.clone());
        },
        async addAll(urls) {
          for (const url of urls) map.set(url, new Response('shell'));
        },
      };
    },
    async match(url) {
      for (const map of store.values()) if (map.has(url)) return map.get(url).clone();
    },
  };
}
function worker(
  caches,
  version = 'aaaaaaaaaaaa',
  fetcher = async (url) => new Response('content:' + url),
) {
  const handlers = {};
  const context = {
    caches,
    Response,
    URL,
    Promise,
    Date,
    JSON,
    Error,
    fetch: fetcher,
    self: {
      location: { origin: 'https://example.test' },
      clients: { claim: async () => {} },
      skipWaiting: async () => {},
      addEventListener: (type, fn) => (handlers[type] = fn),
    },
  };
  vm.runInNewContext(
    `const VERSION='${version}';const SHELL_URLS=['/offline/'];const GUIDES={avocado:{url:'/produce/avocado/',assets:['/_astro/app.js','/_astro/avocado.webp']},banana:{url:'/produce/banana/',assets:['/_astro/app.js','/_astro/banana.webp']}};` +
      template,
    context,
  );
  return {
    async message(action, id) {
      return new Promise((resolve, reject) => {
        handlers.message({
          data: { action, id },
          ports: [{ postMessage: resolve }],
          waitUntil: (p) => p.catch(reject),
        });
      });
    },
    handlers,
  };
}
test('offline status requires a completed guide and every dependency', async () => {
  const caches = cacheStore();
  const w = worker(caches);
  assert.equal((await w.message('STATUS', 'avocado')).ready, false);
  assert.equal((await w.message('SAVE', 'avocado')).ready, true);
  assert.equal((await w.message('STATUS', 'avocado')).ready, true);
  caches.store.get('producewise-guide-avocado-aaaaaaaaaaaa').delete('/_astro/avocado.webp');
  assert.equal((await w.message('STATUS', 'avocado')).ready, false);
});
test('a failed refresh preserves the previous complete offline guide', async () => {
  const caches = cacheStore();
  await worker(caches).message('SAVE', 'avocado');
  const updated = worker(caches, 'bbbbbbbbbbbb', async () => {
    throw new Error('offline');
  });
  assert.equal((await updated.message('SAVE', 'avocado')).ok, false);
  assert.equal((await updated.message('STATUS', 'avocado')).ready, true);
  assert(caches.store.has('producewise-guide-avocado-aaaaaaaaaaaa'));
  assert(!caches.store.has('producewise-guide-avocado-bbbbbbbbbbbb'));
});
test('quota failure never announces an incomplete download as ready', async () => {
  const caches = cacheStore();
  const open = caches.open.bind(caches);
  caches.open = async (key) => {
    const cache = await open(key);
    cache.put = async () => {
      throw new Error('QuotaExceeded');
    };
    return cache;
  };
  const w = worker(caches);
  assert.equal((await w.message('SAVE', 'avocado')).ok, false);
  assert.equal((await w.message('STATUS', 'avocado')).ready, false);
});
test('removal and sync remove only the relevant guide cache', async () => {
  const caches = cacheStore();
  const w = worker(caches);
  await w.message('SAVE', 'avocado');
  await w.message('SAVE', 'banana');
  await w.message('REMOVE', 'avocado');
  assert.equal((await w.message('STATUS', 'avocado')).ready, false);
  assert.equal((await w.message('STATUS', 'banana')).ready, true);
  await w.message('SYNC', '[]');
  assert.equal((await w.message('STATUS', 'banana')).ready, false);
});
test('serialized rapid save and remove leaves no downloaded guide', async () => {
  const caches = cacheStore();
  const w = worker(caches);
  await Promise.all([w.message('SAVE', 'avocado'), w.message('REMOVE', 'avocado')]);
  assert.equal((await w.message('STATUS', 'avocado')).ready, false);
});

test('a deployment changing guide dependencies never marks an incomplete version ready', async () => {
  const caches = cacheStore();
  await worker(caches).message('SAVE', 'avocado');
  const updated = worker(
    caches,
    'bbbbbbbbbbbb',
    async () => new Response('<script src="/_astro/new-app.js"></script>'),
  );
  assert.equal((await updated.message('SAVE', 'avocado')).ok, false);
  assert.equal((await updated.message('STATUS', 'avocado')).ready, true);
  assert(!caches.store.has('producewise-guide-avocado-bbbbbbbbbbbb'));
});
