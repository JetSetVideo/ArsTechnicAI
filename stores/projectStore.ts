import { create } from 'zustand';

interface ProjectState {
  projectId: string | null;
  projectName: string | null;
  isDirty: boolean;
  lastSynced: Date | null;

  setProject: (id: string, name: string) => void;
  clearProject: () => void;
  markDirty: () => void;
  markSynced: () => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  projectId: null,
  projectName: null,
  isDirty: false,
  lastSynced: null,

  setProject: (id, name) => set({ projectId: id, projectName: name, isDirty: false }),
  clearProject: () => set({ projectId: null, projectName: null, isDirty: false, lastSynced: null }),
  markDirty: () => set({ isDirty: true }),
  markSynced: () => set({ isDirty: false, lastSynced: new Date() }),
}));
