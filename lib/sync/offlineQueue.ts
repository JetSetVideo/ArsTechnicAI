/**
 * Offline Queue — buffers actions taken while the server is unreachable
 * and replays them automatically when connectivity is restored.
 *
 * Works entirely in localStorage so nothing is lost on page refresh.
 */

const QUEUE_KEY = 'ars:offline-queue';
const MAX_QUEUE_SIZE = 200;
const MAX_RETRIES = 5;

export type QueueItemType =
  | 'canvas_save'
  | 'asset_upload'
  | 'project_create'
  | 'project_update'
  | 'version_save';

export interface QueueItem {
  id: string;
  type: QueueItemType;
  projectId: string;
  payload: unknown;
  createdAt: number;
  retries: number;
  lastAttempt?: number;
}

// ── Local storage helpers ─────────────────────────────────────────────────────

function readQueue(): QueueItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as QueueItem[];
  } catch {
    return [];
  }
}

function writeQueue(items: QueueItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items.slice(0, MAX_QUEUE_SIZE)));
  } catch {
    // localStorage quota — drop oldest entries
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(items.slice(-50)));
    } catch { /* non-fatal */ }
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Enqueue an action to be replayed when the server is available. */
export function enqueueSync(
  item: Pick<QueueItem, 'type' | 'projectId' | 'payload'>
): void {
  const queue = readQueue();
  const newItem: QueueItem = {
    ...item,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
    retries: 0,
  };

  // Deduplicate: for canvas_save, keep only the latest per project
  if (item.type === 'canvas_save') {
    const filtered = queue.filter(
      (q) => !(q.type === 'canvas_save' && q.projectId === item.projectId)
    );
    writeQueue([...filtered, newItem]);
  } else {
    writeQueue([...queue, newItem]);
  }
}

/** How many items are waiting. */
export function queueSize(): number {
  return readQueue().length;
}

/** True if there are pending items. */
export function hasPendingSync(): boolean {
  return readQueue().length > 0;
}

/**
 * Flush the queue — call this when the server is confirmed reachable.
 * Each item is attempted in order; failures are re-queued with a retry counter.
 */
export async function flushQueue(signal?: AbortSignal): Promise<{
  flushed: number;
  failed: number;
}> {
  if (typeof window === 'undefined') return { flushed: 0, failed: 0 };

  const queue = readQueue();
  if (queue.length === 0) return { flushed: 0, failed: 0 };

  let flushed = 0;
  let failed = 0;
  const remaining: QueueItem[] = [];

  for (const item of queue) {
    if (signal?.aborted) break;

    // Skip permanently failed items
    if (item.retries >= MAX_RETRIES) {
      failed++;
      continue;
    }

    const success = await replayItem(item, signal);

    if (success) {
      flushed++;
    } else {
      remaining.push({ ...item, retries: item.retries + 1, lastAttempt: Date.now() });
      failed++;
    }
  }

  writeQueue(remaining);
  return { flushed, failed };
}

/** Clear the entire queue (e.g., on sign-out or project delete). */
export function clearQueue(projectId?: string): void {
  if (!projectId) {
    writeQueue([]);
    return;
  }
  writeQueue(readQueue().filter((q) => q.projectId !== projectId));
}

// ── Item replay ───────────────────────────────────────────────────────────────

async function replayItem(item: QueueItem, signal?: AbortSignal): Promise<boolean> {
  try {
    switch (item.type) {
      case 'canvas_save':
        return replayCanvasSave(item, signal);
      case 'version_save':
        return replayVersionSave(item, signal);
      case 'project_create':
      case 'project_update':
        return replayProjectUpdate(item, signal);
      default:
        return false;
    }
  } catch {
    return false;
  }
}

async function replayCanvasSave(item: QueueItem, signal?: AbortSignal): Promise<boolean> {
  const res = await fetch(`/api/projects/${item.projectId}/canvas`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item.payload),
    signal,
  });
  return res.ok;
}

async function replayVersionSave(item: QueueItem, signal?: AbortSignal): Promise<boolean> {
  const res = await fetch(`/api/projects/${item.projectId}/versions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item.payload),
    signal,
  });
  return res.ok;
}

async function replayProjectUpdate(item: QueueItem, signal?: AbortSignal): Promise<boolean> {
  const res = await fetch(`/api/projects/${item.projectId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item.payload),
    signal,
  });
  return res.ok;
}
