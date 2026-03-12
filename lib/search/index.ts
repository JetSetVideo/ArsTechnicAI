import { prisma } from '@/lib/prisma';
import { generateEmbedding } from './vector';
import { searchFullText } from './fulltext';

const TEXT_WEIGHT = 0.4;
const VECTOR_WEIGHT = 0.6;

interface SearchResult {
  id: string;
  name: string;
  type: string;
  thumbnailPath: string | null;
  prompt: string | null;
  score: number;
  source: 'prefix' | 'fulltext' | 'vector' | 'combined';
}

export async function unifiedSearch(
  query: string,
  userId: string,
  limit = 20
): Promise<SearchResult[]> {
  const results = new Map<string, SearchResult>();

  // 1. ILIKE prefix match (instant, no cost)
  const prefixResults = await prisma.asset.findMany({
    where: {
      userId,
      OR: [
        { name: { startsWith: query, mode: 'insensitive' } },
        { prompt: { startsWith: query, mode: 'insensitive' } },
      ],
    },
    take: limit,
    select: { id: true, name: true, type: true, thumbnailPath: true, prompt: true },
  });

  for (const r of prefixResults) {
    results.set(r.id, { ...r, score: 0.5, source: 'prefix' });
  }

  // 2. Full-text search
  try {
    const ftResults = await searchFullText(query, userId, limit);
    for (const r of ftResults) {
      const existing = results.get(r.id);
      const ftScore = Math.min(r.rank, 1);
      if (existing) {
        existing.score = Math.max(existing.score, ftScore * TEXT_WEIGHT);
        existing.source = 'combined';
      } else {
        results.set(r.id, {
          id: r.id,
          name: r.name,
          type: 'unknown',
          thumbnailPath: null,
          prompt: null,
          score: ftScore * TEXT_WEIGHT,
          source: 'fulltext',
        });
      }
    }
  } catch {
    // Full-text search failure is non-fatal
  }

  // 3. Vector search (if OpenAI API key is available)
  try {
    const queryEmbedding = await generateEmbedding(query);
    if (queryEmbedding) {
      const vectorStr = `[${queryEmbedding.join(',')}]`;
      const vecResults = await prisma.$queryRawUnsafe<
        Array<{ id: string; name: string; type: string; thumbnail_path: string | null; prompt: string | null; distance: number }>
      >(
        `SELECT id, name, type::text, thumbnail_path, prompt, (embedding <=> $1::vector) as distance
         FROM assets
         WHERE user_id = $2 AND embedding IS NOT NULL
         ORDER BY embedding <=> $1::vector
         LIMIT $3`,
        vectorStr,
        userId,
        limit
      );

      for (const r of vecResults) {
        const vecScore = Math.max(0, 1 - r.distance); // cosine similarity
        const existing = results.get(r.id);
        if (existing) {
          existing.score += vecScore * VECTOR_WEIGHT;
          existing.source = 'combined';
        } else {
          results.set(r.id, {
            id: r.id,
            name: r.name,
            type: r.type,
            thumbnailPath: r.thumbnail_path,
            prompt: r.prompt,
            score: vecScore * VECTOR_WEIGHT,
            source: 'vector',
          });
        }
      }
    }
  } catch {
    // Vector search failure is non-fatal
  }

  // Sort by score descending, take limit
  return [...results.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
