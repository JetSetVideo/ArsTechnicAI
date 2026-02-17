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

// Project loader that handles ?project= query param and redirects to /home when no project
const ProjectLoader = dynamic(
  () =>
    Promise.resolve(function ProjectLoaderInner() {
      const router = useRouter();
      const projectId = router.query.project as string | undefined;

      useEffect(() => {
        // If no project, redirect to home page (dashboard with projects and options)
        if (!projectId) {
          router.replace('/home');
          return;
        }

        // Load canvas state for the requested project
        const { loadCanvasState } = require('@/hooks/useProjectSync');
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
            useFileStore.getState().switchToProject(dashProject.name);

            // Load saved canvas
            loadCanvasState(projectId);
          }
        }
      }, [projectId, router]);

      return null;
    }),
  { ssr: false }
);

export default function EditorPage() {
  const router = useRouter();
  const projectId = router.query.project as string | undefined;

  return (
    <>
      <Head>
        <title>Ars TechnicAI - AI-Powered Creative Suite</title>
        <meta
          name="description"
          content="Create and rework images, videos, and comics using AI. A complete production suite for visual storytelling."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <ProjectLoader />
      {projectId && <AppShell />}
    </>
  );
}
