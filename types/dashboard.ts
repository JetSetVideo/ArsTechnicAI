/**
 * Dashboard Types
 *
 * Home page: projects, asset filters, publishing accounts, usage stats.
 */

import type { Timestamp, UUID } from './index';

export type DashboardSourceId =
  | 'imports'
  | 'library'
  | 'prompts'
  | 'characters'
  | 'audio'
  | 'video'
  | 'production_refs';

// ============================================
// PROJECT TYPES (enhanced for dashboard)
// ============================================

export interface DashboardProject {
  id: string;
  name: string;
  description?: string;
  thumbnail?: string;
  createdAt: Timestamp;
  modifiedAt: Timestamp;
  assetCount: number;
  tags: string[];
  isFavorite?: boolean;
  lastOpenedAt?: Timestamp;
  length?: string;
  style?: string;
  genre?: string;
  characters?: string;
  type?: string;
  aspectRatio?: string;
}

// ============================================
// ASSET FILTER & INVENTORY
// ============================================

/** Home-page filter categories (broader than core AssetType). */
export type DashboardAssetCategory =
  | 'all'
  | 'image'
  | 'video'
  | 'audio'
  | 'prompt'
  | 'text'
  | 'character'
  | 'subtitle'
  | 'scene'
  | 'preset'
  | 'other';

export type DashboardProjectScope = 'all' | 'library' | string;

export type DashboardMainView = 'projects' | 'assets';

export interface DashboardFilters {
  category: DashboardAssetCategory;
  projectScope: DashboardProjectScope;
  sourceScope: DashboardSourceId | 'all';
  mainView: DashboardMainView;
}

export interface DashboardAssetLink {
  kind: 'parent' | 'lineage' | 'prompt' | 'source';
  targetAssetId: UUID;
  label?: string;
}

export interface DashboardInventoryItem {
  assetId: UUID;
  name: string;
  category: DashboardAssetCategory;
  path: string;
  modifiedAt: Timestamp;
  thumbnail?: string;
  /** `library` = shared under /library; otherwise project slug */
  scope: 'library' | string;
  projectIds: string[];
  links: DashboardAssetLink[];
}

// ============================================
// PUBLISHING & USAGE
// ============================================

export type SocialPlatformId =
  | 'instagram'
  | 'youtube'
  | 'tiktok'
  | 'facebook'
  | 'linkedin'
  | 'x'
  | 'pinterest'
  | 'other';

export interface PublishingAccount {
  id: string;
  platform: SocialPlatformId;
  handle: string;
  displayName?: string;
  connected: boolean;
  postsCount: number;
  lastPostedAt?: Timestamp;
}

export interface ProviderUsageRecord {
  provider: string;
  model: string;
  callCount: number;
  lastUsedAt?: Timestamp;
}

export interface UsageStatsSnapshot {
  generationsTotal: number;
  generationsSession: number;
  modelCallsTotal: number;
  tokensEstimated: number;
  postsTotal: number;
  importsTotal: number;
  exportsTotal: number;
  byProvider: ProviderUsageRecord[];
}

// ============================================
// DASHBOARD TAB TYPES
// ============================================

export type DashboardTab = 'projects';
