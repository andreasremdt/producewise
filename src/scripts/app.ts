import { matchesQuery, parseFavorites, FAVORITES_KEY } from '../lib/client-core.mjs';
const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector);
const $$ = <T extends HTMLElement = HTMLElement>(selector: string) => [
  ...document.querySelectorAll<T>(selector),
];
let favorites = new Set<string>();
let storageAvailable = true;
try {
  favorites = new Set(parseFavorites(localStorage.getItem(FAVORITES_KEY)));
} catch {
  storageAvailable = false;
}
let toastTimer: ReturnType<typeof setTimeout>;
function toast(message: string) {
  const el = $('[data-toast]');
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 6500);
}
const catalogue = $('[data-catalogue]');
const cards = $$('[data-card]');
const query = $<HTMLInputElement>('[data-query]');
const filters = $$<HTMLButtonElement>('[data-filter]');
const sort = $<HTMLSelectElement>('[data-sort]');
let category = 'all';
const initialParams = new URLSearchParams(location.search);
if (['fruit', 'vegetable'].includes(initialParams.get('category') ?? ''))
  category = initialParams.get('category')!;
if (query) query.value = initialParams.get('q') ?? '';
function filterCards(updateUrl = false) {
  if (!catalogue) return;
  const savedOnly = catalogue.dataset.favorites === 'true';
  const isHome = catalogue.dataset.home === 'true';
  const q = query?.value ?? '';
  const grid = catalogue.querySelector('.produce-grid')!;
  const ordered =
    sort?.value === 'az'
      ? [...cards].sort((a, b) => a.dataset.name!.localeCompare(b.dataset.name!))
      : cards;
  let visible = 0;
  for (const card of ordered) {
    const match =
      (!savedOnly || favorites.has(card.dataset.card!)) &&
      (category === 'all' || card.dataset.category === category) &&
      matchesQuery(card.dataset.search ?? '', q);
    card.hidden = !match;
    if (match) visible++;
    grid.appendChild(card);
  }
  const empty = catalogue.querySelector<HTMLElement>('[data-empty]');
  if (empty) empty.hidden = visible > 0;
  const count = catalogue.querySelector<HTMLElement>('[data-result-count]');
  if (count)
    count.textContent =
      q || category !== 'all' || savedOnly
        ? `${visible} ${visible === 1 ? 'guide' : 'guides'}${q ? ` for “${q.trim()}”` : ''}`
        : '';
  filters.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === category)));
  if (updateUrl && !isHome && !savedOnly) {
    const url = new URL(location.href);
    q.trim() ? url.searchParams.set('q', q.trim()) : url.searchParams.delete('q');
    category === 'all'
      ? url.searchParams.delete('category')
      : url.searchParams.set('category', category);
    history.replaceState(null, '', url);
  }
}
filters.forEach((b) =>
  b.addEventListener('click', () => {
    category = b.dataset.filter!;
    filterCards(true);
  }),
);
query?.addEventListener('input', () => filterCards(true));
query?.form?.addEventListener('submit', (e) => {
  e.preventDefault();
  filterCards(true);
});
sort?.addEventListener('change', () => filterCards());
window.addEventListener('popstate', () => {
  const params = new URLSearchParams(location.search);
  if (query) query.value = params.get('q') ?? '';
  category = ['fruit', 'vegetable'].includes(params.get('category') ?? '')
    ? params.get('category')!
    : 'all';
  filterCards();
});
function syncFavorites() {
  $$<HTMLButtonElement>('[data-favorite]').forEach((b) => {
    const saved = favorites.has(b.dataset.favorite!);
    b.setAttribute('aria-pressed', String(saved));
    b.setAttribute('aria-label', `${saved ? 'Remove' : 'Save'} ${b.dataset.name}`);
    b.title = `${saved ? 'Remove' : 'Save'} ${b.dataset.name}`;
    const label = b.querySelector('[data-favorite-label]');
    if (label) label.textContent = saved ? 'Guide saved' : 'Save guide';
  });
  $$('[data-saved-count]').forEach((el) => (el.textContent = String(favorites.size)));
  filterCards();
}
function setOfflineStatus(id: string, text: string) {
  $$('[data-offline-status]')
    .filter((e) => e.dataset.offlineStatus === id)
    .forEach((e) => (e.textContent = text));
}
type WorkerResult = { ok: boolean; ready?: boolean; updatedAt?: string; error?: string };
let workerPromise: Promise<ServiceWorkerRegistration> | undefined;
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  workerPromise = navigator.serviceWorker
    .register('/sw.js')
    .then(() =>
      Promise.race([
        navigator.serviceWorker.ready,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Worker timed out')), 12000),
        ),
      ]),
    );
  workerPromise.catch(() => {});
}
async function messageWorker(action: string, id?: string): Promise<WorkerResult> {
  if (!workerPromise)
    throw new Error('Offline saving needs a supported browser and the production site.');
  const registration = await workerPromise;
  const worker = registration.active;
  if (!worker) throw new Error('Offline storage is not ready yet.');
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => {
      channel.port1.close();
      reject(new Error('Offline download timed out.'));
    }, 45000);
    channel.port1.onmessage = (event) => {
      clearTimeout(timer);
      channel.port1.close();
      event.data.ok
        ? resolve(event.data)
        : reject(new Error(event.data.error ?? 'Offline storage failed.'));
    };
    worker.postMessage({ action, id }, [channel.port2]);
  });
}
async function downloadGuide(id: string, refresh = false) {
  setOfflineStatus(id, 'Downloading…');
  try {
    await messageWorker('SAVE', id);
    if (favorites.has(id)) setOfflineStatus(id, '✓ Ready offline');
    else await messageWorker('REMOVE', id);
  } catch {
    if (favorites.has(id)) {
      try {
        const result = await messageWorker('STATUS', id);
        setOfflineStatus(
          id,
          result.ready
            ? '✓ Saved copy available · refresh failed'
            : 'Saved · download needs a connection',
        );
      } catch {
        setOfflineStatus(id, 'Saved · offline download unavailable');
      }
    }
    if (refresh) throw new Error('Some guides could not be refreshed.');
  }
}
async function checkOffline() {
  for (const id of favorites) {
    try {
      const result = await messageWorker('STATUS', id);
      setOfflineStatus(
        id,
        result.ready
          ? `✓ Ready offline${result.updatedAt ? ' · ' + new Date(result.updatedAt).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : ''}`
          : 'Saved · not downloaded',
      );
    } catch {
      setOfflineStatus(id, 'Saved · offline download unavailable');
    }
  }
}
$$<HTMLButtonElement>('[data-favorite]').forEach((b) =>
  b.addEventListener('click', async () => {
    const id = b.dataset.favorite!;
    const next = new Set(favorites);
    const removing = next.has(id);
    removing ? next.delete(id) : next.add(id);
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify([...next]));
      storageAvailable = true;
    } catch {
      storageAvailable = false;
      toast('Your browser couldn’t save this guide. Allow site storage and try again.');
      return;
    }
    favorites = next;
    syncFavorites();
    if (removing) {
      setOfflineStatus(id, '');
      toast(`${b.dataset.name} removed from saved guides.`);
      try {
        await messageWorker('REMOVE', id);
      } catch {
        toast('Favorite removed. Offline cleanup could not finish; reopen Saved guides to retry.');
      }
    } else {
      toast(`${b.dataset.name} saved on this device.`);
      await downloadGuide(id);
    }
  }),
);
window.addEventListener('storage', (event) => {
  if (event.key === FAVORITES_KEY || event.key === null) {
    favorites = new Set(parseFavorites(event.newValue));
    syncFavorites();
    $$('[data-offline-status]').forEach((e) => {
      if (!favorites.has(e.dataset.offlineStatus!)) e.textContent = '';
    });
    void checkOffline();
  }
});
$<HTMLButtonElement>('[data-refresh-offline]')?.addEventListener('click', async (event) => {
  const button = event.currentTarget as HTMLButtonElement;
  if (!favorites.size) {
    toast('Save a guide first, then download it here.');
    return;
  }
  button.disabled = true;
  const results = await Promise.allSettled([...favorites].map((id) => downloadGuide(id, true)));
  button.disabled = false;
  toast(
    results.every((r) => r.status === 'fulfilled')
      ? 'Your saved guides are ready offline.'
      : 'Some downloads could not refresh. Check the labels and try again with a connection.',
  );
});
const panels = $$('[data-panel]');
const conditions = $$<HTMLButtonElement>('[data-condition]');
function selectCondition(condition: string) {
  panels.forEach((p) => (p.hidden = p.dataset.panel !== condition));
  const selected = panels.find((p) => p.dataset.panel === condition);
  if (selected) {
    $('[data-storage-label]')!.textContent = selected.dataset.label!.toLowerCase();
    $('[data-storage-value]')!.textContent =
      `${selected.dataset.location!.toLowerCase()} · ${selected.dataset.time!.toLowerCase()}`;
  }
  conditions.forEach((b) =>
    b.setAttribute('aria-pressed', String(b.dataset.condition === condition)),
  );
}
if (panels.length) selectCondition($('[data-storage-panels]')!.dataset.default!);
conditions.forEach((b) => b.addEventListener('click', () => selectCondition(b.dataset.condition!)));
function connection() {
  const status = $('[data-connection]');
  if (status) status.hidden = navigator.onLine;
}
window.addEventListener('online', connection);
window.addEventListener('offline', connection);
connection();
function failedImage(img: HTMLImageElement) {
  if (img.dataset.failed) return;
  img.dataset.failed = 'true';
  img.style.display = 'none';
  const fallback = document.createElement('span');
  fallback.className = 'image-fallback';
  fallback.textContent = img.alt || 'Image unavailable';
  img.after(fallback);
}
$$<HTMLImageElement>('img').forEach((img) => {
  img.addEventListener('error', () => failedImage(img));
  if (img.complete && img.naturalWidth === 0) failedImage(img);
});
syncFavorites();
if (!storageAvailable) toast('Browser storage is unavailable. You can still read all guides.');
void checkOffline();
// Clean up guides removed in another session, without depending on network access.
if (workerPromise)
  void workerPromise
    .then(async () => {
      await messageWorker('SYNC', JSON.stringify([...favorites]));
    })
    .catch(() => {});
