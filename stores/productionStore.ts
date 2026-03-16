import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { STORAGE_KEYS } from '@/constants/workspace';
import type {
  DialogueLine,
  GlossaryTerm,
  IdeaCard,
  ModelRun,
  ModelRunStatus,
  ProductionStage,
  ProjectProductionRecord,
  PromptDraft,
  PromptModelContext,
  PromptVersion,
  ScriptSegment,
  SourceReference,
  StoryStatus,
  TimelineEntityType,
} from '@/types/production';

interface ProjectSeedInput {
  projectId: string;
  projectName?: string;
}

interface RecordPromptRunInput extends ProjectSeedInput {
  promptText: string;
  negativePrompt?: string;
  provider: string;
  model: string;
  outputAssetId?: string;
  generationJobId?: string;
  status: ModelRunStatus;
  seed?: number;
  width?: number;
  height?: number;
  steps?: number;
  guidanceScale?: number;
  errorMessage?: string;
}

interface ProductionState {
  records: Record<string, ProjectProductionRecord>;
  currentProjectId: string | null;
}

interface ProductionActions {
  ensureProjectRecord: (input: ProjectSeedInput) => ProjectProductionRecord;
  setCurrentProject: (projectId: string | null) => void;
  getProjectRecord: (projectId: string) => ProjectProductionRecord | undefined;
  resetAll: () => void;

  addIdea: (
    projectId: string,
    input: { title: string; description: string; tags?: string[]; status?: StoryStatus }
  ) => IdeaCard;
  addGlossaryTerm: (
    projectId: string,
    input: { term: string; definition: string; aliases?: string[]; categories?: string[] }
  ) => GlossaryTerm;
  addScriptSegment: (
    projectId: string,
    input: {
      title: string;
      content: string;
      segmentType: ScriptSegment['segmentType'];
      order?: number;
      status?: StoryStatus;
    }
  ) => ScriptSegment;
  addSourceReference: (
    projectId: string,
    input: Omit<SourceReference, 'id' | 'createdAt' | 'updatedAt'>
  ) => SourceReference;
  addDialogueLine: (
    projectId: string,
    input: {
      speaker: string;
      line: string;
      sceneRef?: string;
      tone?: string;
      order?: number;
    }
  ) => DialogueLine;
  addPromptDraft: (
    projectId: string,
    input: {
      title?: string;
      promptText: string;
      intent?: string;
      tags?: string[];
      status?: StoryStatus;
    }
  ) => PromptDraft;
  addPromptVersion: (
    projectId: string,
    input: {
      promptDraftId: string;
      modelContext: PromptModelContext;
      notes?: string;
      outputAssetIds?: string[];
    }
  ) => PromptVersion;
  addModelRun: (
    projectId: string,
    input: Omit<ModelRun, 'id'>
  ) => ModelRun;
  updateModelRun: (
    projectId: string,
    modelRunId: string,
    updates: Partial<ModelRun>
  ) => void;
  updateIdea: (projectId: string, id: string, updates: Partial<Omit<IdeaCard, 'id' | 'createdAt'>>) => void;
  deleteIdea: (projectId: string, id: string) => void;
  updateGlossaryTerm: (projectId: string, id: string, updates: Partial<Omit<GlossaryTerm, 'id' | 'createdAt'>>) => void;
  deleteGlossaryTerm: (projectId: string, id: string) => void;
  updateScriptSegment: (projectId: string, id: string, updates: Partial<Omit<ScriptSegment, 'id' | 'createdAt'>>) => void;
  deleteScriptSegment: (projectId: string, id: string) => void;
  updateSourceReference: (projectId: string, id: string, updates: Partial<Omit<SourceReference, 'id' | 'createdAt'>>) => void;
  deleteSourceReference: (projectId: string, id: string) => void;
  updateDialogueLine: (projectId: string, id: string, updates: Partial<Omit<DialogueLine, 'id' | 'createdAt'>>) => void;
  deleteDialogueLine: (projectId: string, id: string) => void;
  updatePromptDraft: (projectId: string, id: string, updates: Partial<Omit<PromptDraft, 'id' | 'createdAt'>>) => void;
  deletePromptDraft: (projectId: string, id: string) => void;
  deleteModelRun: (projectId: string, id: string) => void;
  updateTimelineEntry: (projectId: string, id: string, updates: { title?: string; notes?: string }) => void;
  deleteTimelineEntry: (projectId: string, id: string) => void;
  addTimelineEntry: (
    projectId: string,
    input: {
      stage: ProductionStage;
      entityType: TimelineEntityType;
      entityId?: string;
      title: string;
      notes?: string;
    }
  ) => void;
  recordPromptRun: (input: RecordPromptRunInput) => {
    promptDraftId: string;
    promptVersionId: string;
    modelRunId: string;
  };
}

