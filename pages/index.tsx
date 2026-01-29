import Head from 'next/head';
import dynamic from 'next/dynamic';

// Dynamic import to avoid SSR issues with stores
const AppShell = dynamic(
  () => import('@/components/layout/AppShell').then((mod) => mod.AppShell),
  { ssr: false }
);

export default function Home() {
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

      <AppShell />
    </>
  );
}
