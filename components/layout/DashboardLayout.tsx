/**
 * DashboardLayout — Home Page (Redesigned)
 *
 * Full-screen creation dashboard with left panel, collapsible sections,
 * character creator, templates, and comprehensive module access.
 */
import React, { useState, useCallback, useRef, useEffect, KeyboardEvent } from 'react';
import Link from 'next/link';
import {
  Search, UserRound, LayoutGrid, Image as ImageIcon,
  Sparkles, Film, Send, ChevronDown, Zap, BrainCircuit,
  Wand2, Music, Share2, Instagram, Twitter, Youtube,
  Plus, Layers, Download, ChevronUp, Settings2, Box,
  Sliders, Camera, Sun, Focus, Aperture, Users, BookOpen,
  Palette, Ruler, Grid, Eye, Move, ArrowUpDown,
  Pencil, Eraser,
} from 'lucide-react';
import { useRouter } from 'next/router';
import styles from './DashboardLayout.module.css';
import { Button } from '../ui';
import { ConnectionBanner } from '../ui/ConnectionBanner';
import { SettingsModal } from './SettingsModal';
import { HomeLeftPanel } from '../dashboard/HomeLeftPanel';
import { HomeLeftToolbar } from '../dashboard/HomeLeftToolbar';
import { ThreeDViewer } from '../dashboard/ThreeDViewer';
import { useProjectSync, saveProjectWorkspaceState } from '../../hooks/useProjectSync';
import { useSettingsStore } from '../../stores/settingsStore';
import { useUserStore } from '../../stores/userStore';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { useProjectsStore } from '../../stores/projectsStore';
import { useToastStore } from '../../stores/toastStore';
import { ProjectsGrid } from '../dashboard';
import { AssetsGrid } from '../dashboard/AssetsGrid';

type SettingsTab = 'account' | 'api' | 'appearance' | 'shortcuts' | 'help' | 'about' | 'publishing' | 'usage' | 'data' | 'storage' | 'search';
type MainTab = 'projects' | 'assets';
type Platform = 'tiktok' | 'instagram' | 'youtube' | 'twitter' | 'custom';
type FilterPlatform = 'tiktok' | 'instagram' | 'youtube' | 'twitter';
type FilterSource = 'ai-generated' | 'imported' | 'remixed' | 'manual';
type FilterSort = 'recent' | 'alpha' | 'size' | 'published';

interface ActiveFilters {
  platform: FilterPlatform | null;
  source: FilterSource | null;
  sortBy: FilterSort;
}

const FILTER_PLATFORMS: { id: FilterPlatform; label: string; icon: React.ReactNode }[] = [
  { id: 'tiktok', label: 'TikTok', icon: <Film size={11} /> },
  { id: 'instagram', label: 'Instagram', icon: <Instagram size={11} /> },
  { id: 'youtube', label: 'YouTube', icon: <Youtube size={11} /> },
  { id: 'twitter', label: 'X / Twitter', icon: <Twitter size={11} /> },
];

const FILTER_SOURCES: { id: FilterSource; label: string }[] = [
  { id: 'ai-generated', label: 'AI Generated' },
  { id: 'imported', label: 'Imported' },
  { id: 'remixed', label: 'Remixed' },
  { id: 'manual', label: 'Manual' },
];

const PLATFORMS: { id: Platform; label: string; icon: React.ReactNode; ratio: string; width: number; height: number }[] = [
  { id: 'tiktok', label: 'TikTok', icon: <Film size={13} />, ratio: '9:16', width: 1080, height: 1920 },
  { id: 'instagram', label: 'Instagram', icon: <Instagram size={13} />, ratio: '1:1', width: 1080, height: 1080 },
  { id: 'youtube', label: 'YouTube', icon: <Youtube size={13} />, ratio: '16:9', width: 1920, height: 1080 },
  { id: 'twitter', label: 'X/Twitter', icon: <Twitter size={13} />, ratio: '16:9', width: 1920, height: 1080 },
  { id: 'custom', label: 'Custom', icon: <Settings2 size={13} />, ratio: 'custom', width: 1024, height: 1024 },
];

const AI_STYLES = [
  'Photorealistic', 'Cinematic', 'Anime', 'Oil Painting',
  'Watercolor', 'Pixel Art', 'Sketch', 'Neon Cyberpunk',
  'Fantasy', 'Minimalist', '3D Render', 'Line Art',
  'Comic Book', 'Impressionist', 'Baroque',
];

const COMPOSITION_GUIDES = [
  { id: 'rule-thirds', label: 'Rule of Thirds', icon: <Grid size={11} /> },
  { id: 'golden-ratio', label: 'Golden Ratio', icon: <Ruler size={11} /> },
  { id: 'centered', label: 'Centered', icon: <Box size={11} /> },
  { id: 'diagonal', label: 'Diagonal', icon: <Move size={11} /> },
  { id: 'leading-lines', label: 'Leading Lines', icon: <ArrowUpDown size={11} /> },
  { id: 'framing', label: 'Natural Frame', icon: <Focus size={11} /> },
];

const LIGHTING_PRESETS = [
  { id: 'studio-3pt', label: '3-Point Studio', desc: 'Key + Fill + Back' },
  { id: 'rembrandt', label: 'Rembrandt', desc: 'Triangle cheek light' },
  { id: 'golden-hour', label: 'Golden Hour', desc: 'Warm low angle sun' },
  { id: 'neon-noir', label: 'Neon Noir', desc: 'Colored practical lights' },
  { id: 'overcast', label: 'Soft Overcast', desc: 'Diffused even light' },
  { id: 'dramatic', label: 'Dramatic Top', desc: 'Theatrical spot' },
];

const CAMERA_PRESETS = [
  { id: 'portrait-85', label: 'Portrait 85mm', fov: '28°', dof: 'Shallow f/1.8' },
  { id: 'wide-24', label: 'Wide 24mm', fov: '84°', dof: 'Deep f/8' },
  { id: 'standard-50', label: 'Standard 50mm', fov: '46°', dof: 'Medium f/2.8' },
  { id: 'tele-200', label: 'Telephoto 200mm', fov: '12°', dof: 'Very shallow f/2' },
  { id: 'macro-100', label: 'Macro 100mm', fov: '24°', dof: 'Extreme f/2.8' },
];

