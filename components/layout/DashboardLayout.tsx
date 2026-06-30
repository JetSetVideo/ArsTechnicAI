/**
 * DashboardLayout — Home Page
 *
 * Full-screen creation dashboard. Primary flow:
 *   Prompt → Generate Images → Assemble Video → Publish to Social
 */

import React, { useState, useCallback, useRef, KeyboardEvent } from 'react';
import Link from 'next/link';
import {
  Search,
  UserRound,
  LayoutGrid,
  Image as ImageIcon,
  Sparkles,
  Film,
  Send,
  ChevronDown,
  Zap,
  BrainCircuit,
  Wand2,
  Music,
  Share2,
  Instagram,
  Twitter,
  Youtube,
  Plus,
  Layers,
  Download,
} from 'lucide-react';
import { useRouter } from 'next/router';
import styles from './DashboardLayout.module.css';
import { Button } from '../ui';
import { ConnectionBanner } from '../ui/ConnectionBanner';
import { SettingsModal } from './SettingsModal';
import { useProjectSync, saveProjectWorkspaceState } from '../../hooks/useProjectSync';
import { useSettingsStore } from '../../stores/settingsStore';
import { useUserStore } from '../../stores/userStore';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { useProjectsStore } from '../../stores/projectsStore';
import { ProjectsGrid } from '../dashboard';
import { AssetsGrid } from '../dashboard/AssetsGrid';

type SettingsTab = 'account' | 'api' | 'appearance' | 'shortcuts' | 'help' | 'about' | 'publishing' | 'usage';
type MainTab = 'projects' | 'assets';
type Platform = 'tiktok' | 'instagram' | 'youtube' | 'twitter';

const PLATFORMS: { id: Platform; label: string; icon: React.ReactNode; ratio: string }[] = [
  { id: 'tiktok',     label: 'TikTok',     icon: <Film size={13} />,      ratio: '9:16' },
  { id: 'instagram',  label: 'Instagram',  icon: <Instagram size={13} />, ratio: '1:1'  },
  { id: 'youtube',    label: 'YouTube',    icon: <Youtube size={13} />,   ratio: '16:9' },
  { id: 'twitter',    label: 'Twitter/X',  icon: <Twitter size={13} />,   ratio: '16:9' },
];

const AI_STYLES = [
  'Photorealistic', 'Cinematic', 'Anime', 'Oil Painting',
  'Watercolor', 'Pixel Art', 'Sketch', 'Neon Cyberpunk',
  'Fantasy', 'Minimalist',
];

