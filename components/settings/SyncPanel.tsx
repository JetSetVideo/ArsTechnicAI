/**
 * Settings → Data → Sync: where this machine syncs to, how the last run went,
 * a manual "Sync now", and the conflict copies sync has kept (lib/sync/syncEngine).
 */
import React, { useState } from 'react';
import { RefreshCw, Server, AlertTriangle, CheckCircle, WifiOff, LogIn, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { useSyncStore } from '@/stores/syncStore';
import { useAuthStore } from '@/stores/authStore';
import { homeServer, syncNow, deviceName } from '@/lib/sync/syncEngine';

const row: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
  padding: '4px 10px', background: 'var(--bg-tertiary)', borderRadius: 4, fontSize: '0.6875rem',
};
const label: React.CSSProperties = {
  display: 'block', fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.06em',
  color: 'var(--text-muted)', marginBottom: 4,
};

function ago(ts: number | null): string {
  if (!ts) return 'never';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  return new Date(ts).toLocaleString();
}

export const SyncPanel: React.FC = () => {
  const { status, lastSyncAt, lastError, lastReport, conflicts, dismissConflict } = useSyncStore();
  const user = useAuthStore((s) => s.user);
  const [busy, setBusy] = useState(false);
  const server = homeServer() || (typeof window !== 'undefined' ? `${window.location.origin} (this machine)` : 'this machine');

  const state = (() => {
    if (busy || status === 'syncing') return { icon: <RefreshCw size={12} className="spin" />, text: 'Syncing…', color: 'var(--text-secondary)' };
    if (status === 'offline') return { icon: <WifiOff size={12} />, text: 'Home server unreachable — working offline, changes stay on this machine', color: 'var(--warning, #f5a524)' };
    if (status === 'signed-out') return { icon: <LogIn size={12} />, text: 'Sign in (Account tab) to sync', color: 'var(--warning, #f5a524)' };
    if (status === 'error') return { icon: <AlertTriangle size={12} />, text: lastError ?? 'Last sync failed', color: '#ff2a4a' };
    return { icon: <CheckCircle size={12} />, text: 'Up to date', color: 'var(--success)' };
  })();

  const run = async () => {
    setBusy(true);
    try {
      await syncNow();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ marginBottom: 18 }} data-testid="sync-panel">
      <span style={label}>Device sync</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
        <div style={row}><span><Server size={11} /> Home server</span><span style={{ color: 'var(--text-primary)' }}>{server}</span></div>
        <div style={row}><span>This device</span><span style={{ color: 'var(--text-primary)' }}>{typeof window !== 'undefined' ? deviceName() : ''}{user ? ` · ${user.email}` : ''}</span></div>
        <div style={row}><span>Status</span><span style={{ color: state.color, display: 'flex', gap: 4, alignItems: 'center' }} data-testid="sync-status">{state.icon}{state.text}</span></div>
        <div style={row}>
          <span>Last sync</span>
          <span style={{ color: 'var(--text-primary)' }}>
            {ago(lastSyncAt)}
            {lastReport && ` · ↑${lastReport.pushed.length} ↓${lastReport.pulled.length} projects · ↑${lastReport.assetsUp} ↓${lastReport.assetsDown} files`}
          </span>
        </div>
      </div>
      <Button variant="secondary" onClick={run} disabled={busy || status === 'syncing'} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <RefreshCw size={14} /> Sync now
      </Button>
      <p style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginTop: 6 }}>
        Projects and their generated files sync with the home server; API keys and settings never leave this machine.
        When the same project changed on two devices, both versions are kept.
      </p>

      {conflicts.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <span style={label}>Kept both versions</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {conflicts.map((c) => (
              <div key={c.copyId} style={row}>
                <span>
                  “{c.name}” — your version is in “{c.copyName}”
                  {c.serverDevice ? ` (other version from ${c.serverDevice})` : ''}
                </span>
                <button
                  onClick={() => dismissConflict(c.copyId)}
                  title="Dismiss (both projects stay)"
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
