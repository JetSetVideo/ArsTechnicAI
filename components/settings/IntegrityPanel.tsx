/**
 * Settings → Data → Data integrity: a real check of this machine's projects and
 * files (/api/workspace/integrity). Replaces rows that always read "✓ Verified".
 */
import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';

interface IntegrityReport {
  checkedAt: number;
  projects: { count: number; unreadable: string[] };
  files: { referenced: number; missing: { file: string; projectId: string }[] };
  orphans: { count: number; bytes: number; sample: string[] };
  settings: { ok: boolean; generationsOk: boolean };
}

const row: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
  padding: '4px 10px', background: 'var(--bg-tertiary)', borderRadius: 4, fontSize: '0.6875rem',
};
const label: React.CSSProperties = {
  display: 'block', fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.06em',
  color: 'var(--text-muted)', marginBottom: 4,
};

function mb(bytes: number) {
  return bytes > 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${Math.max(1, Math.round(bytes / 1e6))} MB`;
}

function Line({ name, ok, text, title }: { name: string; ok: boolean; text: string; title?: string }) {
  return (
    <div style={row} title={title}>
      <span>{name}</span>
      <span style={{ display: 'flex', gap: 4, alignItems: 'center', color: ok ? 'var(--success)' : 'var(--warning, #f5a524)' }}>
        {ok ? <CheckCircle size={11} /> : <AlertTriangle size={11} />} {text}
      </span>
    </div>
  );
}

export const IntegrityPanel: React.FC = () => {
  const [report, setReport] = useState<IntegrityReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const check = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/workspace/integrity');
      if (!res.ok) throw new Error(res.status === 401 ? 'Sign in to check this machine’s data' : `Check failed (${res.status})`);
      setReport(await res.json());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { void check(); }, [check]);

  return (
    <div style={{ marginBottom: 14 }} data-testid="integrity-panel">
      <span style={label}>Data integrity (this machine)</span>
      {error && <div style={{ ...row, color: '#ff2a4a' }}>{error}</div>}
      {report && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 6 }}>
          <Line
            name="Projects"
            ok={report.projects.unreadable.length === 0}
            text={report.projects.unreadable.length ? `${report.projects.unreadable.length} unreadable file(s)` : `${report.projects.count} readable`}
            title={report.projects.unreadable.join('\n')}
          />
          <Line
            name="Referenced files"
            ok={report.files.missing.length === 0}
            text={report.files.missing.length ? `${report.files.missing.length} missing of ${report.files.referenced}` : `all ${report.files.referenced} present`}
            title={report.files.missing.map((m) => `${m.file} (project ${m.projectId.slice(0, 8)})`).join('\n')}
          />
          <Line
            name="Unreferenced files"
            ok
            text={report.orphans.count ? `${report.orphans.count} not used by any project (${mb(report.orphans.bytes)}) — kept` : 'none'}
            title={report.orphans.sample.join('\n')}
          />
          <Line name="Settings" ok={report.settings.ok && report.settings.generationsOk} text={report.settings.ok && report.settings.generationsOk ? 'readable' : 'a settings file is corrupt'} />
        </div>
      )}
      <Button variant="secondary" onClick={check} disabled={busy} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <RefreshCw size={14} /> {busy ? 'Checking…' : 'Check again'}
      </Button>
    </div>
  );
};
