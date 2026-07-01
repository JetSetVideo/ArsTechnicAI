/**
 * ProjectService — project lifecycle operations as a pure service layer.
 * Decoupled from React; safe to call from API routes, hooks, or server actions.
 */

import { bus } from '@/lib/events/bus';

export interface ProjectSnapshot {
  id: string;
  name: string;
  canvasState: unknown;
  createdAt: number;
}

export class ProjectService {
  async create(name: string, metadata: Record<string, unknown> = {}): Promise<{ id: string }> {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, ...metadata }),
    });
    if (!res.ok) throw new Error(`Failed to create project: ${res.statusText}`);
    const data = await res.json();
    const id: string = data?.data?.id ?? data?.id;
    bus.emit('project:created', { projectId: id, name });
    return { id };
  }

  async update(projectId: string, fields: Record<string, unknown>): Promise<void> {
    const res = await fetch(`/api/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
    if (!res.ok) throw new Error(`Failed to update project: ${res.statusText}`);
    bus.emit('project:updated', { projectId, fields: Object.keys(fields) });
  }

  async delete(projectId: string): Promise<void> {
    const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Failed to delete project: ${res.statusText}`);
    bus.emit('project:deleted', { projectId });
  }

  async save(projectId: string, name: string, trigger: 'manual' | 'auto' | 'generate' = 'manual'): Promise<void> {
    bus.emit('project:saved', { projectId, trigger });
    const res = await fetch(`/api/projects/${projectId}/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trigger: trigger.toUpperCase() }),
    });
    if (!res.ok) console.warn(`[ProjectService] Version snapshot failed: ${res.statusText}`);
  }
}

export const projectService = new ProjectService();
