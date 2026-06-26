import type { GenerationJob } from '@/types';
import type { ModelRun } from '@/types/production';
import type { ProviderUsageRecord, UsageStatsSnapshot } from '@/types/dashboard';
import type { PublishingAccount } from '@/types/dashboard';

interface UsageInput {
  sessionGenerations: number;
  sessionImports: number;
  sessionExports: number;
  generationJobs: GenerationJob[];
  modelRuns: ModelRun[];
  publishingAccounts: PublishingAccount[];
  /** Rough token estimate from prompt + generation log lengths */
  tokensEstimated?: number;
}

export function aggregateProviderUsage(
  jobs: GenerationJob[],
  modelRuns: ModelRun[]
): ProviderUsageRecord[] {
  const map = new Map<string, ProviderUsageRecord>();

  const bump = (provider: string, model: string, at: number) => {
    const key = `${provider}::${model}`;
    const existing = map.get(key);
    if (existing) {
      existing.callCount += 1;
      existing.lastUsedAt = Math.max(existing.lastUsedAt ?? 0, at);
    } else {
      map.set(key, { provider, model, callCount: 1, lastUsedAt: at });
    }
  };

  for (const job of jobs) {
    bump('imagen', job.request.model, job.createdAt);
  }
  for (const run of modelRuns) {
    bump(run.provider, run.model, run.completedAt ?? run.requestedAt);
  }

  return Array.from(map.values()).sort((a, b) => b.callCount - a.callCount);
}

export function estimateTokensFromJobs(jobs: GenerationJob[]): number {
  let total = 0;
  for (const job of jobs) {
    const promptLen = job.request.prompt?.length ?? 0;
    const negLen = job.request.negativePrompt?.length ?? 0;
    total += Math.ceil((promptLen + negLen) / 4);
  }
  return total;
}

export function sumModelRunTokens(modelRuns: ModelRun[]): number {
  return modelRuns.reduce(
    (sum, run) => sum + (run.requestTokens ?? 0) + (run.responseTokens ?? 0),
    0
  );
}

export function buildUsageSnapshot(input: UsageInput): UsageStatsSnapshot {
  const byProvider = aggregateProviderUsage(input.generationJobs, input.modelRuns);
  const modelCallsTotal = byProvider.reduce((sum, r) => sum + r.callCount, 0);
  const generationsTotal = input.generationJobs.filter((j) => j.status === 'completed').length;
  const postsTotal = input.publishingAccounts.reduce((sum, a) => sum + a.postsCount, 0);
  const runTokens = sumModelRunTokens(input.modelRuns);
  const estimated =
    runTokens > 0 ? runTokens : estimateTokensFromJobs(input.generationJobs);

  return {
    generationsTotal,
    generationsSession: input.sessionGenerations,
    modelCallsTotal,
    tokensEstimated: input.tokensEstimated ?? estimated,
    postsTotal,
    importsTotal: input.sessionImports,
    exportsTotal: input.sessionExports,
    byProvider,
  };
}
