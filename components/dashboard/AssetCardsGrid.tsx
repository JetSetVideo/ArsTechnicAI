/**
 * AssetCardsGrid — filtered assets and production refs in card form.
 */

import { useMemo } from 'react';
import { Library, FolderOpen, FileImage, Link2 } from 'lucide-react';
import { useFileStore } from '@/stores/fileStore';
import { useProjectsStore } from '@/stores/projectsStore';
import { useProductionStore } from '@/stores/productionStore';
import { useDashboardStore } from '@/stores/dashboardStore';
import { buildAssetInventory, filterInventory } from '@/utils/dashboardInventory';
import styles from './AssetCardsGrid.module.css';

export function AssetCardsGrid() {
  const assets = useFileStore((s) => s.assets);
  const projects = useProjectsStore((s) => s.projects);
  const records = useProductionStore((s) => s.records);
  const filters = useDashboardStore((s) => s.filters);

  const productionSources = useMemo(
    () => Object.values(records).flatMap((r) => r.sources),
    [records]
  );

  const items = useMemo(() => {
    const inventory = buildAssetInventory(
      assets.values(),
      projects,
      filters.sourceScope
    );
    return filterInventory(
      inventory,
      filters.category,
      filters.projectScope,
      filters.sourceScope
    );
  }, [assets, projects, filters.category, filters.projectScope, filters.sourceScope]);

  const showProductionRefs = filters.sourceScope === 'production_refs';
  const showAssets =
    filters.sourceScope !== 'production_refs' &&
    (items.length > 0 || filters.sourceScope !== 'all');

  if (!showAssets && !showProductionRefs) {
    return null;
  }

  return (
    <>
      {showProductionRefs && (
        <section className={styles.section} aria-labelledby="production-refs-heading">
          <h2 id="production-refs-heading" className={styles.sectionTitle}>
            Production references
            <span className={styles.sectionCount}>{productionSources.length}</span>
          </h2>
          {productionSources.length === 0 ? (
            <p className={styles.emptyHint}>
              Add source references inside a project&apos;s production tracker (URLs, notes, linked files).
            </p>
          ) : (
            <div className={styles.grid}>
              {productionSources.map((ref) => (
                <article key={ref.id} className={styles.card}>
                  <div className={styles.thumbnail}>
                    <div className={styles.placeholderThumb}>
                      <Link2 size={28} />
                    </div>
                    <span className={styles.categoryBadge}>{ref.sourceType}</span>
                  </div>
                  <div className={styles.info}>
                    <h3 className={styles.name} title={ref.label}>
                      {ref.label}
                    </h3>
                    <div className={styles.meta}>
                      {ref.uri && (
                        <span className={styles.metaItem} title={ref.uri}>
                          {ref.uri}
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {showAssets && (
        <section className={styles.section} aria-labelledby="asset-cards-heading">
          <h2 id="asset-cards-heading" className={styles.sectionTitle}>
            {filters.sourceScope === 'all' ? 'Assets' : 'Source items'}
            <span className={styles.sectionCount}>{items.length}</span>
          </h2>
          {items.length === 0 ? (
            <p className={styles.emptyHint}>
              No items in this source yet. Use Import or New prompt above to add base material.
            </p>
          ) : (
            <div className={styles.grid}>
              {items.map((item) => (
                <article key={item.assetId} className={styles.card}>
                  <div className={styles.thumbnail}>
                    {item.thumbnail ? (
                      <img src={item.thumbnail} alt="" />
                    ) : (
                      <div className={styles.placeholderThumb}>
                        <FileImage size={28} />
                      </div>
                    )}
                    <span className={styles.categoryBadge}>{item.category}</span>
                  </div>
                  <div className={styles.info}>
                    <h3 className={styles.name} title={item.name}>
                      {item.name}
                    </h3>
                    <div className={styles.meta}>
                      {item.scope === 'library' ? (
                        <span className={styles.metaItem}>
                          <Library size={12} />
                          Shared library
                        </span>
                      ) : (
                        <span className={styles.metaItem}>
                          <FolderOpen size={12} />
                          {item.scope}
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );
}