export function DashboardLayout() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [mainTab, setMainTab] = useState<MainTab>('projects');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('account');

  // Quick-create state
  const [prompt, setPrompt] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>('tiktok');
  const [selectedStyle, setSelectedStyle] = useState('Cinematic');
  const [styleDropOpen, setStyleDropOpen] = useState(false);
  const [imageCount, setImageCount] = useState(4);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  const { openProjectFromDashboard } = useProjectSync();
  const currentProject = useUserStore((s) => s.currentProject);
  const health = useTelemetryStore((s) => s.health);
  const addProject = useProjectsStore((s) => s.addProject);

  const handleOpenProject = useCallback(
    (projectId: string) => {
      void saveProjectWorkspaceState(currentProject.id, currentProject.name);
      openProjectFromDashboard(projectId);
      router.push(`/project/${projectId}`);
    },
    [router, currentProject.id, currentProject.name, openProjectFromDashboard]
  );

  // Generation result state
  const [generatedImages, setGeneratedImages] = useState<Array<{
    id: string; dataUrl: string; prompt: string; seed?: number; assetId?: string; createdAt: number;
  }>>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [showSaveToProject, setShowSaveToProject] = useState<string | null>(null); // asset id being saved

  const handleQuickCreate = useCallback(async () => {
    if (!prompt.trim()) {
      promptRef.current?.focus();
      return;
    }
    setIsGenerating(true);
    setGenError('');
    
    const genWidth = selectedPlatform === 'tiktok' ? 1080 : selectedPlatform === 'instagram' ? 1080 : 1920;
    const genHeight = selectedPlatform === 'tiktok' ? 1920 : selectedPlatform === 'instagram' ? 1080 : 1080;
    
    const results: typeof generatedImages = [];
    
    for (let i = 0; i < imageCount; i++) {
      try {
        // Read API key from settings if available
        let apiKey = '';
        try {
          const raw = localStorage.getItem('ars-settings-store');
          if (raw) {
            const parsed = JSON.parse(raw);
            apiKey = parsed?.state?.settings?.aiProvider?.apiKey || '';
          }
        } catch { /* no settings */ }
        
        // If no API key, use placeholder mode (server generates SVG placeholder)
        const body: Record<string, unknown> = {
          prompt: `${prompt} — ${selectedStyle} style`,
          width: genWidth, height: genHeight,
        };
        if (apiKey) body.apiKey = apiKey;
        
        const resp = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        
        const json = await resp.json();
        
        if (json.dataUrl) {
          results.push({
            id: `gen-${Date.now()}-${i}`,
            dataUrl: json.dataUrl,
            prompt: prompt,
            seed: json.seed,
            assetId: json.assetId,
            createdAt: Date.now(),
          });
        } else if (json.error) {
          setGenError(json.error);
        }
      } catch (err) {
        setGenError(err instanceof Error ? err.message : 'Generation failed');
      }
    }
    
    setGeneratedImages(prev => [...results, ...prev]);
    setIsGenerating(false);
  }, [prompt, selectedStyle, selectedPlatform, imageCount]);

  const handlePromptKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleQuickCreate();
    }
  };

  const connectedClass =
    health?.status === 'ok'
      ? styles.avatarConnected
      : health?.status === 'error' || health?.status === 'degraded'
        ? styles.avatarDisconnected
        : '';

  const currentPlatform = PLATFORMS.find((p) => p.id === selectedPlatform)!;

  return (
    <div id="dashboard-layout-root-page-region" className={styles.root}>
      <ConnectionBanner />

      {/* ── Compact Top Bar ── */}
      <header className={styles.topBar}>
        <Link href="/home" className={styles.brand} title="Dashboard Home">
          <span className={styles.brandArs}>Ars</span>
          <span className={styles.brandTechnic}>Technic</span>
          <span className={styles.brandAI}>AI</span>
        </Link>

        <div className={styles.searchBox}>
          <Search size={14} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search projects, assets, prompts…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <div className={styles.topBarRight}>
          <button
            className={styles.avatarBtn}
            onClick={() => { setSettingsTab('account'); setSettingsOpen(true); }}
            title="Account & Settings"
          >
            <div className={`${styles.avatar} ${connectedClass}`}>
              <UserRound size={13} />
            </div>
          </button>
        </div>
      </header>

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} defaultTab={settingsTab} />

      {/* ── Creation Hero ── */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>

          {/* Platform selector row */}
          <div className={styles.platformRow}>
            <span className={styles.platformLabel}>Target platform</span>
            <div className={styles.platformTabs}>
              {PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  className={`${styles.platformTab} ${selectedPlatform === p.id ? styles.platformTabActive : ''}`}
                  onClick={() => setSelectedPlatform(p.id)}
                >
                  {p.icon}
                  {p.label}
                  <span className={styles.platformRatio}>{p.ratio}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Prompt area */}
          <div className={styles.promptGroup}>
            <div className={styles.promptWrap}>
              <textarea
                ref={promptRef}
                className={styles.promptInput}
                placeholder={`Describe what you want to create for ${currentPlatform.label}… (⌘↵ to generate)`}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handlePromptKeyDown}
                rows={3}
              />
              <button
                className={styles.generateBtn}
                onClick={handleQuickCreate}
                disabled={!prompt.trim() || isGenerating}
              >
                <Sparkles size={16} />
                {isGenerating ? 'Generating...' : 'Generate'}
              </button>
            </div>

            {/* Quick controls row */}
            <div className={styles.promptControls}>
              {/* Style picker */}
              <div className={styles.controlGroup}>
                <button
                  className={styles.controlBtn}
                  onClick={() => setStyleDropOpen((v) => !v)}
                >
                  <Wand2 size={13} />
                  {selectedStyle}
                  <ChevronDown size={12} />
                </button>
                {styleDropOpen && (
                  <div className={styles.styleDropdown}>
                    {AI_STYLES.map((s) => (
                      <button
                        key={s}
                        className={`${styles.styleOption} ${selectedStyle === s ? styles.styleOptionActive : ''}`}
                        onClick={() => { setSelectedStyle(s); setStyleDropOpen(false); }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Image count */}
              <div className={styles.controlGroup}>
                <span className={styles.controlLabel}>Images</span>
                {[1, 2, 4, 8].map((n) => (
                  <button
                    key={n}
                    className={`${styles.countBtn} ${imageCount === n ? styles.countBtnActive : ''}`}
                    onClick={() => setImageCount(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>

              {/* Pipeline hint */}
              <div className={styles.pipeline}>
                <span className={styles.pipelineStep} data-active="true">
                  <BrainCircuit size={11} /> Prompt
                </span>
                <span className={styles.pipelineArrow}>→</span>
                <span className={styles.pipelineStep}>
                  <ImageIcon size={11} /> Images ×{imageCount}
                </span>
                <span className={styles.pipelineArrow}>→</span>
                <span className={styles.pipelineStep}>
                  <Film size={11} /> Video
                </span>
                <span className={styles.pipelineArrow}>→</span>
                <span className={styles.pipelineStep}>
                  <Share2 size={11} /> {currentPlatform.label} ({currentPlatform.ratio})
                </span>
              </div>
              {selectedPlatform === 'tiktok' && <div className={styles.formatHint}>1080×1920 (9:16) • up to 3 min</div>}
              {selectedPlatform === 'instagram' && <div className={styles.formatHint}>1080×1080 (1:1) • up to 60s</div>}
              {selectedPlatform === 'youtube' && <div className={styles.formatHint}>1920×1080 (16:9) • any duration</div>}
              {selectedPlatform === 'twitter' && <div className={styles.formatHint}>1920×1080 (16:9) • up to 2:20</div>}
            </div>
          </div>

          {/* Full Module Categories */}
          <div className={styles.moduleCategories}>
            {/* Generate */}
            <div className={styles.moduleCat}>
              <div className={styles.moduleCatHeader}>
                <Sparkles size={14} /> Generate
              </div>
              <div className={styles.moduleCatItems}>
                <span className={styles.moduleBadge}><ImageIcon size={10} /> Image</span>
                <span className={styles.moduleBadge}><Film size={10} /> Video</span>
                <span className={styles.moduleBadge}><Music size={10} /> Music</span>
                <span className={styles.moduleBadge}><Music size={10} /> SFX</span>
                <span className={styles.moduleBadge}><BrainCircuit size={10} /> TTS</span>
                <span className={styles.moduleBadge}><Wand2 size={10} /> Prompt Enhance</span>
                <span className={styles.moduleBadge}><Zap size={10} /> Upscale</span>
                <span className={styles.moduleBadge}><Sparkles size={10} /> Style Transfer</span>
                <span className={styles.moduleBadge}><ImageIcon size={10} /> Inpaint</span>
                <span className={styles.moduleBadge}><ImageIcon size={10} /> Outpaint</span>
                <span className={styles.moduleBadge}><ImageIcon size={10} /> Image-to-Image</span>
                <span className={styles.moduleBadge}><LayoutGrid size={10} /> Storyboard</span>
                <span className={styles.moduleBadge}><Film size={10} /> Video Interpolate</span>
                <span className={styles.moduleBadge}><BrainCircuit size={10} /> Script</span>
                <span className={styles.moduleBadge}><BrainCircuit size={10} /> Embedding</span>
              </div>
            </div>
            
            {/* Edit */}
            <div className={styles.moduleCat}>
              <div className={styles.moduleCatHeader}>
                <Wand2 size={14} /> Edit
              </div>
              <div className={styles.moduleCatItems}>
                <span className={styles.moduleBadge}>Crop</span>
                <span className={styles.moduleBadge}>Resize</span>
                <span className={styles.moduleBadge}>Rotate</span>
                <span className={styles.moduleBadge}>Flip</span>
                <span className={styles.moduleBadge}>Color Adjust</span>
                <span className={styles.moduleBadge}>Filter</span>
                <span className={styles.moduleBadge}>Blend</span>
                <span className={styles.moduleBadge}>Mask</span>
                <span className={styles.moduleBadge}>Overlay</span>
                <span className={styles.moduleBadge}>Background Remove</span>
                <span className={styles.moduleBadge}>Background Replace</span>
                <span className={styles.moduleBadge}>Deform</span>
                <span className={styles.moduleBadge}>Transition</span>
                <span className={styles.moduleBadge}>Audio Duck</span>
                <span className={styles.moduleBadge}>Audio Trim</span>
                <span className={styles.moduleBadge}>Audio Mix</span>
                <span className={styles.moduleBadge}>Audio Normalize</span>
                <span className={styles.moduleBadge}>Video Trim</span>
                <span className={styles.moduleBadge}>Video Overlay</span>
                <span className={styles.moduleBadge}>Subtitle Burn</span>
              </div>
            </div>
            
            {/* 3D / Spatial */}
            <div className={styles.moduleCat}>
              <div className={styles.moduleCatHeader}>
                <LayoutGrid size={14} /> 3D / Spatial
              </div>
              <div className={styles.moduleCatItems}>
                <span className={styles.moduleBadge}>3D Render</span>
                <span className={styles.moduleBadge}>3D Video Render</span>
                <span className={styles.moduleBadge}>Load Scene</span>
                <span className={styles.moduleBadge}>Camera Rig</span>
                <span className={styles.moduleBadge}>Animate Model</span>
                <span className={styles.moduleBadge}>Lighting</span>
                <span className={styles.moduleBadge}>Depth Parallax</span>
                <span className={styles.moduleBadge}>New Angle</span>
                <span className={styles.moduleBadge}>Splat Camera</span>
              </div>
            </div>
            
            {/* Intelligence */}
            <div className={styles.moduleCat}>
              <div className={styles.moduleCatHeader}>
                <BrainCircuit size={14} /> Intelligence
              </div>
              <div className={styles.moduleCatItems}>
                <span className={styles.moduleBadge}>Auto Tag</span>
                <span className={styles.moduleBadge}>Segment</span>
                <span className={styles.moduleBadge}>Detect Faces</span>
                <span className={styles.moduleBadge}>Facial Emotion</span>
                <span className={styles.moduleBadge}>Geo Image</span>
                <span className={styles.moduleBadge}>Character Consistent</span>
                <span className={styles.moduleBadge}>Character Replace</span>
                <span className={styles.moduleBadge}>Magic Cut</span>
                <span className={styles.moduleBadge}>Script to Shots</span>
                <span className={styles.moduleBadge}>Storyboard from Prompt</span>
              </div>
            </div>
            
            {/* Assembly */}
            <div className={styles.moduleCat}>
              <div className={styles.moduleCatHeader}>
                <Layers size={14} /> Assembly
              </div>
              <div className={styles.moduleCatItems}>
                <span className={styles.moduleBadge}>Canvas Compose</span>
                <span className={styles.moduleBadge}>Layer Composite</span>
                <span className={styles.moduleBadge}>Video Assemble</span>
                <span className={styles.moduleBadge}>Timeline Build</span>
                <span className={styles.moduleBadge}>Comic Layout</span>
                <span className={styles.moduleBadge}>Auto Group</span>
                <span className={styles.moduleBadge}>Add Captions</span>
              </div>
            </div>
            
            {/* Ingest */}
            <div className={styles.moduleCat}>
              <div className={styles.moduleCatHeader}>
                <Download size={14} /> Ingest
              </div>
              <div className={styles.moduleCatItems}>
                <span className={styles.moduleBadge}>Image Decode</span>
                <span className={styles.moduleBadge}>Video Decode</span>
                <span className={styles.moduleBadge}>Audio Decode</span>
                <span className={styles.moduleBadge}>3D Decode</span>
                <span className={styles.moduleBadge}>Text Decode</span>
                <span className={styles.moduleBadge}>Splat Decode</span>
                <span className={styles.moduleBadge}>Extract Metadata</span>
                <span className={styles.moduleBadge}>Extract Palette</span>
                <span className={styles.moduleBadge}>Extract Waveform</span>
                <span className={styles.moduleBadge}>Extract Filmstrip</span>
                <span className={styles.moduleBadge}>Generate Thumbnail</span>
                <span className={styles.moduleBadge}>Import File</span>
                <span className={styles.moduleBadge}>Import URL</span>
                <span className={styles.moduleBadge}>Extract ZIP</span>
              </div>
            </div>
            
            {/* Publish */}
            <div className={styles.moduleCat}>
              <div className={styles.moduleCatHeader}>
                <Send size={14} /> Publish
              </div>
              <div className={styles.moduleCatItems}>
                <span className={styles.moduleBadge}>Apply Format</span>
                <span className={styles.moduleBadge}>Export</span>
                <span className={styles.moduleBadge}>Schedule</span>
                <span className={styles.moduleBadge}><Instagram size={10} /> Instagram</span>
                <span className={styles.moduleBadge}><Youtube size={10} /> YouTube</span>
                <span className={styles.moduleBadge}><Film size={10} /> TikTok</span>
                <span className={styles.moduleBadge}><Twitter size={10} /> X/Twitter</span>
              </div>
            </div>
          </div>

          {/* Generated Images Results */}
          {genError && (
            <div className={styles.genError}>
              ⚠️ {genError}
            </div>
          )}
          {generatedImages.length > 0 && (
            <div className={styles.genResults}>
              <div className={styles.genResultsHeader}>
                <Sparkles size={14} />
                <span>Generated Images ({generatedImages.length})</span>
                <button className={styles.genClearBtn} onClick={() => setGeneratedImages([])}>Clear</button>
              </div>
              <div className={styles.genResultsGrid}>
                {generatedImages.map((img) => (
                  <div key={img.id} className={styles.genResultCard}>
                    <img src={img.dataUrl} alt={img.prompt} className={styles.genResultImg} />
                    <div className={styles.genResultOverlay}>
                      <button
                        className={styles.genResultBtn}
                        onClick={() => {
                          // Create project with the prompt as name (but sanitized)
                          const safeName = img.prompt.slice(0, 40).replace(/[^a-zA-Z0-9 _-]/g, '').trim() || 'Generated Image';
                          const newProject = addProject({ name: safeName, tags: [selectedPlatform] });
                          // Store quick-create params including the pre-generated image data
                          localStorage.setItem('ars:quick-create', JSON.stringify({
                            prompt: img.prompt, style: selectedStyle, imageCount: 1,
                            projectId: newProject.id, prefillDataUrl: img.dataUrl, createdAt: Date.now(),
                          }));
                          void saveProjectWorkspaceState(currentProject.id, currentProject.name);
                          openProjectFromDashboard(newProject.id);
                          router.push(`/project/${newProject.id}?quickcreate=1`);
                        }}
                        title="Open in Editor"
                      >
                        <Wand2 size={12} /> Edit
                      </button>
                      <a href={img.dataUrl} download={`generated-${img.id.slice(0,8)}.png`} className={styles.genResultBtn} title="Download">
                        <Download size={12} /> Save
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Content Tabs ── */}
      <div className={styles.contentBar}>
        <nav className={styles.tabs}>
          <button
            className={`${styles.tab} ${mainTab === 'projects' ? styles.tabActive : ''}`}
            onClick={() => setMainTab('projects')}
          >
            <LayoutGrid size={14} />
            Projects
          </button>
          <button
            className={`${styles.tab} ${mainTab === 'assets' ? styles.tabActive : ''}`}
            onClick={() => setMainTab('assets')}
          >
            <ImageIcon size={14} />
            All Assets
          </button>
        </nav>

        <div className={styles.contentBarRight}>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={14} />}
            onClick={() => {
              // Trigger new project from within ProjectsGrid by URL param
              router.push('/home?new=1');
            }}
          >
            New Project
          </Button>
        </div>
      </div>

      {/* ── Main content ── */}
      <main id="dashboard-layout-main-content-region" className={styles.main}>
        {mainTab === 'projects' ? (
          <ProjectsGrid onOpenProject={handleOpenProject} searchQuery={searchQuery} />
        ) : (
          <AssetsGrid searchQuery={searchQuery} />
        )}
      </main>
    </div>
  );
}

export default DashboardLayout;
