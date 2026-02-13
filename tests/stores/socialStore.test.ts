/**
 * Social Store Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useSocialStore } from '../../stores/socialStore';

describe('socialStore', () => {
  beforeEach(() => {
    useSocialStore.setState(useSocialStore.getInitialState());
  });

  describe('initial state', () => {
    it('should have connections for all platforms', () => {
      const { connections } = useSocialStore.getState();
      expect(connections.length).toBe(5);
    });

    it('should have some sample posts', () => {
      const { posts } = useSocialStore.getState();
      expect(posts.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('connections', () => {
    it('should report instagram as connected', () => {
      expect(useSocialStore.getState().isConnected('instagram')).toBe(true);
    });

    it('should report youtube as not connected', () => {
      expect(useSocialStore.getState().isConnected('youtube')).toBe(false);
    });

    it('should connect a platform', () => {
      useSocialStore.getState().connectPlatform('youtube', '@my_channel');
      
      expect(useSocialStore.getState().isConnected('youtube')).toBe(true);
      const conn = useSocialStore.getState().getConnection('youtube');
      expect(conn!.username).toBe('@my_channel');
    });

    it('should disconnect a platform', () => {
      useSocialStore.getState().disconnectPlatform('instagram');
      
      expect(useSocialStore.getState().isConnected('instagram')).toBe(false);
      const conn = useSocialStore.getState().getConnection('instagram');
      expect(conn!.username).toBeUndefined();
    });

    it('getConnectedPlatforms should return only connected', () => {
      const connected = useSocialStore.getState().getConnectedPlatforms();
      expect(connected.every(c => c.connected)).toBe(true);
    });
  });

  describe('posts', () => {
    it('should create a new post', () => {
      const { createPost, posts } = useSocialStore.getState();
      const initialCount = posts.length;
      
      const post = createPost({
        platform: 'instagram',
        content: 'New test post',
        mediaUrls: [],
        status: 'draft',
      });
      
      expect(useSocialStore.getState().posts.length).toBe(initialCount + 1);
      expect(post.id).toMatch(/^post-/);
    });

    it('should delete a post', () => {
      const { posts, deletePost } = useSocialStore.getState();
      const postId = posts[0].id;
      const initialCount = posts.length;
      
      deletePost(postId);
      
      expect(useSocialStore.getState().posts.length).toBe(initialCount - 1);
    });

    it('should duplicate a post as draft', () => {
      const { posts, duplicatePost } = useSocialStore.getState();
      const original = posts.find(p => p.status === 'published');
      if (!original) throw new Error('Expected a published post');
      
      const copy = duplicatePost(original.id);
      expect(copy).not.toBeNull();
      expect(copy!.status).toBe('draft');
      expect(copy!.content).toBe(original.content);
    });
  });

  describe('post status', () => {
    it('should schedule a post', () => {
      const { posts, schedulePost } = useSocialStore.getState();
      const draft = posts.find(p => p.status === 'draft');
      if (!draft) throw new Error('Expected a draft post');
      
      const futureTime = Date.now() + 86400000;
      schedulePost(draft.id, futureTime);
      
      const updated = useSocialStore.getState().getPost(draft.id);
      expect(updated!.status).toBe('scheduled');
      expect(updated!.scheduledAt).toBe(futureTime);
    });

    it('should cancel a scheduled post back to draft', () => {
      const { posts, cancelScheduled } = useSocialStore.getState();
      const scheduled = posts.find(p => p.status === 'scheduled');
      if (!scheduled) throw new Error('Expected a scheduled post');
      
      cancelScheduled(scheduled.id);
      
      const updated = useSocialStore.getState().getPost(scheduled.id);
      expect(updated!.status).toBe('draft');
      expect(updated!.scheduledAt).toBeUndefined();
    });
  });

  describe('getters', () => {
    it('getPostsByPlatform should filter correctly', () => {
      const posts = useSocialStore.getState().getPostsByPlatform('instagram');
      expect(posts.length).toBeGreaterThan(0);
      expect(posts.every(p => p.platform === 'instagram')).toBe(true);
    });

    it('getScheduledPosts should return only scheduled', () => {
      const scheduled = useSocialStore.getState().getScheduledPosts();
      expect(scheduled.every(p => p.status === 'scheduled')).toBe(true);
    });

    it('getDrafts should return only drafts', () => {
      const drafts = useSocialStore.getState().getDrafts();
      expect(drafts.every(p => p.status === 'draft')).toBe(true);
    });

    it('getPublishedPosts should return only published', () => {
      const published = useSocialStore.getState().getPublishedPosts();
      expect(published.every(p => p.status === 'published')).toBe(true);
    });
  });

  describe('analytics', () => {
    it('getTotalEngagement should sum all engagement', () => {
      const total = useSocialStore.getState().getTotalEngagement();
      expect(total.likes).toBeGreaterThan(0);
      expect(total.views).toBeGreaterThan(0);
    });

    it('getEngagementByPlatform should filter correctly', () => {
      const tiktokEngagement = useSocialStore.getState().getEngagementByPlatform('tiktok');
      expect(tiktokEngagement.likes).toBeGreaterThan(0);
    });

    it('getBestPerformingPost should return a post', () => {
      const best = useSocialStore.getState().getBestPerformingPost();
      expect(best).toBeDefined();
      expect(best!.engagement).toBeDefined();
    });
  });

  describe('publishPost', () => {
    it('should fail if platform is not connected', async () => {
      // Create a post on an unconnected platform
      const post = useSocialStore.getState().createPost({
        platform: 'youtube',
        content: 'Test',
        mediaUrls: [],
        status: 'draft',
      });
      
      const result = await useSocialStore.getState().publishPost(post.id);
      expect(result).toBe(false);
      
      const updated = useSocialStore.getState().getPost(post.id);
      expect(updated!.status).toBe('failed');
      expect(updated!.error).toBe('Platform not connected');
    });

    it('should succeed for connected platform', async () => {
      const post = useSocialStore.getState().createPost({
        platform: 'instagram',
        content: 'Test publish',
        mediaUrls: [],
        status: 'draft',
      });
      
      const result = await useSocialStore.getState().publishPost(post.id);
      expect(result).toBe(true);
      
      const updated = useSocialStore.getState().getPost(post.id);
      expect(updated!.status).toBe('published');
    });
  });
});
