import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Search, X, Globe, Folder, Image as ImageIcon } from 'lucide-react';
import styles from './SearchBar.module.css';
import type { Asset, FileNode, SearchScope } from '@/types';
import type { PipelineNode } from '@/types/pipeline';
import { useFileStore, useProjectsStore } from '@/stores';
import { buildLibrary } from '@/lib/pipeline/canvasPictures';
import { useCanvasPictures } from '@/hooks/useCanvasPictures';
import { usePipelineStore } from '@/stores/pipelineStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { matchShortcut } from '@/lib/shortcuts';
import { PIPELINE_NODE_DEFS } from '@/lib/pipeline/catalog';
import { ancestorPaths, suggestionGroups } from '@/lib/search/fileSuggestions';
import type { FileSearchInput } from '@/lib/search/fileSuggestions';
import type { WebImageHit } from '@/lib/search/webImages';

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

function writeBool(key: string, on: boolean) {
  localStorage.setItem(key, on ? '1' : '0');
  window.dispatchEvent(new Event('ars-search-prefs'));
}

function fileCount(node: FileNode): number {
  if (node.type === 'file') return 1;
  return (node.children || []).reduce((sum, child) => sum + fileCount(child), 0);
}

function collectFolders(nodes: FileNode[], into: FileSearchInput[]) {
  for (const node of nodes) {
    if (node.type === 'folder' && node.path !== '/') {
      const count = fileCount(node);
      if (count > 0) {
        into.push({
          id: `folder:${node.path}`,
          label: node.name,
          kind: 'folder',
          path: node.path,
          count,
          text: `${count} file${count === 1 ? '' : 's'}`,
        });
      }
    }
    if (node.children?.length) collectFolders(node.children, into);
  }
}

function collectFiles(nodes: FileNode[], into: FileSearchInput[], seen: Set<string>) {
  for (const node of nodes) {
    if (node.type === 'file') {
      if (node.asset?.id) seen.add(node.asset.id);
      into.push({
        id: node.id,
        label: node.name,
        kind: node.asset?.type || 'file',
        thumbnail: node.asset?.thumbnail,
        path: node.path,
        text: node.asset?.metadata?.prompt,
      });
    }
    if (node.children?.length) collectFiles(node.children, into, seen);
  }
}

