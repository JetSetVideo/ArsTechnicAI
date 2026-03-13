/**
 * Aide & Support Page
 * 
 * Help center and support resources for ArsTechnicAI.
 */

import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { 
  HelpCircle, 
  Book, 
  Video, 
  MessageSquare, 
  Mail,
  ChevronDown,
  ChevronRight,
  Search,
  ExternalLink,
  Zap,
  FileText,
  Users
} from 'lucide-react';
import { NavigationBar } from '@/components/layout/NavigationBar';
import styles from '@/styles/pages/aide.module.css';

const HELP_CATEGORIES = [
  {
    icon: <Book size={20} />,
    title: 'Documentation',
    description: 'Guides complets et tutoriels',
    href: '/aide/documentation',
    color: '#3b82f6',
  },
  {
    icon: <Video size={20} />,
    title: 'Tutoriels vidéo',
    description: 'Apprenez visuellement',
    href: '/aide/videos',
    color: '#ef4444',
  },
  {
    icon: <MessageSquare size={20} />,
    title: 'Forum',
    description: 'Aide de la communauté',
    href: '/forum',
    color: '#00d4aa',
  },
  {
    icon: <Mail size={20} />,
    title: 'Contact support',
    description: 'Assistance personnalisée',
    href: '/aide/contact',
    color: '#8b5cf6',
  },
];

const FAQ_ITEMS = [
  {
    question: 'Comment commencer avec Ars TechnicAI ?',
    answer: 'Créez un compte gratuit, explorez les tutoriels d\'introduction, puis commencez à créer votre premier projet. Notre interface intuitive vous guide à chaque étape.',
  },
  {
    question: 'Quels formats d\'export sont disponibles ?',
    answer: 'Ars TechnicAI supporte de nombreux formats : MP4, MOV, GIF, WebM pour la vidéo ; PNG, JPEG, WebP pour les images. Les abonnés Pro ont accès à l\'export 4K et aux formats professionnels.',
  },
  {
    question: 'Comment fonctionne la génération IA ?',
    answer: 'Notre moteur IA utilise des modèles de diffusion avancés pour générer du contenu unique à partir de vos descriptions textuelles (prompts). Plus votre description est précise, meilleurs seront les résultats.',
  },
  {
    question: 'Puis-je utiliser le contenu généré commercialement ?',
    answer: 'Oui ! Avec un abonnement Pro ou Entreprise, vous possédez les droits complets sur tout le contenu généré et pouvez l\'utiliser à des fins commerciales.',
  },
  {
    question: 'Comment annuler mon abonnement ?',
    answer: 'Vous pouvez annuler à tout moment depuis vos paramètres de compte. Votre abonnement restera actif jusqu\'à la fin de la période de facturation en cours.',
  },
];

const QUICK_LINKS = [
  { title: 'Guide de démarrage', icon: <Zap size={14} />, href: '/aide/demarrage' },
  { title: 'Raccourcis clavier', icon: <FileText size={14} />, href: '/aide/raccourcis' },
  { title: 'API Documentation', icon: <Book size={14} />, href: '/aide/api' },
  { title: 'Rejoindre Discord', icon: <Users size={14} />, href: 'https://discord.gg/arstechnicai', external: true },
];

export default function AidePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  return (
    <>
      <Head>
        <title>Aide & Support | Ars TechnicAI</title>
        <meta name="description" content="Centre d'aide Ars TechnicAI - Documentation, tutoriels et support." />
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

        {/* Hero with Search */}
        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>
            Comment pouvons-nous <span className={styles.heroAccent}>vous aider</span> ?
          </h1>
          <div className={styles.searchBox}>
            <Search size={18} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Rechercher dans l'aide..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>
        </section>

        <main className={styles.mainContent}>
          {/* Help Categories */}
          <section className={styles.categories}>
            <div className={styles.categoriesGrid}>
              {HELP_CATEGORIES.map((category, index) => (
                <Link key={index} href={category.href} className={styles.categoryCard}>
                  <div className={styles.categoryIcon} style={{ color: category.color, background: `${category.color}20` }}>
                    {category.icon}
                  </div>
                  <div className={styles.categoryContent}>
                    <h3 className={styles.categoryTitle}>{category.title}</h3>
                    <p className={styles.categoryDescription}>{category.description}</p>
                  </div>
                  <ChevronRight size={16} className={styles.categoryArrow} />
                </Link>
              ))}
            </div>
          </section>

          {/* Two Column Layout */}
          <div className={styles.twoColumn}>
            {/* FAQ */}
            <section className={styles.faqSection}>
              <h2 className={styles.sectionTitle}>
                <HelpCircle size={18} />
                Questions fréquentes
              </h2>
              <div className={styles.faqList}>
                {FAQ_ITEMS.map((item, index) => (
                  <div key={index} className={`${styles.faqItem} ${openFaqIndex === index ? styles.open : ''}`}>
                    <button className={styles.faqQuestion} onClick={() => toggleFaq(index)}>
                      <span>{item.question}</span>
                      <ChevronDown size={16} className={styles.faqChevron} />
                    </button>
                    {openFaqIndex === index && (
                      <div className={styles.faqAnswer}>{item.answer}</div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Quick Links */}
            <aside className={styles.quickLinksSection}>
              <h2 className={styles.sectionTitle}>Liens rapides</h2>
              <div className={styles.quickLinks}>
                {QUICK_LINKS.map((link, index) => (
                  <Link
                    key={index}
                    href={link.href}
                    className={styles.quickLink}
                    target={link.external ? '_blank' : undefined}
                    rel={link.external ? 'noopener noreferrer' : undefined}
                  >
                    {link.icon}
                    <span>{link.title}</span>
                    {link.external && <ExternalLink size={12} className={styles.externalIcon} />}
                  </Link>
                ))}
              </div>

              {/* Contact Box */}
              <div className={styles.contactBox}>
                <h3>Besoin d'aide supplémentaire ?</h3>
                <p>Notre équipe support est disponible 24/7 pour les abonnés Pro.</p>
                <Link href="/aide/contact" className={styles.contactButton}>
                  Contacter le support
                </Link>
              </div>
            </aside>
          </div>
        </main>

        {/* Footer */}
        <footer className={styles.footer}>
          <p>© 2025 Ars TechnicAI. Tous droits réservés.</p>
        </footer>
      </div>
    </>
  );
}
