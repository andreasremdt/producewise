import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../dist/', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const index = JSON.parse(await read('search-index.json'));
function dependencies(html) {
  return [
    ...new Set(
      [...html.matchAll(/(?:src|href)="(\/[^"?#]+)(?:\?[^"#]*)?"/g)]
        .map((m) => m[1])
        .filter(
          (p) =>
            p.startsWith('/_astro/') ||
            p.startsWith('/icons/') ||
            p === '/favicon.svg' ||
            p === '/manifest.webmanifest',
        ),
    ),
  ];
}
const shellPages = ['/', '/browse/', '/favorites/', '/about/', '/offline/'];
const shellAssets = new Set([
  '/search-index.json',
  '/favicon.svg',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/licenses/gfdl-1.2.txt',
]);
const hasher = createHash('sha256');
for (const page of shellPages) {
  const html = await read(page.slice(1) + 'index.html');
  hasher.update(html);
  for (const asset of dependencies(html))
    if (!/\.(webp|jpg|png)$/.test(asset) || asset.startsWith('/icons/')) shellAssets.add(asset);
}
const guides = {};
for (const p of index) {
  const html = await read(p.url.slice(1) + 'index.html');
  hasher.update(html);
  guides[p.id] = { url: p.url, assets: [...new Set([...dependencies(html), ...shellAssets])] };
}
const version = hasher.digest('hex').slice(0, 12);
const template = await readFile(new URL('./service-worker.js', import.meta.url), 'utf8');
await writeFile(
  new URL('sw.js', root),
  `const VERSION=${JSON.stringify(version)};\nconst SHELL_URLS=${JSON.stringify([...shellPages, ...shellAssets])};\nconst GUIDES=${JSON.stringify(guides)};\n` +
    template,
);
console.log(
  `Offline worker ${version}: ${index.length} guides; photos downloaded only for saved guides.`,
);
