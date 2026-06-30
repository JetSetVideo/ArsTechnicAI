// ============================================================
// ARS TECHNICAI — Script to Shots Module
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'intelligence.script-to-shots';

export const moduleDef: ModuleDef = {
  id,
  name: 'Script to Shots',
  category: 'intelligence',
  description: 'Convert a video script into a shot list with camera angles, movements, timing, and visual references.',
  inputs: [
    { id: 'input', label: 'Input Data', type: 'data', direction: 'input', optional: true },
  ],
  outputs: [
    { id: 'result', label: 'Result', type: 'data', direction: 'output' },
  ],
  parameters: [
    { id: 'detail', label: 'Detail Level', type: 'enum', default: 'standard', options: ['outline', 'standard', 'storyboard'] },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    ctx.onProgress?.(50, 'Processing...');
    return {
      outputs: { result: ctx.parameters },
      metadata: { operation: 'script-to-shots', timestamp: Date.now() },
    };
  },
};
