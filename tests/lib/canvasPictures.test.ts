import { describe, expect, it } from 'vitest';
import {
  buildLibrary,
  displayCover,
  entriesForProject,
  picturesFromNodes,
  placeFromPath,
} from '../../lib/pipeline/canvasPictures';
import type { Asset } from '../../types';

const asset = (over: Partial<Asset>): Asset => ({
  id: 'a1',
  name: 'file.png',
  type: 'image',
  path: '/projects/untitled-project/generated/file.png',
  createdAt: 1,
  modifiedAt: 2,
  ...over,
});

describe('picturesFromNodes', () => {
  it('keeps images that are on the node and skips empty variants', () => {
    const pictures = picturesFromNodes([{
      id: 'n1',
      title: 'Import Image',
      params: { file: 'data:image/png;base64,AAA' },
      variants: [
        { id: 'v1', label: 'Take 1', image: 'data:image/png;base64,AAA', updatedAt: 10 },
        { id: 'v2', image: 'hello', updatedAt: 11 },
        { id: 'v3', label: 'Take 2', image: 'data:image/png;base64,BBB', updatedAt: 12 },
      ],
    }]);
    expect(pictures.map((picture) => picture.variantId)).toEqual(['v1', 'v3']);
    expect(pictures[0].nodeTitle).toBe('Import Image');
    expect(pictures[0].name).toBe('Take 1');
  });

  it('uses a file on the node when no variant already has it', () => {
    const pictures = picturesFromNodes([{
      id: 'n1',
      title: 'Import Image',
      params: { file: '/generated/plate.png' },
      variants: [],
    }]);
    expect(pictures).toHaveLength(1);
    expect(pictures[0].name).toBe('plate.png');
    expect(pictures[0].src).toBe('/generated/plate.png');
  });
});

describe('displayCover', () => {
  const pictures = [
    { nodeId: 'n', nodeTitle: 'Key Visual', variantId: 'v', name: 'Key Visual', src: 'data:image/png;base64,NEW', updatedAt: 20 },
    { nodeId: 'n2', nodeTitle: 'Older', variantId: 'v', name: 'Older', src: 'data:image/png;base64,OLD', updatedAt: 5 },
  ];

  it('replaces a cover that is not on the canvas', () => {
    expect(displayCover('/generated/gen_une-jolie-femme.png', pictures)).toBe('data:image/png;base64,NEW');
  });

  it('keeps a cover the canvas still has', () => {
    expect(displayCover('data:image/png;base64,OLD', pictures)).toBe('data:image/png;base64,OLD');
  });
});

describe('placeFromPath', () => {
  it('names the project folder', () => {
    expect(placeFromPath('/projects/untitled-project/generated/shot.png')).toEqual({
      label: 'Generated',
      detail: 'untitled-project',
    });
    expect(placeFromPath('/imports/clip.mp4').label).toBe('Imports');
  });
});

describe('buildLibrary', () => {
  it('lists the folder file and the canvas picture, each with a source', () => {
    const listed = buildLibrary(
      [asset({ thumbnail: '/generated/file.png' })],
      [{
        projectId: 'p1',
        projectName: 'Untitled Project',
        updatedAt: 1,
        pictures: [
          { nodeId: 'n', nodeTitle: 'Import Image', variantId: 'v', name: 'Import Image', src: 'data:image/png;base64,CANVAS', updatedAt: 9 },
          { nodeId: 'n2', nodeTitle: 'File', variantId: 'v', name: 'file.png', src: '/generated/file.png', updatedAt: 8 },
        ],
      }],
      [{ id: 'p1', name: 'Untitled Project' }],
    );
    expect(listed.map((item) => [item.placeLabel, item.placeDetail, item.name])).toEqual([
      ['Generated', 'Untitled Project', 'file.png'],
      ['Canvas', 'Untitled Project', 'Import Image'],
    ]);
  });

  it('treats a canvas copy of a folder file as that file', () => {
    const listed = buildLibrary(
      [asset({
        name: 'gen_a-computer.png',
        path: '/projects/untitled-project/generated/gen_a-computer.png',
      })],
      [{
        projectId: 'old',
        projectName: 'Gone',
        updatedAt: 1,
        pictures: [{
          nodeId: 'n',
          nodeTitle: 'Import Image',
          variantId: 'a',
          name: 'gen_a-computer.png',
          src: 'data:image/jpeg;base64,abc',
          updatedAt: 2,
        }],
      }],
      [{ id: 'live', name: 'Untitled Project' }],
    );
    expect(listed.map((item) => item.placeLabel)).toEqual(['Generated']);
  });

  it('groups versions and marks pictures that are not on a current project', () => {
    const listed = buildLibrary([], [{
      projectId: 'old',
      projectName: 'Gone',
      updatedAt: 1,
      pictures: [
        { nodeId: 'n', nodeTitle: 'Animate Image', variantId: 'a', name: 'v1', src: 'data:image/png;base64,A', updatedAt: 2 },
        { nodeId: 'n', nodeTitle: 'Animate Image', variantId: 'b', name: 'v1', src: 'data:image/png;base64,B', updatedAt: 9 },
      ],
    }], [{ id: 'live', name: 'Untitled Project' }]);
    expect(listed).toHaveLength(1);
    expect(listed[0].placeLabel).toBe('No project');
    expect(listed[0].placeDetail).toBe('Not on a current project');
    expect(listed[0].name).toBe('Animate Image');
    expect(listed[0].metadata?.variationIds).toEqual(['b', 'a']);
    expect(listed[0].metadata?.projectIds).toEqual([]);
  });
});

describe('entriesForProject', () => {
  it('does not borrow another project canvas', () => {
    const entries = entriesForProject('p1', 'Untitled Project', [
      asset({}),
      asset({ id: 'other', path: '/projects/other/generated/x.png', name: 'x.png' }),
    ], [
      { nodeId: 'n', nodeTitle: 'Moodboard', variantId: 'v', name: 'Moodboard', src: 'data:image/png;base64,M', updatedAt: 3 },
    ]);
    expect(entries.map((item) => item.name)).toEqual(['file.png', 'Moodboard']);
    expect(entries[1].placeLabel).toBe('Canvas');
  });
});
