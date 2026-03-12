import { prisma } from '@/lib/prisma';

export async function searchFullText(
  query: string,
  userId: string,
  limit = 20
): Promise<Array<{ id: string; name: string; rank: number }>> {
  const results = await prisma.$queryRawUnsafe<
    Array<{ id: string; name: string; rank: number }>
  >(
    `SELECT id, name,
       ts_rank(
         to_tsvector('english', coalesce(name, '') || ' ' || coalesce(prompt, '') || ' ' || coalesce(original_filename, '')),
         plainto_tsquery('english', $1)
       ) as rank
     FROM assets
     WHERE user_id = $2
       AND to_tsvector('english', coalesce(name, '') || ' ' || coalesce(prompt, '') || ' ' || coalesce(original_filename, ''))
           @@ plainto_tsquery('english', $1)
     ORDER BY rank DESC
     LIMIT $3`,
    query,
    userId,
    limit
  );
  return results;
}
