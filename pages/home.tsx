/**
 * Home Page (Dashboard)
 * 
 * The main dashboard page accessible at /home.
 * Provides project management, AI tools, agents, profile, and social features.
 */

import Head from 'next/head';
import dynamic from 'next/dynamic';

// Import DashboardLayout with SSR disabled (uses browser APIs)
const DashboardLayout = dynamic(
  () => import('../components/layout/DashboardLayout'),
  { ssr: false }
);

export default function HomePage() {
  return (
    <>
      <Head>
        <title>Dashboard - Ars Technic AI</title>
        <meta name="description" content="Ars Technic AI Dashboard - Manage projects, AI tools, agents, and more" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <DashboardLayout />
    </>
  );
}
