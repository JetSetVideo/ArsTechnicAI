import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';

const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = parseInt(process.env.EMBEDDING_DIMENSIONS || '1536');

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

export async function generateEmbedding(text: string): Promise<number[] | null> {
  const client = getOpenAIClient();
  if (!client) return null;

  try {
    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
      dimensions: EMBEDDING_DIMENSIONS,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('Embedding generation failed:', error);
    return null;
  }
}

export function buildEmbeddingText(asset: {
  name: string;
  prompt?: string | null;
  negativePrompt?: string | null;
  tags?: Array<{ tag: { name: string } }>;
}): string {
  const parts = [asset.name];
  if (asset.prompt) parts.push(asset.prompt);
  if (asset.negativePrompt) parts.push(`negative: ${asset.negativePrompt}`);
  if (asset.tags) {
    parts.push(asset.tags.map((t) => t.tag.name).join(', '));
  }
  return parts.join(' | ');
}

export async function updateAssetEmbedding(assetId: string): Promise<void> {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    include: { tags: { include: { tag: true } } },
  });
  if (!asset) return;

  const text = buildEmbeddingText(asset);
  const embedding = await generateEmbedding(text);
  if (!embedding) return;

  // Use raw SQL since Prisma doesn't natively handle vector type writes
  await prisma.$executeRawUnsafe(
    `UPDATE assets SET embedding = $1::vector WHERE id = $2`,
    `[${embedding.join(',')}]`,
    assetId
  );
}

export async function searchByVector(
  queryEmbedding: number[],
  userId: string,
  limit = 20
): Promise<Array<{ id: string; name: string; distance: number }>> {
  const vectorStr = `[${queryEmbedding.join(',')}]`;
  const results = await prisma.$queryRawUnsafe<
    Array<{ id: string; name: string; distance: number }>
  >(
    `SELECT id, name, (embedding <=> $1::vector) as distance
     FROM assets
     WHERE user_id = $2 AND embedding IS NOT NULL
     ORDER BY embedding <=> $1::vector
     LIMIT $3`,
    vectorStr,
    userId,
    limit
  );
  return results;
}
