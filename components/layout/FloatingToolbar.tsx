import React, { useState, useRef, useEffect } from 'react';
import {
  MousePointer2,
  Hand,
  BoxSelect,
  Pen,
  Square,
  Type,
} from 'lucide-react';
import styles from './FloatingToolbar.module.css';
import type { WorkspaceMode } from '@/types';

export type ToolId =
  | 'pointer' | 'lasso' | 'hand'
  | 'pen' | 'shape' | 'text' | 'eyedropper';

const SELECTION_CYCLE: ToolId[] = ['pointer', 'lasso', 'hand'];

const SELECTION_ICONS: Record<string, React.ReactNode> = {
  pointer: <MousePointer2 size={16} />,
  lasso: <BoxSelect size={16} />,
  hand: <Hand size={16} />,
};

const SELECTION_LABELS: Record<string, string> = {
  pointer: 'Pointer (V)',
  lasso: 'Lasso Select (L)',
  hand: 'Pan (H)',
};

interface DrawTool {
  id: ToolId;
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  type: 'toggle' | 'action';
  group: number;
  modes?: WorkspaceMode[];
}

const DRAW_TOOLS: DrawTool[] = [
  { id: 'pen',        icon: <Pen size={16} />,        label: 'Draw',       shortcut: 'B', type: 'toggle', group: 1 },
  { id: 'shape',      icon: <Square size={16} />,     label: 'Shape',      shortcut: 'R', type: 'toggle', group: 1 },
  { id: 'text',       icon: <Type size={16} />,       label: 'Text',       shortcut: 'T', type: 'toggle', group: 1 },
];

interface FloatingToolbarProps {
  activeTool: ToolId;
  onToolChange: (tool: ToolId) => void;
  onAction?: (action: ToolId) => void;
  mode?: WorkspaceMode;
  side?: 'left' | 'right';
}

export const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
  activeTool,
  onToolChange,
  onAction,
  mode = 'create',
  side = 'left',
}) => {
  const [tooltip, setTooltip] = useState<{ id: string; label: string; shortcut?: string } | null>(null);
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEnter = (id: string, label: string, shortcut?: string) => {
    tooltipTimerRef.current = setTimeout(() => {
      setTooltip({ id, label, shortcut });
    }, 400);
  };

  const handleLeave = () => {
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    setTooltip(null);
  };

  useEffect(() => () => { if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current); }, []);

  const isSelectionTool = SELECTION_CYCLE.includes(activeTool);
  const currentSelectionTool = isSelectionTool ? activeTool : 'pointer';

  const cycleSelection = () => {
    const idx = SELECTION_CYCLE.indexOf(currentSelectionTool);
    const next = SELECTION_CYCLE[(idx + 1) % SELECTION_CYCLE.length];
    onToolChange(next);
  };

  const visibleDrawTools = DRAW_TOOLS.filter((t) => !t.modes || t.modes.includes(mode));

  const groups: DrawTool[][] = [];
  let currentGroup: DrawTool[] = [];
  let lastGroupId: number | null = null;
  for (const tool of visibleDrawTools) {
    if (lastGroupId !== null && tool.group !== lastGroupId) {
      groups.push(currentGroup);
      currentGroup = [];
    }
    currentGroup.push(tool);
    lastGroupId = tool.group;
  }
  if (currentGroup.length > 0) groups.push(currentGroup);

  const handleClick = (tool: DrawTool) => {
    if (tool.type === 'toggle') {
      onToolChange(tool.id);
    } else {
      onAction?.(tool.id);
    }
  };

  const tooltipSide = side === 'right' ? styles.tooltipLeft : styles.tooltipRight;

  return (
    <div id="floating-toolbar-vertical-left" className={`${styles.toolbar} ${side === 'right' ? styles.toolbarRight : styles.toolbarLeft}`}>
      {/* Unified selection cycle button */}
      <button
        className={`${styles.toolBtn} ${isSelectionTool ? styles.toolBtnActive : ''}`}
        onClick={cycleSelection}
        onMouseEnter={() => handleEnter('selection', SELECTION_LABELS[currentSelectionTool])}
        onMouseLeave={handleLeave}
        aria-label={SELECTION_LABELS[currentSelectionTool]}
        data-tool-id={currentSelectionTool}
        title={SELECTION_LABELS[currentSelectionTool]}
      >
        {SELECTION_ICONS[currentSelectionTool]}
        {tooltip?.id === 'selection' && (
          <div className={`${styles.tooltip} ${tooltipSide}`}>
            <span className={styles.tooltipLabel}>{tooltip.label}</span>
            <span className={styles.tooltipHint}>Click to cycle modes</span>
          </div>
        )}
      </button>

      {/* Drawing and action tools */}
      {groups.map((group, gi) => (
        <React.Fragment key={gi}>
          <div className={styles.divider} />
          {group.map((tool) => (
            <button
              key={tool.id}
              className={`${styles.toolBtn} ${tool.type === 'toggle' && activeTool === tool.id ? styles.toolBtnActive : ''}`}
              onClick={() => handleClick(tool)}
              onMouseEnter={() => handleEnter(tool.id, tool.label, tool.shortcut)}
              onMouseLeave={handleLeave}
              aria-label={tool.label}
              data-tool-id={tool.id}
            >
              {tool.icon}
              {tooltip?.id === tool.id && (
                <div className={`${styles.tooltip} ${tooltipSide}`}>
                  <span className={styles.tooltipLabel}>{tooltip.label}</span>
                  {tooltip.shortcut && (
                    <kbd className={styles.tooltipKey}>{tooltip.shortcut}</kbd>
                  )}
                </div>
              )}
            </button>
          ))}
        </React.Fragment>
      ))}
    </div>
  );
};

export default FloatingToolbar;
