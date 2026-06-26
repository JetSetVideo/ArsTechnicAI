// ============================================================
// ARS TECHNICAI — Text/Data Parser Module
// Phase 1.5: Parse SRT, JSON, CSV, MD, TXT, VTT
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'import.decode.text';

export interface SubtitleEntry {
  index: number;
  start: string;
  end: string;
  text: string;
}

export const moduleDef: ModuleDef = {
  id,
  name: 'Text/Data Parser',
  category: 'ingest',
  description: 'Parse text files: SRT, VTT, JSON, CSV, Markdown, plain text',
  library: 'Native JS + papaparse',
  inputs: [
    { id: 'file', name: 'File', type: 'data', required: true, description: 'Text Blob or File' },
  ],
  outputs: [
    { id: 'text', name: 'Text', type: 'text', description: 'Raw text content' },
    { id: 'structured', name: 'Structured', type: 'data', description: 'Parsed structured data' },
    { id: 'format', name: 'Format', type: 'text', description: 'Detected format: json | csv | srt | vtt | md | txt' },
  ],
  parameters: [],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    const file = ctx.inputs.file as File | Blob | undefined;
    if (!file) {
      return { outputs: {}, error: 'No text file provided' };
    }

    const blob = file instanceof File ? file : new File([file], 'text', { type: 'text/plain' });
    const text = await blob.text();
    const name = blob.name.toLowerCase();

    let format = 'txt';
    let structured: unknown = null;

    // Detect format by extension and content
    if (name.endsWith('.json') || blob.type === 'application/json') {
      format = 'json';
      try {
        structured = JSON.parse(text);
      } catch {
        return { outputs: {}, error: 'Invalid JSON file' };
      }
    } else if (name.endsWith('.csv') || blob.type === 'text/csv') {
      format = 'csv';
      structured = parseCSV(text);
    } else if (name.endsWith('.srt')) {
      format = 'srt';
      structured = parseSRT(text);
    } else if (name.endsWith('.vtt')) {
      format = 'vtt';
      structured = parseVTT(text);
    } else if (name.endsWith('.md') || name.endsWith('.markdown')) {
      format = 'md';
      structured = { headings: extractMarkdownHeadings(text), wordCount: text.trim().split(/\s+/).length };
    }

    return {
      outputs: {
        text,
        structured,
        format,
      },
      logs: [`Parsed ${format.toUpperCase()}: ${text.length} chars`],
    };
  },
};

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  // Simple CSV parser (no quote handling for now)
  const headers = lines[0].split(',').map((h) => h.trim());
  const rows = lines.slice(1).map((line) => line.split(',').map((cell) => cell.trim()));
  return { headers, rows };
}

function parseSRT(text: string): SubtitleEntry[] {
  const entries: SubtitleEntry[] = [];
  const blocks = text.trim().split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 3) continue;

    const index = parseInt(lines[0], 10);
    const timeLine = lines[1];
    const textLines = lines.slice(2);

    const timeMatch = timeLine.match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/);
    if (!timeMatch) continue;

    entries.push({
      index,
      start: timeMatch[1],
      end: timeMatch[2],
      text: textLines.join('\n').trim(),
    });
  }

  return entries;
}

function parseVTT(text: string): SubtitleEntry[] {
  const entries: SubtitleEntry[] = [];
  const lines = text.trim().split(/\r?\n/);
  if (lines[0]?.trim() === 'WEBVTT') lines.shift();

  let currentIndex = 0;
  let currentText: string[] = [];
  let currentStart = '';
  let currentEnd = '';

  for (const line of lines) {
    const timeMatch = line.match(/(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})/);
    if (timeMatch) {
      if (currentStart) {
        entries.push({ index: ++currentIndex, start: currentStart, end: currentEnd, text: currentText.join('\n').trim() });
      }
      currentStart = timeMatch[1];
      currentEnd = timeMatch[2];
      currentText = [];
    } else if (currentStart && line.trim()) {
      currentText.push(line);
    }
  }

  if (currentStart) {
    entries.push({ index: ++currentIndex, start: currentStart, end: currentEnd, text: currentText.join('\n').trim() });
  }

  return entries;
}

function extractMarkdownHeadings(text: string): Array<{ level: number; text: string }> {
  const headings: Array<{ level: number; text: string }> = [];
  const lines = text.split('\n');
  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      headings.push({ level: match[1].length, text: match[2].trim() });
    }
  }
  return headings;
}
