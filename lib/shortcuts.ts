/** `mod` is ⌘ on macOS and Ctrl elsewhere. */
export function matchShortcut(event: KeyboardEvent, shortcut: string): boolean {
  const parts = shortcut.toLowerCase().split('+').map((part) => part.trim()).filter(Boolean);
  const key = parts.pop() ?? '';
  const wantsMod = parts.some((part) => part === 'mod' || part === 'meta' || part === 'cmd' || part === 'ctrl');
  const wantsShift = parts.includes('shift');
  const wantsAlt = parts.includes('alt');
  const mod = event.metaKey || event.ctrlKey;
  if (wantsMod !== mod || wantsShift !== event.shiftKey || wantsAlt !== event.altKey) return false;
  return event.key.toLowerCase() === key;
}

export function formatShortcut(shortcut: string): string {
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform);
  return shortcut.split('+').map((part) => {
    const token = part.trim().toLowerCase();
    if (token === 'mod') return mac ? '⌘' : 'Ctrl';
    if (token === 'shift') return mac ? '⇧' : 'Shift';
    if (token === 'alt') return mac ? '⌥' : 'Alt';
    if (token === ' ') return 'Space';
    return token.length === 1 ? token.toUpperCase() : token;
  }).join(mac ? '' : '+');
}

export function shortcutFromEvent(event: KeyboardEvent): string | null {
  if (event.key === 'Escape') return null;
  if (event.key === 'Shift' || event.key === 'Control' || event.key === 'Alt' || event.key === 'Meta') return null;
  const parts: string[] = [];
  if (event.metaKey || event.ctrlKey) parts.push('mod');
  if (event.altKey) parts.push('alt');
  if (event.shiftKey) parts.push('shift');
  parts.push(event.key.length === 1 ? event.key.toLowerCase() : event.key.toLowerCase());
  return parts.join('+');
}