function buildIndex(rootNodes: FileNode[], assets: Map<string, Asset>, nodes: PipelineNode[]): FileSearchInput[] {
  const into: FileSearchInput[] = [];
  const seen = new Set<string>();
  collectFolders(rootNodes, into);
  collectFiles(rootNodes, into, seen);
  assets.forEach((asset) => {
    if (seen.has(asset.id)) return;
    into.push({
      id: asset.id,
      label: asset.name,
      kind: asset.type || 'file',
      thumbnail: asset.thumbnail,
      path: asset.path,
      text: asset.metadata?.prompt,
    });
  });
  const placedTypes = new Set(nodes.map((node) => node.type));
  for (const node of nodes) {
    const pictured = (node.variants || []).find((variant) => variant.image);
    const subtitle = PIPELINE_NODE_DEFS[node.type]?.subtitle;
    into.push({
      id: node.id,
      label: node.title,
      kind: 'node',
      thumbnail: pictured?.image,
      text: subtitle,
    });
  }
  for (const def of Object.values(PIPELINE_NODE_DEFS)) {
    if (placedTypes.has(def.type)) continue;
    into.push({
      id: `catalog:${def.type}`,
      label: def.title,
      kind: 'node',
      text: def.subtitle,
      nodeType: def.type,
    });
  }
  return into;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  placeholder = 'Search files or the web...',
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
  const [compact, setCompact] = useState(false);
  const [webImages, setWebImages] = useState<WebImageHit[]>([]);
  const [webStatus, setWebStatus] = useState<'idle' | 'loading' | 'ready' | 'empty'>('idle');
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLFormElement>(null);

  const rootNodes = useFileStore((s) => s.rootNodes);
  const assets = useFileStore((s) => s.assets);
  const nodes = usePipelineStore((s) => s.nodes);
  const canvases = useCanvasPictures();
  const liveProjects = useProjectsStore((s) => s.projects);
  const searchShortcut = useSettingsStore((s) => s.settings.shortcuts?.search || 'mod+k');

  useEffect(() => {
    const openQuery = (value: string) => {
      setFilesOn(true);
      setQuery(value);
      setActiveIndex(0);
      setOpen(true);
      window.setTimeout(() => inputRef.current?.focus(), 40);
    };
    const pending = sessionStorage.getItem('ars-pending-file-search');
    if (pending) {
      sessionStorage.removeItem('ars-pending-file-search');
      openQuery(pending);
    }
    const onOpen = (event: Event) => {
      const value = (event as CustomEvent<{ query?: string }>).detail?.query;
      if (!value) return;
      sessionStorage.removeItem('ars-pending-file-search');
      openQuery(value);
    };
    window.addEventListener('ars-open-file-search', onOpen);
    return () => window.removeEventListener('ars-open-file-search', onOpen);
  }, []);

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

  useEffect(() => {
    const narrow = window.matchMedia('(max-width: 899px)');
    const measure = () => {
      const header = rootRef.current?.closest('header');
      const width = header?.clientWidth ?? window.innerWidth;
      setCompact(narrow.matches || width < 900);
    };
    measure();
    const observer = new ResizeObserver(measure);
    const header = rootRef.current?.closest('header');
    if (header) observer.observe(header);
    narrow.addEventListener('change', measure);
    window.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      narrow.removeEventListener('change', measure);
      window.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('resize', measure);
    };
  }, []);

  const scope: SearchScope = filesOn && googleOn ? 'all' : googleOn ? 'google' : 'files';
  const fieldPlaceholder = googleOn && !filesOn ? 'Search the web...' : filesOn && googleOn ? 'Search files or the web...' : placeholder;

  const index = useMemo(() => {
    const base = buildIndex(rootNodes, assets, nodes);
    const library = buildLibrary(
      assets.values(),
      canvases,
      liveProjects.map((project) => ({ id: project.id, name: project.name })),
    );
    const extra: FileSearchInput[] = [];
    const pushGroup = (id: string, label: string, folderPath: string, detail: string, rows: typeof library) => {
      if (rows.length === 0) return;
      extra.push({
        id,
        label,
        kind: 'folder',
        path: folderPath,
        count: rows.length,
        text: `${rows.length} file${rows.length === 1 ? '' : 's'}`,
      });
      for (const asset of rows) {
        extra.push({
          id: asset.id,
          label: asset.name,
          kind: asset.type || 'image',
          thumbnail: asset.thumbnail,
          path: `${folderPath}/${asset.id}`,
          text: detail,
        });
      }
    };
    pushGroup(
      'folder:/unassigned',
      'No project',
      '/unassigned',
      'Not on a current project',
      library.filter((asset) => asset.placeLabel === 'No project'),
    );
    const onCanvas = library.filter((asset) => asset.placeLabel === 'Canvas');
    const projectNames = [...new Set(onCanvas.map((asset) => asset.placeDetail || 'Canvas'))];
    for (const name of projectNames) {
      const rows = onCanvas.filter((asset) => (asset.placeDetail || 'Canvas') === name);
      pushGroup(`folder:/canvas-library/${name}`, 'Canvas', `/canvas-library/${encodeURIComponent(name)}`, name, rows);
    }
    return extra.length ? [...base, ...extra] : base;
  }, [rootNodes, assets, nodes, canvases, liveProjects]);

  const groups = useMemo(
    () => (filesOn && suggestOn ? suggestionGroups(index, query) : { nodes: [], folders: [], files: [] }),
    [filesOn, suggestOn, index, query]
  );
  const suggestions = useMemo(
    () => [...groups.nodes, ...groups.folders, ...groups.files],
    [groups]
  );

  const dragAsset = (event: React.DragEvent, item: FileSearchInput) => {
    if (item.kind === 'node' || item.kind === 'folder' || (!item.thumbnail && !item.path)) return;
    event.dataTransfer.setData('application/json', JSON.stringify({
      name: item.label,
      thumbnail: item.thumbnail,
      dataUrl: item.thumbnail?.startsWith('data:') ? item.thumbnail : undefined,
      path: item.path,
      type: item.kind,
    }));
    event.dataTransfer.effectAllowed = 'copy';
  };

  useEffect(() => {
    if (!googleOn || !open) {
      setWebImages([]);
      setWebStatus('idle');
      return;
    }
    const q = query.trim();
    if (!q) {
      setWebImages([]);
      setWebStatus('idle');
      return;
    }
    const controller = new AbortController();
    setWebStatus('loading');
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/search/images?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        const body = await response.json() as { data?: WebImageHit[] };
        const images = Array.isArray(body.data) ? body.data : [];
        if (controller.signal.aborted) return;
        setWebImages(images);
        setWebStatus(images.length ? 'ready' : 'empty');
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
        if (!controller.signal.aborted) {
          setWebImages([]);
          setWebStatus('empty');
        }
      }
    }, 280);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [googleOn, open, query]);

  const revealFile = useCallback((item: FileSearchInput) => {
    if (!item.path) return;
    const store = useFileStore.getState();
    for (const prefix of ancestorPaths(item.path)) store.expandPath(prefix);
    store.selectPath(item.path);
    window.setTimeout(() => {
      document
        .querySelector('#explorer-panel-left-sidebar [aria-selected="true"]')
        ?.scrollIntoView({ block: 'nearest' });
    }, 40);
  }, []);

  const choose = useCallback((item: FileSearchInput) => {
    if (item.nodeType) {
      usePipelineStore.getState().addNode(item.nodeType);
    } else if (item.kind === 'node') {
      usePipelineStore.getState().select(item.id);
    } else {
      revealFile(item);
    }
    onScopeChange?.(scope);
    onSearch(item.label, scope);
    setQuery(item.label);
    setOpen(false);
    inputRef.current?.blur();
  }, [onScopeChange, onSearch, revealFile, scope]);

  const openWebImage = useCallback((hit: WebImageHit) => {
    if (!hit.page) return;
    window.open(hit.page, '_blank', 'noopener,noreferrer');
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (activeIndex < suggestions.length && suggestions[activeIndex]) {
      choose(suggestions[activeIndex]);
      return;
    }
    const web = webImages[activeIndex - suggestions.length];
    if (web) {
      openWebImage(web);
      return;
    }
    const trimmed = query.trim();
    if (!trimmed || (!filesOn && !googleOn)) return;
    onScopeChange?.(scope);
    onSearch(trimmed, scope);
    setOpen(true);
  }, [activeIndex, choose, filesOn, googleOn, onScopeChange, onSearch, openWebImage, query, scope, suggestions, webImages]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!matchShortcut(e, searchShortcut)) return;
      e.preventDefault();
      setOpen(true);
      inputRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchShortcut]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const showMenu = open && (suggestions.length > 0 || (googleOn && query.trim().length > 0));
  const choiceCount = suggestions.length + webImages.length;

  return (
    <form
      ref={rootRef}
      className={`${styles.searchBar} ${isFocused ? styles.focused : ''} ${open ? styles.open : ''} ${compact ? styles.compact : ''} ${className || ''}`}
      data-search-compact={compact ? 'true' : 'false'}
      data-search-open={open ? 'true' : 'false'}
      onSubmit={handleSubmit}
    >
      <button
        type="button"
        className={`${styles.iconBtn} ${(isFocused || open) ? styles.iconActive : ''}`}
        aria-label={open ? 'Search' : 'Open search'}
        aria-expanded={open}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          if (open && !query) {
            setOpen(false);
            inputRef.current?.blur();
            return;
          }
          setOpen(true);
          inputRef.current?.focus();
        }}
      >
        <Search size={16} />
      </button>

      <div className={styles.scopeButtons}>
        <button
          type="button"
          className={`${styles.scopeButton} ${filesOn ? styles.active : ''}`}
          aria-pressed={filesOn}
          onClick={() => setFilesOn((on) => {
            writeBool(PREF_FILES, !on);
            return !on;
          })}
          title={filesOn ? 'Files search on — click to turn off' : 'Search files'}
        >
          <Folder size={14} />
        </button>
        <button
          type="button"
          className={`${styles.scopeButton} ${googleOn ? styles.active : ''}`}
          aria-pressed={googleOn}
          onClick={() => setGoogleOn((on) => {
            writeBool(PREF_GOOGLE, !on);
            return !on;
          })}
          title={googleOn ? 'Web images on — shown in this menu' : 'Show web images in this menu'}
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
          placeholder={fieldPlaceholder}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); setOpen(true); }}
          onFocus={() => { setIsFocused(true); setOpen(true); }}
          onBlur={() => setIsFocused(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { setQuery(''); setOpen(false); inputRef.current?.blur(); }
            if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => Math.min(Math.max(choiceCount - 1, 0), i + 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => Math.max(0, i - 1)); }
          }}
        />
        {query && (
          <button type="button" className={styles.clearButton} onClick={() => setQuery('')} aria-label="Clear search">
            <X size={14} />
          </button>
        )}
      </div>

      {showMenu && (
        <div className={styles.suggest} role="listbox">
          {groups.nodes.length > 0 && (
            <div>
              <div className={styles.suggestMeta}>Nodes</div>
              <ul className={styles.fileList}>
                {groups.nodes.map((item, index) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={index === activeIndex}
                      className={index === activeIndex ? styles.suggestActive : ''}
                      onMouseDown={(e) => { e.preventDefault(); choose(item); }}
                    >
                      {item.thumbnail ? (
                        <img className={styles.thumb} src={item.thumbnail} alt="" />
                      ) : (
                        <span className={styles.thumbFallback} aria-hidden>
                          <ImageIcon size={14} />
                        </span>
                      )}
                      <span className={styles.suggestLabel}>{item.label}</span>
                      <span className={styles.suggestKind}>{item.nodeType ? 'Add' : 'Canvas'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {groups.folders.length > 0 && (
            <div>
              <div className={styles.suggestMeta}>Folders</div>
              <ul className={styles.fileList}>
                {groups.folders.map((item, index) => {
                  const choice = groups.nodes.length + index;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={choice === activeIndex}
                        className={choice === activeIndex ? styles.suggestActive : ''}
                        onClick={() => choose(item)}
                      >
                        <span className={styles.thumbFallback} aria-hidden>
                          <Folder size={14} />
                        </span>
                        <span className={styles.suggestLabel}>{item.label}</span>
                        <span className={styles.suggestKind}>{item.count ?? 0} files</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {groups.files.length > 0 && (
            <div>
              <div className={styles.suggestMeta}>Files</div>
              <ul className={styles.fileList}>
                {groups.files.map((item, index) => {
                  const choice = groups.nodes.length + groups.folders.length + index;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={choice === activeIndex}
                        className={choice === activeIndex ? styles.suggestActive : ''}
                        draggable={Boolean(item.thumbnail || item.path)}
                        onDragStart={(event) => dragAsset(event, item)}
                        onClick={() => choose(item)}
                      >
                        {item.thumbnail ? (
                          <img className={styles.thumb} src={item.thumbnail} alt="" />
                        ) : (
                          <span className={styles.thumbFallback} aria-hidden>
                            <Folder size={14} />
                          </span>
                        )}
                        <span className={styles.suggestLabel}>{item.label}</span>
                        <span className={styles.suggestKind}>{item.kind}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {googleOn && query.trim() && (
            <div className={styles.webBlock}>
              <div className={styles.suggestMeta}>Images</div>
              {webStatus === 'loading' && webImages.length === 0 && (
                <div className={styles.suggestMeta}>Looking up images…</div>
              )}
              {webStatus === 'empty' && (
                <div className={styles.suggestMeta}>No images for this search</div>
              )}
              {webImages.length > 0 && (
                <div className={styles.webGrid}>
                  {webImages.map((hit, index) => {
                    const choice = suggestions.length + index;
                    return (
                      <button
                        key={hit.thumbnail}
                        type="button"
                        className={`${styles.webTile} ${choice === activeIndex ? styles.webTileActive : ''}`}
                        title={hit.title}
                        onMouseDown={(e) => { e.preventDefault(); openWebImage(hit); }}
                      >
                        <img src={hit.thumbnail} alt={hit.title} />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </form>
  );
};
