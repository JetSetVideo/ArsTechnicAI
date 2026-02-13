/**
 * Agents Store Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useAgentsStore } from '../../stores/agentsStore';

describe('agentsStore', () => {
  beforeEach(() => {
    useAgentsStore.setState(useAgentsStore.getInitialState());
  });

  describe('initial state', () => {
    it('should have prebuilt agents', () => {
      const prebuilt = useAgentsStore.getState().getPrebuiltAgents();
      expect(prebuilt.length).toBeGreaterThanOrEqual(6);
    });

    it('should have shop agents', () => {
      const shop = useAgentsStore.getState().getShopAgents();
      expect(shop.length).toBeGreaterThanOrEqual(2);
    });

    it('should have no user agents initially', () => {
      expect(useAgentsStore.getState().getUserAgents().length).toBe(0);
    });
  });

  describe('getAgent', () => {
    it('should find prebuilt agents', () => {
      const agent = useAgentsStore.getState().getAgent('agent-batch-proc');
      expect(agent).toBeDefined();
      expect(agent!.name).toBe('Batch Processor');
    });

    it('should find user-created agents', () => {
      const state = useAgentsStore.getState();
      const created = state.createAgent({
        name: 'Test Agent',
        description: 'A test',
        icon: 'bot',
        mode: 'automatic',
        tasks: [],
        requiredModules: [],
        tags: ['test'],
      });
      
      const found = useAgentsStore.getState().getAgent(created.id);
      expect(found).toBeDefined();
      expect(found!.name).toBe('Test Agent');
    });
  });

  describe('createAgent', () => {
    it('should create a user agent with correct defaults', () => {
      const state = useAgentsStore.getState();
      const agent = state.createAgent({
        name: 'My Agent',
        description: 'Does things',
        icon: 'bot',
        mode: 'interactive',
        tasks: [],
        requiredModules: [],
        tags: [],
      });
      
      expect(agent.source).toBe('user-created');
      expect(agent.status).toBe('idle');
      expect(agent.usageCount).toBe(0);
      expect(agent.id).toMatch(/^agent-user-/);
    });
  });

  describe('deleteAgent', () => {
    it('should remove user agents', () => {
      const state = useAgentsStore.getState();
      const agent = state.createAgent({
        name: 'To Delete',
        description: 'Will be removed',
        icon: 'bot',
        mode: 'automatic',
        tasks: [],
        requiredModules: [],
        tags: [],
      });
      
      useAgentsStore.getState().deleteAgent(agent.id);
      expect(useAgentsStore.getState().getAgent(agent.id)).toBeUndefined();
    });
  });

  describe('duplicateAgent', () => {
    it('should create a copy with (Copy) suffix', () => {
      const copy = useAgentsStore.getState().duplicateAgent('agent-batch-proc');
      expect(copy).not.toBeNull();
      expect(copy!.name).toBe('Batch Processor (Copy)');
      expect(copy!.source).toBe('user-created');
    });

    it('should return null for non-existent agent', () => {
      expect(useAgentsStore.getState().duplicateAgent('nonexistent')).toBeNull();
    });
  });

  describe('execution', () => {
    it('should start an execution for agent with tasks', () => {
      const execution = useAgentsStore.getState().startExecution('agent-batch-proc');
      expect(execution).not.toBeNull();
      expect(execution!.status).toBe('running');
      expect(execution!.currentTaskIndex).toBe(0);
      expect(execution!.progress).toBe(0);
    });

    it('should return null for agents with no tasks', () => {
      // Shop agents have empty tasks
      const execution = useAgentsStore.getState().startExecution('agent-shop-voiceover');
      expect(execution).toBeNull();
    });

    it('should advance execution through tasks', () => {
      const execution = useAgentsStore.getState().startExecution('agent-batch-proc');
      if (!execution) throw new Error('Expected execution');
      
      useAgentsStore.getState().advanceExecution(execution.id);
      
      const updated = useAgentsStore.getState().getExecution(execution.id);
      expect(updated!.currentTaskIndex).toBe(1);
      expect(updated!.progress).toBeGreaterThan(0);
    });

    it('should complete execution when all tasks done', () => {
      const execution = useAgentsStore.getState().startExecution('agent-batch-proc');
      if (!execution) throw new Error('Expected execution');
      
      // Advance through all 3 tasks
      useAgentsStore.getState().advanceExecution(execution.id);
      useAgentsStore.getState().advanceExecution(execution.id);
      useAgentsStore.getState().advanceExecution(execution.id);
      
      const updated = useAgentsStore.getState().getExecution(execution.id);
      expect(updated!.status).toBe('completed');
      expect(updated!.progress).toBe(100);
    });

    it('should cancel execution', () => {
      const execution = useAgentsStore.getState().startExecution('agent-batch-proc');
      if (!execution) throw new Error('Expected execution');
      
      useAgentsStore.getState().cancelExecution(execution.id);
      
      const updated = useAgentsStore.getState().getExecution(execution.id);
      expect(updated!.status).toBe('error');
      expect(updated!.error).toBe('Cancelled by user');
    });
  });

  describe('searchAgents', () => {
    it('should find agents by name', () => {
      const results = useAgentsStore.getState().searchAgents('batch');
      expect(results.some(a => a.id === 'agent-batch-proc')).toBe(true);
    });

    it('should find agents by tag', () => {
      const results = useAgentsStore.getState().searchAgents('style');
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('getAgentsByMode', () => {
    it('should filter by mode', () => {
      const automatic = useAgentsStore.getState().getAgentsByMode('automatic');
      expect(automatic.length).toBeGreaterThan(0);
      expect(automatic.every(a => a.mode === 'automatic')).toBe(true);
    });
  });
});
