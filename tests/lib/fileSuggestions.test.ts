import { describe, expect, it } from 'vitest';
import { ancestorPaths, suggestionGroups } from '../../lib/search/fileSuggestions';
import type { FileSearchInput } from '../../lib/search/fileSuggestions';
import { parseBingImages } from '../../lib/search/webImages';

const files: FileSearchInput[] = [
  { id: 'n1', label: 'Character sheet', kind: 'node' },
  { id: 'n2', label: 'Caption', kind: 'node' },
  { id: 'n3', label: 'Color grade', kind: 'node' },
  { id: 'n4', label: 'Compose', kind: 'node' },
  { id: 'a', label: 'gen_a-computer.png', kind: 'image', thumbnail: 'thumb-a', path: '/gen/gen_a-computer.png' },
  { id: 'b', label: 'sim-computer.png', kind: 'image', thumbnail: 'thumb-b', path: '/gen/sim-computer.png' },
];

describe('file suggestions', () => {
  it('lists every node whose title contains the letter, beside the pictured files', () => {
    const groups = suggestionGroups(files, 'c');
    expect(groups.nodes.map((hit) => hit.label).sort()).toEqual([
      'Caption',
      'Character sheet',
      'Color grade',
      'Compose',
    ]);
    const pictures = groups.files.map((hit) => hit.label).sort();
    expect(pictures).toEqual(['gen_a-computer.png', 'sim-computer.png']);
    expect(groups.files.every((hit) => hit.thumbnail)).toBe(true);
  });

  it('still finds a picture from its prompt when the file name does not match', () => {
    const groups = suggestionGroups(
      [{ id: 'p', label: 'gen_a.png', kind: 'image', thumbnail: 'thumb', text: 'a sim computer on a desk' }],
      'computer'
    );
    expect(groups.files).toHaveLength(1);
    expect(groups.files[0].thumbnail).toBe('thumb');
  });

  it('shows the folder and how many matching files are in it', () => {
    const groups = suggestionGroups([
      { id: 'folder:/projects/demo/generated', label: 'Generated', kind: 'folder', path: '/projects/demo/generated', count: 6, text: '6 files' },
      { id: 'a', label: 'gen_a-computer.png', kind: 'image', thumbnail: 'thumb-a', path: '/projects/demo/generated/gen_a-computer.png' },
      { id: 'b', label: 'notes.txt', kind: 'text', path: '/projects/demo/generated/notes.txt' },
    ], 'computer');
    expect(groups.folders.map((hit) => [hit.label, hit.count])).toEqual([['Generated', 6]]);
    expect(groups.files.map((hit) => hit.label)).toEqual(['gen_a-computer.png']);
  });

  it('lists the folders above a file', () => {
    expect(ancestorPaths('/projects/demo/generated/gen_a-computer.png')).toEqual([
      '/projects',
      '/projects/demo',
      '/projects/demo/generated',
    ]);
  });
});

describe('web image results', () => {
  it('reads the first pictures off an image-results page', () => {
    const html = `
      <a m="{&quot;t&quot;:&quot;Red bicycle&quot;,&quot;turl&quot;:&quot;https://ts1.mm.bing.net/th?id=abc&quot;,&quot;purl&quot;:&quot;https://example.com/bike&quot;,&quot;murl&quot;:&quot;https://example.com/bike.jpg&quot;}"></a>
      <a m="{&quot;t&quot;:&quot;Second&quot;,&quot;turl&quot;:&quot;https://ts2.mm.bing.net/th?id=def&quot;,&quot;purl&quot;:&quot;https://example.com/two&quot;}"></a>
    `;
    const hits = parseBingImages(html);
    expect(hits).toEqual([
      { title: 'Red bicycle', thumbnail: 'https://ts1.mm.bing.net/th?id=abc', page: 'https://example.com/bike' },
      { title: 'Second', thumbnail: 'https://ts2.mm.bing.net/th?id=def', page: 'https://example.com/two' },
    ]);
  });
});
