/**
 * Typed Domain Event Bus
 * Cross-cutting publish/subscribe for generation, project, sync, health, and error events.
 * Pattern: CQRS domain events — fire-and-forget; no return values.
 */

// ── Domain event payload map ───────────────────────────────────────────────────
export interface DomainEventMap {
  // Generation lifecycle
  'generation:started':   { jobId: string; prompt: string; width: number; height: number; model: string };
  'generation:completed': { jobId: string; assetId?: string; seed?: number; filePath?: string };
  'generation:failed':    { jobId: string; error: string };
  'generation:cancelled': { jobId: string };

  // Canvas mutations
  'canvas:item:added':    { itemId: string; type: string; projectId?: string };
  'canvas:item:removed':  { itemId: string; projectId?: string };
  'canvas:item:updated':  { itemId: string; fields: string[] };
  'canvas:cleared':       { projectId?: string };

  // Project lifecycle
  'project:created':      { projectId: string; name: string };
  'project:updated':      { projectId: string; fields: string[] };
  'project:deleted':      { projectId: string };
  'project:opened':       { projectId: string; name: string };
  'project:saved':        { projectId: string; trigger: 'manual' | 'auto' | 'generate' };
  'project:version:restored': { projectId: string; versionId: string; versionNum: number };

  // Asset lifecycle
  'asset:added':          { assetId: string; type: string; projectId?: string };
  'asset:deleted':        { assetId: string };
  'asset:relation:added': { sourceId: string; targetId: string; relationType: string };

  // Sync & persistence
  'sync:workspace:started':   { projectId: string };
  'sync:workspace:completed': { projectId: string };
  'sync:workspace:failed':    { projectId: string; error: string };
  'sync:disk:saved':          { path: string };

  // Publish pipeline
  'publish:queued':   { platform: string; jobId: string };
  'publish:posted':   { platform: string; postId: string };
  'publish:failed':   { platform: string; error: string };

  // Auth
  'auth:signed:in':  { userId: string };
  'auth:signed:out': Record<string, never>;

  // Health & errors
  'health:api:ok':       { provider: string; latencyMs: number };
  'health:api:degraded': { provider: string; error: string };
  'error:panel':         { panelName: string; error: string; stack?: string };
}

export type DomainEventType = keyof DomainEventMap;

type Handler<T extends DomainEventType> = (payload: DomainEventMap[T]) => void;

// ── Bus implementation ─────────────────────────────────────────────────────────
class EventBus {
  private listeners = new Map<string, Set<Handler<any>>>();

  emit<T extends DomainEventType>(type: T, payload: DomainEventMap[T]): void {
    const handlers = this.listeners.get(type);
    if (!handlers) return;
    for (const handler of handlers) {
      try { handler(payload); } catch { /* individual handler failures are isolated */ }
    }
  }

  on<T extends DomainEventType>(type: T, handler: Handler<T>): () => void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(handler as Handler<any>);
    return () => this.off(type, handler);
  }

  off<T extends DomainEventType>(type: T, handler: Handler<T>): void {
    this.listeners.get(type)?.delete(handler as Handler<any>);
  }

  once<T extends DomainEventType>(type: T, handler: Handler<T>): void {
    const wrapped: Handler<T> = (payload) => {
      handler(payload);
      this.off(type, wrapped);
    };
    this.on(type, wrapped);
  }

  listenerCount(type: DomainEventType): number {
    return this.listeners.get(type)?.size ?? 0;
  }
}

export const bus = new EventBus();
