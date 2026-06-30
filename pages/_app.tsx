import type { AppProps } from "next/app";
import dynamic from "next/dynamic";
import { SessionProvider } from "next-auth/react";
import { useEffect } from "react";
import "../styles/globals.css";
import { ToastContainer } from "@/components/ui";
import { useSyncOnReconnect } from "@/hooks/useSyncOnReconnect";

const TelemetryProvider = dynamic(
  () => import("@/contexts/TelemetryProvider").then((m) => m.TelemetryProvider),
  { ssr: false }
);

function SyncManager() {
  useSyncOnReconnect();
  return null;
}

// Restore parametric design knobs from localStorage
const PARAM_KEYS = ['--param-density', '--param-roundness', '--param-glow', '--param-contrast', '--param-speed'] as const;

function ParametricInit() {
  useEffect(() => {
    const root = document.documentElement;
    for (const key of PARAM_KEYS) {
      const stored = localStorage.getItem(`ars:${key.replace('--', '')}`);
      if (stored !== null) root.style.setProperty(key, stored);
    }
  }, []);
  return null;
}

export default function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  return (
    <SessionProvider session={session}>
      <Component {...pageProps} />
      <TelemetryProvider>{null}</TelemetryProvider>
      <SyncManager />
      <ParametricInit />
      <ToastContainer />
    </SessionProvider>
  );
}
