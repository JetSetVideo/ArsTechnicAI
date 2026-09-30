import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Search, X, Globe, Folder } from 'lucide-react';
import styles from './SearchBar.module.css';
import type { SearchScope } from '@/types';
import { useFileStore } from '@/stores';
import { usePipelineStore } from '@/stores/pipelineStore';

interface SearchBarProps {
  placeholder?: string;
  scope?: SearchScope;
  onScopeChange?: (scope: SearchScope) => void;
  onSearch: (query: string, scope: SearchScope) => void;
  className?: string;
}

const PREF_FILES = 'ars:search:files';
const PREF_GOOGLE = 'ars:search:google';
const PREF_SUGGEST = 'ars:search:suggestions';

function readBool(key: string, fallback: boolean): boolean {
  if (typeof window === 'undefined') return fallback;
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  return raw === '1';
}

export const SearchBar: React.FC<SearchBarProps> = ({
  placeholder = 'Search files or web...',
  onScopeChange,
  onSearch,
  className,
}) => {
  const [query, setQuery] = useState('');
  const [filesOn, setFilesOn] = useState(true);
  const [googleOn, setGoogleOn] = useState(false);
  const [suggestOn, setSuggestOn] = useState(true);
  const [open, setOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLFormElement>(null);

  const assets = useFileStore((s) => s.assets);
  const nodes = usePipelineStore((s) => s.nodes);

  useEffect(() => {
    setFilesOn(readBool(PREF_FILES, true));
    setGoogleOn(readBool(PREF_GOOGLE, false));
    setSuggestOn(readBool(PREF_SUGGEST, true));
    const sync = () => {
      setFilesOn(readBool(PREF_FILES, true));
      setGoogleOn(readBool(PREF_GOOGLE, false));
      setSuggestOn(readBool(PREF_SUGGEST, true));
    };
    window.addEventListener('storage', sync);
    window.addEventListener('ars-search-prefs', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('ars-search-prefs', sync);
    };
  }, []);

  const scope: SearchScope = filesOn && googleOn ? 'all' : googleOn ? 'google' : 'files';

  const suggestions = useMemo(() => {
    const started = performance.now();
    const q = query.trim().toLowerCase();
    if (!suggestOn || q.length < 1) return { items: [] as { label: string; kind: string }[], ms: 0, scanned: 0 };
    const pool: { label: string; kind: string }[] = [];
    assets.forEach((asset) => pool.push({ label: asset.name, kind: asset.type || 'file' }));
    nodes.forEach((node) => pool.push({ label: node.title, kind: 'node' }));
    const ranked = pool
      .map((item) => {
        const name = item.label.toLowerCase();
        const at = name.indexOf(q);
        return at < 0 ? null : { ...item, rank: at === 0 ? 0 : 1 + at };
      })
      .filter((item): item is { label: string; kind: string; rank: number } => !!item)
      .sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label));
    const unique: { label: string; kind: string }[] = [];
    for (const item of ranked) {
      if (unique.some((u) => u.label === item.label)) continue;
      unique.push({ label: item.label, kind: item.kind });
      if (unique.length === 3) break;
    }
    return { items: unique, ms: performance.now() - started, scanned: pool.length };
  }, [query, assets, nodes, suggestOn]);

  const runSearch = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (!filesOn && !googleOn) return;
    onScopeChange?.(scope);
    onSearch(trimmed, filesOn ? scope : 'google');
    setQuery(trimmed);
    setOpen(false);
  }, [filesOn, googleOn, onScopeChange, onSearch, scope]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const pick = suggestions.items[activeIndex];
    runSearch(pick && isFocused ? pick.label : query);
  }, [activeIndex, isFocused, query, runSearch, suggestions.items]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const reveal = () => {
    setOpen(true);
    if (window.matchMedia('(pointer: coarse)').matches) inputRef.current?.focus();
  };

  return (
    <form
      ref={rootRef}
      className={`${styles.searchBar} ${isFocused ? styles.focused : ''} ${open ? styles.open : ''} ${className || ''}`}
      onSubmit={handleSubmit}
    >
      <button
        type="button"
        className={`${styles.iconBtn} ${(isFocused || open) ? styles.iconActive : ''}`}
        aria-label={open ? 'Search' : 'Open search'}
        onClick={() => { if (open && !query) setOpen(false); else reveal(); }}
      >
        <Search size={16} />
      </button>

      <div className={styles.scopeButtons}>
        <button
          type="button"
          className={`${styles.scopeButton} ${filesOn ? styles.active : ''}`}
          aria-pressed={filesOn}
          onClick={() => setFilesOn((on) => !on)}
          title={filesOn ? 'Files search on — click to turn off' : 'Search files'}
        >
          <Folder size={14} />
        </button>
        <button
          type="button"
          className={`${styles.scopeButton} ${googleOn ? styles.active : ''}`}
          aria-pressed={googleOn}
          onClick={() => setGoogleOn((on) => !on)}
          title={googleOn ? 'Google search on — click to turn off' : 'Search Google'}
        >
          <Globe size={14} />
        </button>
      </div>

      <div className={styles.inputWrapper}>
        <input
          ref={inputRef}
          type="text"
          inputMode="search"
          enterKeyHint="search"
          className={styles.input}
          placeholder={placeholder}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); setOpen(true); }}
          onFocus={() => { setIsFocused(true); setOpen(true); }}
          onBlur={() => setIsFocused(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { setQuery(''); setOpen(false); inputRef.current?.blur(); }
            if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => Math.min(suggestions.items.length - 1, i + 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => Math.max(0, i - 1)); }
          }}
        />
        {query && (
          <button type="button" className={styles.clearButton} onClick={() => setQuery('')} aria-label="Clear search">
            <X size={14} />
          </button>
        )}
      </div>

      <kbd className={styles.shortcut}>⌘K</kbd>

      {open && suggestOn && suggestions.items.length > 0 && (
        <ul className={styles.suggest} role="listbox">
          {suggestions.items.map((item, index) => (
            <li key={item.label}>
              <button
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className={index === activeIndex ? styles.suggestActive : ''}
                onMouseDown={(e) => { e.preventDefault(); runSearch(item.label); }}
              >
                <span>{item.label}</span>
                <span className={styles.suggestKind}>{item.kind}</span>
              </button>
            </li>
          ))}
          <li className={styles.suggestMeta}>{suggestions.scanned} names · {suggestions.ms.toFixed(2)} ms</li>
        </ul>
      )}
    </form>
  );
};
