import React, { useState, useCallback } from 'react';
import { Search, X, Globe, Folder } from 'lucide-react';
import styles from './SearchBar.module.css';
import type { SearchScope } from '@/types';

interface SearchBarProps {
  placeholder?: string;
  scope?: SearchScope;
  onScopeChange?: (scope: SearchScope) => void;
  onSearch: (query: string, scope: SearchScope) => void;
  className?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  placeholder = 'Search files or web...',
  scope = 'all',
  onScopeChange,
  onSearch,
  className,
}) => {
  const [query, setQuery] = useState('');
  const [currentScope, setCurrentScope] = useState<SearchScope>(scope);
  const [isFocused, setIsFocused] = useState(false);

  const handleScopeChange = useCallback(
    (newScope: SearchScope) => {
      setCurrentScope(newScope);
      onScopeChange?.(newScope);
      if (query) {
        onSearch(query, newScope);
      }
    },
    [query, onScopeChange, onSearch]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (query.trim()) {
        onSearch(query.trim(), currentScope);
      }
    },
    [query, currentScope, onSearch]
  );

  const handleClear = useCallback(() => {
    setQuery('');
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setQuery('');
        (e.target as HTMLInputElement).blur();
      }
    },
    []
  );

  return (
    <form
      className={`${styles.searchBar} ${isFocused ? styles.focused : ''} ${
        className || ''
      }`}
      onSubmit={handleSubmit}
    >
      <div className={styles.scopeButtons}>
        <button
          type="button"
          className={`${styles.scopeButton} ${
            currentScope === 'files' || currentScope === 'all'
              ? styles.active
              : ''
          }`}
          onClick={() =>
            handleScopeChange(currentScope === 'files' ? 'all' : 'files')
          }
          title="Search files"
        >
          <Folder size={14} />
        </button>
        <button
          type="button"
          className={`${styles.scopeButton} ${
            currentScope === 'google' || currentScope === 'all'
              ? styles.active
              : ''
          }`}
          onClick={() =>
            handleScopeChange(currentScope === 'google' ? 'all' : 'google')
          }
          title="Search Google"
        >
          <Globe size={14} />
        </button>
      </div>

      <div className={styles.inputWrapper}>
        <Search size={16} className={styles.searchIcon} />
        <input
          type="text"
          className={styles.input}
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
        />
        {query && (
          <button
            type="button"
            className={styles.clearButton}
            onClick={handleClear}
          >
            <X size={14} />
          </button>
        )}
      </div>

      <kbd className={styles.shortcut}>⌘K</kbd>
    </form>
  );
};
