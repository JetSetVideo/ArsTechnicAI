import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { GenerationJob, GenerationRequest, GenerationResult } from '@/types';

interface GenerationState {
  jobs: GenerationJob[];
  currentJobId: string | null;
  prompt: string;
  negativePrompt: string;
  width: number;
  height: number;
  isGenerating: boolean;

  // Prompt management
  setPrompt: (prompt: string) => void;
  setNegativePrompt: (prompt: string) => void;
  setDimensions: (width: number, height: number) => void;

  // Job management
  startGeneration: (request: GenerationRequest) => GenerationJob;
  updateJob: (id: string, updates: Partial<GenerationJob>) => void;
  completeJob: (id: string, result: GenerationResult) => void;
  failJob: (id: string, error: string) => void;
  cancelJob: (id: string) => void;
  getJob: (id: string) => GenerationJob | undefined;
  getRecentJobs: (count: number) => GenerationJob[];
  clearJobs: () => void;
}

export const useGenerationStore = create<GenerationState>((set, get) => ({
  jobs: [],
  currentJobId: null,
  prompt: '',
  negativePrompt: '',
  width: 1024,
  height: 1024,
  isGenerating: false,

  setPrompt: (prompt) => set({ prompt }),
  setNegativePrompt: (negativePrompt) => set({ negativePrompt }),
  setDimensions: (width, height) => set({ width, height }),

  startGeneration: (request) => {
    const job: GenerationJob = {
      id: uuidv4(),
      status: 'queued',
      request,
      progress: 0,
      createdAt: Date.now(),
    };

    set((state) => ({
      jobs: [job, ...state.jobs],
      currentJobId: job.id,
      isGenerating: true,
    }));

    return job;
  },

  updateJob: (id, updates) => {
    set((state) => ({
      jobs: state.jobs.map((j) => (j.id === id ? { ...j, ...updates } : j)),
    }));
  },

  completeJob: (id, result) => {
    set((state) => ({
      jobs: state.jobs.map((j) =>
        j.id === id
          ? { ...j, status: 'completed', result, progress: 100, completedAt: Date.now() }
          : j
      ),
      isGenerating: state.currentJobId === id ? false : state.isGenerating,
    }));
  },

  failJob: (id, error) => {
    set((state) => ({
      jobs: state.jobs.map((j) =>
        j.id === id
          ? { ...j, status: 'failed', error, completedAt: Date.now() }
          : j
      ),
      isGenerating: state.currentJobId === id ? false : state.isGenerating,
    }));
  },

  cancelJob: (id) => {
    set((state) => ({
      jobs: state.jobs.filter((j) => j.id !== id),
      isGenerating: state.currentJobId === id ? false : state.isGenerating,
      currentJobId: state.currentJobId === id ? null : state.currentJobId,
    }));
  },

  getJob: (id) => get().jobs.find((j) => j.id === id),

  getRecentJobs: (count) => get().jobs.slice(0, count),

  clearJobs: () => set({ jobs: [], currentJobId: null, isGenerating: false }),
}));
