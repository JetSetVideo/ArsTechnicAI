/**
 * Informations Page
 * 
 * Landing page with information about ArsTechnicAI.
 */

import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { 
  ArrowRight, 
  Sparkles, 
  Layers, 
  Zap, 
  Globe,
  Users,
  Shield,
  Code2
} from 'lucide-react';
import { NavigationBar } from '@/components/layout/NavigationBar';
import styles from '@/styles/pages/informations.module.css';

const FEATURES = [
  {
    icon: <Sparkles size={24} />,
    title: 'Génération IA',
    description: 'Créez des médias uniques avec notre moteur d\'intelligence artificielle avancé.',
  },
  {
    icon: <Layers size={24} />,
    title: 'Éditeur Multicouche',
    description: 'Interface d\'édition professionnelle avec gestion avancée des calques.',
  },
  {
    icon: <Zap size={24} />,
    title: 'Temps Réel',
    description: 'Prévisualisation instantanée et rendu haute performance.',
  },
  {
    icon: <Globe size={24} />,
    title: 'Publication Multi-Plateforme',
    description: 'Partagez directement vers YouTube, TikTok, Instagram et plus.',
  },
];

export default function InformationsPage() {
  return (
    <>
      <Head>
        <title>Informations | Ars TechnicAI</title>
        <meta name="description" content="Découvrez Ars TechnicAI - La plateforme de création média alimentée par l'IA." />
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

        {/* Hero Section */}
        <section className={styles.hero}>
          <div className={styles.heroContent}>
            <h1 className={styles.heroTitle}>
              Créez des médias
              <span className={styles.heroAccent}> extraordinaires</span>
            </h1>
            <p className={styles.heroSubtitle}>
              Ars TechnicAI combine la puissance de l'intelligence artificielle avec des outils d'édition professionnels pour transformer vos idées en contenu visuel captivant.
            </p>
            <div className={styles.heroCta}>
              <Link href="/home" className={styles.primaryButton}>
                Commencer gratuitement
                <ArrowRight size={16} />
              </Link>
              <Link href="/aide" className={styles.secondaryButton}>
                En savoir plus
              </Link>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className={styles.features}>
          <h2 className={styles.sectionTitle}>Fonctionnalités</h2>
          <div className={styles.featuresGrid}>
            {FEATURES.map((feature, index) => (
              <div key={index} className={styles.featureCard}>
                <div className={styles.featureIcon}>{feature.icon}</div>
                <h3 className={styles.featureTitle}>{feature.title}</h3>
                <p className={styles.featureDescription}>{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Stats */}
        <section className={styles.stats}>
          <div className={styles.statItem}>
            <span className={styles.statNumber}>10K+</span>
            <span className={styles.statLabel}>Créateurs actifs</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statNumber}>500K+</span>
            <span className={styles.statLabel}>Médias générés</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statNumber}>99.9%</span>
            <span className={styles.statLabel}>Disponibilité</span>
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
