/**
 * Forum Page
 * 
 * Discussion forum for ArsTechnicAI community.
 */

import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { 
  MessageSquare, 
  TrendingUp, 
  Clock, 
  Users,
  HelpCircle,
  Lightbulb,
  Bug,
  Megaphone
} from 'lucide-react';
import { NavigationBar } from '@/components/layout/NavigationBar';
import styles from '@/styles/pages/forum.module.css';

const FORUM_CATEGORIES = [
  {
    icon: <Megaphone size={20} />,
    title: 'Annonces',
    description: 'Actualités et mises à jour d\'Ars TechnicAI.',
    topics: 24,
    posts: 156,
    color: '#f59e0b',
  },
  {
    icon: <MessageSquare size={20} />,
    title: 'Discussions générales',
    description: 'Discussions ouvertes sur tout et rien.',
    topics: 342,
    posts: 2847,
    color: '#00d4aa',
  },
  {
    icon: <Lightbulb size={20} />,
    title: 'Suggestions',
    description: 'Proposez vos idées pour améliorer la plateforme.',
    topics: 89,
    posts: 567,
    color: '#8b5cf6',
  },
  {
    icon: <HelpCircle size={20} />,
    title: 'Support',
    description: 'Posez vos questions et obtenez de l\'aide.',
    topics: 156,
    posts: 892,
    color: '#3b82f6',
  },
  {
    icon: <Bug size={20} />,
    title: 'Rapports de bugs',
    description: 'Signalez les problèmes rencontrés.',
    topics: 45,
    posts: 234,
    color: '#ef4444',
  },
];

const RECENT_TOPICS = [
  {
    title: 'Comment optimiser les prompts pour de meilleurs résultats ?',
    author: 'Marie_Design',
    replies: 23,
    views: 456,
    lastActivity: 'Il y a 2h',
    category: 'Discussions générales',
  },
  {
    title: 'Nouvelle fonctionnalité : Export vers TikTok',
    author: 'Admin',
    replies: 45,
    views: 1203,
    lastActivity: 'Il y a 5h',
    category: 'Annonces',
  },
  {
    title: 'Idée : Mode collaboration en temps réel',
    author: 'Tech_Creator',
    replies: 12,
    views: 234,
    lastActivity: 'Il y a 8h',
    category: 'Suggestions',
  },
];

export default function ForumPage() {
  return (
    <>
      <Head>
        <title>Forum | Ars TechnicAI</title>
        <meta name="description" content="Forum de discussion Ars TechnicAI - Échangez avec la communauté." />
      </Head>

      <div className={styles.pageContainer}>
        {/* Header */}
        <header className={styles.header}>
          <Link href="/home" className={styles.logo}>
            <span className={styles.logoArs}>Ars</span>
            <span className={styles.logoTechnic}>Technic</span>
            <span className={styles.logoAI}>AI</span>
          </Link>
        </header>

        {/* Navigation */}
        <NavigationBar />

        {/* Hero */}
        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>Forum</h1>
          <p className={styles.heroSubtitle}>
            Échangez, posez vos questions et partagez vos idées avec la communauté.
          </p>
        </section>

        {/* Stats Bar */}
        <div className={styles.statsBar}>
          <div className={styles.stat}>
            <MessageSquare size={14} />
            <span>4.5K+ sujets</span>
          </div>
          <div className={styles.stat}>
            <Users size={14} />
            <span>2.3K membres actifs</span>
          </div>
          <div className={styles.stat}>
            <TrendingUp size={14} />
            <span>150+ posts aujourd'hui</span>
          </div>
        </div>

        <main className={styles.mainContent}>
          {/* Categories */}
          <section className={styles.categories}>
            <h2 className={styles.sectionTitle}>Catégories</h2>
            <div className={styles.categoriesGrid}>
              {FORUM_CATEGORIES.map((category, index) => (
                <Link key={index} href={`/forum/${category.title.toLowerCase()}`} className={styles.categoryCard}>
                  <div className={styles.categoryIcon} style={{ color: category.color, background: `${category.color}20` }}>
                    {category.icon}
                  </div>
                  <div className={styles.categoryContent}>
                    <h3 className={styles.categoryTitle}>{category.title}</h3>
                    <p className={styles.categoryDescription}>{category.description}</p>
                  </div>
                  <div className={styles.categoryStats}>
                    <span>{category.topics} sujets</span>
                    <span>{category.posts} posts</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* Recent Topics */}
          <section className={styles.recentTopics}>
            <h2 className={styles.sectionTitle}>
              <Clock size={18} />
              Sujets récents
            </h2>
            <div className={styles.topicsList}>
              {RECENT_TOPICS.map((topic, index) => (
                <div key={index} className={styles.topicRow}>
                  <div className={styles.topicInfo}>
                    <h4 className={styles.topicTitle}>{topic.title}</h4>
                    <div className={styles.topicMeta}>
                      <span className={styles.topicAuthor}>{topic.author}</span>
                      <span className={styles.topicCategory}>{topic.category}</span>
                    </div>
                  </div>
                  <div className={styles.topicStats}>
                    <span>{topic.replies} réponses</span>
                    <span>{topic.views} vues</span>
                    <span className={styles.topicTime}>{topic.lastActivity}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className={styles.footer}>
          <p>© 2025 Ars TechnicAI. Tous droits réservés.</p>
        </footer>
      </div>
    </>
  );
}
