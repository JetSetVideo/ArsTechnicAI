/** Nano Banana 2 first, then the other Gemini image models still on the API. */
export const BANANA_IMAGE_MODELS = [
  'gemini-3.1-flash-image',
  'gemini-3-pro-image',
  'gemini-3.1-flash-lite-image',
  'gemini-2.5-flash-image',
] as const;

export const BANANA_TEXT_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
] as const;

/** A missing or retired model should fall through to the next candidate. */
export function isUnavailableModelError(status: number, message: string): boolean {
  if (status === 404) return true;
  const lower = message.toLowerCase();
  return (
    lower.includes('not found')
    || lower.includes('not available')
    || lower.includes('not supported')
    || lower.includes('is not supported for generatecontent')
  );
}

/** Prefer current Nano Banana ids discovered from ListModels, skipping ones already tried. */
export function rankDiscoveredImageModels(ids: string[], alreadyTried: string[]): string[] {
  const seen = new Set(alreadyTried);
  const fresh = ids.filter((id) => {
    if (!id || seen.has(id) || !/image/i.test(id)) return false;
    seen.add(id);
    return true;
  });
  const score = (id: string) => {
    if (id === 'gemini-3.1-flash-image') return 0;
    if (id.includes('3.1-flash-image')) return 1;
    if (id.includes('3-pro-image') && !id.includes('preview')) return 2;
    if (id.includes('flash-lite-image')) return 3;
    if (id.includes('2.5-flash-image')) return 4;
    if (id.includes('preview')) return 9;
    return 5;
  };
  return fresh.sort((a, b) => score(a) - score(b) || a.localeCompare(b));
}

/** Text models only. Image, speech, and live models are left out. */
export function rankDiscoveredTextModels(ids: string[], alreadyTried: string[]): string[] {
  const seen = new Set(alreadyTried);
  const fresh = ids.filter((id) => {
    if (!id || seen.has(id)) return false;
    if (/image|tts|live|transcribe|embed|aqa/i.test(id)) return false;
    if (!/^gemini-3(\.|-)/.test(id)) return false;
    seen.add(id);
    return true;
  });
  const score = (id: string) => {
    if (id === 'gemini-3.8-flash') return 0;
    if (id.startsWith('gemini-3.7-flash')) return 1;
    if (id.startsWith('gemini-3.6-flash')) return 2;
    if (id.startsWith('gemini-3.5-flash') && !id.includes('lite')) return 3;
    if (id.includes('preview')) return 8;
    return 5;
  };
  return fresh.sort((a, b) => score(a) - score(b) || a.localeCompare(b));
}
