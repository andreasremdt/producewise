import { getCollection } from 'astro:content';
export async function GET() {
  const entries = await getCollection('produce');
  return new Response(
    JSON.stringify(
      entries.map(({ id, data: p }) => ({
        id,
        name: p.name,
        aliases: p.aliases,
        tags: p.tags,
        category: p.category,
        url: `/produce/${p.slug}/`,
      })),
    ),
    { headers: { 'Content-Type': 'application/json' } },
  );
}
