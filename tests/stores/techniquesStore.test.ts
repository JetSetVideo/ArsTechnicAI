/**
 * Techniques Store Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useTechniquesStore } from '../../stores/techniquesStore';

describe('techniquesStore', () => {
  beforeEach(() => {
    useTechniquesStore.setState(useTechniquesStore.getInitialState());
  });

  describe('catalog', () => {
    it('should have techniques across all categories', () => {
      const state = useTechniquesStore.getState();
      const categories = state.getCategories();
      expect(categories).toContain('image');
      expect(categories).toContain('video');
      expect(categories).toContain('3d');
      expect(categories).toContain('audio');
      expect(categories).toContain('text');
      expect(categories).toContain('analysis');
    });

    it('should have a comprehensive techniques catalog', () => {
      const all = useTechniquesStore.getState().getAllTechniques();
      expect(all.length).toBeGreaterThanOrEqual(50);
    });

    it('should return featured techniques', () => {
      const featured = useTechniquesStore.getState().getFeaturedTechniques();
      expect(featured.length).toBeGreaterThan(0);
      expect(featured.every(t => t.featured)).toBe(true);
    });
  });

  describe('getTechnique', () => {
    it('should find a technique by id', () => {
      const technique = useTechniquesStore.getState().getTechnique('upscale');
      expect(technique).toBeDefined();
      expect(technique!.name).toBe('Upscale 4K/8K');
    });

    it('should return undefined for unknown id', () => {
      expect(useTechniquesStore.getState().getTechnique('nonexistent')).toBeUndefined();
    });
  });

  describe('getTechniquesByCategory', () => {
    it('should return image techniques', () => {
      const image = useTechniquesStore.getState().getTechniquesByCategory('image');
      expect(image.length).toBeGreaterThan(0);
      expect(image.every(t => t.category === 'image')).toBe(true);
    });
  });

  describe('favorites', () => {
    it('should add and remove favorites', () => {
      const state = useTechniquesStore.getState();
      
      state.addFavorite('upscale');
      expect(useTechniquesStore.getState().isFavorite('upscale')).toBe(true);
      
      useTechniquesStore.getState().removeFavorite('upscale');
      expect(useTechniquesStore.getState().isFavorite('upscale')).toBe(false);
    });

    it('should toggle favorites', () => {
      const state = useTechniquesStore.getState();
      
      state.toggleFavorite('denoise');
      expect(useTechniquesStore.getState().isFavorite('denoise')).toBe(true);
      
      useTechniquesStore.getState().toggleFavorite('denoise');
      expect(useTechniquesStore.getState().isFavorite('denoise')).toBe(false);
    });

    it('should not duplicate favorites', () => {
      const state = useTechniquesStore.getState();
      state.addFavorite('upscale');
      useTechniquesStore.getState().addFavorite('upscale');
      
      expect(useTechniquesStore.getState().favorites.filter(f => f === 'upscale').length).toBe(1);
    });

    it('getFavoriteTechniques should return matching techniques', () => {
      const state = useTechniquesStore.getState();
      state.addFavorite('upscale');
      useTechniquesStore.getState().addFavorite('denoise');
      
      const favs = useTechniquesStore.getState().getFavoriteTechniques();
      expect(favs.length).toBe(2);
    });
  });

  describe('usage tracking', () => {
    it('should record and retrieve usage count', () => {
      const state = useTechniquesStore.getState();
      state.recordUsage('upscale');
      useTechniquesStore.getState().recordUsage('upscale');
      useTechniquesStore.getState().recordUsage('denoise');
      
      expect(useTechniquesStore.getState().getUsageCount('upscale')).toBe(2);
      expect(useTechniquesStore.getState().getUsageCount('denoise')).toBe(1);
    });

    it('should update recentlyUsed list', () => {
      const state = useTechniquesStore.getState();
      state.recordUsage('upscale');
      useTechniquesStore.getState().recordUsage('denoise');
      
      const recent = useTechniquesStore.getState().getRecentlyUsedTechniques();
      expect(recent[0].id).toBe('denoise');
      expect(recent[1].id).toBe('upscale');
    });
  });

  describe('search', () => {
    it('should search by name', () => {
      const results = useTechniquesStore.getState().searchTechniques('upscale');
      expect(results.some(t => t.id === 'upscale')).toBe(true);
    });

    it('should search by tag', () => {
      const results = useTechniquesStore.getState().searchTechniques('cinematic');
      expect(results.length).toBeGreaterThan(0);
    });

    it('getTechniquesByModule should filter correctly', () => {
      const results = useTechniquesStore.getState().getTechniquesByModule('image-enhance');
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(t => t.requiredModule === 'image-enhance')).toBe(true);
    });

    it('getTechniquesByAssetType should filter correctly', () => {
      const results = useTechniquesStore.getState().getTechniquesByAssetType('video');
      expect(results.length).toBeGreaterThan(0);
    });
  });
});
