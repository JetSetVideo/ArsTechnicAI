import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useProjectStore } from '@/stores/projectStore';

export interface DbAsset {
  id: string;
  name: string;
  type: string;
  status: string;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  thumbnailPath: string | null;
  prompt: string | null;
  provider: string | null;
  model: string | null;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
}

export function useAssetLibrary() {
  const { data: session } = useSession();
  const { projectId } = useProjectStore();
  const [assets, setAssets] = useState<DbAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session?.user) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ pageSize: '60' });
      if (projectId) params.set('projectId', projectId);
      const res = await fetch(`/api/assets?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { data } = await res.json();
      setAssets(data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load assets');
    } finally {
      setLoading(false);
    }
  }, [session?.user, projectId]);

  useEffect(() => {
    if (session?.user) {
      refresh();
    } else {
      setAssets([]);
    }
  }, [session?.user, projectId, refresh]);

  return { assets, loading, error, refresh };
}
