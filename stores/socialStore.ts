/**
 * Social Store
 * 
 * Manages social media connections and post history.
 * Handles TikTok, X, Instagram, YouTube, and email integrations.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { 
  SocialConnection, 
  SocialPost, 
  SocialPlatform, 
  PostStatus,
  PostEngagement 
} from '../types/dashboard';

// ============================================
// SAMPLE DATA
// ============================================

const SAMPLE_CONNECTIONS: SocialConnection[] = [
  {
    platform: 'instagram',
    connected: true,
    username: '@creative_studio',
    connectedAt: Date.now() - 86400000 * 30,
  },
  {
    platform: 'tiktok',
    connected: true,
    username: '@ars_technic',
    connectedAt: Date.now() - 86400000 * 15,
  },
  {
    platform: 'youtube',
    connected: false,
  },
  {
    platform: 'x',
    connected: false,
  },
  {
    platform: 'email',
    connected: true,
    username: 'newsletter@example.com',
    connectedAt: Date.now() - 86400000 * 60,
  },
];

const SAMPLE_POSTS: SocialPost[] = [
  {
    id: 'post-1',
    platform: 'instagram',
    content: 'Check out our latest AI-generated artwork! #AIArt #Creative',
    mediaUrls: [],
    status: 'published',
    publishedAt: Date.now() - 86400000 * 2,
    engagement: { likes: 245, comments: 18, shares: 12, views: 1520 },
    projectId: 'proj-1',
  },
  {
    id: 'post-2',
    platform: 'tiktok',
    content: 'How I use AI to speed up my creative workflow',
    mediaUrls: [],
    status: 'published',
    publishedAt: Date.now() - 86400000 * 5,
    engagement: { likes: 1840, comments: 92, shares: 156, views: 24500 },
    projectId: 'proj-1',
  },
  {
    id: 'post-3',
    platform: 'instagram',
    content: 'Behind the scenes of our brand refresh project',
    mediaUrls: [],
    status: 'scheduled',
    scheduledAt: Date.now() + 86400000 * 2,
    projectId: 'proj-3',
  },
  {
    id: 'post-4',
    platform: 'email',
    content: 'Monthly Newsletter - Creative Tips & Updates',
    mediaUrls: [],
    status: 'draft',
    projectId: 'proj-2',
  },
];

// ============================================
// PLATFORM METADATA
// ============================================

export const PLATFORM_INFO: Record<SocialPlatform, { name: string; icon: string; color: string; maxLength?: number }> = {
  tiktok: { name: 'TikTok', icon: 'video', color: '#000000', maxLength: 2200 },
  x: { name: 'X (Twitter)', icon: 'twitter', color: '#000000', maxLength: 280 },
  instagram: { name: 'Instagram', icon: 'instagram', color: '#E4405F', maxLength: 2200 },
  youtube: { name: 'YouTube', icon: 'youtube', color: '#FF0000', maxLength: 5000 },
  email: { name: 'Email', icon: 'mail', color: '#4F46E5' },
};

// ============================================
// STORE INTERFACE
// ============================================

interface SocialState {
  connections: SocialConnection[];
  posts: SocialPost[];
  drafts: SocialPost[];
}

interface SocialActions {
  // Connection management
  connectPlatform: (platform: SocialPlatform, username: string, accessToken?: string) => void;
  disconnectPlatform: (platform: SocialPlatform) => void;
  updateConnection: (platform: SocialPlatform, updates: Partial<SocialConnection>) => void;
  isConnected: (platform: SocialPlatform) => boolean;
  getConnection: (platform: SocialPlatform) => SocialConnection | undefined;
  getConnectedPlatforms: () => SocialConnection[];
  
  // Post management
  createPost: (post: Omit<SocialPost, 'id'>) => SocialPost;
  updatePost: (id: string, updates: Partial<SocialPost>) => void;
  deletePost: (id: string) => void;
  duplicatePost: (id: string, targetPlatform?: SocialPlatform) => SocialPost | null;
  
  // Post status
  saveDraft: (post: Omit<SocialPost, 'id' | 'status'>) => SocialPost;
  schedulePost: (id: string, scheduledAt: number) => void;
  publishPost: (id: string) => Promise<boolean>;
  cancelScheduled: (id: string) => void;
  
  // Engagement
  updateEngagement: (id: string, engagement: PostEngagement) => void;
  refreshEngagement: (id: string) => Promise<PostEngagement | null>;
  
  // Getters
  getPost: (id: string) => SocialPost | undefined;
  getPostsByPlatform: (platform: SocialPlatform) => SocialPost[];
  getPostsByStatus: (status: PostStatus) => SocialPost[];
  getPostsByProject: (projectId: string) => SocialPost[];
  getScheduledPosts: () => SocialPost[];
  getDrafts: () => SocialPost[];
  getPublishedPosts: () => SocialPost[];
  getRecentPosts: (limit?: number) => SocialPost[];
  
  // Analytics
  getTotalEngagement: () => { likes: number; comments: number; shares: number; views: number };
  getEngagementByPlatform: (platform: SocialPlatform) => { likes: number; comments: number; shares: number; views: number };
  getBestPerformingPost: () => SocialPost | undefined;
}

type SocialStore = SocialState & SocialActions;

// ============================================
// STORE IMPLEMENTATION
// ============================================

export const useSocialStore = create<SocialStore>()(
  persist(
    (set, get) => ({
      // Initial state
      connections: SAMPLE_CONNECTIONS,
      posts: SAMPLE_POSTS,
      drafts: [],

      // Connection management
      connectPlatform: (platform, username, accessToken) => {
        set((state) => ({
          connections: state.connections.map((c) =>
            c.platform === platform
              ? { ...c, connected: true, username, accessToken, connectedAt: Date.now() }
              : c
          ),
        }));
      },

      disconnectPlatform: (platform) => {
        set((state) => ({
          connections: state.connections.map((c) =>
            c.platform === platform
              ? { ...c, connected: false, username: undefined, accessToken: undefined, connectedAt: undefined }
              : c
          ),
        }));
      },

      updateConnection: (platform, updates) => {
        set((state) => ({
          connections: state.connections.map((c) =>
            c.platform === platform ? { ...c, ...updates } : c
          ),
        }));
      },

      isConnected: (platform) => 
        get().connections.find((c) => c.platform === platform)?.connected ?? false,

      getConnection: (platform) => 
        get().connections.find((c) => c.platform === platform),

      getConnectedPlatforms: () => 
        get().connections.filter((c) => c.connected),

      // Post management
      createPost: (postData) => {
        const newPost: SocialPost = {
          id: `post-${Date.now()}`,
          ...postData,
        };
        
        set((state) => ({
          posts: [newPost, ...state.posts],
        }));
        
        return newPost;
      },

      updatePost: (id, updates) => {
        set((state) => ({
          posts: state.posts.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        }));
      },

      deletePost: (id) => {
        set((state) => ({
          posts: state.posts.filter((p) => p.id !== id),
        }));
      },

      duplicatePost: (id, targetPlatform) => {
        const original = get().getPost(id);
        if (!original) return null;
        
        const duplicate: SocialPost = {
          ...original,
          id: `post-${Date.now()}`,
          platform: targetPlatform || original.platform,
          status: 'draft',
          scheduledAt: undefined,
          publishedAt: undefined,
          engagement: undefined,
        };
        
        set((state) => ({
          posts: [duplicate, ...state.posts],
        }));
        
        return duplicate;
      },

      // Post status
      saveDraft: (postData) => {
        const draft: SocialPost = {
          id: `post-${Date.now()}`,
          ...postData,
          status: 'draft',
        };
        
        set((state) => ({
          posts: [draft, ...state.posts],
        }));
        
        return draft;
      },

      schedulePost: (id, scheduledAt) => {
        set((state) => ({
          posts: state.posts.map((p) =>
            p.id === id ? { ...p, status: 'scheduled' as PostStatus, scheduledAt } : p
          ),
        }));
      },

      publishPost: async (id) => {
        const post = get().getPost(id);
        if (!post) return false;
        
        // Check if platform is connected
        if (!get().isConnected(post.platform)) {
          set((state) => ({
            posts: state.posts.map((p) =>
              p.id === id ? { ...p, status: 'failed' as PostStatus, error: 'Platform not connected' } : p
            ),
          }));
          return false;
        }
        
        // In production, this would call the actual platform API
        // For now, simulate successful publish
        set((state) => ({
          posts: state.posts.map((p) =>
            p.id === id
              ? { ...p, status: 'published' as PostStatus, publishedAt: Date.now(), error: undefined }
              : p
          ),
        }));
        
        return true;
      },

      cancelScheduled: (id) => {
        set((state) => ({
          posts: state.posts.map((p) =>
            p.id === id && p.status === 'scheduled'
              ? { ...p, status: 'draft' as PostStatus, scheduledAt: undefined }
              : p
          ),
        }));
      },

      // Engagement
      updateEngagement: (id, engagement) => {
        set((state) => ({
          posts: state.posts.map((p) =>
            p.id === id ? { ...p, engagement } : p
          ),
        }));
      },

      refreshEngagement: async (id) => {
        const post = get().getPost(id);
        if (!post || post.status !== 'published') return null;
        
        // In production, this would fetch from the actual platform API
        // For now, return existing or simulated engagement
        return post.engagement || { likes: 0, comments: 0, shares: 0, views: 0 };
      },

      // Getters
      getPost: (id) => get().posts.find((p) => p.id === id),
      
      getPostsByPlatform: (platform) => 
        get().posts.filter((p) => p.platform === platform),
      
      getPostsByStatus: (status) => 
        get().posts.filter((p) => p.status === status),
      
      getPostsByProject: (projectId) => 
        get().posts.filter((p) => p.projectId === projectId),
      
      getScheduledPosts: () => 
        get().posts
          .filter((p) => p.status === 'scheduled')
          .sort((a, b) => (a.scheduledAt || 0) - (b.scheduledAt || 0)),
      
      getDrafts: () => 
        get().posts.filter((p) => p.status === 'draft'),
      
      getPublishedPosts: () => 
        get().posts
          .filter((p) => p.status === 'published')
          .sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0)),
      
      getRecentPosts: (limit = 10) => 
        get().posts
          .filter((p) => p.status === 'published')
          .sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0))
          .slice(0, limit),

      // Analytics
      getTotalEngagement: () => {
        const posts = get().posts.filter((p) => p.engagement);
        return posts.reduce(
          (acc, p) => ({
            likes: acc.likes + (p.engagement?.likes || 0),
            comments: acc.comments + (p.engagement?.comments || 0),
            shares: acc.shares + (p.engagement?.shares || 0),
            views: acc.views + (p.engagement?.views || 0),
          }),
          { likes: 0, comments: 0, shares: 0, views: 0 }
        );
      },

      getEngagementByPlatform: (platform) => {
        const posts = get().posts.filter((p) => p.platform === platform && p.engagement);
        return posts.reduce(
          (acc, p) => ({
            likes: acc.likes + (p.engagement?.likes || 0),
            comments: acc.comments + (p.engagement?.comments || 0),
            shares: acc.shares + (p.engagement?.shares || 0),
            views: acc.views + (p.engagement?.views || 0),
          }),
          { likes: 0, comments: 0, shares: 0, views: 0 }
        );
      },

      getBestPerformingPost: () => {
        const publishedPosts = get().posts.filter((p) => p.status === 'published' && p.engagement);
        if (publishedPosts.length === 0) return undefined;
        
        return publishedPosts.reduce((best, current) => {
          const bestScore = (best.engagement?.likes || 0) + (best.engagement?.shares || 0) * 2;
          const currentScore = (current.engagement?.likes || 0) + (current.engagement?.shares || 0) * 2;
          return currentScore > bestScore ? current : best;
        });
      },
    }),
    {
      name: 'ars-technicai-social',
      version: 1,
      partialize: (state) => ({
        connections: state.connections.map((c) => ({
          ...c,
          accessToken: undefined, // Don't persist tokens in localStorage
        })),
        posts: state.posts,
      }),
    }
  )
);
