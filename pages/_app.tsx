import type { AppProps } from "next/app";
import dynamic from "next/dynamic";
import { SessionProvider } from "next-auth/react";
import { useEffect } from "react";
import "../styles/globals.css";
import { ToastContainer } from "@/components/ui";
import { useSyncOnReconnect } from "@/hooks/useSyncOnReconnect";
import { useSettingsStore } from "@/stores/settingsStore";

const TelemetryProvider = dynamic(
  () => import("@/contexts/TelemetryProvider").then((m) => m.TelemetryProvider),
  { ssr: false }
);

function SyncManager() {
  useSyncOnReconnect();
  return null;
}

// Applies parametric design tokens (density/roundness/glow/contrast/speed),
// theme, and accent color as CSS custom properties on <html>. The real
// source of truth is the persisted, DB-synced settingsStore (Settings →
// Appearance) — this just guarantees applyAppearance() runs once per page
// load even if no other mounted component has touched the store yet.
function AppearanceInit() {
  useEffect(() => {
    useSettingsStore.getState().applyAppearance();
  }, []);
  return null;
}

export default function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  return (
    <SessionProvider session={session}>
      <Component {...pageProps} />
      <TelemetryProvider>{null}</TelemetryProvider>
      <SyncManager />
      <AppearanceInit />
      <ToastContainer />
    </SessionProvider>
  );
}
