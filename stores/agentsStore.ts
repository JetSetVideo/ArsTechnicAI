/**
 * Agents Store
 * 
 * Manages AI agents - autonomous/semi-autonomous task executors.
 * Handles prebuilt agents, user-created agents, and agent executions.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Agent, AgentExecution, AgentTask, AgentMode, AgentStatus } from '../types/dashboard';

// ============================================
// PREBUILT AGENTS
// ============================================

const PREBUILT_AGENTS: Agent[] = [
  {
    id: 'agent-batch-proc',
    name: 'Batch Processor',
    description: 'Apply techniques to multiple assets automatically',
    icon: 'layers',
    mode: 'automatic',
    source: 'prebuilt',
    status: 'idle',
    tasks: [
      { id: 't1', name: 'Select Assets', moduleId: 'asset-mgr', requiresInput: true, inputPrompt: 'Select assets to process', order: 1, config: {} },
      { id: 't2', name: 'Choose Technique', moduleId: 'asset-mgr', requiresInput: true, inputPrompt: 'Select technique to apply', order: 2, config: {} },
      { id: 't3', name: 'Process All', moduleId: 'image-enhance', requiresInput: false, order: 3, config: { parallel: true } },
    ],
    requiredModules: ['asset-mgr', 'image-enhance'],
    tags: ['batch', 'automation', 'processing'],
    usageCount: 0,
    createdAt: Date.now() - 86400000 * 30,
    updatedAt: Date.now() - 86400000 * 30,
  },
  {
    id: 'agent-style-consistency',
    name: 'Style Consistency Agent',
    description: 'Ensure visual consistency across project assets',
    icon: 'palette',
    mode: 'semi-automatic',
    source: 'prebuilt',
    status: 'idle',
    tasks: [
      { id: 't1', name: 'Analyze Reference', moduleId: 'image-enhance', requiresInput: true, inputPrompt: 'Select reference image for style', order: 1, config: {} },
      { id: 't2', name: 'Select Targets', moduleId: 'asset-mgr', requiresInput: true, inputPrompt: 'Select images to match', order: 2, config: {} },
      { id: 't3', name: 'Generate Previews', moduleId: 'style-pro', requiresInput: false, order: 3, config: {} },
      { id: 't4', name: 'Review & Approve', moduleId: 'asset-mgr', requiresInput: true, inputPrompt: 'Approve style transfers?', order: 4, config: {} },
      { id: 't5', name: 'Apply Style', moduleId: 'style-pro', requiresInput: false, order: 5, config: {} },
    ],
    requiredModules: ['image-enhance', 'asset-mgr', 'style-pro'],
    tags: ['style', 'consistency', 'visual'],
    usageCount: 0,
    createdAt: Date.now() - 86400000 * 30,
    updatedAt: Date.now() - 86400000 * 30,
  },
  {
    id: 'agent-scene-builder',
    name: 'Scene Builder',
    description: 'Create complete scenes from text descriptions',
    icon: 'image',
    mode: 'interactive',
    source: 'prebuilt',
    status: 'idle',
    tasks: [
      { id: 't1', name: 'Describe Scene', moduleId: 'image-gen', requiresInput: true, inputPrompt: 'Describe the scene you want to create', order: 1, config: {} },
      { id: 't2', name: 'Generate Options', moduleId: 'image-gen', requiresInput: false, order: 2, config: { count: 4 } },
      { id: 't3', name: 'Select Base', moduleId: 'asset-mgr', requiresInput: true, inputPrompt: 'Choose your favorite option', order: 3, config: {} },
      { id: 't4', name: 'Add Depth', moduleId: 'camera-move', requiresInput: false, order: 4, config: {} },
      { id: 't5', name: 'Refine Details', moduleId: 'image-gen', requiresInput: true, inputPrompt: 'Any adjustments needed?', order: 5, config: {} },
    ],
    requiredModules: ['image-gen', 'asset-mgr', 'camera-move'],
    tags: ['scene', 'create', 'generation'],
    usageCount: 0,
    createdAt: Date.now() - 86400000 * 30,
    updatedAt: Date.now() - 86400000 * 30,
  },
  {
    id: 'agent-char-designer',
    name: 'Character Designer',
    description: 'Interactive character creation with variations',
    icon: 'user',
    mode: 'interactive',
    source: 'prebuilt',
    status: 'idle',
    tasks: [
      { id: 't1', name: 'Character Concept', moduleId: 'image-gen', requiresInput: true, inputPrompt: 'Describe your character', order: 1, config: {} },
      { id: 't2', name: 'Generate Variations', moduleId: 'image-gen', requiresInput: false, order: 2, config: { count: 6 } },
      { id: 't3', name: 'Select Favorites', moduleId: 'asset-mgr', requiresInput: true, inputPrompt: 'Pick 2-3 favorites to combine', order: 3, config: {} },
      { id: 't4', name: 'Refine Features', moduleId: 'image-gen', requiresInput: true, inputPrompt: 'Adjust any features?', order: 4, config: {} },
      { id: 't5', name: 'Generate Poses', moduleId: 'char-anim', requiresInput: false, order: 5, config: { poses: ['front', 'side', '3/4'] } },
    ],
    requiredModules: ['image-gen', 'asset-mgr', 'char-anim'],
    tags: ['character', 'design', 'creation'],
    usageCount: 0,
    createdAt: Date.now() - 86400000 * 30,
    updatedAt: Date.now() - 86400000 * 30,
  },
  {
    id: 'agent-video-assembler',
    name: 'Video Assembler',
    description: 'Automatically sequence and transition video clips',
    icon: 'video',
    mode: 'automatic',
    source: 'prebuilt',
    status: 'idle',
    tasks: [
      { id: 't1', name: 'Import Clips', moduleId: 'asset-mgr', requiresInput: true, inputPrompt: 'Select video clips', order: 1, config: {} },
      { id: 't2', name: 'Analyze Content', moduleId: 'video-edit', requiresInput: false, order: 2, config: {} },
      { id: 't3', name: 'Auto Sequence', moduleId: 'video-edit', requiresInput: false, order: 3, config: {} },
      { id: 't4', name: 'Add Transitions', moduleId: 'video-edit', requiresInput: false, order: 4, config: { style: 'smooth' } },
      { id: 't5', name: 'Export', moduleId: 'export-eng', requiresInput: false, order: 5, config: {} },
    ],
    requiredModules: ['asset-mgr', 'video-edit', 'export-eng'],
    tags: ['video', 'assemble', 'edit'],
    usageCount: 0,
    createdAt: Date.now() - 86400000 * 30,
    updatedAt: Date.now() - 86400000 * 30,
  },
  {
    id: 'agent-audio-mixer',
    name: 'Audio Mixer',
    description: 'Balance and master audio tracks automatically',
    icon: 'volume-2',
    mode: 'automatic',
    source: 'prebuilt',
    status: 'idle',
    tasks: [
      { id: 't1', name: 'Import Audio', moduleId: 'asset-mgr', requiresInput: true, inputPrompt: 'Select audio tracks', order: 1, config: {} },
      { id: 't2', name: 'Analyze Levels', moduleId: 'audio-proc', requiresInput: false, order: 2, config: {} },
      { id: 't3', name: 'Auto Balance', moduleId: 'audio-proc', requiresInput: false, order: 3, config: {} },
      { id: 't4', name: 'Apply EQ', moduleId: 'audio-proc', requiresInput: false, order: 4, config: {} },
      { id: 't5', name: 'Master', moduleId: 'audio-proc', requiresInput: false, order: 5, config: { target: '-14 LUFS' } },
    ],
    requiredModules: ['asset-mgr', 'audio-proc'],
    tags: ['audio', 'mix', 'master'],
    usageCount: 0,
    createdAt: Date.now() - 86400000 * 30,
    updatedAt: Date.now() - 86400000 * 30,
  },
];

// Shop featured agents
const SHOP_AGENTS: Agent[] = [
  {
    id: 'agent-shop-voiceover',
    name: 'Voiceover Producer',
    description: 'Generate professional voiceovers with AI voices',
    icon: 'mic',
    mode: 'semi-automatic',
    source: 'shop',
    status: 'idle',
    tasks: [],
    requiredModules: ['voice-clone', 'audio-proc'],
    tags: ['voice', 'voiceover', 'narration'],
    price: 4.99,
    currency: 'usd',
    author: 'Ars Technic AI',
    rating: 4.8,
    usageCount: 1250,
    createdAt: Date.now() - 86400000 * 60,
    updatedAt: Date.now() - 86400000 * 10,
  },
  {
    id: 'agent-shop-thumbnail',
    name: 'Thumbnail Generator',
    description: 'Create eye-catching thumbnails for videos',
    icon: 'image',
    mode: 'interactive',
    source: 'shop',
    status: 'idle',
    tasks: [],
    requiredModules: ['image-gen', 'image-enhance'],
    tags: ['thumbnail', 'youtube', 'social'],
    price: 2.99,
    currency: 'usd',
    author: 'Creative Tools',
    rating: 4.5,
    usageCount: 3420,
    createdAt: Date.now() - 86400000 * 45,
    updatedAt: Date.now() - 86400000 * 5,
  },
];

// ============================================
// STORE INTERFACE
// ============================================

interface AgentsState {
  agents: Agent[];
  userAgents: Agent[];
  executions: AgentExecution[];
  currentExecutionId: string | null;
}

interface AgentsActions {
  // Agent management
  createAgent: (agent: Omit<Agent, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'source' | 'usageCount'>) => Agent;
  updateAgent: (id: string, updates: Partial<Agent>) => void;
  deleteAgent: (id: string) => void;
  duplicateAgent: (id: string) => Agent | null;
  
  // Agent execution
  startExecution: (agentId: string, inputs?: Record<string, unknown>) => AgentExecution | null;
  pauseExecution: (executionId: string) => void;
  resumeExecution: (executionId: string) => void;
  cancelExecution: (executionId: string) => void;
  completeExecution: (executionId: string, results: Record<string, unknown>[]) => void;
  failExecution: (executionId: string, error: string) => void;
  advanceExecution: (executionId: string) => void;
  provideInput: (executionId: string, input: Record<string, unknown>) => void;
  
  // Getters
  getAgent: (id: string) => Agent | undefined;
  getPrebuiltAgents: () => Agent[];
  getUserAgents: () => Agent[];
  getShopAgents: () => Agent[];
  getAgentsByMode: (mode: AgentMode) => Agent[];
  getExecution: (id: string) => AgentExecution | undefined;
  getCurrentExecution: () => AgentExecution | undefined;
  getActiveExecutions: () => AgentExecution[];
  
  // Search
  searchAgents: (query: string) => Agent[];
}

type AgentsStore = AgentsState & AgentsActions;

// ============================================
// STORE IMPLEMENTATION
// ============================================

export const useAgentsStore = create<AgentsStore>()(
  persist(
    (set, get) => ({
      // Initial state
      agents: [...PREBUILT_AGENTS, ...SHOP_AGENTS],
      userAgents: [],
      executions: [],
      currentExecutionId: null,

      // Agent management
      createAgent: (agentData) => {
        const newAgent: Agent = {
          id: `agent-user-${Date.now()}`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          status: 'idle',
          source: 'user-created',
          usageCount: 0,
          ...agentData,
        };
        
        set((state) => ({
          userAgents: [...state.userAgents, newAgent],
        }));
        
        return newAgent;
      },

      updateAgent: (id, updates) => {
        set((state) => ({
          userAgents: state.userAgents.map((a) =>
            a.id === id ? { ...a, ...updates, updatedAt: Date.now() } : a
          ),
        }));
      },

      deleteAgent: (id) => {
        set((state) => ({
          userAgents: state.userAgents.filter((a) => a.id !== id),
        }));
      },

      duplicateAgent: (id) => {
        const original = get().getAgent(id);
        if (!original) return null;
        
        const duplicate: Agent = {
          ...original,
          id: `agent-user-${Date.now()}`,
          name: `${original.name} (Copy)`,
          source: 'user-created',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          usageCount: 0,
        };
        
        set((state) => ({
          userAgents: [...state.userAgents, duplicate],
        }));
        
        return duplicate;
      },

      // Agent execution
      startExecution: (agentId, inputs = {}) => {
        const agent = get().getAgent(agentId);
        if (!agent || agent.tasks.length === 0) return null;
        
        const execution: AgentExecution = {
          id: `exec-${Date.now()}`,
          agentId,
          status: 'running',
          currentTaskIndex: 0,
          progress: 0,
          startedAt: Date.now(),
          results: [],
          inputs,
        };
        
        set((state) => ({
          executions: [...state.executions, execution],
          currentExecutionId: execution.id,
          // Update agent usage count
          agents: state.agents.map((a) =>
            a.id === agentId ? { ...a, status: 'running' as AgentStatus, usageCount: (a.usageCount || 0) + 1 } : a
          ),
          userAgents: state.userAgents.map((a) =>
            a.id === agentId ? { ...a, status: 'running' as AgentStatus, usageCount: (a.usageCount || 0) + 1 } : a
          ),
        }));
        
        return execution;
      },

      pauseExecution: (executionId) => {
        set((state) => ({
          executions: state.executions.map((e) =>
            e.id === executionId ? { ...e, status: 'paused' } : e
          ),
        }));
      },

      resumeExecution: (executionId) => {
        set((state) => ({
          executions: state.executions.map((e) =>
            e.id === executionId ? { ...e, status: 'running' } : e
          ),
        }));
      },

      cancelExecution: (executionId) => {
        const execution = get().getExecution(executionId);
        if (!execution) return;
        
        set((state) => ({
          executions: state.executions.map((e) =>
            e.id === executionId ? { ...e, status: 'error', error: 'Cancelled by user', completedAt: Date.now() } : e
          ),
          agents: state.agents.map((a) =>
            a.id === execution.agentId ? { ...a, status: 'idle' as AgentStatus } : a
          ),
          userAgents: state.userAgents.map((a) =>
            a.id === execution.agentId ? { ...a, status: 'idle' as AgentStatus } : a
          ),
          currentExecutionId: state.currentExecutionId === executionId ? null : state.currentExecutionId,
        }));
      },

      completeExecution: (executionId, results) => {
        const execution = get().getExecution(executionId);
        if (!execution) return;
        
        set((state) => ({
          executions: state.executions.map((e) =>
            e.id === executionId
              ? { ...e, status: 'completed', progress: 100, completedAt: Date.now(), results }
              : e
          ),
          agents: state.agents.map((a) =>
            a.id === execution.agentId ? { ...a, status: 'idle' as AgentStatus } : a
          ),
          userAgents: state.userAgents.map((a) =>
            a.id === execution.agentId ? { ...a, status: 'idle' as AgentStatus } : a
          ),
          currentExecutionId: state.currentExecutionId === executionId ? null : state.currentExecutionId,
        }));
      },

      failExecution: (executionId, error) => {
        const execution = get().getExecution(executionId);
        if (!execution) return;
        
        set((state) => ({
          executions: state.executions.map((e) =>
            e.id === executionId
              ? { ...e, status: 'error', error, completedAt: Date.now() }
              : e
          ),
          agents: state.agents.map((a) =>
            a.id === execution.agentId ? { ...a, status: 'error' as AgentStatus } : a
          ),
          userAgents: state.userAgents.map((a) =>
            a.id === execution.agentId ? { ...a, status: 'error' as AgentStatus } : a
          ),
        }));
      },

      advanceExecution: (executionId) => {
        const execution = get().getExecution(executionId);
        const agent = execution ? get().getAgent(execution.agentId) : null;
        if (!execution || !agent) return;
        
        const nextIndex = execution.currentTaskIndex + 1;
        const progress = Math.round((nextIndex / agent.tasks.length) * 100);
        
        if (nextIndex >= agent.tasks.length) {
          get().completeExecution(executionId, execution.results);
        } else {
          set((state) => ({
            executions: state.executions.map((e) =>
              e.id === executionId
                ? { ...e, currentTaskIndex: nextIndex, progress }
                : e
            ),
          }));
        }
      },

      provideInput: (executionId, input) => {
        set((state) => ({
          executions: state.executions.map((e) =>
            e.id === executionId
              ? { ...e, inputs: { ...e.inputs, ...input } }
              : e
          ),
        }));
      },

      // Getters
      getAgent: (id) => {
        const { agents, userAgents } = get();
        return agents.find((a) => a.id === id) || userAgents.find((a) => a.id === id);
      },

      getPrebuiltAgents: () => get().agents.filter((a) => a.source === 'prebuilt'),
      getUserAgents: () => get().userAgents,
      getShopAgents: () => get().agents.filter((a) => a.source === 'shop'),
      getAgentsByMode: (mode) => [...get().agents, ...get().userAgents].filter((a) => a.mode === mode),

      getExecution: (id) => get().executions.find((e) => e.id === id),
      getCurrentExecution: () => {
        const { currentExecutionId, executions } = get();
        return currentExecutionId ? executions.find((e) => e.id === currentExecutionId) : undefined;
      },
      getActiveExecutions: () => get().executions.filter((e) => e.status === 'running' || e.status === 'paused'),

      // Search
      searchAgents: (query) => {
        const lowerQuery = query.toLowerCase();
        const { agents, userAgents } = get();
        return [...agents, ...userAgents].filter((a) =>
          a.name.toLowerCase().includes(lowerQuery) ||
          a.description.toLowerCase().includes(lowerQuery) ||
          a.tags.some((t) => t.toLowerCase().includes(lowerQuery))
        );
      },
    }),
    {
      name: 'ars-technicai-agents',
      version: 1,
      partialize: (state) => ({
        userAgents: state.userAgents,
        // Don't persist active executions
      }),
    }
  )
);
