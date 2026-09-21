import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { GitBranch, Film, Image as ImageIcon, ArrowRight, Database } from 'lucide-react';
import { usePipelineStore } from '@/stores/pipelineStore';
import { useUserStore } from '@/stores/userStore';
import { payloadStats, formatBytes } from '@/lib/pipeline/ingest';
import { STAGE_ORDER, STAGES } from '@/lib/pipeline/catalog';

/**
 * Home-page summary of the Workshop creation pipeline: stage fill, media
 * payload, film runtime — one click continues where the director left off.
 * Workshop state is scoped per-project (stores/pipelineStore.ts), so this
 * card must load the *current* project's pipeline itself — it renders on
 * the home page where WorkshopFlow (which normally triggers that load)
 * isn't mounted.
 */
export const PipelineStatusCard: React.FC = () => {
  const router = useRouter();
  const { nodes, scenes, currentProjectId } = usePipelineStore();
  const { currentProject } = useUserStore();

  useEffect(() => {
    void usePipelineStore.getState().loadForProject(currentProject.id);
  }, [currentProject.id]);

  // Avoid a one-frame flash of the previous project's node count while the
  // newly-selected project's pipeline is loading.
  if (currentProjectId !== currentProject.id) return null;
  if (nodes.length === 0) return null;

  const stats = payloadStats(nodes);
  const runtime = scenes.reduce((acc, s) => acc + (s.duration || 0), 0);
  const doneCount = nodes.filter((n) => n.variants.length > 0).length;

  const openWorkshop = () => {
    router.push(`/project/${currentProject.id}?workshop=1`);
  };

  return (
    <div
      onClick={openWorkshop}
      title="Continue in the Workshop"
      style={{
        display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer',
        margin: '0 0 10px', padding: '10px 14px', borderRadius: 12,
        border: '1px solid rgba(0, 212, 170, 0.25)',
        background: 'linear-gradient(135deg, rgba(0,212,170,0.08), rgba(99,102,241,0.06))',
      }}
    >
      <span style={{ display: 'grid', placeItems: 'center', width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#00d4aa,#0ea5e9)', color: '#04131a', flexShrink: 0 }}>
        <GitBranch size={17} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary, #f0f0fa)' }}>
          Creation pipeline — {nodes.length} nodes · {doneCount} with results
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 5 }}>
          {STAGE_ORDER.map((st) => {
            const stageNodes = nodes.filter((n) => n.stage === st);
            const filled = stageNodes.some((n) => n.variants.length > 0);
            return (
              <span
                key={st}
                title={`${STAGES[st].title}: ${stageNodes.length} node${stageNodes.length === 1 ? '' : 's'}`}
                style={{
                  width: 26, height: 5, borderRadius: 3,
                  background: stageNodes.length === 0
                    ? 'rgba(255,255,255,0.08)'
                    : filled ? STAGES[st].color : `color-mix(in srgb, ${STAGES[st].color} 35%, transparent)`,
                }}
              />
            );
          })}
        </div>
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14, fontSize: '0.68rem', color: 'var(--text-secondary, #9a9ab2)', flexShrink: 0 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <Film size={12} /> {scenes.length} scene{scenes.length === 1 ? '' : 's'} · {runtime.toFixed(1)}s
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <ImageIcon size={12} /> {stats.imageCount} pictures
        </span>
        <span
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: stats.level === 'ok' ? undefined : '#fbbf24' }}
          title="Curated media payload (EXIF stripped, ≤2048px, local-only)"
        >
          <Database size={12} /> {formatBytes(stats.totalBytes)}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#00d4aa', fontWeight: 700 }}>
          Open Workshop <ArrowRight size={12} />
        </span>
      </div>
    </div>
  );
};
