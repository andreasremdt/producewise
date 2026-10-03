export function normalizeQuery(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}
export function matchesQuery(searchable, query) {
  const words = normalizeQuery(query).split(' ').filter(Boolean);
  const haystack = normalizeQuery(searchable);
  return words.every((word) => haystack.includes(word));
}
export function parseFavorites(raw) {
  try {
    const value = JSON.parse(raw ?? '[]');
    return Array.isArray(value)
      ? [
          ...new Set(
            value.filter((id) => typeof id === 'string' && /^[a-z]+(?:-[a-z]+)*$/.test(id)),
          ),
        ]
      : [];
  } catch {
    return [];
  }
}
export const FAVORITES_KEY = 'producewise:favorites:v1';
