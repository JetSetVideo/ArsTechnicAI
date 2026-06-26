/**
 * ServicesUsagePanel — AI providers/models and usage counters (Settings tab).
 */

import { useMemo } from 'react';
import { Cpu, Sparkles } from 'lucide-react';
import { useGenerationStore } from '@/stores/generationStore';
import { useProductionStore } from '@/stores/productionStore';
import { useUserStore } from '@/stores/userStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useDashboardStore } from '@/stores/dashboardStore';
import { buildUsageSnapshot } from '@/utils/dashboardUsage';
import styles from './ServicesUsagePanel.module.css';

export function ServicesUsagePanel() {
  const jobs = useGenerationStore((s) => s.jobs);
  const records = useProductionStore((s) => s.records);
  const session = useUserStore((s) => s.session);
  const aiProvider = useSettingsStore((s) => s.settings.aiProvider);
  const tokensTracked = useDashboardStore((s) => s.tokensTracked);
  const publishingAccounts = useDashboardStore((s) => s.publishingAccounts);

  const usage = useMemo(() => {
    const modelRuns = Object.values(records).flatMap((r) => r.modelRuns);
    return buildUsageSnapshot({
      sessionGenerations: session.generationsCount,
      sessionImports: session.importsCount,
      sessionExports: session.exportsCount,
      generationJobs: jobs,
      modelRuns,
      publishingAccounts,
      tokensEstimated: tokensTracked,
    });
  }, [jobs, records, session, publishingAccounts, tokensTracked]);

  const activeProvider = aiProvider.provider;
  const activeModel = aiProvider.model;

  return (
    <div className={styles.root}>
      <h3>Models &amp; usage</h3>
      <p className={styles.description}>
        Active provider: <strong>{activeProvider}</strong> · <code>{activeModel}</code>
      </p>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <Sparkles size={14} />
          <span className={styles.statValue}>{usage.generationsTotal}</span>
          <span className={styles.statLabel}>Generations</span>
          <span className={styles.statSub}>{usage.generationsSession} this session</span>
        </div>
        <div className={styles.statCard}>
          <Cpu size={14} />
          <span className={styles.statValue}>{usage.modelCallsTotal}</span>
          <span className={styles.statLabel}>Model calls</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{usage.tokensEstimated}</span>
          <span className={styles.statLabel}>Tokens (est.)</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{usage.postsTotal}</span>
          <span className={styles.statLabel}>Posts logged</span>
        </div>
      </div>

      {usage.byProvider.length > 0 ? (
        <>
          <h4 className={styles.subheading}>By provider / model</h4>
          <ul className={styles.providerList}>
            {usage.byProvider.slice(0, 12).map((row) => (
              <li key={`${row.provider}-${row.model}`} className={styles.providerRow}>
                <span className={styles.providerName}>
                  {row.provider} · <code>{row.model}</code>
                </span>
                <span className={styles.providerCount}>{row.callCount}×</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className={styles.description}>
          No model runs yet. Generate from a project to start tracking usage here.
        </p>
      )}
    </div>
  );
}
