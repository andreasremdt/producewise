import { readFile, writeFile, rename } from 'node:fs/promises';
import { nutritionSchema } from '../src/lib/nutrition-schema.mjs';
const reviewer = process.argv[2];
if (!reviewer?.trim())
  throw new Error('After reviewing the full diff, run pnpm nutrition:approve "Reviewer name".');
const records = JSON.parse(
  await readFile(new URL('../data/nutrition-proposals/latest.json', import.meta.url), 'utf8'),
);
const selections = JSON.parse(
  await readFile(new URL('../data/usda-selections.json', import.meta.url), 'utf8'),
);
if (
  records.length !== selections.length ||
  new Set(records.map((r) => r.id)).size !== records.length
)
  throw new Error('Incomplete or duplicate proposal.');
const reviewed = records.map((r) => {
  const selection = selections.find((s) => s.id === r.id);
  if (
    !selection ||
    selection.fdcId !== r.fdcId ||
    selection.description !== r.description ||
    selection.dataType !== r.dataType ||
    selection.preparation !== r.preparation
  )
    throw new Error('Proposal does not match reviewed selection.');
  return nutritionSchema.parse({
    ...r,
    reviewedAt: new Date().toISOString().slice(0, 10),
    reviewedBy: reviewer,
  });
});
const target = new URL('../src/content/nutrition/approved.json', import.meta.url);
const temp = new URL(`../src/content/nutrition/approved-${process.pid}.tmp`, import.meta.url);
await writeFile(temp, JSON.stringify(reviewed, null, 2) + '\n');
await rename(temp, target);
console.log('Approved all records atomically. Review the Git diff before committing.');
