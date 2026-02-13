/**
 * SocialHistory Component
 * 
 * Social media post history and connected accounts management.
 */

import { useState } from 'react';
import { 
  Link as LinkIcon, 
  Unlink, 
  Plus, 
  Calendar, 
  Heart, 
  MessageCircle, 
  Share2,
  Eye,
  Clock,
  CheckCircle,
  AlertCircle,
  Edit2,
  Trash2
} from 'lucide-react';
import { useSocialStore, PLATFORM_INFO } from '../../stores';
import { Button } from '../ui';
import type { SocialPlatform, PostStatus } from '../../types/dashboard';
import styles from './SocialHistory.module.css';

// Platform icons (simplified - in production would use actual brand icons)
const PLATFORM_ICONS: Record<SocialPlatform, string> = {
  tiktok: '📱',
  x: '𝕏',
  instagram: '📷',
  youtube: '▶️',
  email: '📧',
};

const STATUS_CONFIG: Record<PostStatus, { icon: React.ReactNode; label: string; color: string }> = {
  draft: { icon: <Edit2 size={12} />, label: 'Draft', color: 'var(--text-muted)' },
  scheduled: { icon: <Clock size={12} />, label: 'Scheduled', color: 'var(--warning)' },
  published: { icon: <CheckCircle size={12} />, label: 'Published', color: 'var(--success)' },
  failed: { icon: <AlertCircle size={12} />, label: 'Failed', color: 'var(--error)' },
};