type ProductionStore = ProductionState & ProductionActions;

const now = () => Date.now();

const createEmptyRecord = (projectId: string, projectName?: string): ProjectProductionRecord => ({
  projectId,
  projectName,
  createdAt: now(),
  updatedAt: now(),
  ideas: [],
  glossary: [],
  script: [],
  sources: [],
  dialogues: [],
  prompts: [],
  promptVersions: [],
  modelRuns: [],
  timeline: [],
  nextTimelineOrder: 1,
});

const titleFromPrompt = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed) return 'Untitled Prompt';
  return trimmed.slice(0, 60);
};

export const useProductionStore = create<ProductionStore>()(
  persist(
    (set, get) => ({
      records: {},
      currentProjectId: null,

      ensureProjectRecord: ({ projectId, projectName }) => {
        const existing = get().records[projectId];
        if (existing) {
          if (projectName && existing.projectName !== projectName) {
            const updated = { ...existing, projectName, updatedAt: now() };
            set((state) => ({
              records: {
                ...state.records,
                [projectId]: updated,
              },
            }));
            return updated;
          }
          return existing;
        }

        const fresh = createEmptyRecord(projectId, projectName);
        set((state) => ({
          records: {
            ...state.records,
            [projectId]: fresh,
          },
        }));
        return fresh;
      },

      setCurrentProject: (projectId) => set({ currentProjectId: projectId }),

      getProjectRecord: (projectId) => get().records[projectId],

      resetAll: () => set({ records: {}, currentProjectId: null }),

      addIdea: (projectId, input) => {
        const record = get().ensureProjectRecord({ projectId });
        const item: IdeaCard = {
          id: uuidv4(),
          title: input.title,
          description: input.description,
          tags: input.tags || [],
          status: input.status || 'draft',
          createdAt: now(),
          updatedAt: now(),
        };

        set((state) => ({
          records: {
            ...state.records,
            [projectId]: {
              ...record,
              ideas: [item, ...record.ideas],
              updatedAt: now(),
            },
          },
        }));

        get().addTimelineEntry(projectId, {
          stage: 'idea',
          entityType: 'idea',
          entityId: item.id,
          title: `Idea: ${item.title}`,
        });

        return item;
      },

      addGlossaryTerm: (projectId, input) => {
        const record = get().ensureProjectRecord({ projectId });
        const item: GlossaryTerm = {
          id: uuidv4(),
          term: input.term,
          definition: input.definition,
          aliases: input.aliases || [],
          categories: input.categories || [],
          createdAt: now(),
          updatedAt: now(),
        };

        set((state) => ({
          records: {
            ...state.records,
            [projectId]: {
              ...record,
              glossary: [item, ...record.glossary],
              updatedAt: now(),
            },
          },
        }));

        get().addTimelineEntry(projectId, {
          stage: 'glossary',
          entityType: 'glossaryTerm',
          entityId: item.id,
          title: `Glossary: ${item.term}`,
        });

        return item;
      },

      addScriptSegment: (projectId, input) => {
        const record = get().ensureProjectRecord({ projectId });
        const maxOrder = Math.max(0, ...record.script.map((s) => s.order));
        const item: ScriptSegment = {
          id: uuidv4(),
          title: input.title,
          content: input.content,
          segmentType: input.segmentType,
          order: input.order ?? maxOrder + 1,
          status: input.status || 'draft',
          createdAt: now(),
          updatedAt: now(),
        };

        set((state) => ({
          records: {
            ...state.records,
            [projectId]: {
              ...record,
              script: [...record.script, item].sort((a, b) => a.order - b.order),
              updatedAt: now(),
            },
          },
        }));

        get().addTimelineEntry(projectId, {
          stage: 'script',
          entityType: 'scriptSegment',
          entityId: item.id,
          title: `Script ${item.segmentType}: ${item.title}`,
        });

        return item;
      },

      addSourceReference: (projectId, input) => {
        const record = get().ensureProjectRecord({ projectId });
        const item: SourceReference = {
          id: uuidv4(),
          ...input,
          createdAt: now(),
          updatedAt: now(),
        };

        set((state) => ({
          records: {
            ...state.records,
            [projectId]: {
              ...record,
              sources: [item, ...record.sources],
              updatedAt: now(),
            },
          },
        }));

        get().addTimelineEntry(projectId, {
          stage: 'sources',
          entityType: 'sourceReference',
          entityId: item.id,
          title: `Source: ${item.label}`,
        });

        return item;
      },

      addDialogueLine: (projectId, input) => {
        const record = get().ensureProjectRecord({ projectId });
        const maxOrder = Math.max(0, ...record.dialogues.map((d) => d.order));
        const item: DialogueLine = {
          id: uuidv4(),
          speaker: input.speaker,
          line: input.line,
          sceneRef: input.sceneRef,
          tone: input.tone,
          order: input.order ?? maxOrder + 1,
          createdAt: now(),
          updatedAt: now(),
        };

        set((state) => ({
          records: {
            ...state.records,
            [projectId]: {
              ...record,
              dialogues: [...record.dialogues, item].sort((a, b) => a.order - b.order),
              updatedAt: now(),
            },
          },
        }));

        get().addTimelineEntry(projectId, {
          stage: 'dialogue',
          entityType: 'dialogueLine',
          entityId: item.id,
          title: `Dialogue (${item.speaker})`,
        });

        return item;
      },

      addPromptDraft: (projectId, input) => {
        const record = get().ensureProjectRecord({ projectId });
        const item: PromptDraft = {
          id: uuidv4(),
          title: input.title || titleFromPrompt(input.promptText),
          promptText: input.promptText.trim(),
          intent: input.intent,
          tags: input.tags || [],
          status: input.status || 'draft',
          createdAt: now(),
          updatedAt: now(),
        };

        set((state) => ({
          records: {
            ...state.records,
            [projectId]: {
              ...record,
              prompts: [item, ...record.prompts],
              updatedAt: now(),
            },
          },
        }));

        get().addTimelineEntry(projectId, {
          stage: 'prompt',
          entityType: 'promptDraft',
          entityId: item.id,
          title: `Prompt draft: ${item.title}`,
        });

        return item;
      },

      addPromptVersion: (projectId, input) => {
        const record = get().ensureProjectRecord({ projectId });
        const versionsForPrompt = record.promptVersions.filter(
          (v) => v.promptDraftId === input.promptDraftId
        );
        const item: PromptVersion = {
          id: uuidv4(),
          promptDraftId: input.promptDraftId,
          versionLabel: `v${versionsForPrompt.length + 1}`,
          modelContext: input.modelContext,
          notes: input.notes,
          outputAssetIds: input.outputAssetIds || [],
          createdAt: now(),
        };

        set((state) => {
          const nextRecord = state.records[projectId];
          if (!nextRecord) return state;
          return {
            records: {
              ...state.records,
              [projectId]: {
                ...nextRecord,
                promptVersions: [item, ...nextRecord.promptVersions],
                prompts: nextRecord.prompts.map((p) =>
                  p.id === input.promptDraftId
                    ? { ...p, latestVersionId: item.id, updatedAt: now() }
                    : p
                ),
                updatedAt: now(),
              },
            },
          };
        });

        get().addTimelineEntry(projectId, {
          stage: 'prompt',
          entityType: 'promptVersion',
          entityId: item.id,
          title: `Prompt version ${item.versionLabel}`,
        });

        return item;
      },

      addModelRun: (projectId, input) => {
        const record = get().ensureProjectRecord({ projectId });
        const item: ModelRun = { ...input, id: uuidv4() };

        set((state) => ({
          records: {
            ...state.records,
            [projectId]: {
              ...record,
              modelRuns: [item, ...record.modelRuns],
              updatedAt: now(),
            },
          },
        }));

        get().addTimelineEntry(projectId, {
          stage: 'generation',
          entityType: 'modelRun',
          entityId: item.id,
          title: `Run ${item.model} (${item.status})`,
          notes: item.errorMessage,
        });

        return item;
      },

      updateModelRun: (projectId, modelRunId, updates) => {
        const record = get().ensureProjectRecord({ projectId });
        set((state) => ({
          records: {
            ...state.records,
            [projectId]: {
              ...record,
              modelRuns: record.modelRuns.map((run) =>
                run.id === modelRunId ? { ...run, ...updates } : run
              ),
              updatedAt: now(),
            },
          },
        }));
      },

      updateIdea: (projectId, id, updates) => {
        set((state) => {
          const record = state.records[projectId];
          if (!record) return state;
          return { records: { ...state.records, [projectId]: {
            ...record,
            ideas: record.ideas.map((i) => i.id === id ? { ...i, ...updates, updatedAt: now() } : i),
            updatedAt: now(),
          }}};
        });
      },

      deleteIdea: (projectId, id) => {
        set((state) => {
          const record = state.records[projectId];
          if (!record) return state;
          return { records: { ...state.records, [projectId]: {
            ...record,
            ideas: record.ideas.filter((i) => i.id !== id),
            updatedAt: now(),
          }}};
        });
      },

      updateGlossaryTerm: (projectId, id, updates) => {
        set((state) => {
          const record = state.records[projectId];
          if (!record) return state;
          return { records: { ...state.records, [projectId]: {
            ...record,
            glossary: record.glossary.map((i) => i.id === id ? { ...i, ...updates, updatedAt: now() } : i),
            updatedAt: now(),
          }}};
        });
      },

      deleteGlossaryTerm: (projectId, id) => {
        set((state) => {
          const record = state.records[projectId];
          if (!record) return state;
          return { records: { ...state.records, [projectId]: {
            ...record,
            glossary: record.glossary.filter((i) => i.id !== id),
            updatedAt: now(),
          }}};
        });
      },

      updateScriptSegment: (projectId, id, updates) => {
        set((state) => {
          const record = state.records[projectId];
          if (!record) return state;
          return { records: { ...state.records, [projectId]: {
            ...record,
            script: record.script.map((i) => i.id === id ? { ...i, ...updates, updatedAt: now() } : i),
            updatedAt: now(),
          }}};
        });
      },

      deleteScriptSegment: (projectId, id) => {
        set((state) => {
          const record = state.records[projectId];
          if (!record) return state;
          return { records: { ...state.records, [projectId]: {
            ...record,
            script: record.script.filter((i) => i.id !== id),
            updatedAt: now(),
          }}};
        });
      },

      updateSourceReference: (projectId, id, updates) => {
        set((state) => {
          const record = state.records[projectId];
          if (!record) return state;
          return { records: { ...state.records, [projectId]: {
            ...record,
            sources: record.sources.map((i) => i.id === id ? { ...i, ...updates, updatedAt: now() } : i),
            updatedAt: now(),
          }}};
        });
      },

      deleteSourceReference: (projectId, id) => {
        set((state) => {
          const record = state.records[projectId];
          if (!record) return state;
          return { records: { ...state.records, [projectId]: {
            ...record,
            sources: record.sources.filter((i) => i.id !== id),
            updatedAt: now(),
          }}};
        });
      },

      updateDialogueLine: (projectId, id, updates) => {
        set((state) => {
          const record = state.records[projectId];
          if (!record) return state;
          return { records: { ...state.records, [projectId]: {
            ...record,
            dialogues: record.dialogues.map((i) => i.id === id ? { ...i, ...updates, updatedAt: now() } : i),
            updatedAt: now(),
          }}};
        });
      },

      deleteDialogueLine: (projectId, id) => {
        set((state) => {
          const record = state.records[projectId];
          if (!record) return state;
          return { records: { ...state.records, [projectId]: {
            ...record,
            dialogues: record.dialogues.filter((i) => i.id !== id),
            updatedAt: now(),
          }}};
        });
      },

      updatePromptDraft: (projectId, id, updates) => {
        set((state) => {
          const record = state.records[projectId];
          if (!record) return state;
          return { records: { ...state.records, [projectId]: {
            ...record,
            prompts: record.prompts.map((i) => i.id === id ? { ...i, ...updates, updatedAt: now() } : i),
            updatedAt: now(),
          }}};
        });
      },

      deletePromptDraft: (projectId, id) => {
        set((state) => {
          const record = state.records[projectId];
          if (!record) return state;
          return { records: { ...state.records, [projectId]: {
            ...record,
            prompts: record.prompts.filter((i) => i.id !== id),
            promptVersions: record.promptVersions.filter((v) => v.promptDraftId !== id),
            updatedAt: now(),
          }}};
        });
      },

      deleteModelRun: (projectId, id) => {
        set((state) => {
          const record = state.records[projectId];
          if (!record) return state;
          return { records: { ...state.records, [projectId]: {
            ...record,
            modelRuns: record.modelRuns.filter((i) => i.id !== id),
            updatedAt: now(),
          }}};
        });
      },

      updateTimelineEntry: (projectId, id, updates) => {
        set((state) => {
          const record = state.records[projectId];
          if (!record) return state;
          return { records: { ...state.records, [projectId]: {
            ...record,
            timeline: record.timeline.map((i) => i.id === id ? { ...i, ...updates } : i),
            updatedAt: now(),
          }}};
        });
      },

      deleteTimelineEntry: (projectId, id) => {
        set((state) => {
          const record = state.records[projectId];
          if (!record) return state;
          return { records: { ...state.records, [projectId]: {
            ...record,
            timeline: record.timeline.filter((i) => i.id !== id),
            updatedAt: now(),
          }}};
        });
      },

      addTimelineEntry: (projectId, input) => {
        const record = get().ensureProjectRecord({ projectId });
        const item = {
          id: uuidv4(),
          order: record.nextTimelineOrder,
          stage: input.stage,
          entityType: input.entityType,
          entityId: input.entityId,
          title: input.title,
          notes: input.notes,
          createdAt: now(),
        };

        set((state) => ({
          records: {
            ...state.records,
            [projectId]: {
              ...record,
              timeline: [...record.timeline, item],
              nextTimelineOrder: record.nextTimelineOrder + 1,
              updatedAt: now(),
            },
          },
        }));
      },

      recordPromptRun: (input) => {
        const record = get().ensureProjectRecord({
          projectId: input.projectId,
          projectName: input.projectName,
        });

        const promptText = input.promptText.trim();
        const existingPrompt = record.prompts.find((p) => p.promptText === promptText);
        const promptDraft =
          existingPrompt ||
          get().addPromptDraft(input.projectId, {
            promptText,
            title: titleFromPrompt(promptText),
          });

        const promptVersion = get().addPromptVersion(input.projectId, {
          promptDraftId: promptDraft.id,
          modelContext: {
            provider: input.provider,
            model: input.model,
            negativePrompt: input.negativePrompt,
            seed: input.seed,
            width: input.width,
            height: input.height,
            steps: input.steps,
            guidanceScale: input.guidanceScale,
          },
          outputAssetIds: input.outputAssetId ? [input.outputAssetId] : [],
        });

        const run = get().addModelRun(input.projectId, {
          promptDraftId: promptDraft.id,
          promptVersionId: promptVersion.id,
          provider: input.provider,
          model: input.model,
          status: input.status,
          requestedAt: now(),
          completedAt:
            input.status === 'completed' || input.status === 'failed' ? now() : undefined,
          errorMessage: input.errorMessage,
          generationJobId: input.generationJobId,
          outputAssetIds: input.outputAssetId ? [input.outputAssetId] : [],
        });

        return {
          promptDraftId: promptDraft.id,
          promptVersionId: promptVersion.id,
          modelRunId: run.id,
        };
      },
    }),
    {
      name: STORAGE_KEYS.productionTracker,
      version: 1,
    }
  )
);

