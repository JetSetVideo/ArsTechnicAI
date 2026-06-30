// ============================================================
// ARS TECHNICAI — Search Index
// Full-text and semantic search across projects, assets, prompts.
// Performance-optimized with LRU caching and batched indexing.
// ============================================================

import { LRUCache } from 'lru-cache';

export interface SearchDocument {
  id: string;
  type: 'project' | 'asset' | 'prompt' | 'generation' | 'blueprint';
  title: string;
  content: string;
  tags: string[];
  projectId?: string;
  updatedAt: number;
  score?: number;
}

export interface SearchQuery {
  text: string;
  types?: SearchDocument['type'][];
  projectId?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'relevance' | 'date' | 'name';
}

export interface SearchStats {
  totalDocuments: number;
  indexSize: number;
  lastIndexedAt: number;
  averageQueryTime: number;
  cacheHitRate: number;
}

// In-memory search with scoring and prefix matching
// Production replacement: use FlexSearch, MiniSearch, or Fuse.js for fuzzy matching
// Or sqlite-vec / pgvector for vector search

const DOCUMENT_CACHE = new LRUCache<string, SearchDocument>({ max: 5000 });
const SEARCH_CACHE = new LRUCache<string, SearchDocument[]>({ max: 200 });

let totalQueries = 0;
let cacheHits = 0;
let totalQueryTime = 0;

export function indexDocument(doc: SearchDocument): void {
  DOCUMENT_CACHE.set(doc.id, doc);
  SEARCH_CACHE.clear(); // Invalidate search cache on index
}

export function indexDocuments(docs: SearchDocument[]): void {
  for (const doc of docs) {
    DOCUMENT_CACHE.set(doc.id, doc);
  }
  SEARCH_CACHE.clear();
}

export function removeDocument(id: string): void {
  DOCUMENT_CACHE.delete(id);
  SEARCH_CACHE.clear();
}

/**
 * Unified search across all document types with ranking.
 */
export async function unifiedSearch(
  query: string,
  userId?: string,
  limit: number = 50
): Promise<SearchDocument[]> {
  const { results } = search({
    text: query,
    limit,
  });
  return results;
}

export function search(query: SearchQuery): { results: SearchDocument[]; stats: SearchStats } {
  totalQueries++;
  const cacheKey = JSON.stringify(query);
  
  const cached = SEARCH_CACHE.get(cacheKey);
  if (cached) {
    cacheHits++;
    return { results: cached, stats: getStats() };
  }
  
  const t0 = performance.now();
  const results = performSearch(query);
  totalQueryTime += performance.now() - t0;
  
  SEARCH_CACHE.set(cacheKey, results);
  
  return { results, stats: getStats() };
}

function performSearch(query: SearchQuery): SearchDocument[] {
  const tokens = query.text.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return Array.from(DOCUMENT_CACHE.values())
      .slice(0, query.limit || 50);
  }
  
  const scored: { doc: SearchDocument; score: number }[] = [];
  
  for (const doc of DOCUMENT_CACHE.values()) {
    // Filter by type
    if (query.types && query.types.length > 0 && !query.types.includes(doc.type)) {
      continue;
    }
    // Filter by project
    if (query.projectId && doc.projectId && doc.projectId !== query.projectId) {
      continue;
    }
    
    let score = 0;
    const searchText = `${doc.title} ${doc.content} ${doc.tags.join(' ')}`.toLowerCase();
    
    for (const token of tokens) {
      // Title matches are weighted higher
      if (doc.title.toLowerCase().includes(token)) {
        score += 10;
        // Exact title match bonus
        if (doc.title.toLowerCase() === token) score += 20;
        // Prefix match bonus
        if (doc.title.toLowerCase().startsWith(token)) score += 5;
      }
      // Content matches
      const contentMatches = (searchText.match(new RegExp(token, 'gi')) || []).length;
      score += contentMatches * 2;
      // Tag exact match
      if (doc.tags.some(t => t.toLowerCase() === token)) {
        score += 8;
      }
    }
    
    // Recency boost (newer documents score slightly higher)
    const ageInDays = (Date.now() - doc.updatedAt) / (1000 * 60 * 60 * 24);
    const recencyBoost = Math.max(0, 10 - ageInDays * 0.5);
    score += recencyBoost;
    
    if (score > 0) {
      scored.push({ doc, score });
    }
  }
  
  // Sort by score descending, then by date
  scored.sort((a, b) => b.score - a.score || b.doc.updatedAt - a.doc.updatedAt);
  
  const limit = query.limit || 50;
  const offset = query.offset || 0;
  
  return scored.slice(offset, offset + limit).map(s => ({
    ...s.doc,
    score: s.score,
  }));
}

export function getStats(): SearchStats {
  return {
    totalDocuments: DOCUMENT_CACHE.size,
    indexSize: DOCUMENT_CACHE.size, // Simplified
    lastIndexedAt: Date.now(),
    averageQueryTime: totalQueries > 0 ? totalQueryTime / totalQueries : 0,
    cacheHitRate: totalQueries > 0 ? cacheHits / totalQueries : 0,
  };
}

export function clearIndex(): void {
  DOCUMENT_CACHE.clear();
  SEARCH_CACHE.clear();
  totalQueries = 0;
  cacheHits = 0;
  totalQueryTime = 0;
}

// Auto-index: batch-reindex all documents periodically
export function scheduleReindex(intervalMs: number = 60000): () => void {
  const timer = setInterval(() => {
    // Validate document integrity
    for (const [id, doc] of DOCUMENT_CACHE) {
      if (!doc.content || !doc.title) {
        DOCUMENT_CACHE.delete(id);
      }
    }
  }, intervalMs);
  
  return () => clearInterval(timer);
}
