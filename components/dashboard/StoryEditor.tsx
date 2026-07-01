/**
 * StoryEditor — Chapter/scene tree with drag-drop reorder (ART-005)
 */
import React, { useState } from 'react';
import {
  ChevronRight, ChevronDown, Plus, Trash2, GripVertical,
  BookOpen, FileText, Edit3, Eye, Check, X,
} from 'lucide-react';

interface StoryEditorChapter {
  id: string;
  number: number;
  title: string;
  scenes: StoryEditorScene[];
}

interface StoryEditorScene {
  id: string;
  number: number;
  title: string;
  description: string;
  wordCount: number;
  dialogueCount: number;
  hasIllustration: boolean;
  illustrationStatus: 'pending' | 'generated' | 'approved' | 'rejected';
}

interface StoryEditorProps {
  chapters: StoryEditorChapter[];
  onSelectScene?: (chapterId: string, sceneId: string) => void;
  onAddChapter?: () => void;
  onAddScene?: (chapterId: string) => void;
  onDeleteChapter?: (chapterId: string) => void;
  onDeleteScene?: (chapterId: string, sceneId: string) => void;
  onReorder?: (fromIdx: number, toIdx: number) => void;
}

export const StoryEditor: React.FC<StoryEditorProps> = ({
  chapters, onSelectScene, onAddChapter, onAddScene,
  onDeleteChapter, onDeleteScene, onReorder,
}) => {
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set(chapters.map(c => c.id)));
  const [selectedScene, setSelectedScene] = useState<string | null>(null);

  const toggleChapter = (id: string) => {
    setExpandedChapters(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const statusIcons: Record<string, React.ReactNode> = {
    pending: <Eye size={10} color="var(--text-muted)" />,
    generated: <Check size={10} color="var(--accent-primary)" />,
    approved: <Check size={10} color="var(--success)" />,
    rejected: <X size={10} color="var(--error)" />,
  };

  return (
    <div style={{
      background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
      borderRadius: 8, overflow: 'hidden', maxHeight: 500, display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', borderBottom: '1px solid var(--border-color)',
        background: 'var(--bg-tertiary)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <BookOpen size={14} color="var(--accent-primary)" />
          <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Story Editor</span>
        </div>
        <button onClick={onAddChapter} style={{
          background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.2)',
          borderRadius: 5, color: 'var(--accent-primary)', fontSize: '0.625rem',
          cursor: 'pointer', padding: '3px 10px', display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <Plus size={10} /> Chapter
        </button>
      </div>

      {/* Chapter list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 4 }}>
        {chapters.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            No chapters yet. Add one to begin your story.
          </div>
        ) : (
          chapters.map((chapter, chIdx) => {
            const isExpanded = expandedChapters.has(chapter.id);
            return (
              <div key={chapter.id} style={{ marginBottom: 2 }}>
                {/* Chapter header */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 8px', borderRadius: 5, cursor: 'pointer',
                  background: isExpanded ? 'rgba(255,255,255,0.02)' : 'transparent',
                }}>
                  <button onClick={() => toggleChapter(chapter.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}>
                    {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </button>
                  <span style={{
                    fontSize: '0.5625rem', color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)', minWidth: 24,
                  }}>
                    Ch.{chapter.number}
                  </span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 500, flex: 1 }}>
                    {chapter.title}
                  </span>
                  <span style={{ fontSize: '0.5625rem', color: 'var(--text-muted)' }}>
                    {chapter.scenes.length} scenes
                  </span>
                  <button onClick={(e) => { e.stopPropagation(); onAddScene?.(chapter.id); }}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}
                    title="Add scene">
                    <Plus size={12} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); onDeleteChapter?.(chapter.id); }}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}
                    title="Delete chapter">
                    <Trash2 size={12} />
                  </button>
                </div>

                {/* Scene list */}
                {isExpanded && chapter.scenes.map((scene, scIdx) => (
                  <div key={scene.id}
                    onClick={() => { setSelectedScene(scene.id); onSelectScene?.(chapter.id, scene.id); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      marginLeft: 28, padding: '4px 8px', borderRadius: 4, cursor: 'pointer',
                      background: selectedScene === scene.id ? 'rgba(0,212,170,0.06)' : 'transparent',
                      borderLeft: selectedScene === scene.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
                    }}>
                    <span style={{ fontSize: '0.5rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', width: 20 }}>
                      {scene.number}.
                    </span>
                    <FileText size={10} color="var(--text-muted)" />
                    <span style={{ fontSize: '0.6875rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {scene.title}
                    </span>
                    <span style={{ fontSize: '0.5rem', color: 'var(--text-muted)' }}>{scene.wordCount}w</span>
                    {statusIcons[scene.illustrationStatus]}
                    <button onClick={(e) => { e.stopPropagation(); onDeleteScene?.(chapter.id, scene.id); }}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 1, opacity: 0.3 }}>
                      <Trash2 size={10} />
                    </button>
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default StoryEditor;
