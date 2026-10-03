import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { normalizeQuery, matchesQuery, parseFavorites } from '../src/lib/client-core.mjs';
import { normalizeFood, fetchProposals } from '../scripts/nutrition.mjs';
import { nutritionSchema } from '../src/lib/nutrition-schema.mjs';
const approvedPath = new URL('../src/content/nutrition/approved.json', import.meta.url);
const approved = JSON.parse(await fs.readFile(approvedPath, 'utf8'));
const selections = JSON.parse(
  await fs.readFile(new URL('../data/usda-selections.json', import.meta.url), 'utf8'),
);
const raw = JSON.parse(
  await fs.readFile(new URL('../data/source-snapshots/usda-starter.json', import.meta.url), 'utf8'),
);
test('search handles aliases, case, diacritics, and extra whitespace', () => {
  assert.equal(normalizeQuery('  AUBERGINE   '), 'aubergine');
  assert(matchesQuery('Eggplant aubergine brinjal', '  AuBeRgInE  '));
  assert(matchesQuery('Zucchini courgette', 'COURGETTE'));
  assert(matchesQuery('Mangos mangoes tropical', ' mangoes '));
  assert(!matchesQuery('bananas', 'apple'));
});
test('favorites reject invalid and corrupt storage without crashing', () => {
  assert.deepEqual(parseFavorites('{broken'), []);
  assert.deepEqual(parseFavorites('{}'), []);
  assert.deepEqual(parseFavorites('["avocado","avocado",1,null,"../bad"]'), ['avocado']);
});
test('all approved records validate and exactly match USDA snapshot amounts and units', () => {
  assert.equal(approved.length, 10);
  assert.equal(approved.filter((n) => n.dataType === 'Foundation').length, 8);
  for (const record of approved) {
    nutritionSchema.parse(record);
    const normalized = normalizeFood(
      raw.find((f) => f.fdcId === record.fdcId),
      selections.find((s) => s.id === record.id),
    );
    assert.deepEqual(record.nutrients, normalized.nutrients);
    assert.equal(record.basisGrams, 100);
  }
});
test('missing fiber is unavailable, not zero or borrowed from another record', () => {
  const r = approved.find((r) => r.id === 'avocado');
  assert.equal(r.nutrients.find((n) => n.key === 'fiber').value, null);
  const b = approved.find((r) => r.id === 'blueberry');
  assert.equal(b.nutrients.find((n) => n.key === 'fiber').value, null);
});
test('normalizer rejects changed food form, branded data, wrong units, and negative amounts', () => {
  const s = selections[0];
  const f = raw.find((f) => f.fdcId === s.fdcId);
  assert.throws(() => normalizeFood({ ...f, description: 'Cooked avocado' }, s));
  assert.throws(() => normalizeFood({ ...f, dataType: 'Branded' }, s));
  const altered = structuredClone(f);
  altered.foodNutrients.find((n) => n.nutrient.id === 1003).nutrient.unitName = 'mg';
  assert.throws(() => normalizeFood(altered, s));
  const negative = structuredClone(f);
  negative.foodNutrients.find((n) => n.nutrient.id === 1003).amount = -1;
  assert.throws(() => normalizeFood(negative, s));
});
test('import failures and incomplete responses preserve approved bytes', async () => {
  const before = await fs.readFile(approvedPath);
  await assert.rejects(() => fetchProposals(selections, ''));
  await assert.rejects(
    () => fetchProposals(selections, 'test-key', async () => new Response('', { status: 429 })),
    /rate limit/,
  );
  await assert.rejects(() =>
    fetchProposals(selections, 'test-key', async () => new Response('[]')),
  );
  await assert.rejects(() =>
    fetchProposals(selections, 'test-key', async () => {
      throw new Error('Network unavailable');
    }),
  );
  assert.deepEqual(await fs.readFile(approvedPath), before);
});
test('complete imports produce review candidates without overwriting approved records', async () => {
  const before = await fs.readFile(approvedPath);
  const result = await fetchProposals(
    selections,
    'test-key',
    async () => new Response(JSON.stringify(raw)),
  );
  assert.equal(result.length, 10);
  assert(result.every((r) => r.reviewedBy === 'PENDING REVIEW'));
  assert.deepEqual(await fs.readFile(approvedPath), before);
});
test('starter content is balanced, references approved records, and has local photos', async () => {
  const files = await fs.readdir(new URL('../src/content/produce/', import.meta.url));
  const entries = await Promise.all(
    files.map(async (name) =>
      JSON.parse(
        await fs.readFile(new URL('../src/content/produce/' + name, import.meta.url), 'utf8'),
      ),
    ),
  );
  assert.equal(entries.filter((p) => p.category === 'fruit').length, 5);
  assert.equal(entries.filter((p) => p.category === 'vegetable').length, 5);
  for (const p of entries) {
    assert(approved.some((n) => n.id === p.nutrition));
    assert(p.storage.some((s) => s.condition === p.defaultCondition));
    assert(p.image.license && p.image.author && p.sources.length);
    await fs.access(new URL('../src/assets/produce/' + p.image.src, import.meta.url));
  }
});
test('built output has no USDA request endpoint or API secrets', async () => {
  const paths = [];
  async function walk(dir) {
    for (const item of await fs.readdir(dir, { withFileTypes: true })) {
      const path = new URL(item.name + (item.isDirectory() ? '/' : ''), dir);
      if (item.isDirectory()) await walk(path);
      else if (/\.(html|js|json)$/.test(item.name)) paths.push(path);
    }
  }
  await walk(new URL('../dist/', import.meta.url));
  assert(paths.length > 15);
  for (const path of paths) {
    const text = await fs.readFile(path, 'utf8');
    assert(!/api\.nal\.usda\.gov|DEMO_KEY|USDA_API_KEY|api_key=/i.test(text), path.pathname);
  }
});
