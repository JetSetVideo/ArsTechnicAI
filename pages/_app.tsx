import type { AppProps } from "next/app";
import { useEffect } from "react";
import "../styles/globals.css";
import { ToastContainer } from "@/components/ui";
import { useSettingsStore } from "@/stores";

export default function App({ Component, pageProps }: AppProps) {
  const applyFontScale = useSettingsStore((s) => s.applyFontScale);
  
  // Apply font scale settings on mount
  useEffect(() => {
    applyFontScale();
  }, [applyFontScale]);
  
  return (
    <>
      <Component {...pageProps} />
      <ToastContainer />
    </>
  );
}

