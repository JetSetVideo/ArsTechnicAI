// ============================================================
// ARS TECHNICAI — Blueprint Store
// Phase 0.5: Blueprint types and store (Zustand + localStorage persist)
// ============================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Blueprint, BlueprintRun } from '@/types/blueprint';
import { STARTER_BLUEPRINTS, specToBlueprint } from '@/lib/pipeline/blueprintBridge';

interface BlueprintState {
  blueprints: Blueprint[];
  runs: BlueprintRun[];
  selectedBlueprintId: string | null;
  /** Set after the built-in graphs have been inserted once. Deleting one stays deleted. */
  startersSeeded: boolean;

  // CRUD
  addBlueprint: (bp: Blueprint) => void;
  updateBlueprint: (id: string, updater: Partial<Blueprint>) => void;
  removeBlueprint: (id: string) => void;
  setSelectedBlueprint: (id: string | null) => void;

  // Runs
  addRun: (run: BlueprintRun) => void;
  updateRun: (id: string, updater: Partial<BlueprintRun>) => void;

  // Import / Export
  exportBlueprint: (id: string) => string | null;
  importBlueprint: (json: string) => Blueprint | null;
  /** Inserts the built-in workshop graphs the first time the store hydrates. */
  ensureStarters: () => void;
}

export const useBlueprintStore = create<BlueprintState>()(
  persist(
    (set, get) => ({
      blueprints: [],
      runs: [],
      selectedBlueprintId: null,
      startersSeeded: false,

      addBlueprint: (bp) =>
        set((s) => ({ blueprints: [...s.blueprints, bp] })),

      updateBlueprint: (id, updater) =>
        set((s) => ({
          blueprints: s.blueprints.map((bp) =>
            bp.id === id ? { ...bp, ...updater, updatedAt: Date.now() } : bp
          ),
        })),

      removeBlueprint: (id) =>
        set((s) => ({
          blueprints: s.blueprints.filter((bp) => bp.id !== id),
          selectedBlueprintId:
            s.selectedBlueprintId === id ? null : s.selectedBlueprintId,
        })),

      setSelectedBlueprint: (id) => set({ selectedBlueprintId: id }),

      addRun: (run) => set((s) => ({ runs: [...s.runs, run] })),

      updateRun: (id, updater) =>
        set((s) => ({
          runs: s.runs.map((r) => (r.id === id ? { ...r, ...updater } : r)),
        })),

      exportBlueprint: (id) => {
        const bp = get().blueprints.find((b) => b.id === id);
        if (!bp) return null;
        return JSON.stringify(bp, null, 2);
      },

      ensureStarters: () => {
        const starters = STARTER_BLUEPRINTS.map(specToBlueprint);
        const have = new Set(get().blueprints.map((bp) => bp.id));
        const missing = starters.filter((bp) => !have.has(bp.id));
        if (missing.length === 0 && get().startersSeeded) return;
        set({
          startersSeeded: true,
          blueprints: [...missing, ...get().blueprints],
        });
      },

      importBlueprint: (json) => {
        try {
          const parsed = JSON.parse(json) as Blueprint;
          if (!parsed.id || !parsed.name) return null;
          const bp: Blueprint = {
            ...parsed,
            updatedAt: Date.now(),
          };
          get().addBlueprint(bp);
          return bp;
        } catch {
          return null;
        }
      },
    }),
    {
      name: 'ars-blueprints',
      partialize: (state) => ({
        blueprints: state.blueprints,
        selectedBlueprintId: state.selectedBlueprintId,
        startersSeeded: state.startersSeeded,
      }),
      onRehydrateStorage: () => (state) => {
        state?.ensureStarters();
      },
    }
  )
);
