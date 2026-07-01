/**
 * IllustrationReviewBoard — Grid of illustrations with approve/reject (ART-009)
 */
import React, { useState } from 'react';
import { Check, X, Maximize2, RefreshCw, Filter, Image as ImageIcon } from 'lucide-react';

export interface ReviewIllustration {
  id: string;
  chapterNumber: number;
  sceneNumber: number;
  title: string;
  imageUrl?: string;
  prompt: string;
  characterNames: string[];
  status: 'pending' | 'approved' | 'rejected' | 'needs-revision';
  similarityScore?: number;
}

interface IllustrationReviewBoardProps {
  illustrations: ReviewIllustration[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onRegenerate: (id: string) => void;
  onApproveAll?: () => void;
  onRejectAll?: () => void;
  onExpand: (id: string) => void;
}

export const IllustrationReviewBoard: React.FC<IllustrationReviewBoardProps> = ({
  illustrations, onApprove, onReject, onRegenerate,
  onApproveAll, onRejectAll, onExpand,
}) => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filtered = filter === 'all'
    ? illustrations
    : illustrations.filter(i => i.status === filter);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const batchApprove = () => {
    selectedIds.forEach(id => onApprove(id));
    setSelectedIds(new Set());
  };

  const batchReject = () => {
    selectedIds.forEach(id => onReject(id));
    setSelectedIds(new Set());
  };

  const statusColors: Record<string, string> = {
    pending: 'var(--text-muted)',
    approved: 'var(--success)',
    rejected: 'var(--error)',
    'needs-revision': 'var(--accent-tertiary)',
  };

  const counts = {
    all: illustrations.length,
    pending: illustrations.filter(i => i.status === 'pending').length,
    approved: illustrations.filter(i => i.status === 'approved').length,
    rejected: illustrations.filter(i => i.status === 'rejected').length,
  };

  return (
    <div style={{
      background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
      borderRadius: 8, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', borderBottom: '1px solid var(--border-color)',
        background: 'var(--bg-tertiary)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ImageIcon size={14} color="var(--accent-primary)" />
          <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Review Board</span>
          <span style={{ fontSize: '0.5625rem', color: 'var(--text-muted)' }}>
            {illustrations.length} illustrations
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{
                padding: '2px 8px', borderRadius: 4, border: '1px solid',
                borderColor: filter === f ? 'var(--accent-primary)' : 'var(--border-color)',
                background: filter === f ? 'rgba(0,212,170,0.06)' : 'none',
                color: filter === f ? 'var(--accent-primary)' : 'var(--text-muted)',
                fontSize: '0.5625rem', cursor: 'pointer',
              }}>
              {f} ({counts[f]})
            </button>
          ))}
        </div>
      </div>

      {/* Batch actions */}
      {selectedIds.size > 0 && (
        <div style={{
          display: 'flex', gap: 8, padding: '6px 12px',
          background: 'rgba(0,212,170,0.04)', borderBottom: '1px solid var(--border-color)',
          alignItems: 'center',
        }}>
          <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
            {selectedIds.size} selected
          </span>
          <button onClick={batchApprove}
            style={{ padding: '3px 10px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 4, color: 'var(--success)', fontSize: '0.5625rem', cursor: 'pointer' }}>
            ✓ Approve All
          </button>
          <button onClick={batchReject}
            style={{ padding: '3px 10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 4, color: 'var(--error)', fontSize: '0.5625rem', cursor: 'pointer' }}>
            ✗ Reject All
          </button>
        </div>
      )}

      {/* Illustration grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 8, padding: 12, maxHeight: 500, overflowY: 'auto',
      }}>
        {filtered.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            No {filter} illustrations.
          </div>
        ) : (
          filtered.map(ill => {
            const isSelected = selectedIds.has(ill.id);
            return (
              <div key={ill.id}
                onClick={() => toggleSelect(ill.id)}
                style={{
                  border: '1px solid',
                  borderColor: isSelected ? 'var(--accent-primary)' : 'var(--border-color)',
                  borderRadius: 8, overflow: 'hidden', cursor: 'pointer',
                  background: isSelected ? 'rgba(0,212,170,0.04)' : 'var(--bg-primary)',
                }}>
                {/* Image */}
                <div style={{
                  width: '100%', height: 140, background: 'var(--bg-tertiary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative',
                }}>
                  {ill.imageUrl ? (
                    <img src={ill.imageUrl} alt={ill.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <ImageIcon size={32} opacity={0.2} />
                  )}
                  {/* Status indicator */}
                  <div style={{
                    position: 'absolute', top: 6, right: 6,
                    width: 10, height: 10, borderRadius: '50%',
                    background: statusColors[ill.status],
                    border: '2px solid rgba(0,0,0,0.5)',
                  }} />
                  {/* Scene badge */}
                  <div style={{
                    position: 'absolute', top: 6, left: 6,
                    background: 'rgba(0,0,0,0.7)', padding: '1px 5px',
                    borderRadius: 3, fontSize: '0.5rem', color: '#fff',
                    fontFamily: 'var(--font-mono)',
                  }}>
                    Ch.{ill.chapterNumber} Sc.{ill.sceneNumber}
                  </div>
                  {/* Similarity score */}
                  {ill.similarityScore != null && (
                    <div style={{
                      position: 'absolute', bottom: 6, right: 6,
                      background: 'rgba(0,0,0,0.7)', padding: '1px 5px',
                      borderRadius: 3, fontSize: '0.5rem',
                      color: ill.similarityScore >= 0.7 ? 'var(--success)' : 'var(--error)',
                      fontFamily: 'var(--font-mono)',
                    }}>
                      {(ill.similarityScore * 100).toFixed(0)}%
                    </div>
                  )}
                </div>

                {/* Info */}
                <div style={{ padding: '6px 8px' }}>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ill.title}
                  </div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                    {ill.characterNames.map(c => (
                      <span key={c} style={{ fontSize: '0.5rem', padding: '1px 4px', background: 'rgba(0,212,170,0.06)', borderRadius: 3, color: 'var(--accent-primary)' }}>{c}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                    <button onClick={(e) => { e.stopPropagation(); onApprove(ill.id); }}
                      style={{ flex: 1, padding: '3px 0', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 4, color: 'var(--success)', fontSize: '0.5625rem', cursor: 'pointer' }}>
                      <Check size={10} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onReject(ill.id); }}
                      style={{ flex: 1, padding: '3px 0', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 4, color: 'var(--error)', fontSize: '0.5625rem', cursor: 'pointer' }}>
                      <X size={10} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onRegenerate(ill.id); }}
                      style={{ flex: 1, padding: '3px 0', background: 'none', border: '1px solid var(--border-color)', borderRadius: 4, color: 'var(--text-muted)', fontSize: '0.5625rem', cursor: 'pointer' }}>
                      <RefreshCw size={10} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onExpand(ill.id); }}
                      style={{ padding: '3px 4px', background: 'none', border: '1px solid var(--border-color)', borderRadius: 4, color: 'var(--text-muted)', fontSize: '0.5625rem', cursor: 'pointer' }}>
                      <Maximize2 size={10} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default IllustrationReviewBoard;
