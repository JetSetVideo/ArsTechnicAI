// ============================================================
// ARS TECHNICAI — Workflow Queue System
// ComfyUI-inspired: enqueue multiple prompt/param sets,
// process them through a workflow graph sequentially,
// track progress per job, support cancel/retry.
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import type { ExecutionGraph, GraphExecutionResult } from './graph-executor';
import { executeGraph, validateGraph } from './graph-executor';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface QueueJob {
  id: string;
  name: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  graph: ExecutionGraph;
  paramOverrides: Record<string, Record<string, unknown>>; // nodeId → param overrides
  result?: GraphExecutionResult;
  error?: string;
  progress: number;       // 0-100
  currentNodeId?: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  priority: number;       // 0-10, higher = first
}

export interface QueueState {
  jobs: QueueJob[];
  isProcessing: boolean;
  currentJobId?: string;
  maxConcurrent: number;
  paused: boolean;
}

export interface QueueStats {
  total: number;
  queued: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
  averageDurationMs: number;
  estimatedTimeRemainingMs: number;
}

// ─── Queue Implementation ──────────────────────────────────────────────────

export class WorkflowQueue {
  private jobs: QueueJob[] = [];
  private isProcessing = false;
  private currentJobId: string | null = null;
  private maxConcurrent = 1;
  private paused = false;
  private abortController: AbortController | null = null;
  private listeners: Set<(state: QueueState) => void> = new Set();

  /** Subscribe to queue state changes */
  subscribe(fn: (state: QueueState) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    const state = this.getState();
    for (const fn of this.listeners) fn(state);
  }

  getState(): QueueState {
    return {
      jobs: [...this.jobs],
      isProcessing: this.isProcessing,
      currentJobId: this.currentJobId ?? undefined,
      maxConcurrent: this.maxConcurrent,
      paused: this.paused,
    };
  }

  getStats(): QueueStats {
    const completed = this.jobs.filter(j => j.status === 'completed');
    const totalDuration = completed.reduce((s, j) => s + (j.completedAt || 0) - (j.startedAt || 0), 0);
    const avgDuration = completed.length > 0 ? totalDuration / completed.length : 0;
    
    // Estimate remaining time based on average
    const pending = this.jobs.filter(j => j.status === 'queued').length;
    const estimatedRemaining = avgDuration * pending;

    return {
      total: this.jobs.length,
      queued: this.jobs.filter(j => j.status === 'queued').length,
      running: this.jobs.filter(j => j.status === 'running').length,
      completed: completed.length,
      failed: this.jobs.filter(j => j.status === 'failed').length,
      cancelled: this.jobs.filter(j => j.status === 'cancelled').length,
      averageDurationMs: Math.round(avgDuration),
      estimatedTimeRemainingMs: Math.round(estimatedRemaining),
    };
  }

  /** Add one or more jobs to the queue */
  enqueue(
    graph: ExecutionGraph,
    paramOverrides: Record<string, Record<string, unknown>> = {},
    name?: string,
    priority = 0,
  ): string {
    // Validate graph first
    const validation = validateGraph(graph);
    if (!validation.valid) {
      throw new Error(`Invalid workflow: ${validation.errors.join('; ')}`);
    }

    const job: QueueJob = {
      id: uuidv4(),
      name: name || `Job ${this.jobs.length + 1}`,
      status: 'queued',
      graph,
      paramOverrides,
      progress: 0,
      createdAt: Date.now(),
      priority,
    };

    this.jobs.push(job);
    // Sort by priority (descending) then creation time
    this.jobs.sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt);
    this.notify();

    // Auto-start if not already processing
    if (!this.isProcessing && !this.paused) {
      this.processNext();
    }

