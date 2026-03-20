import Head from 'next/head';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { projectPathFromName } from '@/utils/project';

const AppShell = dynamic(
  () => import('@/components/layout/AppShell').then((mod) => mod.AppShell),
  { ssr: false }
);

const ProjectLoader = dynamic(
  () =>
    Promise.resolve(function ProjectLoaderInner() {
      const router = useRouter();
      const projectId = router.query.id as string | undefined;
      const [loaded, setLoaded] = useState(false);

      useEffect(() => {
        if (!projectId || loaded) return;

        const { loadProjectWorkspaceState } = require('@/hooks/useProjectSync');
        const { useProjectsStore } = require('@/stores/projectsStore');
        const { useUserStore } = require('@/stores/userStore');
        const { useFileStore } = require('@/stores/fileStore');
        const { useProjectStore } = require('@/stores/projectStore');

        const dashProject = useProjectsStore.getState().getProject(projectId);

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
          loadProjectWorkspaceState(projectId, dashProject.name).then(() => setLoaded(true));
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
              setLoaded(true);
            } catch {
              router.replace('/');
            }
          })();
        }
      }, [projectId, loaded, router]);

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
