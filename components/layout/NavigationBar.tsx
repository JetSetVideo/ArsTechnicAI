/**
 * NavigationBar Component
 * 
 * Secondary navigation with links to:
 * - Informations
 * - Communauté  
 * - Forum
 * - Magasin
 * - Aide & Support
 * 
 * Compact, modern design inspired by Linear and Notion.
 */

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { 
  Info, 
  Users, 
  MessageSquare, 
  Store, 
  HelpCircle,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import styles from './NavigationBar.module.css';

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  external?: boolean;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'informations',
    label: 'Informations',
    href: '/informations',
    icon: <Info size={14} />,
  },
  {
    id: 'communaute',
    label: 'Communauté',
    href: '/communaute',
    icon: <Users size={14} />,
    badge: 'Nouveau',
  },
  {
    id: 'forum',
    label: 'Forum',
    href: '/forum',
    icon: <MessageSquare size={14} />,
  },
  {
    id: 'magasin',
    label: 'Magasin',
    href: '/magasin',
    icon: <Store size={14} />,
  },
  {
    id: 'aide',
    label: 'Aide & Support',
    href: '/aide',
    icon: <HelpCircle size={14} />,
  },
];

interface NavigationBarProps {
  variant?: 'default' | 'compact' | 'expanded';
  showLabels?: boolean;
}

export const NavigationBar: React.FC<NavigationBarProps> = ({
  variant = 'default',
  showLabels = true,
}) => {
  const router = useRouter();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const isActive = (href: string) => {
    return router.pathname === href || router.pathname.startsWith(href + '/');
  };

  return (
    <nav className={`${styles.navigationBar} ${styles[variant]}`} aria-label="Navigation secondaire">
      <div className={styles.navContent}>
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={`${styles.navItem} ${isActive(item.href) ? styles.active : ''}`}
            onMouseEnter={() => setHoveredItem(item.id)}
            onMouseLeave={() => setHoveredItem(null)}
            target={item.external ? '_blank' : undefined}
            rel={item.external ? 'noopener noreferrer' : undefined}
          >
            <span className={styles.navIcon}>{item.icon}</span>
            {showLabels && <span className={styles.navLabel}>{item.label}</span>}
            {item.badge && (
              <span className={styles.navBadge}>{item.badge}</span>
            )}
            {item.external && <ExternalLink size={10} className={styles.externalIcon} />}
          </Link>
        ))}
      </div>
    </nav>
  );
};

export default NavigationBar;
