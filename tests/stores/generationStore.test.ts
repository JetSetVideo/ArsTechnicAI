/**
 * Generation Store Unit Tests
 * 
 * Tests for image generation job management including:
 * - Prompt management
 * - Job lifecycle
 * - Job status tracking
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock uuid
vi.mock('uuid', () => ({
  v4: () => 'mock-gen-' + Math.random().toString(36).substr(2, 9),
}));

import { useGenerationStore } from '../../stores/generationStore';

describe('GenerationStore', () => {
  beforeEach(() => {
    // Reset the store state
    useGenerationStore.setState({
      jobs: [],
      currentJobId: null,
      prompt: '',
      negativePrompt: '',
      width: 1024,
      height: 1024,
      isGenerating: false,
    });
  });

  describe('Prompt Management', () => {
    it('should set prompt', () => {
      const store = useGenerationStore.getState();
      
      store.setPrompt('A beautiful sunset');
      
      expect(useGenerationStore.getState().prompt).toBe('A beautiful sunset');
    });

    it('should set negative prompt', () => {
      const store = useGenerationStore.getState();
      
      store.setNegativePrompt('blurry, low quality');
      
      expect(useGenerationStore.getState().negativePrompt).toBe('blurry, low quality');
    });

    it('should set dimensions', () => {
      const store = useGenerationStore.getState();
      
      store.setDimensions(512, 768);
      
      const state = useGenerationStore.getState();
      expect(state.width).toBe(512);
      expect(state.height).toBe(768);
    });
  });

  describe('Job Lifecycle', () => {
    it('should start a generation job', () => {
      const store = useGenerationStore.getState();
      
      const job = store.startGeneration({
        prompt: 'Test prompt',
        width: 1024,
        height: 1024,
        model: 'test-model',
      });
      
      expect(job.id).toBeDefined();
      expect(job.status).toBe('queued');
      expect(job.progress).toBe(0);
      
      const state = useGenerationStore.getState();
      expect(state.jobs).toHaveLength(1);
      expect(state.currentJobId).toBe(job.id);
      expect(state.isGenerating).toBe(true);
    });

    it('should update job progress', () => {
      const store = useGenerationStore.getState();
      const job = store.startGeneration({ prompt: 'Test', width: 512, height: 512, model: 'test' });
      
      store.updateJob(job.id, { progress: 50, status: 'processing' });
      
      const updatedJob = store.getJob(job.id);
      expect(updatedJob?.progress).toBe(50);
      expect(updatedJob?.status).toBe('processing');
    });

    it('should complete a job', () => {
      const store = useGenerationStore.getState();
      const job = store.startGeneration({ prompt: 'Test', width: 512, height: 512, model: 'test' });
      
      store.completeJob(job.id, {
        imageUrl: 'data:image/png;base64,test',
        seed: 12345,
        width: 512,
        height: 512,
      });
      
      const state = useGenerationStore.getState();
      const completedJob = state.jobs.find(j => j.id === job.id);
      
      expect(completedJob?.status).toBe('completed');
      expect(completedJob?.progress).toBe(100);
      expect(completedJob?.result?.imageUrl).toBe('data:image/png;base64,test');
      expect(completedJob?.completedAt).toBeDefined();
      expect(state.isGenerating).toBe(false);
    });

    it('should fail a job', () => {
      const store = useGenerationStore.getState();
      const job = store.startGeneration({ prompt: 'Test', width: 512, height: 512, model: 'test' });
      
      store.failJob(job.id, 'API error occurred');
      
      const state = useGenerationStore.getState();
      const failedJob = state.jobs.find(j => j.id === job.id);
      
      expect(failedJob?.status).toBe('failed');
      expect(failedJob?.error).toBe('API error occurred');
      expect(failedJob?.completedAt).toBeDefined();
      expect(state.isGenerating).toBe(false);
    });

    it('should cancel a job', () => {
      const store = useGenerationStore.getState();
      const job = store.startGeneration({ prompt: 'Test', width: 512, height: 512, model: 'test' });
      
      store.cancelJob(job.id);
      
      const state = useGenerationStore.getState();
      expect(state.jobs.find(j => j.id === job.id)).toBeUndefined();
      expect(state.currentJobId).toBeNull();
      expect(state.isGenerating).toBe(false);
    });
  });

  describe('Job Retrieval', () => {
    it('should get job by id', () => {
      const store = useGenerationStore.getState();
      const job = store.startGeneration({ prompt: 'Test', width: 512, height: 512, model: 'test' });
      
      const retrieved = store.getJob(job.id);
      
      expect(retrieved?.id).toBe(job.id);
      expect(retrieved?.request.prompt).toBe('Test');
    });

    it('should return undefined for non-existent job', () => {
      const store = useGenerationStore.getState();
      
      const retrieved = store.getJob('non-existent-id');
      
      expect(retrieved).toBeUndefined();
    });

    it('should get recent jobs', () => {
      const store = useGenerationStore.getState();
      
      store.startGeneration({ prompt: 'First', width: 512, height: 512, model: 'test' });
      store.startGeneration({ prompt: 'Second', width: 512, height: 512, model: 'test' });
      store.startGeneration({ prompt: 'Third', width: 512, height: 512, model: 'test' });
      
      const recent = store.getRecentJobs(2);
      
      expect(recent).toHaveLength(2);
      // Most recent first
      expect(recent[0].request.prompt).toBe('Third');
      expect(recent[1].request.prompt).toBe('Second');
    });
  });

  describe('Job Management', () => {
    it('should clear all jobs', () => {
      const store = useGenerationStore.getState();
      
      store.startGeneration({ prompt: 'Job 1', width: 512, height: 512, model: 'test' });
      store.startGeneration({ prompt: 'Job 2', width: 512, height: 512, model: 'test' });
      
      store.clearJobs();
      
      const state = useGenerationStore.getState();
      expect(state.jobs).toHaveLength(0);
      expect(state.currentJobId).toBeNull();
      expect(state.isGenerating).toBe(false);
    });

    it('should maintain job order (newest first)', () => {
      const store = useGenerationStore.getState();
      
      store.startGeneration({ prompt: 'First', width: 512, height: 512, model: 'test' });
      store.startGeneration({ prompt: 'Second', width: 512, height: 512, model: 'test' });
      store.startGeneration({ prompt: 'Third', width: 512, height: 512, model: 'test' });
      
      const state = useGenerationStore.getState();
      expect(state.jobs[0].request.prompt).toBe('Third');
      expect(state.jobs[1].request.prompt).toBe('Second');
      expect(state.jobs[2].request.prompt).toBe('First');
    });

    it('should only reset isGenerating for current job', () => {
      const store = useGenerationStore.getState();
      
      const job1 = store.startGeneration({ prompt: 'Job 1', width: 512, height: 512, model: 'test' });
      // Start a second job (this becomes current)
      const job2 = store.startGeneration({ prompt: 'Job 2', width: 512, height: 512, model: 'test' });
      
      // Complete first job - should not affect isGenerating since job2 is current
      store.completeJob(job1.id, { imageUrl: 'test', seed: 1, width: 512, height: 512 });
      
      expect(useGenerationStore.getState().isGenerating).toBe(true);
      
      // Complete second job - should reset isGenerating
      store.completeJob(job2.id, { imageUrl: 'test', seed: 2, width: 512, height: 512 });
      
      expect(useGenerationStore.getState().isGenerating).toBe(false);
    });
  });

  describe('Default Values', () => {
    it('should have correct default dimensions', () => {
      const state = useGenerationStore.getState();
      
      expect(state.width).toBe(1024);
      expect(state.height).toBe(1024);
    });

    it('should have empty prompts by default', () => {
      const state = useGenerationStore.getState();
      
      expect(state.prompt).toBe('');
      expect(state.negativePrompt).toBe('');
    });

    it('should not be generating by default', () => {
      const state = useGenerationStore.getState();
      
      expect(state.isGenerating).toBe(false);
      expect(state.currentJobId).toBeNull();
    });
  });
});
