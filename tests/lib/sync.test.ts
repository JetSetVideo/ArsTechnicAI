/**
 * Device sync building blocks: hashing, bundle identity, asset references,
 * the content-addressed blob store and the OneDrive mirror.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createHash, randomBytes } from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { Readable } from 'stream';
import { sha256HexSync, digestHex } from '../../lib/sync/sha256';
import { bundleDigestInput, canonicalJson, assetRefsOf } from '../../lib/sync/bundle';
import { putBlob, hasBlob, blobPath, BlobError } from '../../lib/storage/blobStore';
import { chooseFileName, safeFileName, mirrorAsset, mirrorProjectBundle, type ManifestEntry } from '../../lib/storage/oneDriveMirror';

const nodeSha = (b: Uint8Array | string) => createHash('sha256').update(b).digest('hex');

describe('sha256 fallback (non-secure browser contexts)', () => {
  it.each([0, 1, 55, 56, 63, 64, 65, 119, 120, 1000, 100_000])('matches Node crypto for %i bytes', (n) => {
    const data = new Uint8Array(randomBytes(n));
    expect(sha256HexSync(data)).toBe(nodeSha(data));
  });

  it('digestHex agrees on strings, including non-ASCII', async () => {
    expect(await digestHex('café — 写真')).toBe(nodeSha('café — 写真'));
  });
});

describe('bundle identity', () => {
  it('canonical JSON ignores key order and drops undefined', () => {
    expect(canonicalJson({ b: 1, a: { d: [1, { z: 1, y: 2 }], c: undefined } })).toBe('{"a":{"d":[1,{"y":2,"z":1}]},"b":1}');
  });

  it('ignores savedAt so two devices that merely saved are not in conflict', () => {
    const a = { canvas: { savedAt: 1, items: [{ id: 'x' }] }, fileState: { savedAt: 1 } };
    const b = { canvas: { items: [{ id: 'x' }], savedAt: 999 }, fileState: { savedAt: 5 } };
    expect(bundleDigestInput(a)).toBe(bundleDigestInput(b));
  });

  it('a pulled bundle and its disk form (as workspace/save writes it) hash the same', () => {
    // What the server holds, as the pushing device read it from its disk.
    const server = {
      canvas: { projectId: 'p1', savedAt: 5, items: [{ id: 'c1' }] }, // no viewport, no projectName
      pipeline: { nodes: [{ id: 'n1' }], edges: [], scenes: undefined },
      fileState: { projectPath: '/p', projectAssets: [] },
    };
    // What pages/api/workspace/save.ts writes on the pulling device.
    const disk = {
      canvas: { projectId: 'p1', projectName: 'Film', savedAt: 99, viewport: undefined, items: [{ id: 'c1' }] },
      pipeline: { projectId: 'p1', projectName: 'Film', savedAt: 99, nodes: [{ id: 'n1' }], edges: [], viewport: undefined, collapsedStages: undefined, scenes: undefined, paramTemplates: undefined },
      fileState: { projectId: 'p1', projectName: 'Film', savedAt: 99, projectPath: '/p', projectAssets: [] },
    };
    expect(bundleDigestInput(JSON.parse(JSON.stringify(disk)))).toBe(bundleDigestInput(JSON.parse(JSON.stringify(server))));
  });

  it('changes when content changes', () => {
    expect(bundleDigestInput({ canvas: { items: [1] } })).not.toBe(bundleDigestInput({ canvas: { items: [1, 2] } }));
  });
});

describe('asset references', () => {
  const asset = (id: string, thumb: string) => [id, { id, name: id, thumbnail: thumb, type: 'image' }];

  it('extracts /generated/ files from the file tree', () => {
    const refs = assetRefsOf({ fileState: { projectAssets: [asset('a1', '/generated/gen_a.png'), asset('a2', '/generated/gen_b.png?v=2')] } });
    expect(refs.map((r) => [r.assetId, r.urlPath])).toEqual([['a1', '/generated/gen_a.png'], ['a2', '/generated/gen_b.png']]);
  });

  it('refuses anything that is not a plain file directly under /generated/', () => {
    const refs = assetRefsOf({
      fileState: {
        projectAssets: [
          asset('t1', '/generated/../../.env'),
          asset('t2', '/generated/sub/dir.png'),
          asset('t3', '/etc/passwd'),
          asset('t4', 'https://example.test/generated/x.png'),
          asset('t5', '/generated/..png'),
        ],
      },
    });
    expect(refs).toEqual([]);
  });

  it('deduplicates by asset id', () => {
    const refs = assetRefsOf({ fileState: { projectAssets: [asset('a1', '/generated/x.png'), asset('a1', '/generated/x.png')] } });
    expect(refs).toHaveLength(1);
  });
});

describe('blob store', () => {
  let root: string;
  beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'ars-blob-')); });
  afterEach(async () => { await fs.rm(root, { recursive: true, force: true }); });

  it('stores verified bytes under their hash, once', async () => {
    const data = randomBytes(10_000);
    const sha = nodeSha(data);
    const first = await putBlob(Readable.from([data]), { expectedSha256: sha, root });
    expect(first).toEqual({ sha256: sha, size: 10_000, created: true });
    expect(await fs.readFile(blobPath(sha, root))).toEqual(data);
    const again = await putBlob(Readable.from([data]), { expectedSha256: sha, root });
    expect(again.created).toBe(false);
  });

  it('rejects a hash mismatch and leaves nothing behind', async () => {
    const data = randomBytes(1000);
    const wrong = nodeSha(Buffer.from('other'));
    await expect(putBlob(Readable.from([data]), { expectedSha256: wrong, root })).rejects.toMatchObject({ code: 'HASH_MISMATCH', status: 422 });
    expect(await hasBlob(nodeSha(data), root)).toBe(false);
    expect(await fs.readdir(path.join(root, 'tmp'))).toEqual([]);
  });

  it('rejects oversize uploads and leaves nothing behind', async () => {
    const data = randomBytes(5000);
    await expect(putBlob(Readable.from([data]), { expectedSha256: nodeSha(data), root, maxBytes: 4096 })).rejects.toBeInstanceOf(BlobError);
    expect(await fs.readdir(path.join(root, 'tmp'))).toEqual([]);
  });

  it('refuses malformed hashes as paths', () => {
    expect(() => blobPath('../../etc/passwd', root)).toThrow(BlobError);
  });
});

describe('OneDrive mirror', () => {
  const entry = (file: string, assetId: string, sha256: string): ManifestEntry => ({ file, assetId, sha256, size: 1, updatedAt: '' });

  it('makes names safe for Linux, macOS and OneDrive', () => {
    expect(safeFileName('My Portrait: v1?.png')).toBe('My Portrait_ v1_.png');
    expect(safeFileName('../../etc/passwd')).toBe('_.._etc_passwd');
    expect(safeFileName('~$lock.tmp')).toBe('$lock.tmp');
    expect(safeFileName('name. ')).toBe('name');
    expect(safeFileName('')).toBe('untitled');
  });

  it('never picks a name that holds different bytes', () => {
    const sha = 'a'.repeat(64);
    expect(chooseFileName('x.png', sha, 'A', [], new Set())).toBe('x.png');
    expect(chooseFileName('x.png', sha, 'A', [entry('x.png', 'B', 'b'.repeat(64))], new Set(['x.png']))).toBe('x (aaaaaaaa).png');
    expect(chooseFileName('x.png', sha, 'A', [], new Set(['x.png']))).toBe('x (aaaaaaaa).png'); // a file the user put there
    expect(chooseFileName('x.png', sha, 'A', [entry('x.png', 'B', sha)], new Set(['x.png']))).toBe('x.png'); // same bytes
    expect(chooseFileName('y.png', sha, 'A', [entry('old.png', 'A', 'c'.repeat(64))], new Set(['old.png']))).toBe('old.png'); // keeps its file
  });

  describe('on disk', () => {
    let dir: string;
    let prev: string | undefined;
    beforeEach(async () => {
      dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ars-od-'));
      prev = process.env.ARS_ONEDRIVE_DIR;
      process.env.ARS_ONEDRIVE_DIR = dir;
    });
    afterEach(async () => {
      if (prev === undefined) delete process.env.ARS_ONEDRIVE_DIR; else process.env.ARS_ONEDRIVE_DIR = prev;
      await fs.rm(dir, { recursive: true, force: true });
    });

    it('mirrors readable files atomically and keeps the user’s own files', async () => {
      const src = path.join(dir, 'src.bin');
      await fs.writeFile(src, 'generated-bytes');
      const sha = nodeSha('generated-bytes');

      const first = await mirrorAsset('11111111-2222', 'Film: Noir', { assetId: 'A', name: 'shot.png', sha256: sha, size: 15, mimeType: 'image/png', sourcePath: src });
      expect(first.ok && first.file).toBe('shot.png');
      const projectDir = first.dir!;
      expect(path.basename(projectDir)).toBe('Film_ Noir-11111111');

      // The user drops their own file with the same name as the next asset.
      await fs.writeFile(path.join(projectDir, 'mine.png'), 'hand-made');
      const second = await mirrorAsset('11111111-2222', 'Film: Noir', { assetId: 'B', name: 'mine.png', sha256: sha, size: 15, mimeType: 'image/png', sourcePath: src });
      expect(second.file).toBe(`mine (${sha.slice(0, 8)}).png`);
      expect(await fs.readFile(path.join(projectDir, 'mine.png'), 'utf-8')).toBe('hand-made');

      await mirrorProjectBundle('11111111-2222', 'Film: Noir (renamed)', { canvas: { items: [] } });
      const files = (await fs.readdir(projectDir)).sort();
      expect(files).toEqual(['.arstechnicai-manifest.json', 'mine (' + sha.slice(0, 8) + ').png', 'mine.png', 'project.arstechnic.json', 'shot.png']);
      expect(files.some((f) => f.startsWith('.~ars-'))).toBe(false); // no temp leftovers
      const manifest = JSON.parse(await fs.readFile(path.join(projectDir, '.arstechnicai-manifest.json'), 'utf-8'));
      expect(manifest.projectName).toBe('Film: Noir (renamed)');
      expect(manifest.assets.map((a: ManifestEntry) => a.assetId).sort()).toEqual(['A', 'B']);
      // A rename keeps the same folder.
      expect((await fs.readdir(dir)).filter((n) => n.endsWith('-11111111'))).toHaveLength(1);
    });
  });
});
