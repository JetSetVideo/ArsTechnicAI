/**
 * Dashboard Types
 *
 * Type definitions for the dashboard project list and navigation.
 */

import type { Timestamp } from './index';

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
}

// ============================================
// DASHBOARD TAB TYPES
// ============================================

export type DashboardTab = 'projects';
