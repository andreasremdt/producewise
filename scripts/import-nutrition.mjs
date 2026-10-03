import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { fetchProposals } from './nutrition.mjs';
try {
  const selections = JSON.parse(
    await readFile(new URL('../data/usda-selections.json', import.meta.url), 'utf8'),
  );
  const records = await fetchProposals(selections, process.env.USDA_API_KEY);
  const directory = new URL('../data/nutrition-proposals/', import.meta.url);
  await mkdir(directory, { recursive: true });
  const temp = new URL(`proposal-${process.pid}.tmp`, directory);
  await writeFile(temp, JSON.stringify(records, null, 2) + '\n');
  await rename(temp, new URL('latest.json', directory));
  console.log(
    'Proposal: data/nutrition-proposals/latest.json. Review against src/content/nutrition/approved.json before approval.',
  );
} catch (error) {
  // Do not print fetch errors or URLs, which can contain the API key.
  console.error(
    error instanceof TypeError
      ? 'USDA connection failed. No approved records changed.'
      : error.message,
  );
  process.exitCode = 1;
}
