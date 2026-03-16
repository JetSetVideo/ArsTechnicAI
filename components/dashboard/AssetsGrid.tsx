import { useState, useMemo, useDeferredValue } from 'react';
import { 
  Search, 
  Filter, 
  Grid, 
  List, 
  Clock, 
  Image as ImageIcon, 
  FileText, 
  Video, 
  Music,
  FolderOpen
} from 'lucide-react';
import { useFileStore } from '../../stores/fileStore';
import styles from './ProjectsGrid.module.css'; // Reuse styles for now
import type { Asset, AssetType } from '../../types';

interface AssetsGridProps {
  searchQuery?: string;
}

export function AssetsGrid({ searchQuery = '' }: AssetsGridProps) {
  const assets = useFileStore((s) => s.assets);
  const [filterType, setFilterType] = useState<AssetType | 'all'>('all');
  const [sortBy, setSortBy] = useState<'modifiedAt' | 'createdAt' | 'name'>('modifiedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const allAssets = useMemo(() => Array.from(assets.values()), [assets]);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const filteredAssets = useMemo(() => {
    let result = allAssets;

    // Filter by type
    if (filterType !== 'all') {
      result = result.filter((a) => a.type === filterType);
    }

    // Filter by search
    const query = deferredSearchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter((a) => 
        a.name.toLowerCase().includes(query) || 
        (a.metadata?.prompt || '').toLowerCase().includes(query)
      );
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'modifiedAt':
          comparison = a.modifiedAt - b.modifiedAt;
          break;
        case 'createdAt':
          comparison = a.createdAt - b.createdAt;
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [allAssets, filterType, deferredSearchQuery, sortBy, sortOrder]);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  const getIconForType = (type: AssetType) => {
    switch (type) {
      case 'image': return <ImageIcon size={16} />;
      case 'video': return <Video size={16} />;
      case 'audio': return <Music size={16} />;
      case 'text': return <FileText size={16} />;
      default: return <FileText size={16} />;
    }
  };

  return (
    <div className={styles.container}>
      {/* Filters */}
      <div className={styles.filters}>
        <button
          className={`${styles.filterButton} ${filterType === 'all' ? styles.filterActive : ''}`}
          onClick={() => setFilterType('all')}
        >
          All
        </button>
        <button
          className={`${styles.filterButton} ${filterType === 'image' ? styles.filterActive : ''}`}
          onClick={() => setFilterType('image')}
        >
          <ImageIcon size={14} /> Images
        </button>
        <button
          className={`${styles.filterButton} ${filterType === 'video' ? styles.filterActive : ''}`}
          onClick={() => setFilterType('video')}
        >
          <Video size={14} /> Videos
        </button>
        
        <label className={styles.filterSelectLabel}>
          Sort
          <select
            className={styles.filterSelect}
            value={`${sortBy}:${sortOrder}`}
            onChange={(e) => {
              const [newSortBy, newSortOrder] = e.target.value.split(':') as any;
              setSortBy(newSortBy);
              setSortOrder(newSortOrder);
            }}
          >
            <option value="modifiedAt:desc">Newest</option>
            <option value="modifiedAt:asc">Oldest</option>
            <option value="name:asc">Name (A-Z)</option>
          </select>
        </label>
      </div>

      {/* Grid */}
      <div className={styles.grid}>
        {filteredAssets.map((asset) => (
          <div key={asset.id} className={styles.projectCard}>
            <div className={styles.thumbnail}>
              {asset.thumbnail ? (
                <img src={asset.thumbnail} alt={asset.name} />
              ) : (
                <div className={styles.placeholderThumb}>
                  {getIconForType(asset.type)}
                </div>
              )}
            </div>
            <div className={styles.info}>
              <h3 className={styles.name} title={asset.name}>{asset.name}</h3>
              <div className={styles.meta}>
                <span className={styles.metaItem}>
                  <Clock size={12} />
                  {formatDate(asset.modifiedAt)}
                </span>
                <span className={styles.metaItem}>
                  {getIconForType(asset.type)}
                  {asset.type}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredAssets.length === 0 && (
        <div className={styles.empty}>
          <p>No assets found matching your criteria.</p>
        </div>
      )}
    </div>
  );
}
