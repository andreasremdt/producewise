import { defineCollection, reference } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { z } from 'astro/zod';
import { nutritionSchema, dateSchema } from './lib/nutrition-schema.mjs';

const image = z.object({
  src: z.string(),
  alt: z.string().min(1),
  author: z.string(),
  source: z.url(),
  license: z.string(),
  licenseUrl: z.url(),
  modifications: z.string(),
});
const source = z.object({ id: z.string(), title: z.string(), url: z.url(), supports: z.string() });
const produce = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/produce' }),
  schema: z
    .object({
      slug: z.string().regex(/^[a-z]+(?:-[a-z]+)*$/),
      name: z.string(),
      singular: z.string(),
      aliases: z.array(z.string()),
      category: z.enum(['fruit', 'vegetable']),
      tags: z.array(z.string()),
      description: z.string(),
      color: z.string().regex(/^#[a-fA-F0-9]{6}$/),
      image,
      additionalImages: z.array(image).optional(),
      order: z.number(),
      nutrition: reference('nutrition'),
      defaultCondition: z.enum(['whole', 'unripe', 'ripe', 'cut']),
      storage: z
        .array(
          z.object({
            condition: z.enum(['whole', 'unripe', 'ripe', 'cut']),
            label: z.string(),
            location: z.enum(['Refrigerator', 'Room temperature', 'Cool, dark place', 'Freezer']),
            time: z.string(),
            preparation: z.string(),
            advice: z.string(),
            caution: z.string(),
            sourceIds: z.array(z.string()).min(1),
          }),
        )
        .min(1),
      ripeness: z.array(z.string()).optional(),
      mistakes: z.array(z.string()).optional(),
      buying: z.array(z.string()).min(1),
      freshness: z.string(),
      together: z.string().optional(),
      freezing: z
        .object({ instructions: z.string(), quality: z.string(), sourceId: z.string() })
        .optional(),
      leftovers: z.array(z.string()).optional(),
      tips: z.array(z.string()).optional(),
      funFacts: z.array(z.string()).optional(),
      seasonality: z
        .object({ region: z.string(), months: z.array(z.number().int().min(1).max(12)) })
        .optional(),
      sources: z.array(source).min(1),
      reviewedAt: dateSchema,
    })
    .superRefine((item, ctx) => {
      if (!item.storage.some((s) => s.condition === item.defaultCondition))
        ctx.addIssue({ code: 'custom', message: 'Default condition must exist' });
      if (new Set(item.storage.map((s) => s.condition)).size !== item.storage.length)
        ctx.addIssue({ code: 'custom', message: 'Duplicate conditions' });
      const ids = new Set(item.sources.map((s) => s.id));
      for (const s of item.storage)
        for (const id of s.sourceIds)
          if (!ids.has(id))
            ctx.addIssue({ code: 'custom', message: `Missing storage source ${id}` });
      if (item.freezing && !ids.has(item.freezing.sourceId))
        ctx.addIssue({ code: 'custom', message: 'Missing freezing source' });
    }),
});
const nutrition = defineCollection({
  loader: file('./src/content/nutrition/approved.json'),
  schema: nutritionSchema.refine(
    (n) => n.reviewedBy !== 'PENDING REVIEW',
    'Unreviewed nutrition cannot be published',
  ),
});
const stories = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/stories' }),
  schema: z.object({
    produce: reference('produce'),
    title: z.string(),
    sources: z.array(source),
    reviewedAt: dateSchema,
  }),
});
export const collections = { produce, nutrition, stories };
