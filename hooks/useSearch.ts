import { useState, useCallback, useRef } from 'react';

interface SearchResult {
  id: string;
  name: string;
  type: string;
  thumbnailPath: string | null;
  prompt: string | null;
  score: number;
  source: string;
}

export function useSearch() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    // Cancel previous request
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setIsSearching(true);
    try {
      const resp = await fetch(
        `/api/assets/search?q=${encodeURIComponent(query)}&limit=20`,
        { signal: abortRef.current.signal }
      );
      const json = await resp.json();
      if (json.success) {
        setResults(json.data);
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Search failed:', error);
      }
    } finally {
      setIsSearching(false);
    }
  }, []);

  const clear = useCallback(() => {
    setResults([]);
    if (abortRef.current) abortRef.current.abort();
  }, []);

  return { results, isSearching, search, clear };
}
