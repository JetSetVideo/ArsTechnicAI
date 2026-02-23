import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useProductionStore } from '../../stores/productionStore';

vi.mock('uuid', () => ({
  v4: () => 'mock-prod-' + Math.random().toString(36).slice(2, 9),
}));

describe('ProductionStore', () => {
  beforeEach(() => {
    useProductionStore.setState({
      records: {},
      currentProjectId: null,
    });
  });

  it('creates a project tracking record', () => {
    const store = useProductionStore.getState();
    const record = store.ensureProjectRecord({ projectId: 'proj-1', projectName: 'Film A' });

    expect(record.projectId).toBe('proj-1');
    expect(record.projectName).toBe('Film A');
    expect(record.timeline).toHaveLength(0);
  });

  it('tracks idea entries and adds them to timeline order', () => {
    const store = useProductionStore.getState();
    const idea = store.addIdea('proj-2', {
      title: 'Opening shot',
      description: 'Slow dolly through rainy alley',
      tags: ['neo-noir'],
    });

    const state = useProductionStore.getState().records['proj-2'];
    expect(state.ideas[0].id).toBe(idea.id);
    expect(state.timeline).toHaveLength(1);
    expect(state.timeline[0].order).toBe(1);
    expect(state.timeline[0].stage).toBe('idea');
  });

  it('records prompt draft/version/model run for successful generations', () => {
    const store = useProductionStore.getState();
    const ids = store.recordPromptRun({
      projectId: 'proj-3',
      promptText: 'cinematic moonlit city skyline',
      provider: 'nanobanana',
      model: 'imagen-3.0',
      outputAssetId: 'asset-100',
      generationJobId: 'job-100',
      status: 'completed',
      seed: 12345,
      width: 1024,
      height: 1024,
      steps: 40,
      guidanceScale: 7.5,
    });

    const record = useProductionStore.getState().records['proj-3'];
    expect(record.prompts.some((p) => p.id === ids.promptDraftId)).toBe(true);
    expect(record.promptVersions.some((v) => v.id === ids.promptVersionId)).toBe(true);
    expect(record.modelRuns.some((r) => r.id === ids.modelRunId)).toBe(true);
    expect(record.modelRuns[0].status).toBe('completed');
    expect(record.modelRuns[0].outputAssetIds).toEqual(['asset-100']);
  });

  it('reuses existing prompt draft when text matches', () => {
    const store = useProductionStore.getState();
    const first = store.recordPromptRun({
      projectId: 'proj-4',
      promptText: 'character portrait, 85mm lens',
      provider: 'nanobanana',
      model: 'imagen-3.0',
      status: 'completed',
    });
    const second = store.recordPromptRun({
      projectId: 'proj-4',
      promptText: 'character portrait, 85mm lens',
      provider: 'nanobanana',
      model: 'imagen-3.0',
      status: 'failed',
      errorMessage: 'Rate limited',
    });

    const record = useProductionStore.getState().records['proj-4'];
    expect(first.promptDraftId).toBe(second.promptDraftId);
    expect(record.prompts).toHaveLength(1);
    expect(record.promptVersions).toHaveLength(2);
    expect(record.modelRuns).toHaveLength(2);
  });
});

