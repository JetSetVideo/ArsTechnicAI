import { v4 as uuidv4 } from 'uuid';
import type { ActionLogEntry } from '@/types';

/** Full-detail entries kept per project before older ones get folded. */
export const RECENT_WINDOW = 200;

function dayKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

function digestGroupKey(projectId: string | undefined, type: string, day: string): string {
  return `${projectId ?? 'none'}::${type}::${day}`;
}

/**
 * Compresses one project's history: keeps the most recent `RECENT_WINDOW`
 * full-detail entries untouched, and folds everything older into per-day,
 * per-action-type digest entries (count + a few representative samples)
 * instead of discarding them outright. Pre-existing digests for the same
 * project/type/day are merged (counts accumulate) rather than duplicated,
 * so repeated compression passes stay bounded.
 *
 * `allEntries` may contain other projects' entries too — those pass through
 * unchanged; only entries matching `projectId` are considered for folding.
 */
export function compressProjectHistory(
  allEntries: ActionLogEntry[],
  projectId: string | undefined,
): ActionLogEntry[] {
  const other = allEntries.filter((e) => e.projectId !== projectId);
  const mine = allEntries.filter((e) => e.projectId === projectId);

  const digests = mine.filter((e) => e.isDigest);
  const raw = mine.filter((e) => !e.isDigest); // newest-first, per logStore's insertion order

  if (raw.length <= RECENT_WINDOW) return allEntries;

  const keep = raw.slice(0, RECENT_WINDOW);
  const overflow = raw.slice(RECENT_WINDOW);

  const groups = new Map<string, ActionLogEntry[]>();
  for (const entry of overflow) {
    const key = digestGroupKey(projectId, entry.type, dayKey(entry.timestamp));
    const bucket = groups.get(key);
    if (bucket) bucket.push(entry);
    else groups.set(key, [entry]);
  }

  const byDigestKey = new Map<string, ActionLogEntry>();
  for (const d of digests) {
    byDigestKey.set(digestGroupKey(d.projectId, d.type, dayKey(d.digestPeriodStart ?? d.timestamp)), d);
  }

  for (const [key, group] of groups) {
    const timestamps = group.map((g) => g.timestamp);
    const periodStart = Math.min(...timestamps);
    const periodEnd = Math.max(...timestamps);
    const type = group[0].type;
    const existing = byDigestKey.get(key);
    const count = (existing?.digestCount ?? 0) + group.length;
    const mergedStart = Math.min(existing?.digestPeriodStart ?? periodStart, periodStart);
    const mergedEnd = Math.max(existing?.digestPeriodEnd ?? periodEnd, periodEnd);
    const samples = [
      ...((existing?.data?.samples as { description: string; timestamp: number }[] | undefined) ?? []),
      ...group.slice(0, 3).map((g) => ({ description: g.description, timestamp: g.timestamp })),
    ].slice(0, 3);

    byDigestKey.set(key, {
      id: existing?.id ?? uuidv4(),
      type,
      timestamp: mergedEnd,
      description: `${count}× ${type.replace(/_/g, ' ')} on ${dayKey(mergedStart)}`,
      data: { samples },
      undoable: false,
      projectId,
      isDigest: true,
      digestCount: count,
      digestPeriodStart: mergedStart,
      digestPeriodEnd: mergedEnd,
    });
  }

  const mergedDigests = Array.from(byDigestKey.values()).sort((a, b) => b.timestamp - a.timestamp);
  return [...other, ...keep, ...mergedDigests].sort((a, b) => b.timestamp - a.timestamp);
}
