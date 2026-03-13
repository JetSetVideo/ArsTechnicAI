/**
 * Communauté Page
 * 
 * Community hub for ArsTechnicAI users.
 */

import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { Users, MessageCircle, Heart, Star, Trophy, Zap } from 'lucide-react';
import { NavigationBar } from '@/components/layout/NavigationBar';
import styles from '@/styles/pages/community.module.css';

const COMMUNITY_SECTIONS = [
  {
    icon: <Users size={24} />,
    title: 'Créateurs',
    description: 'Découvrez les créateurs qui utilisent Ars TechnicAI.',
    count: '10K+',
    href: '/communaute/createurs',
  },
  {
    icon: <Star size={24} />,
    title: 'Galerie',
    description: 'Explorez les meilleures créations de la communauté.',
    count: '50K+',
    href: '/communaute/galerie',
  },
  {
    icon: <Trophy size={24} />,
    title: 'Challenges',
    description: 'Participez aux défis créatifs hebdomadaires.',
    count: 'Actif',
    href: '/communaute/challenges',
  },
  {
    icon: <MessageCircle size={24} />,
    title: 'Discussions',
    description: 'Échangez avec d\'autres créateurs.',
    count: '5K+',
    href: '/forum',
  },
];

export default function CommunautePage() {
  return (
    <>
      <Head>
        <title>Communauté | Ars TechnicAI</title>
        <meta name="description" content="Rejoignez la communauté Ars TechnicAI - Partagez, apprenez et créez ensemble." />
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
          <div className={styles.heroContent}>
            <h1 className={styles.heroTitle}>
              Notre <span className={styles.heroAccent}>Communauté</span>
            </h1>
            <p className={styles.heroSubtitle}>
              Rejoignez des milliers de créateurs passionnés qui utilisent Ars TechnicAI pour donner vie à leurs idées.
            </p>
          </div>
        </section>

        {/* Community Sections */}
        <section className={styles.sections}>
          <div className={styles.sectionsGrid}>
            {COMMUNITY_SECTIONS.map((section, index) => (
              <Link key={index} href={section.href} className={styles.sectionCard}>
                <div className={styles.sectionIcon}>{section.icon}</div>
                <div className={styles.sectionContent}>
                  <h3 className={styles.sectionTitle}>{section.title}</h3>
                  <p className={styles.sectionDescription}>{section.description}</p>
                </div>
                <div className={styles.sectionCount}>{section.count}</div>
              </Link>
            ))}
          </div>
        </section>

        {/* Join CTA */}
        <section className={styles.joinCta}>
          <div className={styles.joinContent}>
            <Zap size={32} className={styles.joinIcon} />
            <h2 className={styles.joinTitle}>Prêt à créer ?</h2>
            <p className={styles.joinDescription}>
              Créez un compte gratuit et commencez à partager vos créations avec la communauté.
            </p>
            <Link href="/home" className={styles.primaryButton}>
              Rejoindre la communauté
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className={styles.footer}>
          <p>© 2025 Ars TechnicAI. Tous droits réservés.</p>
        </footer>
      </div>
    </>
  );
}
