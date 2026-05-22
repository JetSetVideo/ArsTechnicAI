import type { AppProps } from "next/app";
import dynamic from "next/dynamic";
import { SessionProvider } from "next-auth/react";
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

export default function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  return (
    <SessionProvider session={session}>
      <Component {...pageProps} />
      <TelemetryProvider>{null}</TelemetryProvider>
      <SyncManager />
      <ToastContainer />
    </SessionProvider>
  );
}
