// ============================================================
// ARS TECHNICAI — Batch Prompt Processor (COMFY-018)
// Queue multiple prompts through the same workflow.
// Textarea with one prompt per line, or CSV import.
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'gen.batch.prompts';

export interface BatchPromptJob {
  lineNumber: number;
  prompt: string;
  status: 'queued' | 'running' | 'done' | 'error';
  result?: string;
  error?: string;
  seed?: number;
  durationMs?: number;
}

export interface BatchResult {
  totalLines: number;
  validPrompts: number;
  skippedLines: number;    // empty or comment lines
  jobs: BatchPromptJob[];
  completedCount: number;
  errorCount: number;
  totalDurationMs: number;
}

export const moduleDef: ModuleDef = {
  id,
  name: 'Batch Prompt Processor',
  category: 'generate',
  description: 'Process multiple prompts in batch through the same generation workflow. Paste one prompt per line in a textarea, or import CSV. Each line becomes a queued job processed sequentially. Skip empty lines and comments (#).',
  inputs: [
    { id: 'prompts', label: 'Prompt Text (one per line)', type: 'text', direction: 'input' },
    { id: 'workflow', label: 'Workflow Graph', type: 'data', direction: 'input', optional: true },
  ],
  outputs: [
    { id: 'jobs', label: 'Batch Jobs', type: 'data', direction: 'output' },
    { id: 'results', label: 'Generation Results', type: 'data', direction: 'output' },
    { id: 'summary', label: 'Batch Summary', type: 'text', direction: 'output' },
  ],
  parameters: [
    { id: 'width', label: 'Image Width', type: 'number', default: 1024, min: 64, max: 2048, step: 64 },
    { id: 'height', label: 'Image Height', type: 'number', default: 1024, min: 64, max: 2048, step: 64 },
    { id: 'style', label: 'Style Suffix', type: 'string', default: '' },
    { id: 'negativePrompt', label: 'Global Negative Prompt', type: 'string', default: '' },
    { id: 'maxConcurrent', label: 'Max Concurrent', type: 'number', default: 2, min: 1, max: 4 },
    { id: 'skipComments', label: 'Skip # comments', type: 'boolean', default: true },
    { id: 'skipEmpty', label: 'Skip empty lines', type: 'boolean', default: true },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    const rawText = (ctx.inputs.prompts as string) || '';
    const style = (ctx.parameters.style as string) || '';
    const negativePrompt = (ctx.parameters.negativePrompt as string) || '';
    const width = (ctx.parameters.width as number) || 1024;
    const height = (ctx.parameters.height as number) || 1024;
    const skipComments = ctx.parameters.skipComments !== false;
    const skipEmpty = ctx.parameters.skipEmpty !== false;

    // Parse lines
    const lines = rawText.split('\n');
    const jobs: BatchPromptJob[] = [];
    let skippedLines = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip empty lines
      if (skipEmpty && !line) {
        skippedLines++;
        continue;
      }

      // Skip comments
      if (skipComments && (line.startsWith('#') || line.startsWith('//'))) {
        skippedLines++;
        continue;
      }

      // Build full prompt with style suffix
      let fullPrompt = line;
      if (style && !line.toLowerCase().includes(style.toLowerCase())) {
        fullPrompt = `${line}, ${style}`;
      }

      jobs.push({
        lineNumber: i + 1,
        prompt: fullPrompt,
        status: 'queued',
      });
    }

    // If no workflow provided, return parsed jobs for client-side processing
    if (!ctx.inputs.workflow) {
      return {
        outputs: {
          jobs,
          results: null,
          summary: `${jobs.length} prompts ready for generation. ${skippedLines} lines skipped. Call /api/generate for each.`,
        },
        metadata: {
          totalLines: lines.length,
          validPrompts: jobs.length,
          skippedLines,
          width,
          height,
        },
      };
    }

    // With workflow: queue through graph executor
    const { getWorkflowQueue } = await import('../workflow-queue');
    const queue = getWorkflowQueue();

    const jobIds: string[] = [];
    for (const job of jobs) {
      // Create param overrides for the prompt node in the graph
      const overrides: Record<string, Record<string, unknown>> = {};
      // Find prompt-typed nodes and override their prompt parameter
      const graph = ctx.inputs.workflow as any;
      for (const node of graph?.nodes || []) {
        if (node.moduleId?.includes('prompt') || node.moduleId?.includes('gen.image')) {
          overrides[node.id] = {
            prompt: job.prompt,
            negativePrompt,
            width,
            height,
          };
        }
      }

      try {
        const jid = queue.enqueue(
          ctx.inputs.workflow as any,
          overrides,
          `Batch line ${job.lineNumber}: ${job.prompt.slice(0, 40)}`,
        );
        jobIds.push(jid);
      } catch (err) {
        job.status = 'error';
        job.error = err instanceof Error ? err.message : String(err);
      }
    }

    return {
      outputs: {
        jobs,
        results: { jobIds, queued: jobIds.length },
        summary: `${jobIds.length} jobs queued. ${jobs.length - jobIds.length} failed to queue.`,
      },
      metadata: { totalLines: lines.length, validPrompts: jobs.length, skippedLines, queuedCount: jobIds.length },
    };
  },
};
