import type { AppProps } from "next/app";
import { useEffect } from "react";
import { useRouter } from "next/router";
import "../styles/globals.css";
import { ToastContainer } from "@/components/ui";
import { useSettingsStore } from "@/stores";
import { clearAllWorkspaceData } from "@/hooks/useProjectSync";
import { STORAGE_KEYS } from "@/constants/workspace";

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const applyFontScale = useSettingsStore((s) => s.applyFontScale);
  
  // Apply font scale settings on mount
  useEffect(() => {
    applyFontScale();
  }, [applyFontScale]);

  // One-time workspace cleanup requested by user:
  // removes created assets/projects from persisted client storage.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const alreadyWiped = localStorage.getItem(STORAGE_KEYS.workspaceWipeFlag) === "true";
    if (!alreadyWiped) {
      clearAllWorkspaceData();
    }
  }, []);

  // Editor page needs overflow:hidden; dashboard pages scroll
  useEffect(() => {
    const isEditor = router.pathname === '/';
    document.body.classList.toggle('editor-page', isEditor);
  }, [router.pathname]);
  
  return (
    <>
      <Component {...pageProps} />
      <ToastContainer />
    </>
  );
}

