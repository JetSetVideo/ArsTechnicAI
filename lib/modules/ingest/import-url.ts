// ============================================================
// ARS TECHNICAI — URL Fetcher Module
// Phase 1: Fetch asset from URL
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'import.import.url';

export const moduleDef: ModuleDef = {
  id,
  name: 'URL Fetcher',
  category: 'ingest',
  description: 'Fetch an asset from a remote URL',
  library: 'fetch API',
  inputs: [
    { id: 'url', name: 'URL', type: 'text', required: true, description: 'Remote asset URL' },
  ],
  outputs: [
    { id: 'asset', name: 'Asset', type: 'data', description: 'Fetched Asset' },
    { id: 'blob', name: 'Blob', type: 'data', description: 'Raw Blob data' },
  ],
  parameters: [
    { id: 'headers', name: 'Headers', type: 'data', description: 'Optional fetch headers' },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    const url = ctx.inputs.url as string | undefined;
    if (!url) {
      return { outputs: {}, error: 'No URL provided' };
    }

    try {
      const response = await fetch(url, { headers: (ctx.params.headers as Record<string, string>) || {} });
      if (!response.ok) {
        return { outputs: {}, error: `HTTP ${response.status}: ${response.statusText}` };
      }

      const blob = await response.blob();
      const contentType = response.headers.get('content-type') || blob.type || 'application/octet-stream';
      const filename = url.split('/').pop() || 'download';

      return {
        outputs: {
          blob,
          asset: {
            id: `url-${Date.now()}`,
            name: filename,
            type: contentType.startsWith('image/') ? 'image' : contentType.startsWith('video/') ? 'video' : contentType.startsWith('audio/') ? 'audio' : 'text',
            path: url,
            createdAt: Date.now(),
            modifiedAt: Date.now(),
            metadata: { mimeType: contentType, size: blob.size, sourceUrl: url },
          },
        },
        logs: [`Fetched ${filename} (${(blob.size / 1024).toFixed(1)} KB)`],
      };
    } catch (err) {
      return { outputs: {}, error: `Fetch failed: ${err instanceof Error ? err.message : String(err)}` };
    }
  },
};
