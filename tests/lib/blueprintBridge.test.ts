import { describe, expect, it } from 'vitest';
import {
  STARTER_BLUEPRINTS,
  compileBlueprint,
  graphToBlueprint,
  inferCategory,
  specToBlueprint,
} from '../../lib/pipeline/blueprintBridge';
import type { Blueprint } from '../../types/blueprint';

function signature(bp: ReturnType<typeof compileBlueprint>): string[] {
  const typeById = new Map(bp.nodes.map((node) => [node.id, node.type]));
  return bp.edges
    .map((edge) => `${typeById.get(edge.from)}:${edge.fromPort}->${typeById.get(edge.to)}:${edge.toPort}`)
    .sort();
}

describe('blueprint bridge', () => {
  it('compiles every starter into a connected workshop graph', () => {
    expect(STARTER_BLUEPRINTS.length).toBeGreaterThanOrEqual(16);
    const ids = new Set(STARTER_BLUEPRINTS.map((spec) => spec.id));
    expect(ids.size).toBe(STARTER_BLUEPRINTS.length);
    for (const spec of STARTER_BLUEPRINTS) {
      expect(spec.card.image.startsWith('/workflow-cards/'), spec.id).toBe(true);
      expect(spec.card.summary.length, spec.id).toBeGreaterThan(12);
      const compiled = compileBlueprint(specToBlueprint(spec));
      expect(compiled.warnings, spec.id).toEqual([]);
      expect(compiled.nodes).toHaveLength(spec.nodes.length);
      expect(compiled.edges).toHaveLength(spec.links.length);
      expect(new Set(compiled.nodes.map((node) => node.id)).size).toBe(spec.nodes.length);
      expect(compiled.nodes.every((node) => node.x === undefined)).toBe(true);
    }
  });

  it('skips a node the catalog does not know and drops its links', () => {
    const bp: Blueprint = {
      id: 'bp-test',
      name: 'Broken',
      category: 'image',
      version: '1',
      createdAt: 0,
      updatedAt: 0,
      parameters: [],
      nodes: [
        { id: 'a', moduleId: 'not-a-node', x: 0, y: 0, parameters: {} },
        { id: 'b', moduleId: 'keyframe-gen', x: 0, y: 0, parameters: { subject: 'a door' } },
      ],
      connections: [
        { id: 'c', fromNodeId: 'a', fromPort: 'out', toNodeId: 'b', toPort: 'prompt' },
      ],
    };
    const compiled = compileBlueprint(bp);
    expect(compiled.nodes.map((node) => node.type)).toEqual(['keyframe-gen']);
    expect(compiled.nodes[0].params.subject).toBe('a door');
    expect(compiled.edges).toHaveLength(0);
    expect(compiled.warnings.length).toBeGreaterThan(0);
  });

  it('drops a link whose ports do not fit', () => {
    const bp = specToBlueprint(STARTER_BLUEPRINTS[0]);
    bp.connections = [
      ...bp.connections,
      { id: 'bad', fromNodeId: 'mood', fromPort: 'images', toNodeId: 'key', toPort: 'prompt' },
    ];
    const compiled = compileBlueprint(bp);
    expect(compiled.edges).toHaveLength(STARTER_BLUEPRINTS[0].links.length);
    expect(compiled.warnings.some((line) => line.includes('images'))).toBe(true);
  });

  it('round-trips a compiled graph without losing links', () => {
    const spec = STARTER_BLUEPRINTS[1];
    const first = compileBlueprint(specToBlueprint(spec));
    const saved = graphToBlueprint(first.nodes, first.edges, {
      name: spec.name,
      category: inferCategory(first.nodes),
    });
    expect(saved.category).toBe('video');
    const second = compileBlueprint(saved);
    expect(second.warnings).toEqual([]);
    expect(signature(second)).toEqual(signature(first));
  });
});
