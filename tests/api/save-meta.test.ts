/**
 * generations.json persistence — POST upserts by record id (no duplicate ids).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';

const fsMocks = vi.hoisted(() => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  default: {
    readFile: fsMocks.readFile,
    writeFile: fsMocks.writeFile,
    mkdir: fsMocks.mkdir,
  },
}));

import handler from '../../pages/api/generations/save-meta';
import type { GenerationRecord } from '../../pages/api/generations/save-meta';

function makeRecord(overrides: Partial<GenerationRecord> = {}): GenerationRecord {
  return {
    id: 'gen-1',
    prompt: 'a prompt',
    model: 'test-model',
    seed: 1,
    width: 512,
    height: 512,
    generatedAt: Date.now(),
    imageVersion: 1,
    ...overrides,
  };
}

function mockReqRes(method: string, body?: GenerationRecord) {
  const req = { method, body } as unknown as NextApiRequest;
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const res = { status } as unknown as NextApiResponse;
  return { req, res, json, status };
}

describe('save-meta API', () => {
  beforeEach(() => {
    fsMocks.readFile.mockReset();
    fsMocks.writeFile.mockReset();
    fsMocks.mkdir.mockReset();
    fsMocks.mkdir.mockResolvedValue(undefined);
    fsMocks.writeFile.mockResolvedValue(undefined);
  });

  it('POST appends when id is new', async () => {
    fsMocks.readFile.mockRejectedValue(new Error('ENOENT'));
    const record = makeRecord({ id: 'new-id', prompt: 'hello' });
    const { req, res, json } = mockReqRes('POST', record);

    await handler(req, res);

    expect(fsMocks.writeFile).toHaveBeenCalledTimes(1);
    const written = JSON.parse(fsMocks.writeFile.mock.calls[0][1] as string);
    expect(written.generations).toHaveLength(1);
    expect(written.generations[0].id).toBe('new-id');
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, totalGenerations: 1 })
    );
  });

  it('POST upserts when id already exists (no duplicate ids)', async () => {
    const existing = {
      version: 1 as const,
      generations: [makeRecord({ id: 'same', prompt: 'old', seed: 2 })],
      updatedAt: 100,
    };
    fsMocks.readFile.mockResolvedValue(JSON.stringify(existing));

    const updated = makeRecord({ id: 'same', prompt: 'new text', seed: 99 });
    const { req, res } = mockReqRes('POST', updated);

    await handler(req, res);

    const written = JSON.parse(fsMocks.writeFile.mock.calls[0][1] as string);
    expect(written.generations).toHaveLength(1);
    expect(written.generations[0].prompt).toBe('new text');
    expect(written.generations[0].seed).toBe(99);
  });

  it('GET returns meta file contents', async () => {
    const meta = { version: 1, generations: [makeRecord()], updatedAt: 5 };
    fsMocks.readFile.mockResolvedValue(JSON.stringify(meta));
    const { req, res, json } = mockReqRes('GET');

    await handler(req, res);

    expect(json).toHaveBeenCalledWith(meta);
  });

  it('POST rejects missing id or prompt', async () => {
    const { req, res, json } = mockReqRes('POST', { ...makeRecord(), id: '', prompt: '' });

    await handler(req, res);

    expect(json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
    expect(fsMocks.writeFile).not.toHaveBeenCalled();
  });
});
