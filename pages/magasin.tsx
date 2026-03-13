/**
 * Magasin Page
 * 
 * Store/marketplace for ArsTechnicAI resources and subscriptions.
 */

import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { 
  Crown, 
  Zap, 
  Palette, 
  Package, 
  Check,
  Star,
  Sparkles
} from 'lucide-react';
import { NavigationBar } from '@/components/layout/NavigationBar';
import styles from '@/styles/pages/magasin.module.css';

const PRICING_PLANS = [
  {
    name: 'Gratuit',
    price: '0€',
    period: '/mois',
    description: 'Idéal pour découvrir',
    features: [
      '10 générations / mois',
      'Résolution standard',
      'Formats de base',
      'Support communautaire',
    ],
    cta: 'Commencer',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '19€',
    period: '/mois',
    description: 'Pour les créateurs sérieux',
    features: [
      '200 générations / mois',
      'Haute résolution (4K)',
      'Tous les formats',
      'Pas de filigrane',
      'Support prioritaire',
      'Accès anticipé aux nouvelles fonctionnalités',
    ],
    cta: 'Essai gratuit 14 jours',
    highlighted: true,
  },
  {
    name: 'Entreprise',
    price: 'Sur devis',
    period: '',
    description: 'Pour les équipes',
    features: [
      'Générations illimitées',
      'API complète',
      'Comptes multiples',
      'Support dédié 24/7',
      'Formation personnalisée',
      'SLA garanti',
    ],
    cta: 'Nous contacter',
    highlighted: false,
  },
];

const RESOURCE_PACKS = [
  {
    icon: <Palette size={24} />,
    title: 'Pack Styles Premium',
    description: '50+ styles artistiques exclusifs',
    price: '9.99€',
    rating: 4.8,
  },
  {
    icon: <Sparkles size={24} />,
    title: 'Pack Effets Spéciaux',
    description: 'Transitions et effets cinématiques',
    price: '14.99€',
    rating: 4.9,
  },
  {
    icon: <Package size={24} />,
    title: 'Pack Templates Pro',
    description: '100+ templates prêts à l\'emploi',
    price: '19.99€',
    rating: 4.7,
  },
];

export default function MagasinPage() {
  return (
    <>
      <Head>
        <title>Magasin | Ars TechnicAI</title>
        <meta name="description" content="Magasin Ars TechnicAI - Abonnements et ressources pour créateurs." />
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
          <h1 className={styles.heroTitle}>
            <span className={styles.heroAccent}>Magasin</span>
          </h1>
          <p className={styles.heroSubtitle}>
            Choisissez le plan qui correspond à vos besoins créatifs.
          </p>
        </section>

        {/* Pricing */}
        <section className={styles.pricing}>
          <div className={styles.pricingGrid}>
            {PRICING_PLANS.map((plan, index) => (
              <div key={index} className={`${styles.pricingCard} ${plan.highlighted ? styles.highlighted : ''}`}>
                {plan.highlighted && (
                  <div className={styles.popularBadge}>
                    <Crown size={12} />
                    Le plus populaire
                  </div>
                )}
                <h3 className={styles.planName}>{plan.name}</h3>
                <div className={styles.planPrice}>
                  <span className={styles.priceAmount}>{plan.price}</span>
                  <span className={styles.pricePeriod}>{plan.period}</span>
                </div>
                <p className={styles.planDescription}>{plan.description}</p>
                <ul className={styles.featuresList}>
                  {plan.features.map((feature, i) => (
                    <li key={i}>
                      <Check size={14} />
                      {feature}
                    </li>
                  ))}
                </ul>
                <button className={`${styles.planCta} ${plan.highlighted ? styles.primary : styles.secondary}`}>
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Resources */}
        <section className={styles.resources}>
          <h2 className={styles.sectionTitle}>
            <Package size={20} />
            Packs de ressources
          </h2>
          <div className={styles.resourcesGrid}>
            {RESOURCE_PACKS.map((pack, index) => (
              <div key={index} className={styles.resourceCard}>
                <div className={styles.resourceIcon}>{pack.icon}</div>
                <div className={styles.resourceContent}>
                  <h3 className={styles.resourceTitle}>{pack.title}</h3>
                  <p className={styles.resourceDescription}>{pack.description}</p>
                  <div className={styles.resourceMeta}>
                    <span className={styles.resourceRating}>
                      <Star size={12} fill="currentColor" />
                      {pack.rating}
                    </span>
                    <span className={styles.resourcePrice}>{pack.price}</span>
                  </div>
                </div>
              </div>
            ))}
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