export function SocialHistory() {
  const {
    connections,
    getConnectedPlatforms,
    getPostsByPlatform,
    getScheduledPosts,
    getDrafts,
    getPublishedPosts,
    getRecentPosts,
    getTotalEngagement,
    connectPlatform,
    disconnectPlatform,
    deletePost,
    publishPost,
    cancelScheduled,
  } = useSocialStore();

  const [activePlatform, setActivePlatform] = useState<SocialPlatform | 'all'>('all');

  const connectedPlatforms = getConnectedPlatforms();
  const totalEngagement = getTotalEngagement();
  const recentPosts = getRecentPosts(10);
  const scheduledPosts = getScheduledPosts();
  const drafts = getDrafts();

  const displayPosts = activePlatform === 'all' 
    ? recentPosts 
    : getPostsByPlatform(activePlatform);

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleConnect = (platform: SocialPlatform) => {
    // In production, this would open OAuth flow
    const username = prompt(`Enter your ${PLATFORM_INFO[platform].name} username:`);
    if (username) {
      connectPlatform(platform, username);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.columns}>
        {/* Left Column - Connections & Stats */}
        <div className={styles.sidebar}>
          {/* Connected Accounts */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Connected Accounts</h3>
            <div className={styles.connectionsList}>
              {connections.map((conn) => (
                <div 
                  key={conn.platform} 
                  className={`${styles.connectionItem} ${conn.connected ? styles.connected : ''}`}
                >
                  <span className={styles.platformIcon}>
                    {PLATFORM_ICONS[conn.platform]}
                  </span>
                  <div className={styles.connectionInfo}>
                    <span className={styles.platformName}>
                      {PLATFORM_INFO[conn.platform].name}
                    </span>
                    {conn.connected && conn.username && (
                      <span className={styles.username}>{conn.username}</span>
                    )}
                  </div>
                  {conn.connected ? (
                    <button 
                      className={styles.disconnectButton}
                      onClick={() => disconnectPlatform(conn.platform)}
                      title="Disconnect"
                    >
                      <Unlink size={14} />
                    </button>
                  ) : (
                    <button 
                      className={styles.connectButton}
                      onClick={() => handleConnect(conn.platform)}
                    >
                      <LinkIcon size={14} />
                      Connect
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Engagement Stats */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Total Engagement</h3>
            <div className={styles.statsGrid}>
              <div className={styles.statItem}>
                <Heart size={16} />
                <span className={styles.statValue}>{totalEngagement.likes.toLocaleString()}</span>
                <span className={styles.statLabel}>Likes</span>
              </div>
              <div className={styles.statItem}>
                <MessageCircle size={16} />
                <span className={styles.statValue}>{totalEngagement.comments.toLocaleString()}</span>
                <span className={styles.statLabel}>Comments</span>
              </div>
              <div className={styles.statItem}>
                <Share2 size={16} />
                <span className={styles.statValue}>{totalEngagement.shares.toLocaleString()}</span>
                <span className={styles.statLabel}>Shares</span>
              </div>
              <div className={styles.statItem}>
                <Eye size={16} />
                <span className={styles.statValue}>{totalEngagement.views.toLocaleString()}</span>
                <span className={styles.statLabel}>Views</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className={styles.section}>
            <Button variant="primary" size="md" className={styles.fullWidth}>
              <Plus size={16} />
              Schedule New Post
            </Button>
          </div>
        </div>

        {/* Right Column - Post History */}
        <div className={styles.main}>
          {/* Platform Filter */}
          <div className={styles.platformFilter}>
            <button
              className={`${styles.filterTab} ${activePlatform === 'all' ? styles.active : ''}`}
              onClick={() => setActivePlatform('all')}
            >
              All
            </button>
            {connectedPlatforms.map((conn) => (
              <button
                key={conn.platform}
                className={`${styles.filterTab} ${activePlatform === conn.platform ? styles.active : ''}`}
                onClick={() => setActivePlatform(conn.platform)}
              >
                {PLATFORM_ICONS[conn.platform]}
                {PLATFORM_INFO[conn.platform].name}
              </button>
            ))}
          </div>

          {/* Scheduled Posts */}
          {scheduledPosts.length > 0 && activePlatform === 'all' && (
            <div className={styles.postSection}>
              <h3 className={styles.postSectionTitle}>
                <Clock size={16} />
                Scheduled ({scheduledPosts.length})
              </h3>
              <div className={styles.postList}>
                {scheduledPosts.slice(0, 3).map((post) => (
                  <div key={post.id} className={styles.postCard}>
                    <span className={styles.postPlatform}>
                      {PLATFORM_ICONS[post.platform]}
                    </span>
                    <div className={styles.postContent}>
                      <p className={styles.postText}>{post.content}</p>
                      <div className={styles.postMeta}>
                        <span 
                          className={styles.postStatus}
                          style={{ color: STATUS_CONFIG[post.status].color }}
                        >
                          {STATUS_CONFIG[post.status].icon}
                          {formatDate(post.scheduledAt)}
                        </span>
                      </div>
                    </div>
                    <div className={styles.postActions}>
                      <button 
                        className={styles.actionButton}
                        onClick={() => publishPost(post.id)}
                        title="Publish now"
                      >
                        <CheckCircle size={14} />
                      </button>
                      <button 
                        className={styles.actionButton}
                        onClick={() => cancelScheduled(post.id)}
                        title="Cancel"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Post History */}
          <div className={styles.postSection}>
            <h3 className={styles.postSectionTitle}>
              Post History
            </h3>
            <div className={styles.postList}>
              {displayPosts.map((post) => (
                <div key={post.id} className={styles.postCard}>
                  <span className={styles.postPlatform}>
                    {PLATFORM_ICONS[post.platform]}
                  </span>
                  <div className={styles.postContent}>
                    <p className={styles.postText}>{post.content}</p>
                    <div className={styles.postMeta}>
                      <span 
                        className={styles.postStatus}
                        style={{ color: STATUS_CONFIG[post.status].color }}
                      >
                        {STATUS_CONFIG[post.status].icon}
                        {STATUS_CONFIG[post.status].label}
                      </span>
                      {post.publishedAt && (
                        <span className={styles.postDate}>
                          {formatDate(post.publishedAt)}
                        </span>
                      )}
                    </div>
                    {post.engagement && (
                      <div className={styles.postEngagement}>
                        <span><Heart size={12} /> {post.engagement.likes}</span>
                        <span><MessageCircle size={12} /> {post.engagement.comments}</span>
                        <span><Share2 size={12} /> {post.engagement.shares}</span>
                      </div>
                    )}
                  </div>
                  <div className={styles.postActions}>
                    <button 
                      className={styles.actionButton}
                      onClick={() => deletePost(post.id)}
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}

              {displayPosts.length === 0 && (
                <div className={styles.emptyState}>
                  <p>No posts yet</p>
                  <Button variant="secondary" size="sm">
                    Create your first post
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SocialHistory;
