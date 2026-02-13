/**
 * ShopSection Component
 * 
 * Shop preview for modules, neural networks, agents, and assets.
 */

import { 
  ShoppingBag, 
  Download, 
  Star, 
  ChevronRight,
  Cpu,
  Bot,
  Package,
  Sparkles
} from 'lucide-react';
import { useModulesStore, useAgentsStore } from '../../stores';
import { Button } from '../ui';
import type { ShopItemType } from '../../types/dashboard';
import styles from './ShopSection.module.css';

// Category icons
const CATEGORY_ICONS: Record<ShopItemType, React.ReactNode> = {
  module: <Cpu size={16} />,
  agent: <Bot size={16} />,
  neural_network: <Sparkles size={16} />,
  asset_pack: <Package size={16} />,
  template: <Package size={16} />,
  credits: <Star size={16} />,
};

interface ShopSectionProps {
  searchQuery?: string;
}

export function ShopSection({ searchQuery = '' }: ShopSectionProps) {
  const { getPremiumModules } = useModulesStore();
  const { getShopAgents } = useAgentsStore();

  const query = searchQuery.trim().toLowerCase();
  const premiumModules = getPremiumModules()
    .filter((module) =>
      !query ||
      module.name.toLowerCase().includes(query) ||
      module.description.toLowerCase().includes(query) ||
      module.tags.some((tag) => tag.toLowerCase().includes(query))
    )
    .slice(0, 4);
  const shopAgents = getShopAgents()
    .filter((agent) =>
      !query ||
      agent.name.toLowerCase().includes(query) ||
      agent.description.toLowerCase().includes(query) ||
      agent.tags.some((tag) => tag.toLowerCase().includes(query))
    )
    .slice(0, 4);

  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <ShoppingBag size={20} />
          <h2 className={styles.title}>Shop</h2>
        </div>
        <Button variant="ghost" size="sm">
          Browse All
          <ChevronRight size={16} />
        </Button>
      </div>

      {/* Categories */}
      <div className={styles.categories}>
        <button className={`${styles.categoryTab} ${styles.active}`}>
          <Cpu size={14} />
          Modules
        </button>
        <button className={styles.categoryTab}>
          <Bot size={14} />
          Agents
        </button>
        <button className={styles.categoryTab}>
          <Sparkles size={14} />
          Neural Networks
        </button>
        <button className={styles.categoryTab}>
          <Package size={14} />
          Asset Packs
        </button>
      </div>

      {/* Featured Items Grid */}
      <div className={styles.grid}>
        {/* Premium Modules */}
        {premiumModules.map((module) => (
          <div key={module.id} className={styles.itemCard}>
            <div className={styles.itemIcon}>
              <Cpu size={24} />
            </div>
            <div className={styles.itemInfo}>
              <span className={styles.itemName}>{module.name}</span>
              <span className={styles.itemDesc}>{module.description}</span>
              <div className={styles.itemMeta}>
                <span className={styles.itemType}>Module</span>
                {module.price === 'premium' && (
                  <span className={styles.premiumBadge}>Premium</span>
                )}
              </div>
            </div>
            <div className={styles.itemAction}>
              <Button variant="primary" size="sm">
                <Download size={14} />
                Get
              </Button>
            </div>
          </div>
        ))}

        {/* Shop Agents */}
        {shopAgents.map((agent) => (
          <div key={agent.id} className={styles.itemCard}>
            <div className={styles.itemIcon}>
              <Bot size={24} />
            </div>
            <div className={styles.itemInfo}>
              <span className={styles.itemName}>{agent.name}</span>
              <span className={styles.itemDesc}>{agent.description}</span>
              <div className={styles.itemMeta}>
                <span className={styles.itemType}>Agent</span>
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
            <div className={styles.itemAction}>
              <Button variant="primary" size="sm">
                Get
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Neural Networks Teaser */}
      <div className={styles.teaser}>
        <div className={styles.teaserIcon}>
          <Sparkles size={32} />
        </div>
        <div className={styles.teaserContent}>
          <h3>Neural Networks</h3>
          <p>Download specialized AI models to power your modules and techniques.</p>
        </div>
        <Button variant="secondary" size="sm">
          Browse Networks
        </Button>
      </div>
    </div>
  );
}

export default ShopSection;
