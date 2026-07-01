// ============================================================
// ARS TECHNICAI — Asset Evolution Tracker
// Traces how assets evolve: vertical (parent→child derivatives)
// and horizontal (sibling variations). Builds lineage trees
// from generation metadata and asset relationships.
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'intel.asset.evolution';

export interface AssetNode {
  id: string;
  name: string;
  type: string;
  thumbnail?: string;
  prompt?: string;
  createdAt: number;
  children: AssetNode[];
  siblings: AssetNode[];
  parent?: AssetNode;
  depth: number;         // 0 = root/original
  generationIndex: number; // order in generation sequence
}

export interface EvolutionTree {
  rootAssets: AssetNode[];
  totalAssets: number;
  maxDepth: number;
  lineages: number;     // number of distinct root lineages
  horizontalClusters: AssetNode[][]; // groups of siblings
}

export const moduleDef: ModuleDef = {
  id,
  name: 'Asset Evolution Tracker',
  category: 'intelligence',
  description: 'Trace how assets evolve vertically (parent→child derivatives like inpaint crops edits) and horizontally (sibling variations from same generation batch). Builds lineage trees from generation metadata, parentAssetId references, and variation clusters.',
  inputs: [
    { id: 'assets', label: 'Asset Array', type: 'data', direction: 'input' },
    { id: 'generations', label: 'Generation Metadata', type: 'data', direction: 'input', optional: true },
  ],
  outputs: [
    { id: 'evolutionTree', label: 'Evolution Tree', type: 'data', direction: 'output' },
    { id: 'lineages', label: 'Lineage Count', type: 'number', direction: 'output' },
    { id: 'horizontalClusters', label: 'Variation Clusters', type: 'data', direction: 'output' },
    { id: 'summary', label: 'Evolution Summary', type: 'text', direction: 'output' },
  ],
  parameters: [
    { id: 'maxDepth', label: 'Max Tree Depth', type: 'number', default: 5, min: 1, max: 20 },
    { id: 'groupBy', label: 'Group Siblings By', type: 'enum', options: ['parentId', 'prompt', 'lineageId', 'auto'], default: 'auto' },
    { id: 'includeThumbnails', label: 'Include Thumbnails', type: 'boolean', default: true },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    const assets = (ctx.inputs.assets as any[]) || [];
    const maxDepth = (ctx.parameters.maxDepth as number) || 5;
    const groupBy = (ctx.parameters.groupBy as string) || 'auto';

    if (assets.length === 0) {
      return {
        outputs: { evolutionTree: { rootAssets: [], totalAssets: 0, maxDepth: 0, lineages: 0, horizontalClusters: [] }, lineages: 0, horizontalClusters: [], summary: 'No assets to trace.' },
        metadata: { assetCount: 0 },
      };
    }

    // Build evolution tree from asset metadata
    const tree = buildEvolutionTree(assets, maxDepth, groupBy);
    const summary = generateEvolutionSummary(tree);

    return {
      outputs: {
        evolutionTree: tree,
        lineages: tree.lineages,
        horizontalClusters: tree.horizontalClusters,
        summary,
      },
      metadata: {
        totalAssets: tree.totalAssets,
        maxDepth: tree.maxDepth,
        lineages: tree.lineages,
        clusterCount: tree.horizontalClusters.length,
      },
    };
  },
};

function buildEvolutionTree(
  assets: any[],
  maxDepth: number,
  groupBy: string,
): EvolutionTree {
  // Index assets by ID
  const byId = new Map<string, any>();
  for (const a of assets) {
    byId.set(a.id, a);
  }

  // Find root assets (no parent)
  const roots: AssetNode[] = [];
  const childMap = new Map<string, string[]>(); // parentId → childIds

  for (const a of assets) {
    const parentId = a.parentAssetId || a.metadata?.parentAssetId || a.metadata?.parentId;
    if (parentId) {
      if (!childMap.has(parentId)) childMap.set(parentId, []);
      childMap.get(parentId)!.push(a.id);
    } else {
      roots.push(assetToNode(a, 0));
    }
  }

  // If no roots found (all assets have parents but parents missing), use first-generation assets
  if (roots.length === 0) {
    // Group by prompt similarity as fallback
    const clusters = clusterByPrompt(assets);
    for (const cluster of clusters) {
      if (cluster.length > 0) {
        const root = assetToNode(cluster[0], 0);
        roots.push(root);
      }
    }
  }

  // Recursively build children
  for (const root of roots) {
    buildChildren(root, childMap, byId, 0, maxDepth);
  }

  // Find horizontal clusters (siblings — assets with same parent)
  const horizontalClusters: AssetNode[][] = [];
  for (const [parentId, childIds] of childMap) {
    if (childIds.length >= 2) {
      const cluster = childIds
        .map(id => byId.get(id))
        .filter(Boolean)
        .map(a => assetToNode(a, 1));
      if (cluster.length >= 2) horizontalClusters.push(cluster);
    }
  }

  // If no parent-based clusters, cluster by prompt
  if (horizontalClusters.length === 0) {
    const promptClusters = clusterByPrompt(assets);
    for (const cluster of promptClusters) {
      if (cluster.length >= 2) {
        horizontalClusters.push(cluster.map(a => assetToNode(a, 0)));
      }
    }
  }

  // Compute maxDepth and total
  let maxD = 0;
  let total = 0;
  function walk(node: AssetNode) {
    total++;
    if (node.depth > maxD) maxD = node.depth;
    for (const child of node.children) walk(child);
  }
  for (const root of roots) walk(root);

  return {
    rootAssets: roots,
    totalAssets: total,
    maxDepth: maxD,
    lineages: roots.length,
    horizontalClusters,
  };
}

