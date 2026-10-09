/** A name the workshop search bar can offer, with the picture the explorer shows. */
export interface FileSearchInput {
  id: string;
  label: string;
  kind: string;
  thumbnail?: string;
  /** Explorer path. Present for files, absent for pipeline nodes. */
  path?: string;
  /** Subtitle, or a prompt that should match even when the file name does not. */
  text?: string;
  /** Catalog type. Choosing it adds that node. Absent on a node already on the canvas. */
  nodeType?: string;
  /** Files inside a folder result. */
  count?: number;
}

/**
 * Folder prefixes of a file path, so choosing a result can open the folders
 * above it. `/a/b/c.png` yields `['/a', '/a/b']`.
 */
export function ancestorPaths(path: string): string[] {
  const parts = path.split('/');
  const prefixes: string[] = [];
  for (let i = 1; i < parts.length; i++) {
    const prefix = parts.slice(0, i).join('/');
    if (prefix && prefix !== path) prefixes.push(prefix);
  }
  return prefixes;
}

export interface SuggestionGroups {
  nodes: FileSearchInput[];
  folders: FileSearchInput[];
  files: FileSearchInput[];
}

function takeUnique(rows: { item: FileSearchInput }[], limit: number): FileSearchInput[] {
  const unique: FileSearchInput[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.item.id)) continue;
    seen.add(row.item.id);
    unique.push(row.item);
    if (unique.length === limit) break;
  }
  return unique;
}

/**
 * Split a query into nodes and files.
 * Nodes match on their title, so typing "c" still lists Character and Color Grade
 * when many pictures also contain that letter. Files keep their own list, and a
 * short query puts pictured files first inside that list.
 */
export function suggestionGroups(
  items: FileSearchInput[],
  query: string,
  limits: { nodes?: number; files?: number } = {}
): SuggestionGroups {
  const q = query.trim().toLowerCase();
  if (!q) return { nodes: [], folders: [], files: [] };
  const nodeLimit = limits.nodes ?? 24;
  const fileLimit = limits.files ?? 8;

  const nodes: { item: FileSearchInput; rank: number }[] = [];
  const files: { item: FileSearchInput; rank: number; pictured: number }[] = [];
  const folders: { item: FileSearchInput; rank: number }[] = [];
  for (const item of items) {
    const name = item.label.toLowerCase();
    const extra = (item.text || '').toLowerCase();
    const nameAt = name.indexOf(q);
    if (item.kind === 'node') {
      if (nameAt < 0) continue;
      nodes.push({ item, rank: nameAt === 0 ? 0 : 1 + nameAt });
      continue;
    }
    if (item.kind === 'folder') continue;
    const extraAt = nameAt >= 0 ? -1 : extra.indexOf(q);
    if (nameAt < 0 && extraAt < 0) continue;
    const rank = nameAt === 0 ? 0 : nameAt > 0 ? 1 + nameAt : 50 + extraAt;
    files.push({ item, rank, pictured: item.thumbnail ? 0 : 1 });
  }
  for (const item of items) {
    if (item.kind !== 'folder' || !item.path) continue;
    const nameAt = item.label.toLowerCase().indexOf(q);
    const childHits = files.filter((file) => file.item.path?.startsWith(`${item.path}/`)).length;
    if (nameAt < 0 && childHits === 0) continue;
    folders.push({ item, rank: nameAt === 0 ? 0 : childHits > 0 ? 1 : 2 + Math.max(nameAt, 0) });
  }
  const namedFolders = folders.filter((folder) => folder.item.label.toLowerCase().includes(q));
  if (namedFolders.length > 0) {
    const listed = new Set(files.map((file) => file.item.id));
    for (const item of items) {
      if (item.kind === 'folder' || item.kind === 'node' || !item.path || listed.has(item.id)) continue;
      if (!namedFolders.some((folder) => item.path?.startsWith(`${folder.item.path}/`))) continue;
      files.push({ item, rank: 80, pictured: item.thumbnail ? 0 : 1 });
    }
  }

  const byName = (a: { rank: number; item: FileSearchInput }, b: { rank: number; item: FileSearchInput }) =>
    a.rank - b.rank || a.item.label.localeCompare(b.item.label);
  nodes.sort(byName);
  folders.sort(byName);
  files.sort((a, b) => {
    if (q.length <= 2 && a.pictured !== b.pictured) return a.pictured - b.pictured;
    return byName(a, b);
  });
  return {
    nodes: takeUnique(nodes, nodeLimit),
    folders: takeUnique(folders, 6),
    files: takeUnique(files, fileLimit),
  };
}
