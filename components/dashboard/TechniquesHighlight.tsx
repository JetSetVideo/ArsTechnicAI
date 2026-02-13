/**
 * TechniquesHighlight Component
 * 
 * Featured AI techniques with categories and search.
 */

import { useState } from 'react';
import { 
  Star, 
  Image, 
  Video, 
  Box, 
  Volume2, 
  FileText, 
  Search,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { useTechniquesStore, useModulesStore } from '../../stores';
import type { TechniqueCategory } from '../../types/dashboard';
import styles from './TechniquesHighlight.module.css';

// Category icons
const CATEGORY_ICONS: Record<TechniqueCategory, React.ReactNode> = {
  'image': <Image size={14} />,
  'video': <Video size={14} />,
  '3d': <Box size={14} />,
  'audio': <Volume2 size={14} />,
  'text': <FileText size={14} />,
  'analysis': <Search size={14} />,
};

const CATEGORY_LABELS: Record<TechniqueCategory, string> = {
  'image': 'Image',
  'video': 'Video',
  '3d': '3D',
  'audio': 'Audio',
  'text': 'Text',
  'analysis': 'Analysis',
};

interface TechniquesHighlightProps {
  searchQuery?: string;
}

export function TechniquesHighlight({ searchQuery = '' }: TechniquesHighlightProps) {
  const { 
    getFeaturedTechniques,
    getTechniquesByCategory,
    getCategories,
    toggleFavorite,
    isFavorite,
  } = useTechniquesStore();
  
  const { isModuleActive } = useModulesStore();
  
  const [activeCategory, setActiveCategory] = useState<TechniqueCategory | 'featured'>('featured');
  
  const categories = getCategories();
  const featured = getFeaturedTechniques();
  const categoryTechniques = activeCategory !== 'featured' 
    ? getTechniquesByCategory(activeCategory as TechniqueCategory)
    : featured;
  const query = searchQuery.trim().toLowerCase();
  const filteredTechniques = categoryTechniques.filter((technique) =>
    !query ||
    technique.name.toLowerCase().includes(query) ||
    technique.description.toLowerCase().includes(query) ||
    technique.tags.some((tag) => tag.toLowerCase().includes(query))
  );

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h2 className={styles.title}>Techniques</h2>
        <span className={styles.subtitle}>AI-powered processes</span>
      </div>

      {/* Category Tabs */}
      <div className={styles.categories}>
        <button
          className={`${styles.categoryTab} ${activeCategory === 'featured' ? styles.active : ''}`}
          onClick={() => setActiveCategory('featured')}
        >
          <Sparkles size={14} />
          Featured
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            className={`${styles.categoryTab} ${activeCategory === cat ? styles.active : ''}`}
            onClick={() => setActiveCategory(cat)}
          >
            {CATEGORY_ICONS[cat]}
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Techniques List */}
      <div className={styles.techniquesList}>
        {filteredTechniques.slice(0, 6).map((technique) => {
          const moduleActive = isModuleActive(technique.requiredModule);
          
          return (
            <div 
              key={technique.id} 
              className={`${styles.techniqueItem} ${!moduleActive ? styles.disabled : ''}`}
            >
              <div className={styles.techniqueInfo}>
                <span className={styles.techniqueName}>{technique.name}</span>
                <span className={styles.techniqueDesc}>{technique.description}</span>
                <div className={styles.techniqueTags}>
                  {technique.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className={styles.tag}>{tag}</span>
                  ))}
                </div>
              </div>
              <button
                className={`${styles.favoriteButton} ${isFavorite(technique.id) ? styles.favorited : ''}`}
                onClick={() => toggleFavorite(technique.id)}
              >
                <Star size={14} fill={isFavorite(technique.id) ? 'currentColor' : 'none'} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Browse All Link */}
      <button className={styles.browseAll}>
        Browse all techniques
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

export default TechniquesHighlight;
