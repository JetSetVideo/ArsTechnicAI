/**
 * HomeLeftToolbar — Floating vertical toolbar for quick actions.
 * Sits between the left panel and the main content area.
 */
import React, { useState } from 'react';
import {
  Sparkles, Box, BrainCircuit,
  Download, Send, Palette,
  Pencil, Eraser, MousePointer2, Type, Square,
  Circle, Pipette, Image, Film, Music,
  ChevronLeft, ChevronRight,
} from 'lucide-react';

export interface ToolbarAction {
  id: string;
  icon: React.ReactNode;
  label: string;
  group: string;
  onClick: () => void;
  active?: boolean;
}

interface HomeLeftToolbarProps {
  onAction?: (actionId: string) => void;
  activeAction?: string;
}

type ToolGroup = {
  id: string;
  label: string;
  expanded: boolean;
};

export const HomeLeftToolbar: React.FC<HomeLeftToolbarProps> = ({ onAction, activeAction }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [groups, setGroups] = useState<ToolGroup[]>([
    { id: 'create', label: 'Generate', expanded: true },
    { id: 'draw', label: 'Draw', expanded: false },
    { id: 'export', label: 'Export', expanded: false },
  ]);

  const toggleGroup = (id: string) => {
    setGroups(prev => prev.map(g => g.id === id ? { ...g, expanded: !g.expanded } : g));
  };

  const handleAction = (id: string) => {
    onAction?.(id);
  };

  const actionGroups: Record<string, ToolbarAction[]> = {
    create: [
      { id: 'gen-image', icon: <Image size={15} />, label: 'Generate Image', group: 'create', onClick: () => handleAction('gen-image'), active: activeAction === 'gen-image' },
      { id: 'gen-video', icon: <Film size={15} />, label: 'Generate Video', group: 'create', onClick: () => handleAction('gen-video') },
      { id: 'gen-music', icon: <Music size={15} />, label: 'Generate Music', group: 'create', onClick: () => handleAction('gen-music') },
      { id: 'character', icon: <Sparkles size={15} />, label: 'Character Creator', group: 'create', onClick: () => handleAction('character') },
      { id: 'template', icon: <Palette size={15} />, label: 'Templates', group: 'create', onClick: () => handleAction('template') },
      { id: '3d-scene', icon: <Box size={15} />, label: '3D Scene', group: 'create', onClick: () => handleAction('3d-scene') },
      { id: 'auto-tag', icon: <BrainCircuit size={15} />, label: 'Auto Analyze', group: 'create', onClick: () => handleAction('auto-tag') },
      { id: 'prompt-img', icon: <Sparkles size={15} />, label: 'Image → Prompt', group: 'create', onClick: () => handleAction('prompt-img') },
    ],
    draw: [
      { id: 'brush', icon: <Pencil size={15} />, label: 'Brush (B)', group: 'draw', onClick: () => handleAction('brush') },
      { id: 'eraser', icon: <Eraser size={15} />, label: 'Eraser (E)', group: 'draw', onClick: () => handleAction('eraser') },
      { id: 'shape-rect', icon: <Square size={15} />, label: 'Rectangle', group: 'draw', onClick: () => handleAction('shape-rect') },
      { id: 'shape-ellipse', icon: <Circle size={15} />, label: 'Ellipse', group: 'draw', onClick: () => handleAction('shape-ellipse') },
      { id: 'text', icon: <Type size={15} />, label: 'Text (T)', group: 'draw', onClick: () => handleAction('text') },
      { id: 'picker', icon: <Pipette size={15} />, label: 'Color Picker (I)', group: 'draw', onClick: () => handleAction('picker') },
      { id: 'pointer', icon: <MousePointer2 size={15} />, label: 'Select (V)', group: 'draw', onClick: () => handleAction('pointer') },
    ],
    export: [
      { id: 'export', icon: <Download size={15} />, label: 'Export', group: 'export', onClick: () => handleAction('export') },
      { id: 'publish', icon: <Send size={15} />, label: 'Publish', group: 'export', onClick: () => handleAction('publish') },
    ],
  };

  if (collapsed) {
    return (
      <div style={{
        width: 32, minWidth: 32, background: 'hsla(210, 15%, 15%, 0.5)',
        backdropFilter: 'blur(12px)', borderRight: '1px solid hsla(210, 15%, 85%, 0.04)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 6, gap: 6,
      }}>
        <button onClick={() => setCollapsed(false)}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
          <ChevronRight size={12} />
        </button>
        {groups.map(g => (
          <div key={g.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(actionGroups[g.id] || []).slice(0, 3).map(a => (
              <button key={a.id} onClick={a.onClick} title={a.label}
                style={{
                  background: a.active ? 'rgba(0,212,170,0.1)' : 'none',
                  border: a.active ? '1px solid var(--accent-primary)' : '1px solid transparent',
                  borderRadius: 5, color: a.active ? 'var(--accent-primary)' : 'var(--text-muted)',
                  cursor: 'pointer', padding: 4, display: 'flex',
                }}>
                {a.icon}
              </button>
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{
      width: 48, minWidth: 48,
      background: 'hsla(210, 15%, 15%, 0.5)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderRight: '1px solid hsla(210, 15%, 85%, 0.04)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '5px 6px', borderBottom: '1px solid hsla(210, 15%, 85%, 0.03)',
      }}>
        <span style={{ fontSize: '0.5rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
          Tools
        </span>
        <button onClick={() => setCollapsed(true)}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}>
          <ChevronLeft size={10} />
        </button>
      </div>

      {/* Tool groups */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {groups.map(group => (
          <div key={group.id} style={{ marginBottom: 2 }}>
            <button
              onClick={() => toggleGroup(group.id)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '3px 8px',
                background: 'none', border: 'none',
                color: group.expanded ? 'var(--text-secondary)' : 'var(--text-muted)',
                fontSize: '0.5rem', fontWeight: 600, textTransform: 'uppercase',
                letterSpacing: '0.04em', cursor: 'pointer',
              }}>
              {group.label}
            </button>
            {group.expanded && (actionGroups[group.id] || []).map(action => (
              <button
                key={action.id}
                onClick={action.onClick}
                title={action.label}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '100%', padding: '6px 0',
                  background: action.active ? 'rgba(0,212,170,0.08)' : 'none',
                  border: 'none', borderLeft: action.active ? '2px solid var(--accent-primary)' : '2px solid transparent',
                  color: action.active ? 'var(--accent-primary)' : 'var(--text-muted)',
                  cursor: 'pointer', transition: 'all 0.1s',
                }}
                onMouseEnter={e => { if (!action.active) e.currentTarget.style.color = 'var(--text-secondary)'; }}
                onMouseLeave={e => { if (!action.active) e.currentTarget.style.color = 'var(--text-muted)'; }}>
                {action.icon}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Bottom: active tool indicator */}
      {activeAction && (
        <div style={{
          padding: '4px 6px', borderTop: '1px solid hsla(210, 15%, 85%, 0.03)',
          fontSize: '0.45rem', color: 'var(--accent-primary)', textAlign: 'center',
          textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          {activeAction}
        </div>
      )}
    </div>
  );
};

export default HomeLeftToolbar;
