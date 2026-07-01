// ============================================================
// ARS TECHNICAI — Project Hierarchy Support
// Adds parent/child relationships and drag-drop reordering.
// ============================================================

export function addProjectParentChildPatch() {
  // This module exports utilities for project hierarchy management.
  // Projects can have: parentProjectId, childProjectIds[]
  // Drag-drop reorder: projectOrder[]
  // Vertical development: derivative projects from assets
  // Horizontal development: sibling projects sharing assets
}

export interface ProjectRelation {
  parentId: string | null;
  childIds: string[];
  siblingIds: string[];
  order: number;
  depth: number; // 0 = root, 1 = child of root, etc.
}

export function computeProjectRelations(
  projectId: string,
  allProjects: Array<{ id: string; parentId?: string | null }>
): ProjectRelation {
  const project = allProjects.find(p => p.id === projectId);
  const childIds = allProjects.filter(p => p.parentId === projectId).map(p => p.id);
  const siblingIds = project?.parentId
    ? allProjects.filter(p => p.parentId === project.parentId && p.id !== projectId).map(p => p.id)
    : allProjects.filter(p => !p.parentId && p.id !== projectId).map(p => p.id);
  
  // Compute depth
  let depth = 0;
  let current = project;
  while (current?.parentId) {
    depth++;
    current = allProjects.find(p => p.id === current!.parentId);
  }
  
  return {
    parentId: project?.parentId || null,
    childIds,
    siblingIds,
    order: 0,
    depth,
  };
}
