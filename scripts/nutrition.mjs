import { nutritionSchema } from '../src/lib/nutrition-schema.mjs';

export const nutrientSpecs = [
  ['energy', [2048, 1008, 2047], 'Energy', 'kcal'],
  ['carbohydrate', [1005], 'Carbohydrate', 'g'],
  ['protein', [1003], 'Protein', 'g'],
  ['fat', [1004], 'Fat', 'g'],
  ['fiber', [1079], 'Fiber', 'g'],
  ['vitamin-c', [1162], 'Vitamin C', 'mg'],
  ['potassium', [1092], 'Potassium', 'mg'],
];
export function normalizeFood(
  food,
  selection,
  { importedAt = new Date().toISOString(), reviewedAt, reviewedBy } = {},
) {
  if (
    food.fdcId !== selection.fdcId ||
    food.description !== selection.description ||
    food.dataType !== selection.dataType
  )
    throw new Error(`Source identity changed for ${selection.id}; review the mapping.`);
  if (!Array.isArray(food.foodNutrients) || !food.foodNutrients.length)
    throw new Error(`No nutrient data for ${selection.id}`);
  const nutrients = nutrientSpecs.map(([key, ids, name, unit]) => {
    const found = ids
      .map((id) => food.foodNutrients.find((n) => n.nutrient?.id === id))
      .find(Boolean);
    const actualUnit = found?.nutrient?.unitName?.toLowerCase().replace('ug', 'µg');
    if (found && actualUnit !== unit.toLowerCase())
      throw new Error(`Unexpected unit for ${selection.id}/${key}: ${actualUnit}`);
    const value = found?.amount ?? null;
    if (value !== null && (!Number.isFinite(value) || value < 0))
      throw new Error(`Invalid nutrient ${key}`);
    return {
      key,
      nutrientId: found?.nutrient.id ?? ids[0],
      name: found?.nutrient.name ?? name,
      value,
      unit,
    };
  });
  return nutritionSchema.parse({
    id: selection.id,
    provider: 'USDA FoodData Central',
    fdcId: food.fdcId,
    dataType: food.dataType,
    description: food.description,
    preparation: selection.preparation,
    basis: '100 g edible portion',
    basisGrams: 100,
    sourceUrl: `https://fdc.nal.usda.gov/food-details/${food.fdcId}/nutrients`,
    publicationDate: food.publicationDate,
    importedAt,
    reviewedAt: reviewedAt ?? '1970-01-01',
    reviewedBy: reviewedBy ?? 'PENDING REVIEW',
    selectionReason: selection.reason,
    nutrients,
  });
}

// A single request and in-memory validation: failure cannot partially update files.
export async function fetchProposals(selections, apiKey, fetcher = fetch) {
  if (!apiKey) throw new Error('Set USDA_API_KEY in your environment. No files have changed.');
  const url = new URL('https://api.nal.usda.gov/fdc/v1/foods');
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('fdcIds', selections.map((s) => s.fdcId).join(','));
  const response = await fetcher(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok)
    throw new Error(
      response.status === 429
        ? 'USDA rate limit reached. Retry later; approved records are unchanged.'
        : `USDA request failed (${response.status}); approved records are unchanged.`,
    );
  const foods = await response.json();
  if (!Array.isArray(foods) || foods.length !== selections.length)
    throw new Error('Incomplete USDA response. No updates written.');
  return selections.map((s) => {
    const food = foods.find((f) => f.fdcId === s.fdcId);
    if (!food) throw new Error(`Missing USDA record ${s.fdcId}`);
    return normalizeFood(food, s);
  });
}