function buildChildren(
  node: AssetNode,
  childMap: Map<string, string[]>,
  byId: Map<string, any>,
  currentDepth: number,
  maxDepth: number,
): void {
  if (currentDepth >= maxDepth) return;
  const childIds = childMap.get(node.id) || [];
  for (const cid of childIds) {
    const childAsset = byId.get(cid);
    if (childAsset) {
      const childNode = assetToNode(childAsset, currentDepth + 1);
      childNode.parent = node;
      node.children.push(childNode);
      buildChildren(childNode, childMap, byId, currentDepth + 1, maxDepth);
    }
  }

  // Add siblings from same generation batch
  const siblings = findSiblings(node, byId, childMap);
  node.siblings = siblings.map(a => assetToNode(a, node.depth));
}

function findSiblings(
  node: AssetNode,
  byId: Map<string, any>,
  childMap: Map<string, string[]>,
): any[] {
  // Find assets with same parentAssetId
  const siblings: any[] = [];
  for (const [id, asset] of byId) {
    if (id === node.id) continue;
    const parentId = asset.parentAssetId || asset.metadata?.parentAssetId;
    // Find the parent of this node
    let nodeParentId = '';
    for (const [pid, children] of childMap) {
      if (children.includes(node.id)) { nodeParentId = pid; break; }
    }
    if (parentId === nodeParentId && parentId) {
      siblings.push(asset);
    }
  }
  return siblings;
}

function assetToNode(asset: any, depth: number): AssetNode {
  return {
    id: asset.id,
    name: asset.name || 'Untitled',
    type: asset.type || 'image',
    thumbnail: asset.thumbnail || asset.dataUrl,
    prompt: asset.prompt || asset.metadata?.prompt,
    createdAt: asset.createdAt || asset.metadata?.generatedAt || Date.now(),
    children: [],
    siblings: [],
    depth,
    generationIndex: 0,
  };
}

function clusterByPrompt(assets: any[]): any[][] {
  const clusters: any[][] = [];
  const used = new Set<string>();

  for (const a of assets) {
    if (used.has(a.id)) continue;
    const prompt = (a.prompt || a.metadata?.prompt || '').toLowerCase().slice(0, 50);
    if (!prompt) continue;

    const cluster: any[] = [a];
    used.add(a.id);

    for (const b of assets) {
      if (used.has(b.id)) continue;
      const bPrompt = (b.prompt || b.metadata?.prompt || '').toLowerCase().slice(0, 50);
      if (bPrompt === prompt) {
        cluster.push(b);
        used.add(b.id);
      }
    }

    clusters.push(cluster);
  }

  return clusters.filter(c => c.length >= 2);
}

function generateEvolutionSummary(tree: EvolutionTree): string {
  const parts: string[] = [];
  parts.push(`${tree.totalAssets} total assets traced`);
  parts.push(`${tree.lineages} distinct lineages (root assets)`);
  parts.push(`Maximum evolution depth: ${tree.maxDepth} generations`);

  if (tree.horizontalClusters.length > 0) {
    parts.push(`${tree.horizontalClusters.length} variation clusters found`);
    const avgClusterSize = tree.horizontalClusters.reduce((s, c) => s + c.length, 0) / tree.horizontalClusters.length;
    parts.push(`Average ${avgClusterSize.toFixed(1)} variations per cluster`);
  } else {
    parts.push('No variation clusters detected');
  }

  // Direction analysis
  const hasVertical = tree.maxDepth > 1;
  const hasHorizontal = tree.horizontalClusters.length > 0;
  if (hasVertical && hasHorizontal) parts.push('Both vertical (derivative) and horizontal (variation) development active');
  else if (hasVertical) parts.push('Vertical development only (derivatives, no variations)');
  else if (hasHorizontal) parts.push('Horizontal development only (variations, no derivatives)');
  else parts.push('Single-generation assets (no evolution yet)');

  return parts.join('. ');
}
