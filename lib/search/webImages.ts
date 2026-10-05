export interface WebImageHit {
  title: string;
  thumbnail: string;
  page: string;
}

const RESULT_LIMIT = 8;

function decodeEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

/**
 * First images from a Bing image-results page.
 * Google's image page answers scripted fetches with a script wall, so the
 * menu uses this page's thumbnails and stays inside the search control.
 */
export function parseBingImages(html: string, limit = RESULT_LIMIT): WebImageHit[] {
  const hits: WebImageHit[] = [];
  const seen = new Set<string>();
  const pattern = / m="(\{.*?\})"/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) && hits.length < limit) {
    let data: { t?: string; turl?: string; purl?: string; murl?: string };
    try {
      data = JSON.parse(decodeEntities(match[1])) as typeof data;
    } catch {
      continue;
    }
    const thumbnail = data.turl || '';
    const page = data.purl || data.murl || '';
    if (!thumbnail.startsWith('https://') || seen.has(thumbnail)) continue;
    seen.add(thumbnail);
    hits.push({
      title: (data.t || 'Image').replace(/\s+/g, ' ').trim(),
      thumbnail,
      page: page.startsWith('http') ? page : '',
    });
  }
  return hits;
}

export async function fetchWebImages(query: string, limit = RESULT_LIMIT): Promise<WebImageHit[]> {
  const q = query.trim().slice(0, 180);
  if (!q) return [];
  const url = `https://www.bing.com/images/search?q=${encodeURIComponent(q)}&form=HDRSC2&first=1`;
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return [];
  const html = await response.text();
  return parseBingImages(html, limit);
}
