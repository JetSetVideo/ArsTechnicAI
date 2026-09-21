import Head from 'next/head';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { projectPathFromName } from '@/utils/project';

const AppShell = dynamic(
  () => import('@/components/layout/AppShell').then((mod) => mod.AppShell),
  { ssr: false }
);

// Platform → dimensions map for quick-create
const PLATFORM_DIMS: Record<string, { width: number; height: number }> = {
  tiktok:    { width: 1080, height: 1920 },
  instagram: { width: 1080, height: 1080 },
  youtube:   { width: 1920, height: 1080 },
  twitter:   { width: 1280, height: 720  },
};

const ProjectLoader = dynamic(
  () =>
    Promise.resolve(function ProjectLoaderInner() {
      const router = useRouter();
      const projectId = router.query.id as string | undefined;
      const isQuickCreate = router.query.quickcreate === '1';
      const [loaded, setLoaded] = useState(false);

      useEffect(() => {
        if (!projectId || loaded) return;

        const { loadProjectWorkspaceState } = require('@/hooks/useProjectSync');
        const { useProjectsStore } = require('@/stores/projectsStore');
        const { useUserStore } = require('@/stores/userStore');
        const { useFileStore } = require('@/stores/fileStore');
        const { useProjectStore } = require('@/stores/projectStore');

        const dashProject = useProjectsStore.getState().getProject(projectId);

        const afterLoad = async () => {
          setLoaded(true);
          if (isQuickCreate) {
            try {
              const raw = localStorage.getItem('ars:quick-create');
              if (raw) {
                const qc = JSON.parse(raw) as {
                  prompt?: string; style?: string; platform?: string;
                  imageCount?: number; projectId?: string; createdAt?: number;
                  prefillDataUrl?: string;
                };
                // Only apply if created recently (< 5 min old)
                if (qc.createdAt && Date.now() - qc.createdAt < 5 * 60 * 1000 && qc.projectId === projectId) {
                  const { useGenerationStore } = require('@/stores/generationStore');
                  const gs = useGenerationStore.getState();
                  if (qc.prompt) gs.setPrompt(qc.prompt);
                  const dims = PLATFORM_DIMS[qc.platform ?? ''];
                  if (dims) gs.setDimensions(dims.width, dims.height);

                  // If a pre-generated image URL is provided, add it as a
                  // pipeline node immediately (the Workshop is the only
                  // editor now — this used to add a freeform Canvas item).
                  if (qc.prefillDataUrl) {
                    const { usePipelineStore } = require('@/stores/pipelineStore');
                    const { useUserStore: useUserStoreInner } = require('@/stores/userStore');
                    const current = useUserStoreInner.getState().currentProject;
                    // Ensure the pipeline store has finished loading (or
                    // reset for) THIS project before we add to it — otherwise
                    // WorkshopFlow's own loadForProject effect could wipe
                    // this node if it hasn't run yet.
                    await usePipelineStore.getState().loadForProject(current.id, current.name);
                    const ps = usePipelineStore.getState();
                    const genWidth = dims?.width || 1024;
                    const genHeight = dims?.height || 1024;
                    const node = ps.addNode('image-import');
                    if (node) {
                      ps.renameNode(node.id, 'Quick create');
                      ps.addVariant(node.id, {
                        label: 'Quick create',
                        image: qc.prefillDataUrl,
                        seed: Math.floor(Math.random() * 1000000),
                        paramsSnapshot: qc.prompt ? { __prompt: qc.prompt } : undefined,
                        meta: { model: 'pre-generated', width: genWidth, height: genHeight },
                      });
                      ps.setParam(node.id, 'file', qc.prefillDataUrl);
                    }
                  } else {
                    gs.setPendingAutoGenerate(true);
                  }
                  localStorage.removeItem('ars:quick-create');
                }
              }
            } catch { /* localStorage unavailable */ }
          }
        };

        if (dashProject) {
          const userState = useUserStore.getState();
          if (userState.currentProject.id !== projectId) {
            useUserStore.setState({
              currentProject: {
                id: dashProject.id,
                name: dashProject.name,
                createdAt: dashProject.createdAt,
                modifiedAt: dashProject.modifiedAt,
                path: projectPathFromName(dashProject.name),
              },
            });
            useFileStore.getState().switchToProject(dashProject.name, dashProject.id);
          }
          loadProjectWorkspaceState(projectId, dashProject.name).then(afterLoad);
        } else {
          // Project not in local store — fetch from DB
          (async () => {
            try {
              const res = await fetch(`/api/projects/${projectId}`);
              if (!res.ok) {
                router.replace('/');
                return;
              }
              const { data: project } = await res.json();
              const name = project.name ?? 'Untitled';

              useProjectStore.getState().setProject(projectId, name);
              useUserStore.setState({
                currentProject: {
                  id: projectId,
                  name,
                  createdAt: project.createdAt ?? new Date().toISOString(),
                  modifiedAt: project.updatedAt ?? new Date().toISOString(),
                  path: projectPathFromName(name),
                },
              });
              useFileStore.getState().switchToProject(name, projectId);

              await loadProjectWorkspaceState(projectId, name);
              afterLoad();
            } catch {
              router.replace('/');
            }
          })();
        }
      }, [projectId, loaded, router, isQuickCreate]);

      return null;
    }),
  { ssr: false }
);

export default function ProjectPage() {
  const router = useRouter();
  const projectId = router.query.id as string | undefined;

  return (
    <>
      <Head>
        <title>Ars TechnicAI - Editor</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <ProjectLoader />
      {projectId && <AppShell />}
    </>
  );
}