const IMAGE_COUNTS = [1, 2, 3, 4, 6, 8, 12, 16];
const ASPECT_RATIOS = [
  { id: '9:16', w: 1080, h: 1920 }, { id: '1:1', w: 1080, h: 1080 },
  { id: '4:5', w: 1080, h: 1350 }, { id: '3:4', w: 1080, h: 1440 },
  { id: '16:9', w: 1920, h: 1080 }, { id: '21:9', w: 2560, h: 1080 },
  { id: '2:3', w: 1080, h: 1620 }, { id: '3:2', w: 1620, h: 1080 },
];

export function DashboardLayout() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [mainTab, setMainTab] = useState<MainTab>('projects');
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({ platform: null, source: null, sortBy: 'recent' });
  // All dropdown open states grouped here so the close-on-outside effect can see them
  const [filterDropOpen, setFilterDropOpen] = useState<'platform' | 'source' | 'sort' | null>(null);
  const [styleDropOpen, setStyleDropOpen] = useState(false);

  // Stable refs so the single event listener never goes stale
  const filterDropRef = useRef<typeof filterDropOpen>(null);
  const styleDropRef = useRef(false);
  useEffect(() => { filterDropRef.current = filterDropOpen; }, [filterDropOpen]);
  useEffect(() => { styleDropRef.current = styleDropOpen; }, [styleDropOpen]);

  // Single stable listener attached once — closes open dropdowns on outside click / Escape
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!target) return;
      try {
        if (filterDropRef.current !== null && !target.closest('[data-filter-drop]')) {
          setFilterDropOpen(null);
        }
        if (styleDropRef.current && !target.closest('[data-style-drop]')) {
          setStyleDropOpen(false);
        }
      } catch {
        // closest() can throw on detached/shadow-root nodes — safe to swallow
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFilterDropOpen(null);
        setStyleDropOpen(false);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []); // stable — attaches once, cleans up once

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('account');

  // Panel states
  const [leftPanelPath, setLeftPanelPath] = useState<string>('');
  const [heroExpanded, setHeroExpanded] = useState(false);
  const [showPlatforms, setShowPlatforms] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showComposition, setShowComposition] = useState(false);
  const [showCharacter, setShowCharacter] = useState(false);
  const [showLighting, setShowLighting] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [show3DScene, setShow3DScene] = useState(false);
  const [drawOpen, setDrawOpen] = useState(false);
  const [drawTool, setDrawTool] = useState('brush');
  const [drawColor, setDrawColor] = useState('#ffffff');
  const [drawSize, setDrawSize] = useState(8);
  const [drawBgColor, setDrawBgColor] = useState('#1a1a2e');
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawCanvasWidth = 1000;
  const isDrawingRef = useRef(false);

  const handleDrawStart = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDrawingRef.current = true;
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (drawCanvasWidth / rect.width);
    const y = (e.clientY - rect.top) * (400 / rect.height);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = drawTool === 'eraser' ? drawBgColor : drawColor;
    ctx.lineWidth = drawSize;
    ctx.lineCap = 'round';
  };

  const handleDrawMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (drawCanvasWidth / rect.width);
    const y = (e.clientY - rect.top) * (400 / rect.height);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handleDrawEnd = () => {
    isDrawingRef.current = false;
  };

  const handleClearCanvas = () => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = drawBgColor;
    ctx.fillRect(0, 0, drawCanvasWidth, 400);
  };

  const handleExportDrawing = () => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    setGeneratedImages(prev => [{
      id: `draw-${Date.now()}`,
      dataUrl,
      prompt: 'Hand-drawn composition',
      seed: undefined,
      assetId: undefined,
      createdAt: Date.now(),
    }, ...prev]);
  };
  const [triggerNewProject, setTriggerNewProject] = useState(0);
  const [activeToolbarAction, setActiveToolbarAction] = useState<string>('');

  // Character creator controlled state
  const [charName, setCharName] = useState('');
  const [charAppearance, setCharAppearance] = useState('');
  const [charOutfit, setCharOutfit] = useState('');
  const [charPose, setCharPose] = useState('standing');
  const [charBackground, setCharBackground] = useState('studio');
  const [charBgColor, setCharBgColor] = useState('#1a1a2e');

  // Generation state
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>('tiktok');
  const [selectedStyle, setSelectedStyle] = useState('Cinematic');
  const [imageCount, setImageCount] = useState(4);
  const [customWidth, setCustomWidth] = useState(1080);
  const [customHeight, setCustomHeight] = useState(1920);
  const [selectedComposition, setSelectedComposition] = useState<string[]>([]);
  const [selectedLighting, setSelectedLighting] = useState('studio-3pt');
  const [selectedCamera, setSelectedCamera] = useState('portrait-85');
  const [isGenerating, setIsGenerating] = useState(false);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  // Generated images
  const [generatedImages, setGeneratedImages] = useState<Array<{
    id: string; dataUrl: string; prompt: string; seed?: number; assetId?: string; createdAt: number;
  }>>([]);
  const [genError, setGenError] = useState('');
  const [dragImgId, setDragImgId] = useState<string | null>(null);

  const handleImgDragStart = (e: React.DragEvent, imgId: string) => {
    e.dataTransfer.setData('text/plain', imgId);
    setDragImgId(imgId);
  };

  const handleImgDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const srcId = e.dataTransfer.getData('text/plain');
    if (srcId && srcId !== targetId) {
      setGeneratedImages(prev => {
        const arr = [...prev];
        const srcIdx = arr.findIndex(i => i.id === srcId);
        const tgtIdx = arr.findIndex(i => i.id === targetId);
        if (srcIdx >= 0 && tgtIdx >= 0) {
          const [moved] = arr.splice(srcIdx, 1);
          arr.splice(tgtIdx, 0, moved);
        }
        return arr;
      });
    }
    setDragImgId(null);
  };

  const handleImgDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const { openProjectFromDashboard } = useProjectSync();
  const currentProject = useUserStore((s) => s.currentProject);
  const health = useTelemetryStore((s) => s.health);
  const addProject = useProjectsStore((s) => s.addProject);
  const toast = useToastStore();

  const handleOpenProject = useCallback(
    (projectId: string) => {
      void saveProjectWorkspaceState(currentProject.id, currentProject.name);
      openProjectFromDashboard(projectId);
      router.push(`/project/${projectId}`);
    },
    [router, currentProject.id, currentProject.name, openProjectFromDashboard]
  );

  // Build the full prompt with composition, lighting, camera guides
  const buildFullPrompt = useCallback(() => {
    if (!prompt.trim()) return '';
    let full = prompt;

    if (selectedStyle && selectedStyle !== 'Cinematic') {
      full = `${full}, ${selectedStyle.toLowerCase()} style`;
    }

    // Add composition guide
    if (selectedComposition.length > 0) {
      const compMap: Record<string, string> = {
        'rule-thirds': 'rule of thirds composition',
        'golden-ratio': 'golden ratio composition',
        'centered': 'centered symmetrical composition',
        'diagonal': 'dynamic diagonal composition',
        'leading-lines': 'strong leading lines',
        'framing': 'natural frame within frame composition',
      };
      const comps = selectedComposition.map(c => compMap[c] || '').filter(Boolean);
      if (comps.length) full = `${full}, ${comps.join(', ')}`;
    }

    // Add lighting
    const lightMap: Record<string, string> = {
      'studio-3pt': 'professional three-point studio lighting with soft key, subtle fill, hair light',
      'rembrandt': 'Rembrandt lighting with dramatic triangular cheek catchlight, dark background',
      'golden-hour': 'warm golden hour sunlight, long shadows, atmospheric haze',
      'neon-noir': 'neon noir lighting with colored practical lights, wet surfaces, high contrast',
      'overcast': 'soft overcast lighting, diffused cloud cover, even exposure',
      'dramatic': 'dramatic top-down spotlight, theatrical lighting, deep shadows',
    };
    if (selectedLighting) {
      full = `${full}, ${lightMap[selectedLighting] || 'professional studio lighting'}`;
    }

    // Add camera
    const camMap: Record<string, string> = {
      'portrait-85': '85mm portrait lens, f/1.8, shallow depth of field, creamy bokeh',
      'wide-24': '24mm wide angle lens, f/8, deep focus, expansive view',
      'standard-50': '50mm standard lens, f/2.8, natural perspective',
      'tele-200': '200mm telephoto lens, f/2, compressed perspective, subject isolation',
      'macro-100': '100mm macro lens, f/2.8, extreme close-up detail',
    };
    if (selectedCamera) {
      full = `${full}, ${camMap[selectedCamera] || 'professional lens'}`;
    }

    // Quality suffix
    full = `${full}, 8K resolution, ultra detailed, professional photography`;

    return full;
  }, [prompt, selectedStyle, selectedComposition, selectedLighting, selectedCamera]);

  const handleGenerate = useCallback(async (promptOverride?: string) => {
    const promptText = promptOverride ?? prompt;
    if (!promptText.trim()) {
      if (!promptOverride) promptRef.current?.focus();
      return;
    }

    setIsGenerating(true);
    setGenError('');

    const platform = PLATFORMS.find(p => p.id === selectedPlatform) ?? PLATFORMS[0];
    const genWidth = selectedPlatform === 'custom' ? customWidth : platform.width;
    const genHeight = selectedPlatform === 'custom' ? customHeight : platform.height;
    const fullPrompt = promptOverride ?? buildFullPrompt();

    let apiKey = '';
    try {
      const raw = localStorage.getItem('ars-settings-store');
      if (raw) apiKey = JSON.parse(raw)?.state?.settings?.aiProvider?.apiKey ?? '';
    } catch { /* localStorage unavailable — proceed without API key */ }

    type GenResult = { id: string; dataUrl: string; prompt: string; seed?: number; assetId?: string; createdAt: number };
    const results: GenResult[] = [];
    let failCount = 0;
    let lastError = '';

    for (let i = 0; i < imageCount; i++) {
      try {
        const body: Record<string, unknown> = {
          prompt: fullPrompt,
          negativePrompt: negativePrompt || undefined,
          width: genWidth,
          height: genHeight,
        };
        if (apiKey) body.apiKey = apiKey;

        const resp = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        let json: Record<string, unknown>;
        try {
          json = await resp.json() as Record<string, unknown>;
        } catch {
          throw new Error(`Server returned non-JSON response (HTTP ${resp.status})`);
        }

        if (!resp.ok) {
          const msg = typeof json.error === 'string' ? json.error : `Server error ${resp.status}`;
          throw new Error(msg);
        }

        if (typeof json.dataUrl === 'string' && json.dataUrl) {
          results.push({
            id: `gen-${Date.now()}-${i}`,
            dataUrl: json.dataUrl,
            prompt: fullPrompt,
            seed: typeof json.seed === 'number' ? json.seed : undefined,
            assetId: typeof json.assetId === 'string' ? json.assetId : undefined,
            createdAt: Date.now(),
          });
        } else {
          const msg = typeof json.error === 'string' ? json.error : 'No image returned';
          throw new Error(msg);
        }
      } catch (err) {
        failCount++;
        lastError = err instanceof Error ? err.message : 'Generation failed';
        setGenError(lastError);
      }
    }

    setGeneratedImages(prev => [...results, ...prev]);
    setIsGenerating(false);

    if (results.length > 0 && failCount === 0) {
      toast.addToast({ type: 'success', title: `${results.length} image${results.length > 1 ? 's' : ''} generated`, duration: 2500 });
    } else if (results.length > 0 && failCount > 0) {
      toast.addToast({ type: 'warning', title: 'Partial success', message: `${results.length} generated, ${failCount} failed.`, duration: 4000 });
    } else if (failCount > 0) {
      toast.addToast({ type: 'error', title: 'Generation failed', message: lastError || 'All images failed. Check your API key in Settings.', duration: 7000, action: { label: 'Settings', onClick: () => { setSettingsTab('api'); setSettingsOpen(true); } } });
    }
  }, [prompt, negativePrompt, selectedPlatform, customWidth, customHeight, imageCount, buildFullPrompt, toast]);

  const handleToolbarAction = useCallback((id: string) => {
    setActiveToolbarAction(id);
    switch (id) {
      case 'gen-image':
        setHeroExpanded(true);
        setTimeout(() => promptRef.current?.focus(), 80);
        break;
      case 'character':
        setHeroExpanded(true);
        setShowCharacter(true);
        break;
      case 'template':
        setHeroExpanded(true);
        setShowTemplates(true);
        break;
      case 'brush':
      case 'eraser':
      case 'shape-rect':
      case 'shape-ellipse':
      case 'text':
      case 'picker':
      case 'pointer':
        setDrawOpen(true);
        setDrawTool(id);
        break;
      case 'export': {
        const recent = useProjectsStore.getState().projects[0];
        if (recent) router.push(`/project/${recent.id}`);
        break;
      }
      case 'publish':
        setSettingsTab('publishing');
        setSettingsOpen(true);
        break;
      case 'gen-video':
      case 'gen-music':
        toast.addToast({ type: 'info', title: id === 'gen-video' ? 'Video Generation' : 'Music Generation', message: 'This module is coming soon. Stay tuned!', duration: 4000 });
        break;
    }
  }, [router, toast]);

  const handleGenerateCharacter = useCallback(() => {
    const bgDesc =
      charBackground === 'studio' ? 'plain white studio background' :
      charBackground === 'gradient' ? `gradient background, ${charBgColor}` :
      charBackground === 'environment' ? 'detailed environment scene background' :
      'transparent background';
    const parts = [
      charName ? `character portrait of ${charName}` : 'detailed character portrait',
      charAppearance && `appearance: ${charAppearance}`,
      charOutfit && `outfit: ${charOutfit}`,
      `pose: ${charPose}`,
      bgDesc,
      'full body character reference sheet, professional concept art, ultra detailed',
    ].filter(Boolean);
    void handleGenerate(parts.join(', '));
  }, [charName, charAppearance, charOutfit, charPose, charBackground, charBgColor, handleGenerate]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleGenerate();
    }
  };

  const connectedClass = health?.status === 'ok' ? styles.avatarConnected :
    health?.status === 'error' || health?.status === 'degraded' ? styles.avatarDisconnected : '';
  const currentPlatform = PLATFORMS.find(p => p.id === selectedPlatform)!;
  const effectiveWidth = selectedPlatform === 'custom' ? customWidth : currentPlatform.width;
  const effectiveHeight = selectedPlatform === 'custom' ? customHeight : currentPlatform.height;

  const toggleComposition = (id: string) => {
    setSelectedComposition(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  return (
    <div id="dashboard-layout-root-page-region" className={styles.root}>
      <ConnectionBanner />

      {/* Top Bar */}
      <header id="dashboard-layout-header-primary-at-top" className={styles.topBar}>
        <Link href="/home" className={styles.brand} title="Dashboard Home">
          <span className={styles.brandArs}>Ars</span>
          <span className={styles.brandTechnic}>Technic</span>
          <span className={styles.brandAI}>AI</span>
        </Link>
        <div className={styles.searchBox}>
          <Search size={14} className={styles.searchIcon} />
          <input type="text" placeholder="Search projects, assets, tags…" value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)} className={styles.searchInput} />
        </div>
        <div className={styles.topBarRight}>
          <button className={styles.avatarBtn} onClick={() => { setSettingsTab('account'); setSettingsOpen(true); }}>
            <div className={`${styles.avatar} ${connectedClass}`}><UserRound size={13} /></div>
          </button>
        </div>
      </header>

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} defaultTab={settingsTab} />

      {/* Main body: Left Panel + Content */}
      <div id="app-shell-workspace-region" className={styles.bodyWrap}>
        <HomeLeftPanel
          onSelectFolder={(path) => setLeftPanelPath(path)}
          onNewFolder={() => {}}
          onNewProject={() => setTriggerNewProject(k => k + 1)}
          onOpenCharacterCreator={() => { setHeroExpanded(true); setShowCharacter(true); }}
          onOpenTemplate={() => { setHeroExpanded(true); setShowTemplates(true); }}
          selectedPath={leftPanelPath}
        />

        <HomeLeftToolbar
          onAction={handleToolbarAction}
          activeAction={activeToolbarAction}
        />

        <div className={styles.mainContent}>

          {/* ── CONTENT FILTER BAR — primary visible area ─────── */}
          <div id="content-filter-bar-secondary" className={styles.contentBar}>
            {/* Tab nav */}
            <nav className={styles.tabs} role="tablist">
              <button role="tab" aria-selected={mainTab === 'projects'}
                className={`${styles.tab} ${mainTab === 'projects' ? styles.tabActive : ''}`}
                onClick={() => setMainTab('projects')}>
                <LayoutGrid size={14} /> Projects
              </button>
              <button role="tab" aria-selected={mainTab === 'assets'}
                className={`${styles.tab} ${mainTab === 'assets' ? styles.tabActive : ''}`}
                onClick={() => setMainTab('assets')}>
                <ImageIcon size={14} /> All Assets
              </button>
            </nav>

            {/* Faceted filter chips */}
            <div id="faceted-filter-chips-row" className={styles.filterChipsRow}>
              {/* Platform filter */}
              <div className={styles.filterDropWrap} data-filter-drop="platform">
                <button
                  className={`${styles.filterChip} ${activeFilters.platform ? styles.filterChipActive : ''}`}
                  onClick={() => setFilterDropOpen(filterDropOpen === 'platform' ? null : 'platform')}
                >
                  <Film size={11} />
                  {activeFilters.platform
                    ? FILTER_PLATFORMS.find(p => p.id === activeFilters.platform)?.label
                    : 'Platform'}
                  <ChevronDown size={10} />
                </button>
                {filterDropOpen === 'platform' && (
                  <div className={styles.filterDropdown}>
                    <button className={styles.filterDropItem}
                      onClick={() => { setActiveFilters(f => ({ ...f, platform: null })); setFilterDropOpen(null); }}>
                      All Platforms
                    </button>
                    {FILTER_PLATFORMS.map(p => (
                      <button key={p.id} className={`${styles.filterDropItem} ${activeFilters.platform === p.id ? styles.filterDropItemActive : ''}`}
                        onClick={() => { setActiveFilters(f => ({ ...f, platform: p.id })); setFilterDropOpen(null); }}>
                        {p.icon} {p.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Source filter */}
              <div className={styles.filterDropWrap} data-filter-drop="source">
                <button
                  className={`${styles.filterChip} ${activeFilters.source ? styles.filterChipActive : ''}`}
                  onClick={() => setFilterDropOpen(filterDropOpen === 'source' ? null : 'source')}
                >
                  <Sparkles size={11} />
                  {activeFilters.source
                    ? FILTER_SOURCES.find(s => s.id === activeFilters.source)?.label
                    : 'Source'}
                  <ChevronDown size={10} />
                </button>
                {filterDropOpen === 'source' && (
                  <div className={styles.filterDropdown}>
                    <button className={styles.filterDropItem}
                      onClick={() => { setActiveFilters(f => ({ ...f, source: null })); setFilterDropOpen(null); }}>
                      All Sources
                    </button>
                    {FILTER_SOURCES.map(s => (
                      <button key={s.id} className={`${styles.filterDropItem} ${activeFilters.source === s.id ? styles.filterDropItemActive : ''}`}
                        onClick={() => { setActiveFilters(f => ({ ...f, source: s.id })); setFilterDropOpen(null); }}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Sort */}
              <div className={styles.filterDropWrap} data-filter-drop="sort">
                <button
                  className={`${styles.filterChip} ${activeFilters.sortBy !== 'recent' ? styles.filterChipActive : ''}`}
                  onClick={() => setFilterDropOpen(filterDropOpen === 'sort' ? null : 'sort')}
                >
                  <ArrowUpDown size={11} />
                  {activeFilters.sortBy === 'recent' ? 'Recent' : activeFilters.sortBy === 'alpha' ? 'A–Z' : activeFilters.sortBy === 'size' ? 'By Size' : 'Published'}
                  <ChevronDown size={10} />
                </button>
                {filterDropOpen === 'sort' && (
                  <div className={styles.filterDropdown}>
                    {(['recent', 'alpha', 'size', 'published'] as FilterSort[]).map(s => (
                      <button key={s} className={`${styles.filterDropItem} ${activeFilters.sortBy === s ? styles.filterDropItemActive : ''}`}
                        onClick={() => { setActiveFilters(f => ({ ...f, sortBy: s })); setFilterDropOpen(null); }}>
                        {s === 'recent' ? 'Most Recent' : s === 'alpha' ? 'Alphabetical' : s === 'size' ? 'By Asset Count' : 'Most Published'}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Active filter pills — show when filters active */}
              {(activeFilters.platform || activeFilters.source) && (
                <button className={styles.clearFiltersBtn}
                  onClick={() => setActiveFilters({ platform: null, source: null, sortBy: 'recent' })}>
                  Clear filters
                </button>
              )}
            </div>

            <Button variant="primary" size="sm" icon={<Plus size={14} />}
              onClick={() => setTriggerNewProject(k => k + 1)}>New Project</Button>
          </div>

          {/* ── MAIN PROJECT/ASSET GRID — always above the fold ─ */}
          <main id="content-grid-main-scrollable" className={styles.main}>
            {mainTab === 'projects' ? (
              <ProjectsGrid onOpenProject={handleOpenProject} searchQuery={searchQuery} externalFilters={activeFilters} triggerNew={triggerNewProject} />
            ) : (
              <AssetsGrid searchQuery={searchQuery} />
            )}
          </main>

          {/* ── GENERATION RESULTS STRIP — shown when results exist */}
          {(genError || generatedImages.length > 0) && (
            <div id="generation-results-strip" className={styles.genResultsStrip}>
              {genError && <div className={styles.genError}>⚠️ {genError}</div>}
              {generatedImages.length > 0 && (
                <div className={styles.genResults}>
                  <div className={styles.genResultsHeader}>
                    <Sparkles size={14} /> Generated ({generatedImages.length})
                    <button className={styles.genClearBtn} onClick={() => setGeneratedImages([])}>Clear</button>
                  </div>
                  <div className={styles.genResultsGrid}>
                    {generatedImages.map((img, idx) => (
                      <div key={img.id}
                        className={`${styles.genResultCard} ${dragImgId === img.id ? styles.genDragging : ''}`}
                        draggable
                        onDragStart={(e) => handleImgDragStart(e, img.id)}
                        onDragOver={handleImgDragOver}
                        onDrop={(e) => handleImgDrop(e, img.id)}
                        onDragEnd={() => setDragImgId(null)}>
                        <span style={{position:'absolute',top:4,left:6,zIndex:5,fontSize:'0.5rem',color:'rgba(255,255,255,0.4)',fontFamily:'var(--font-mono)'}}>{idx + 1}</span>
                        <img src={img.dataUrl} alt={img.prompt} className={styles.genResultImg} />
                        <div className={styles.genResultOverlay}>
                          <button className={styles.genResultBtn} onClick={() => {
                            const safeName = img.prompt.slice(0, 40).replace(/[^a-zA-Z0-9 _-]/g, '').trim() || 'Generated';
                            const newProject = addProject({ name: safeName, tags: [selectedPlatform] });
                            localStorage.setItem('ars:quick-create', JSON.stringify({
                              prompt: img.prompt, style: selectedStyle, imageCount: 1,
                              projectId: newProject.id, prefillDataUrl: img.dataUrl, createdAt: Date.now(),
                            }));
                            void saveProjectWorkspaceState(currentProject.id, currentProject.name);
                            openProjectFromDashboard(newProject.id);
                            router.push(`/project/${newProject.id}?quickcreate=1`);
                          }}><Wand2 size={11} /> Edit in Workshop</button>
                          <a href={img.dataUrl} download={`gen-${img.id.slice(0,8)}.png`} className={styles.genResultBtn}>
                            <Download size={11} /> Save
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── DRAW BOARD — opens when draw tools selected ────── */}
          {drawOpen && (
            <div id="draw-board-panel" className={styles.drawPanel}>
              <div className={styles.drawToolbar}>
                {[
                  { id: 'brush', label: 'Brush', icon: <Pencil size={13} /> },
                  { id: 'eraser', label: 'Eraser', icon: <Eraser size={13} /> },
                ].map(t => (
                  <button key={t.id} title={t.label}
                    className={`${styles.drawToolBtn} ${drawTool === t.id ? styles.drawToolActive : ''}`}
                    onClick={() => setDrawTool(t.id)}>
                    {t.icon}
                  </button>
                ))}
                <input type="color" className={styles.drawColorPicker} value={drawColor}
                  onChange={e => setDrawColor(e.target.value)} title="Brush color" />
                <input type="range" className={styles.drawSizeSlider} min={2} max={40} value={drawSize}
                  onChange={e => setDrawSize(Number(e.target.value))} title={`Size: ${drawSize}px`} />
                <span className={styles.drawSizeLabel}>{drawSize}px</span>
                <div className={styles.drawToolDivider} />
                <button className={styles.drawToolBtn} onClick={handleClearCanvas} title="Clear canvas">
                  <Eraser size={13} />
                </button>
                <button className={`${styles.drawToolBtn} ${styles.drawExportBtn}`}
                  onClick={handleExportDrawing} title="Add drawing to results">
                  <Sparkles size={13} /> Add to Results
                </button>
                <button className={styles.drawCloseBtn} onClick={() => setDrawOpen(false)} title="Close draw board">✕</button>
              </div>
              <canvas
                ref={drawCanvasRef}
                width={drawCanvasWidth}
                height={400}
                className={styles.drawCanvas}
                style={{ background: drawBgColor }}
                onMouseDown={handleDrawStart}
                onMouseMove={handleDrawMove}
                onMouseUp={handleDrawEnd}
                onMouseLeave={handleDrawEnd}
              />
            </div>
          )}

          {/* ── QUICK-CREATE HERO — compact by default ────────── */}
          <section id="creation-hero-section-main" className={`${styles.hero} ${heroExpanded ? styles.heroExpanded : ''}`}>
            <div className={styles.heroInner}>

              {/* Pipeline visualizer */}
              <div id="pipeline-visualizer-steps-row" className={styles.pipelineRow} aria-label="Creative pipeline stages">
                {[
                  { label: 'Script', done: false },
                  { label: 'Mood Board', done: false },
                  { label: 'Prompts', done: !!prompt.trim() },
                  { label: 'Generate', done: generatedImages.length > 0 },
                  { label: 'Storyboard', done: false },
                  { label: 'Timeline', done: false },
                  { label: 'Publish', done: false },
                ].map((step, i, arr) => (
                  <React.Fragment key={step.label}>
                    <div className={`${styles.pipelineStep} ${step.done ? styles.pipelineStepDone : ''}`}
                      title={`Pipeline phase: ${step.label}`}>
                      <span className={styles.pipelineDot} />
                      <span className={styles.pipelineLabel}>{step.label}</span>
                    </div>
                    {i < arr.length - 1 && <span className={styles.pipelineArrow} aria-hidden="true">›</span>}
                  </React.Fragment>
                ))}
              </div>

              {/* Compact prompt strip — always visible */}
              <div id="prompt-input-group-flex" className={styles.promptGroup}>
                <div className={styles.promptCompactRow}>
                  {/* Platform chips — inline compact */}
                  <div id="platform-selector-row" className={styles.platformTabsCompact}>
                    {PLATFORMS.filter(p => p.id !== 'custom').map(p => (
                      <button key={p.id}
                        className={`${styles.platformTabCompact} ${selectedPlatform === p.id ? styles.platformTabActive : ''}`}
                        onClick={() => setSelectedPlatform(p.id)}
                        title={`${p.label} — ${p.ratio}`}>
                        {p.icon}
                        <span className={styles.platformRatio}>{p.ratio}</span>
                      </button>
                    ))}
                  </div>

                  <textarea ref={promptRef}
                    id="prompt-textarea-multiline"
                    className={styles.promptInputCompact}
                    placeholder="Describe what you want to create… (⌘↵ to generate)"
                    value={prompt} onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={handleKeyDown} rows={2} />

                  <div className={styles.promptCompactActions}>
                    {/* Style picker */}
                    <div className={styles.controlGroup} data-style-drop>
                      <button className={styles.controlBtn} onClick={() => setStyleDropOpen(v => !v)}
                        title="Style preset" aria-haspopup="listbox" aria-expanded={styleDropOpen}>
                        <Wand2 size={11} /> {selectedStyle} <ChevronDown size={9} />
                      </button>
                      {styleDropOpen && (
                        <div className={styles.styleDropdown} role="listbox">
                          {AI_STYLES.map(s => (
                            <button key={s} className={`${styles.styleOption} ${selectedStyle === s ? styles.styleOptionActive : ''}`}
                              role="option" aria-selected={selectedStyle === s}
                              onClick={() => { setSelectedStyle(s); setStyleDropOpen(false); }}>
                              {s}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Count selector */}
                    <div className={styles.controlGroup}>
                      <span className={styles.controlLabel}>×</span>
                      {[1, 2, 4].map(n => (
                        <button key={n} className={`${styles.countBtn} ${imageCount === n ? styles.countBtnActive : ''}`}
                          onClick={() => setImageCount(n)}>{n}</button>
                      ))}
                    </div>

                    <button id="generate-button-primary-gradient" className={styles.generateBtn}
                      onClick={handleGenerate} disabled={!prompt.trim() || isGenerating}>
                      <Sparkles size={15} />
                      {isGenerating ? 'Generating…' : 'Generate'}
                    </button>

                    <button className={styles.heroExpandBtn} onClick={() => setHeroExpanded(v => !v)}
                      title={heroExpanded ? 'Collapse creative tools' : 'Expand creative tools'}>
                      {heroExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                    </button>
                  </div>
                </div>

                {/* Dim hint */}
                <span className={styles.dimHint}>{effectiveWidth}×{effectiveHeight} · {selectedStyle}</span>
              </div>

              {/* ── Expanded area: all creative tools ─────────── */}
              {heroExpanded && (
                <div id="creation-hero-advanced-panel" className={styles.heroAdvancedPanel}>

                  {/* Negative prompt */}
                  <div className={styles.negativeRow}>
                    <input type="text" className={styles.negativeInput}
                      placeholder="Negative prompt (what to avoid: blurry, watermark, bad anatomy…)"
                      value={negativePrompt} onChange={e => setNegativePrompt(e.target.value)} />
                  </div>

                  {/* Platform selector full */}
                  <button className={styles.sectionToggle} onClick={() => setShowPlatforms(!showPlatforms)}>
                    <Settings2 size={12} />
                    Platform & Dimensions
                    {showPlatforms ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                  {showPlatforms && (
                    <div className={styles.platformRow}>
                      <div className={styles.platformTabs}>
                        {PLATFORMS.filter(p => p.id !== 'custom').map(p => (
                          <button key={p.id}
                            className={`${styles.platformTab} ${selectedPlatform === p.id ? styles.platformTabActive : ''}`}
                            onClick={() => setSelectedPlatform(p.id)}>
                            {p.icon} {p.label}
                            <span className={styles.platformRatio}>{p.ratio}</span>
                          </button>
                        ))}
                        <button
                          className={`${styles.platformTab} ${selectedPlatform === 'custom' ? styles.platformTabActive : ''}`}
                          onClick={() => setSelectedPlatform('custom')}>
                          <Settings2 size={13} /> Custom
                        </button>
                      </div>
                      {selectedPlatform === 'custom' && (
                        <div className={styles.customDims}>
                          <input type="number" value={customWidth} onChange={e => setCustomWidth(Number(e.target.value) || 1024)}
                            className={styles.dimInput} min={64} max={4096} placeholder="Width" />
                          <span>×</span>
                          <input type="number" value={customHeight} onChange={e => setCustomHeight(Number(e.target.value) || 1024)}
                            className={styles.dimInput} min={64} max={4096} placeholder="Height" />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Advanced cinematic controls */}
                  <button className={styles.advancedToggle} onClick={() => setShowAdvanced(!showAdvanced)}>
                    <Sliders size={11} />
                    {showAdvanced ? 'Hide Cinematic Controls' : 'Cinematic Controls (Composition · Lighting · Camera)'}
                    {showAdvanced ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                  </button>

                  {showAdvanced && (
                    <div className={styles.advancedPanel}>
                      <div className={styles.advancedSection}>
                        <button className={styles.advancedSectionHeader}
                          onClick={() => setShowComposition(!showComposition)}>
                          <Grid size={11} /> Composition {showComposition ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                        </button>
                        {showComposition && (
                          <div className={styles.advancedChips}>
                            {COMPOSITION_GUIDES.map(c => (
                              <button key={c.id}
                                className={`${styles.chipBtn} ${selectedComposition.includes(c.id) ? styles.chipActive : ''}`}
                                onClick={() => toggleComposition(c.id)}>
                                {c.icon} {c.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className={styles.advancedSection}>
                        <button className={styles.advancedSectionHeader}
                          onClick={() => setShowLighting(!showLighting)}>
                          <Sun size={11} /> Lighting {showLighting ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                        </button>
                        {showLighting && (
                          <div className={styles.advancedChips}>
                            {LIGHTING_PRESETS.map(l => (
                              <button key={l.id}
                                className={`${styles.chipBtn} ${selectedLighting === l.id ? styles.chipActive : ''}`}
                                onClick={() => setSelectedLighting(l.id)}>
                                {l.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className={styles.advancedSection}>
                        <button className={styles.advancedSectionHeader}
                          onClick={() => setShowCamera(!showCamera)}>
                          <Camera size={11} /> Camera & Lens {showCamera ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                        </button>
                        {showCamera && (
                          <div className={styles.advancedChips}>
                            {CAMERA_PRESETS.map(c => (
                              <button key={c.id}
                                className={`${styles.chipBtn} ${selectedCamera === c.id ? styles.chipActive : ''}`}
                                onClick={() => setSelectedCamera(c.id)}>
                                {c.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className={styles.advancedSection}>
                        <span className={styles.advancedSectionHeader} style={{ cursor: 'default' }}>
                          <Ruler size={11} /> Aspect Ratios
                        </span>
                        <div className={styles.advancedChips}>
                          {ASPECT_RATIOS.map(a => (
                            <button key={a.id}
                              className={`${styles.chipBtn} ${effectiveWidth === a.w && effectiveHeight === a.h ? styles.chipActive : ''}`}
                              onClick={() => { setSelectedPlatform('custom'); setCustomWidth(a.w); setCustomHeight(a.h); }}>
                              {a.id}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Image count full row */}
                  <div className={styles.promptControls}>
                    <div className={styles.controlGroup}>
                      <span className={styles.controlLabel}>Images</span>
                      {IMAGE_COUNTS.filter(n => n <= 8).map(n => (
                        <button key={n} className={`${styles.countBtn} ${imageCount === n ? styles.countBtnActive : ''}`}
                          onClick={() => setImageCount(n)}>{n}</button>
                      ))}
                      {imageCount > 8 && <button className={styles.countBtnActive}>{imageCount}</button>}
                      <button className={styles.countMoreBtn} onClick={() => {
                        const idx = IMAGE_COUNTS.indexOf(imageCount);
                        setImageCount(IMAGE_COUNTS[(idx + 1) % IMAGE_COUNTS.length]);
                      }} title="More options">…</button>
                    </div>
                  </div>

                  {/* Character Creator */}
                  <button className={styles.sectionToggle} onClick={() => setShowCharacter(!showCharacter)}>
                    <Users size={12} />
                    Character Creator
                    {showCharacter ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                  {showCharacter && (
                    <div className={styles.characterPanel}>
                      <div className={styles.charGrid}>
                        <div className={styles.charField}>
                          <label>Character Name</label>
                          <input type="text" className={styles.charInput} placeholder="e.g. Commander Zara"
                            value={charName} onChange={e => setCharName(e.target.value)} />
                        </div>
                        <div className={styles.charField}>
                          <label>Appearance</label>
                          <textarea className={styles.charTextarea} rows={2} placeholder="Hair, eyes, skin, build, height…"
                            value={charAppearance} onChange={e => setCharAppearance(e.target.value)} />
                        </div>
                        <div className={styles.charField}>
                          <label>Outfit / Wardrobe</label>
                          <input type="text" className={styles.charInput} placeholder="e.g. Tactical armor, red cape"
                            value={charOutfit} onChange={e => setCharOutfit(e.target.value)} />
                        </div>
                        <div className={styles.charField}>
                          <label>Pose</label>
                          <select className={styles.charSelect} value={charPose} onChange={e => setCharPose(e.target.value)}>
                            <option value="standing">Standing</option>
                            <option value="action">Action</option>
                            <option value="sitting">Sitting</option>
                            <option value="portrait">Portrait</option>
                            <option value="dynamic">Dynamic</option>
                          </select>
                        </div>
                        <div className={styles.charField}>
                          <label>Background</label>
                          <select className={styles.charSelect} value={charBackground} onChange={e => setCharBackground(e.target.value)}>
                            <option value="studio">Studio (plain)</option>
                            <option value="gradient">Gradient</option>
                            <option value="environment">Environment scene</option>
                            <option value="transparent">Transparent</option>
                          </select>
                        </div>
                        <div className={styles.charField}>
                          <label>Background Color</label>
                          <input type="color" className={styles.charColor} value={charBgColor} onChange={e => setCharBgColor(e.target.value)} />
                        </div>
                      </div>
                      <button className={styles.charGenerateBtn} onClick={handleGenerateCharacter} disabled={isGenerating}>
                        <Sparkles size={12} /> {isGenerating ? 'Generating…' : 'Generate Character Sheet'}
                      </button>
                    </div>
                  )}

                  {/* Prompt Templates */}
                  <button className={styles.sectionToggle} onClick={() => setShowTemplates(!showTemplates)}>
                    <BookOpen size={12} />
                    Prompt Templates
                    {showTemplates ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                  {showTemplates && (
                    <div className={styles.templatePanel}>
                      <div className={styles.templateGrid}>
                        {[
                          { name: 'Cinematic Portrait', vars: 'subject, lighting, mood', prompt: 'cinematic portrait of [SUBJECT], [MOOD] expression, dramatic [LIGHTING] lighting, 85mm f/1.4, shallow depth of field, ultra detailed, professional photography' },
                          { name: 'Product Shot', vars: 'product, angle, background', prompt: '[PRODUCT] product photography, [ANGLE] angle, clean [BACKGROUND] background, studio lighting, commercial photography, 8k resolution' },
                          { name: 'Landscape Epic', vars: 'location, time, weather', prompt: 'epic [LOCATION] landscape, [TIME] sky, [WEATHER] atmosphere, ultra wide angle, hyperdetailed environment, 8k' },
                          { name: 'Character Sheet', vars: 'name, features, outfit', prompt: 'character reference sheet of [NAME], [FEATURES], wearing [OUTFIT], multiple views, front and side, professional concept art' },
                          { name: 'Sci-Fi Scene', vars: 'setting, tech, atmosphere', prompt: 'futuristic [SETTING], advanced [TECH] technology, [ATMOSPHERE] atmosphere, cinematic composition, ultra detailed, sci-fi art' },
                          { name: 'Food Photography', vars: 'dish, plating, setting', prompt: '[DISH] food photography, [PLATING] plating style, [SETTING] setting, natural light, macro lens, professional food photography' },
                        ].map(t => (
                          <button key={t.name} className={styles.templateCard}
                            onClick={() => setPrompt(t.prompt)}>
                            <span className={styles.templateName}>{t.name}</span>
                            <span className={styles.templateVars}>{t.vars}</span>
                          </button>
                        ))}
                      </div>
                      <button className={styles.newTemplateBtn} onClick={() => {
                        const recent = useProjectsStore.getState().projects[0];
                        toast.addToast({
                          type: 'info',
                          title: 'Template Studio',
                          message: 'Open a project in the Workshop to create and save custom prompt templates.',
                          duration: 5000,
                          action: recent ? {
                            label: 'Open Workshop',
                            onClick: () => router.push(`/project/${recent.id}`),
                          } : undefined,
                        });
                      }}>
                        <Plus size={11} /> Create New Template
                      </button>
                    </div>
                  )}
                  {/* 3D Scene Viewer */}
                  <button className={styles.sectionToggle} onClick={() => setShow3DScene(!show3DScene)}>
                    <Box size={12} />
                    3D Scene
                    {show3DScene ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                  {show3DScene && (
                    <div className={styles.templatePanel}>
                      <ThreeDViewer width={700} height={380} />
                    </div>
                  )}

                  {/* Module Categories */}
                  <div id="module-badges-row" className={styles.moduleCategories}>
                    {[
                      { icon: <Sparkles size={12} />, name: 'Generate', items: ['Image', 'Video', 'Music', 'SFX', 'TTS', 'Upscale', 'Inpaint', 'Outpaint', 'Style', 'Img2Img', 'Script', 'Storyboard', 'Embedding', 'Interpolate', 'ControlNet', 'Model Loader', 'CLIP Encode', 'VAE Decode', 'LoRA', 'Model Mgr'] },
                      { icon: <Wand2 size={12} />, name: 'Edit', items: ['Crop', 'Resize', 'Rotate', 'Flip', 'Color', 'Filter', 'Blend', 'Mask', 'BG Remove', 'Transition', 'Audio Mix', 'Video Trim', 'Subtitle Burn', 'Audio Duck', 'Drawing', 'Composition', 'Pad', 'Deform'] },
                      { icon: <Box size={12} />, name: '3D / Spatial', items: ['Render 3D', 'Load Scene', 'Animate', 'Lighting', 'Camera Rig', 'Depth Parallax', 'Splat View', 'Mannequin', '3D Video', 'New Angle'] },
                      { icon: <BrainCircuit size={12} />, name: 'Intelligence', items: ['Auto Tag', 'Segment', 'Faces', 'Emotion', 'Character', 'Prompt→Img', 'Script→Prompts', 'Magic Cut', 'Geo Image', 'Replace', 'Evolution', 'Scene Illus.', 'Location Lib', 'Story Mgr', 'Time+Space', 'States+Vars', 'Perf Profiler'] },
                      { icon: <Layers size={12} />, name: 'Assembly', items: ['Compose', 'Assemble', 'Timeline', 'Captions', 'Comic', 'Auto Group', 'Workflow I/O', 'Templates', 'Node Group', 'Illus→Video', 'Timeline Conv'] },
                      { icon: <Download size={12} />, name: 'Ingest', items: ['Import File', 'Import URL', 'Decode All', 'Metadata', 'Thumbnail', 'Palette', 'Waveform', 'Filmstrip', '3D Import', 'Zip Extract'] },
                      { icon: <Send size={12} />, name: 'Publish', items: ['Instagram', 'YouTube', 'TikTok', 'X', 'Export', 'Schedule', 'Apply Format', 'Save+Preview', 'Twitter'] },
                    ].map(cat => (
                      <div key={cat.name} className={styles.moduleCat}>
                        <button className={styles.moduleCatHeader} onClick={() => {
                          const recent = useProjectsStore.getState().projects[0];
                          if (recent) router.push(`/project/${recent.id}`);
                          else setTriggerNewProject(k => k + 1);
                        }}>
                          {cat.icon} {cat.name}
                        </button>
                        <div className={styles.moduleCatItems}>
                          {cat.items.map(item => (
                            <button key={item} className={styles.moduleBadge} onClick={() => {
                              const recent = useProjectsStore.getState().projects[0];
                              if (recent) router.push(`/project/${recent.id}`);
                              else setTriggerNewProject(k => k + 1);
                            }}>
                              {item}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}

export default DashboardLayout;