    return job.id;
  }

  /** Enqueue multiple jobs at once (batch) */
  enqueueBatch(
    items: Array<{
      graph: ExecutionGraph;
      paramOverrides?: Record<string, Record<string, unknown>>;
      name?: string;
      priority?: number;
    }>,
  ): string[] {
    return items.map(item =>
      this.enqueue(item.graph, item.paramOverrides || {}, item.name, item.priority || 0)
    );
  }

  /** Cancel a specific job */
  cancelJob(jobId: string): boolean {
    const job = this.jobs.find(j => j.id === jobId);
    if (!job) return false;

    if (job.status === 'running') {
      this.abortController?.abort();
      job.status = 'cancelled';
    } else if (job.status === 'queued') {
      job.status = 'cancelled';
    }
    this.notify();
    return true;
  }

  /** Retry a failed job */
  retryJob(jobId: string): boolean {
    const job = this.jobs.find(j => j.id === jobId);
    if (!job || job.status !== 'failed') return false;

    job.status = 'queued';
    job.progress = 0;
    job.error = undefined;
    job.result = undefined;
    this.notify();

    if (!this.isProcessing && !this.paused) {
      this.processNext();
    }
    return true;
  }

  /** Pause processing */
  pause(): void {
    this.paused = true;
    this.notify();
  }

  /** Resume processing */
  resume(): void {
    this.paused = false;
    if (!this.isProcessing) {
      this.processNext();
    }
    this.notify();
  }

  /** Clear all completed/cancelled jobs */
  clearCompleted(): void {
    this.jobs = this.jobs.filter(j => j.status === 'queued' || j.status === 'running' || j.status === 'failed');
    this.notify();
  }

  /** Clear entire queue */
  clearAll(): void {
    this.abortController?.abort();
    this.jobs = [];
    this.isProcessing = false;
    this.currentJobId = null;
    this.notify();
  }

  /** Get a job by ID */
  getJob(jobId: string): QueueJob | undefined {
    return this.jobs.find(j => j.id === jobId);
  }

  // ─── Internal processing ────────────────────────────────────────────────

  private async processNext(): Promise<void> {
    if (this.paused || this.isProcessing) return;

    const nextJob = this.jobs.find(j => j.status === 'queued');
    if (!nextJob) {
      this.isProcessing = false;
      this.currentJobId = null;
      this.notify();
      return;
    }

    this.isProcessing = true;
    this.currentJobId = nextJob.id;
    nextJob.status = 'running';
    nextJob.startedAt = Date.now();
    this.notify();

    this.abortController = new AbortController();

    try {
      // Apply param overrides to graph nodes
      const graph = nextJob.graph;
      for (const node of graph.nodes) {
        const overrides = nextJob.paramOverrides[node.id];
        if (overrides) {
          node.params = { ...node.params, ...overrides };
        }
      }

      // Execute the graph
      const result = await executeGraph(
        graph,
        (nodeId, progress, status) => {
          nextJob.currentNodeId = nodeId;
          nextJob.progress = Math.min(99, progress);
          this.notify();
        },
        this.abortController.signal,
      );

      nextJob.result = result;
      nextJob.status = result.errorCount === 0 ? 'completed' : 'failed';
      if (result.errorCount > 0) {
        nextJob.error = `${result.errorCount} node(s) failed`;
      }
      nextJob.progress = 100;
      nextJob.completedAt = Date.now();

    } catch (err) {
      nextJob.status = 'failed';
      nextJob.error = err instanceof Error ? err.message : String(err);
      nextJob.completedAt = Date.now();
    }

    this.isProcessing = false;
    this.currentJobId = null;
    this.notify();

    // Process next job in queue
    this.processNext();
  }
}

// ─── Singleton instance ───────────────────────────────────────────────────

let _queueInstance: WorkflowQueue | null = null;

export function getWorkflowQueue(): WorkflowQueue {
  if (!_queueInstance) {
    _queueInstance = new WorkflowQueue();
  }
  return _queueInstance;
}

export function resetWorkflowQueue(): void {
  _queueInstance?.clearAll();
  _queueInstance = null;
}
