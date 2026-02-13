/**
 * AgentsPanel Component
 * 
 * Displays user's agents (prebuilt + custom) with run/edit/delete actions.
 */

import { 
  Play, 
  Edit2, 
  Trash2, 
  Plus,
  Layers,
  Palette,
  Image,
  User,
  Video,
  Volume2,
  Mic,
  Bot,
  ShoppingBag,
  Star
} from 'lucide-react';
import { useAgentsStore } from '../../stores';
import { Button } from '../ui';
import type { AgentMode } from '../../types/dashboard';
import styles from './AgentsPanel.module.css';

// Icon mapping
const ICON_MAP: Record<string, React.ReactNode> = {
  'layers': <Layers size={18} />,
  'palette': <Palette size={18} />,
  'image': <Image size={18} />,
  'user': <User size={18} />,
  'video': <Video size={18} />,
  'volume-2': <Volume2 size={18} />,
  'mic': <Mic size={18} />,
};

const MODE_LABELS: Record<AgentMode, { label: string; color: string }> = {
  'automatic': { label: 'Auto', color: 'var(--success)' },
  'semi-automatic': { label: 'Semi', color: 'var(--warning)' },
  'interactive': { label: 'Interactive', color: 'var(--accent-primary)' },
};

interface AgentsPanelProps {
  searchQuery?: string;
}

export function AgentsPanel({ searchQuery = '' }: AgentsPanelProps) {
  const { 
    getPrebuiltAgents,
    getUserAgents,
    getShopAgents,
    startExecution,
    deleteAgent,
    getActiveExecutions,
  } = useAgentsStore();

  const query = searchQuery.trim().toLowerCase();
  const prebuilt = getPrebuiltAgents().filter((agent) =>
    !query ||
    agent.name.toLowerCase().includes(query) ||
    agent.description.toLowerCase().includes(query) ||
    agent.tags.some((tag) => tag.toLowerCase().includes(query))
  );
  const userAgents = getUserAgents().filter((agent) =>
    !query ||
    agent.name.toLowerCase().includes(query) ||
    agent.description.toLowerCase().includes(query) ||
    agent.tags.some((tag) => tag.toLowerCase().includes(query))
  );
  const shopAgents = getShopAgents().filter((agent) =>
    !query ||
    agent.name.toLowerCase().includes(query) ||
    agent.description.toLowerCase().includes(query) ||
    agent.tags.some((tag) => tag.toLowerCase().includes(query))
  );

  const handleRunAgent = (agentId: string) => {
    startExecution(agentId);
  };

  const handleDeleteAgent = (agentId: string) => {
    if (confirm('Are you sure you want to delete this agent?')) {
      deleteAgent(agentId);
    }
  };

  return (
    <div className={styles.panel}>
      <div className={styles.columns}>
        {/* My Agents Column */}
        <div className={styles.column}>
          <div className={styles.columnHeader}>
            <h2 className={styles.title}>
              <Bot size={20} />
              My Agents
            </h2>
            <Button variant="ghost" size="sm">
              <Plus size={16} />
              Create
            </Button>
          </div>

          {/* Prebuilt Agents */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Prebuilt</h3>
            <div className={styles.agentList}>
              {prebuilt.map((agent) => (
                <div key={agent.id} className={styles.agentCard}>
                  <div className={styles.agentIcon}>
                    {ICON_MAP[agent.icon] || <Bot size={18} />}
                  </div>
                  <div className={styles.agentInfo}>
                    <span className={styles.agentName}>{agent.name}</span>
                    <span className={styles.agentDesc}>{agent.description}</span>
                    <div className={styles.agentMeta}>
                      <span 
                        className={styles.modeBadge}
                        style={{ color: MODE_LABELS[agent.mode].color }}
                      >
                        {MODE_LABELS[agent.mode].label}
                      </span>
                      <span className={styles.taskCount}>
                        {agent.tasks.length} tasks
                      </span>
                    </div>
                  </div>
                  <div className={styles.agentActions}>
                    <button
                      className={styles.runButton}
                      onClick={() => handleRunAgent(agent.id)}
                      title="Run agent"
                    >
                      <Play size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* User Created Agents */}
          {userAgents.length > 0 && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>My Custom Agents</h3>
              <div className={styles.agentList}>
                {userAgents.map((agent) => (
                  <div key={agent.id} className={styles.agentCard}>
                    <div className={styles.agentIcon}>
                      {ICON_MAP[agent.icon] || <Bot size={18} />}
                    </div>
                    <div className={styles.agentInfo}>
                      <span className={styles.agentName}>{agent.name}</span>
                      <span className={styles.agentDesc}>{agent.description}</span>
                      <div className={styles.agentMeta}>
                        <span 
                          className={styles.modeBadge}
                          style={{ color: MODE_LABELS[agent.mode].color }}
                        >
                          {MODE_LABELS[agent.mode].label}
                        </span>
                      </div>
                    </div>
                    <div className={styles.agentActions}>
                      <button
                        className={styles.runButton}
                        onClick={() => handleRunAgent(agent.id)}
                        title="Run agent"
                      >
                        <Play size={14} />
                      </button>
                      <button className={styles.editButton} title="Edit agent">
                        <Edit2 size={14} />
                      </button>
                      <button 
                        className={styles.deleteButton}
                        onClick={() => handleDeleteAgent(agent.id)}
                        title="Delete agent"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {userAgents.length === 0 && (
            <div className={styles.emptyState}>
              <p>No custom agents yet</p>
              <Button variant="secondary" size="sm">
                <Plus size={16} />
                Create your first agent
              </Button>
            </div>
          )}
        </div>

        {/* Shop Agents Column */}
        <div className={styles.column}>
          <div className={styles.columnHeader}>
            <h2 className={styles.title}>
              <ShoppingBag size={20} />
              Agent Shop
            </h2>
          </div>

          <div className={styles.agentList}>
            {shopAgents.map((agent) => (
              <div key={agent.id} className={styles.agentCard}>
                <div className={styles.agentIcon}>
                  {ICON_MAP[agent.icon] || <Bot size={18} />}
                </div>
                <div className={styles.agentInfo}>
                  <span className={styles.agentName}>{agent.name}</span>
                  <span className={styles.agentDesc}>{agent.description}</span>
                  <div className={styles.agentMeta}>
                    {agent.rating && (
                      <span className={styles.rating}>
                        <Star size={12} fill="var(--accent-tertiary)" />
                        {agent.rating}
                      </span>
                    )}
                    <span className={styles.price}>
                      ${agent.price?.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className={styles.agentActions}>
                  <Button variant="primary" size="sm">
                    Get
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <button className={styles.browseAll}>
            Browse Agent Shop
          </button>
        </div>
      </div>
    </div>
  );
}

export default AgentsPanel;
