/**
 * StoryboardView — Visual timeline of scene illustrations (ART-011)
 * Horizontal scroll per chapter, thumbnails, scene markers, click-to-expand.
 */
import React, { useState, useRef } from 'react';
import {
  ChevronLeft, ChevronRight, Maximize2, Eye, Film, Clock,
  Image as ImageIcon, Layers, Play,
} from 'lucide-react';

export interface StoryboardScene {
  id: string;
  chapterNumber: number;
  sceneNumber: number;
  title: string;
  description: string;
  imageUrl?: string;
  prompt?: string;
  shotType: string;
  duration: number;
  characters: string[];
  status: 'pending' | 'generated' | 'approved' | 'rejected';
}

interface StoryboardViewProps {
  scenes: StoryboardScene[];
  onSelectScene?: (sceneId: string) => void;
  onApprove?: (sceneId: string) => void;
  onReject?: (sceneId: string) => void;
  onRegenerate?: (sceneId: string) => void;
}

export const StoryboardView: React.FC<StoryboardViewProps> = ({
  scenes, onSelectScene, onApprove, onReject, onRegenerate,
}) => {
  const [expandedScene, setExpandedScene] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<number | 'all'>('all');
  const scrollRef = useRef<HTMLDivElement>(null);

  const chapters = [...new Set(scenes.map(s => s.chapterNumber))].sort((a, b) => a - b);
  const filteredScenes = selectedChapter === 'all'
    ? scenes
    : scenes.filter(s => s.chapterNumber === selectedChapter);

  const scroll = (dir: 'left' | 'right') => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir === 'left' ? -300 : 300, behavior: 'smooth' });
    }
  };

  const statusColors: Record<string, string> = {
    pending: 'var(--text-muted)',
    generated: 'var(--accent-primary)',
    approved: 'var(--success)',
    rejected: 'var(--error)',
  };

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
      borderRadius: 8,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', borderBottom: '1px solid var(--border-color)',
        background: 'var(--bg-tertiary)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Film size={14} color="var(--accent-primary)" />
          <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Storyboard</span>
          <span style={{ fontSize: '0.5625rem', color: 'var(--text-muted)' }}>
            {scenes.length} scenes
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: '0.5625rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Chapter</span>
          <button
            onClick={() => setSelectedChapter('all')}
            style={{
              padding: '2px 8px', borderRadius: 4, border: '1px solid',
              borderColor: selectedChapter === 'all' ? 'var(--accent-primary)' : 'var(--border-color)',
              background: selectedChapter === 'all' ? 'rgba(0,212,170,0.08)' : 'none',
              color: selectedChapter === 'all' ? 'var(--accent-primary)' : 'var(--text-muted)',
              fontSize: '0.625rem', cursor: 'pointer',
            }}>
            All
          </button>
          {chapters.map(ch => (
            <button key={ch}
              onClick={() => setSelectedChapter(ch)}
              style={{
                padding: '2px 8px', borderRadius: 4, border: '1px solid',
                borderColor: selectedChapter === ch ? 'var(--accent-primary)' : 'var(--border-color)',
                background: selectedChapter === ch ? 'rgba(0,212,170,0.08)' : 'none',
                color: selectedChapter === ch ? 'var(--accent-primary)' : 'var(--text-muted)',
                fontSize: '0.625rem', cursor: 'pointer',
              }}>
              Ch.{ch}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable strip */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => scroll('left')}
          style={{
            position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
            zIndex: 5, background: 'rgba(0,0,0,0.6)', border: 'none',
            color: '#fff', cursor: 'pointer', padding: '6px 4px', borderRadius: '0 4px 4px 0',
          }}>
          <ChevronLeft size={16} />
        </button>
        <button
          onClick={() => scroll('right')}
          style={{
            position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)',
            zIndex: 5, background: 'rgba(0,0,0,0.6)', border: 'none',
            color: '#fff', cursor: 'pointer', padding: '6px 4px', borderRadius: '4px 0 0 4px',
          }}>
          <ChevronRight size={16} />
        </button>

        <div
          ref={scrollRef}
          style={{
            display: 'flex', gap: 8, padding: 12,
            overflowX: 'auto', scrollBehavior: 'smooth',
          }}>
          {filteredScenes.length === 0 ? (
            <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center', width: '100%' }}>
              No scenes yet. Generate illustrations to populate the storyboard.
            </div>
          ) : (
            filteredScenes.map(scene => (
              <div
                key={scene.id}
                onClick={() => {
                  setExpandedScene(expandedScene === scene.id ? null : scene.id);
                  onSelectScene?.(scene.id);
                }}
                style={{
                  flexShrink: 0, width: 180,
                  background: expandedScene === scene.id ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
                  border: '1px solid',
                  borderColor: expandedScene === scene.id ? 'var(--accent-primary)' : 'var(--border-color)',
                  borderRadius: 8, overflow: 'hidden', cursor: 'pointer',
                  transition: 'all 0.15s',
                }}>
                {/* Thumbnail */}
                <div style={{
                  width: '100%', height: 120,
                  background: 'var(--bg-tertiary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative',
                }}>
                  {scene.imageUrl ? (
                    <img src={scene.imageUrl} alt={scene.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <ImageIcon size={32} color="var(--text-muted)" opacity={0.3} />
                  )}
                  {/* Status dot */}
                  <div style={{
                    position: 'absolute', top: 6, right: 6,
                    width: 8, height: 8, borderRadius: '50%',
                    background: statusColors[scene.status],
                  }} />
                  {/* Scene number */}
                  <div style={{
                    position: 'absolute', top: 6, left: 6,
                    background: 'rgba(0,0,0,0.7)', padding: '1px 6px',
                    borderRadius: 4, fontSize: '0.5625rem', color: '#fff',
                    fontFamily: 'var(--font-mono)',
                  }}>
                    Ch.{scene.chapterNumber} Sc.{scene.sceneNumber}
                  </div>
                </div>

                {/* Info */}
                <div style={{ padding: '6px 8px' }}>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 500, color: 'var(--text-primary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {scene.title}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 4, fontSize: '0.5625rem', color: 'var(--text-muted)' }}>
                    <span>{scene.shotType}</span>
                    <span>·</span>
                    <span><Clock size={8} /> {scene.duration}s</span>
                  </div>
                  {scene.characters.length > 0 && (
                    <div style={{ display: 'flex', gap: 3, marginTop: 4, flexWrap: 'wrap' }}>
                      {scene.characters.map(c => (
                        <span key={c} style={{
                          fontSize: '0.5rem', padding: '1px 4px',
                          background: 'rgba(0,212,170,0.06)', borderRadius: 3,
                          color: 'var(--accent-primary)',
                        }}>{c}</span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Expanded details */}
                {expandedScene === scene.id && (
                  <div style={{ padding: '6px 8px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-tertiary)' }}>
                    <p style={{ fontSize: '0.625rem', color: 'var(--text-secondary)', margin: '0 0 6px 0', lineHeight: 1.4 }}>
                      {scene.description?.slice(0, 150)}{scene.description?.length > 150 ? '…' : ''}
                    </p>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={(e) => { e.stopPropagation(); onApprove?.(scene.id); }}
                        style={{ flex: 1, padding: '3px 6px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 4, color: 'var(--success)', fontSize: '0.5625rem', cursor: 'pointer' }}>
                        ✓ Approve
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); onReject?.(scene.id); }}
                        style={{ flex: 1, padding: '3px 6px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 4, color: 'var(--error)', fontSize: '0.5625rem', cursor: 'pointer' }}>
                        ✗ Reject
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); onRegenerate?.(scene.id); }}
                        style={{ padding: '3px 6px', background: 'none', border: '1px solid var(--border-color)', borderRadius: 4, color: 'var(--text-muted)', fontSize: '0.5625rem', cursor: 'pointer' }}>
                        ↻
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default StoryboardView;
