import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { GitBranch, ChevronDown, ChevronRight } from 'lucide-react';
import { useBlueprintStore } from '@/stores/blueprintStore';
import { usePipelineStore } from '@/stores/pipelineStore';
import { useProjectsStore } from '@/stores/projectsStore';
import { useUserStore } from '@/stores/userStore';
import { useFileStore } from '@/stores/fileStore';
import { saveProjectWorkspaceState } from '@/hooks/useProjectSync';
import { projectPathFromName } from '@/utils/project';
import {
  PENDING_BLUEPRINT_KEY,
  graphToBlueprint,
  inferCategory,
} from '@/lib/pipeline/blueprintBridge';
import type { Blueprint } from '@/types/blueprint';
import homeStyles from '../dashboard/HomeLeftPanel.module.css';
import styles from './BlueprintShelf.module.css';

function useBlueprintList() {
  const blueprints = useBlueprintStore((s) => s.blueprints);
  useEffect(() => {
    const seed = () => useBlueprintStore.getState().ensureStarters();
    if (useBlueprintStore.persist.hasHydrated()) seed();
    return useBlueprintStore.persist.onFinishHydration(seed);
  }, []);
  return blueprints;
}

function openBlueprintProject(bp: Blueprint, push: (href: string) => void) {
  const current = useUserStore.getState().currentProject;
  saveProjectWorkspaceState(current.id, current.name);
  const project = useProjectsStore.getState().addProject({
    name: bp.name,
    description: bp.description,
    tags: ['blueprint', bp.category],
  });
  useProjectsStore.getState().openProject(project.id);
  useUserStore.setState({
    currentProject: {
      id: project.id,
      name: project.name,
      createdAt: project.createdAt,
      modifiedAt: project.modifiedAt,
      path: projectPathFromName(project.name),
    },
  });
  useFileStore.getState().switchToProject(project.name, project.id);
  sessionStorage.setItem(PENDING_BLUEPRINT_KEY, bp.id);
  push(`/project/${project.id}`);
}

export const BlueprintShelf: React.FC<{ variant: 'home' | 'workshop' }> = ({ variant }) => {
  const router = useRouter();
  const blueprints = useBlueprintList();
  const [open, setOpen] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const nodeCount = usePipelineStore((s) => s.nodes.length);

  const apply = (bp: Blueprint, mode: 'replace' | 'insert') => {
    const next = usePipelineStore.getState().applyBlueprint(bp, mode);
    setWarnings(next);
    if (variant === 'workshop') setOpen(false);
  };

  const saveCurrent = () => {
    const { nodes, edges } = usePipelineStore.getState();
    if (nodes.length === 0) return;
    const name = window.prompt('Name this blueprint');
    if (!name?.trim()) return;
    const bp = graphToBlueprint(nodes, edges, {
      name: name.trim(),
      category: inferCategory(nodes),
      description: 'Saved from the workshop.',
    });
    useBlueprintStore.getState().addBlueprint(bp);
  };

  const list = (
    <div className={styles.list}>
      {blueprints.length === 0 && <p className={styles.meta}>No blueprints yet.</p>}
      {blueprints.map((bp) => (
        <div key={bp.id} className={styles.row}>
          <span className={styles.name}>{bp.name}</span>
          <span className={styles.meta}>
            {bp.category} · {bp.nodes.length} nodes{bp.description ? ` · ${bp.description}` : ''}
          </span>
          <div className={styles.actions}>
            {variant === 'home' ? (
              <button type="button" onClick={() => openBlueprintProject(bp, (href) => void router.push(href))}>
                Open in Workshop
              </button>
            ) : (
              <>
                <button type="button" onClick={() => apply(bp, 'replace')}>
                  Replace
                </button>
                <button type="button" onClick={() => apply(bp, 'insert')} disabled={nodeCount === 0}>
                  Add beside
                </button>
              </>
            )}
          </div>
        </div>
      ))}
      {warnings.length > 0 && <p className={styles.warn}>{warnings.join(' ')}</p>}
    </div>
  );

  if (variant === 'home') {
    return (
      <div className={styles.block}>
        <button
          type="button"
          className={homeStyles.quickAction}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <GitBranch size={12} />
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />} Blueprints
        </button>
        {open && list}
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <button type="button" className={styles.trigger} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <GitBranch size={14} /> Blueprints
      </button>
      {open && (
        <div className={styles.panel}>
          {list}
          <button type="button" className={styles.save} onClick={saveCurrent} disabled={nodeCount === 0}>
            Save this pipeline as a blueprint
          </button>
        </div>
      )}
    </div>
  );
};
