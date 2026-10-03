import { z } from 'astro/zod';

export const dateSchema = z.iso.date();
export const nutritionSchema = z.object({
  id: z.string(),
  provider: z.literal('USDA FoodData Central'),
  fdcId: z.number().int().positive(),
  dataType: z.enum(['Foundation', 'SR Legacy']),
  description: z.string().min(1),
  preparation: z.string().min(1),
  basis: z.literal('100 g edible portion'),
  basisGrams: z.literal(100),
  sourceUrl: z.url(),
  publicationDate: z.string().min(1),
  importedAt: z.iso.datetime(),
  reviewedAt: dateSchema,
  reviewedBy: z.string().min(1),
  selectionReason: z.string().min(1),
  nutrients: z
    .array(
      z.object({
        key: z.string(),
        nutrientId: z.number().int().positive(),
        name: z.string(),
        value: z.number().nonnegative().nullable(),
        unit: z.enum(['g', 'mg', 'µg', 'kcal']),
      }),
    )
    .min(1)
    .refine(
      (values) => new Set(values.map((n) => n.key)).size === values.length,
      'Duplicate nutrient keys',
    ),
});
