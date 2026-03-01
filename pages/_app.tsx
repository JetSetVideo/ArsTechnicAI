import type { AppProps } from "next/app";
import { useEffect } from "react";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import "../styles/globals.css";
import { ToastContainer } from "@/components/ui";
import { useSettingsStore } from "@/stores";
import { useAuthStore } from "@/stores/authStore";
import { clearAllWorkspaceData } from "@/hooks/useProjectSync";
import { STORAGE_KEYS } from "@/constants/workspace";

const TelemetryProvider = dynamic(
  () => import("@/contexts/TelemetryProvider").then((m) => m.TelemetryProvider),
  { ssr: false }
);

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const applyFontScale = useSettingsStore((s) => s.applyFontScale);
  const setAuth = useAuthStore((s) => s.setAuth);
  const isSessionValid = useAuthStore((s) => s.isSessionValid);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  // Apply font scale settings on mount
  useEffect(() => {
    applyFontScale();
  }, [applyFontScale]);

  // One-time workspace cleanup requested by user
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

  // Handle Google OAuth callback: token is passed as a query param after redirect
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const authToken = params.get('auth_token');
    const expiresIn = params.get('auth_expires_in');

    if (authToken) {
      // Verify the token and fetch user info
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${authToken}` },
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.user) {
            setAuth(data.user, authToken, expiresIn ? parseInt(expiresIn, 10) : undefined as any);
          }
        })
        .catch(() => {/* silently ignore if token is invalid */})
        .finally(() => {
          // Clean the URL — remove auth params without full page reload
          const url = new URL(window.location.href);
          url.searchParams.delete('auth_token');
          url.searchParams.delete('auth_expires_in');
          window.history.replaceState({}, '', url.toString());
        });
    }
  }, [setAuth]);

  // On mount: validate persisted session with the server.
  // If token exists but is expired or revoked, clear it.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const { token, isSessionValid: checkValid } = useAuthStore.getState();
    if (!token) return;

    if (!checkValid()) {
      // Token has expired client-side — clear immediately
      clearAuth();
      return;
    }

    // Validate server-side (in the background, non-blocking)
    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => {
      if (!r.ok) {
        // Server rejected the token — clear auth state
        clearAuth();
      }
    }).catch(() => {/* network error — leave session intact */});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <TelemetryProvider>
      <Component {...pageProps} />
      <ToastContainer />
    </TelemetryProvider>
  );
}
