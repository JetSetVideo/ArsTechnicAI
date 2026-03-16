import Head from 'next/head';
import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { projectPathFromName } from '@/utils/project';

// Dynamic import to avoid SSR issues with stores
const AppShell = dynamic(
  () => import('@/components/layout/AppShell').then((mod) => mod.AppShell),
  { ssr: false }
);

// Project loader that handles [id] param
const ProjectLoader = dynamic(
  () =>
    Promise.resolve(function ProjectLoaderInner() {
      const router = useRouter();
      const projectId = router.query.id as string | undefined;

      useEffect(() => {
        if (!projectId) return;

        // Load canvas state for the requested project
        const { loadProjectWorkspaceState } = require('@/hooks/useProjectSync');
        const { useProjectsStore } = require('@/stores/projectsStore');
        const { useUserStore } = require('@/stores/userStore');
        const { useFileStore } = require('@/stores/fileStore');

        const dashProject = useProjectsStore.getState().getProject(projectId);
        if (dashProject) {
          // Switch to this project in userStore
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

            // Switch file tree to this project while preserving shared folders.
            useFileStore.getState().switchToProject(dashProject.name, dashProject.id);
            void loadProjectWorkspaceState(projectId, dashProject.name);
          }
        } else {
          // If project not found in store, maybe redirect to home or show error?
          // For now, let's assume it might be loaded later or handled by AppShell
        }
      }, [projectId]);

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
