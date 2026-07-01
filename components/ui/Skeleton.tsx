import React from 'react';
import { Sparkles } from 'lucide-react';
import styles from './Skeleton.module.css';

export const SkeletonProjectCard = () => (
  <div className={styles.skeletonCard} aria-hidden="true">
    <div className={`${styles.skeletonBase} ${styles.skeletonCover}`} />
    <div className={styles.skeletonBody}>
      <div className={`${styles.skeletonBase} ${styles.skeletonTitle}`} />
      <div className={`${styles.skeletonBase} ${styles.skeletonSubtitle}`} />
      <div className={styles.skeletonBadgeRow}>
        <div className={`${styles.skeletonBase} ${styles.skeletonBadge}`} />
        <div className={`${styles.skeletonBase} ${styles.skeletonBadge}`} />
        <div className={`${styles.skeletonBase} ${styles.skeletonBadge}`} />
      </div>
    </div>
  </div>
);

export const SkeletonAssetCard = () => (
  <div className={styles.skeletonAssetCard} aria-hidden="true">
    <div className={`${styles.skeletonBase} ${styles.skeletonAssetThumb}`} />
    <div className={`${styles.skeletonBase} ${styles.skeletonAssetName}`} />
  </div>
);

export const SkeletonExplorerRow = ({ depth = 0 }: { depth?: number }) => (
  <div
    className={styles.skeletonRow}
    style={{ paddingLeft: `${depth * 12 + 4}px` }}
    aria-hidden="true"
  >
    <div className={`${styles.skeletonBase} ${styles.skeletonRowIcon}`} />
    <div className={`${styles.skeletonBase} ${styles.skeletonRowName}`} />
  </div>
);

export const SkeletonGeneratedImage = ({
  width = 512,
  height = 512,
}: {
  width?: number;
  height?: number;
}) => (
  <div
    className={styles.skeletonGenImage}
    style={{ aspectRatio: `${width}/${height}` }}
    aria-label="Generating image…"
    aria-busy="true"
  >
    <div className={`${styles.skeletonBase} ${styles.skeletonGenImageInner}`} />
    <Sparkles size={24} className={styles.skeletonGenIcon} />
  </div>
);

export const SkeletonInspectorSection = () => (
  <div className={styles.skeletonSection} aria-hidden="true">
    <div className={`${styles.skeletonBase} ${styles.skeletonSectionHeader}`} />
    {[0, 1, 2].map((i) => (
      <div key={i} className={styles.skeletonPropRow}>
        <div className={`${styles.skeletonBase} ${styles.skeletonPropLabel}`} />
        <div className={`${styles.skeletonBase} ${styles.skeletonPropValue}`} />
      </div>
    ))}
  </div>
);
