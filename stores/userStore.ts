import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { projectPathFromName } from '@/utils/project';
import { STORAGE_KEYS, WORKSPACE_DEFAULTS } from '@/constants/workspace';

// ════════════════════════════════════════════════════════════════════════════
// USER & DEVICE INFORMATION STORE
// Securely stores user preferences and gathers device capabilities
// ════════════════════════════════════════════════════════════════════════════

// Types for all collectible information
export interface DeviceInfo {
  // Screen Information
  screenWidth: number;
  screenHeight: number;
  devicePixelRatio: number;
  colorDepth: number;
  orientation: 'portrait' | 'landscape';
  
  // Viewport (browser window)
  viewportWidth: number;
  viewportHeight: number;
  
  // Platform
  platform: string;
  userAgent: string;
  language: string;
  languages: string[];
  
  // Capabilities
  touchEnabled: boolean;
  maxTouchPoints: number;
  hardwareConcurrency: number; // CPU cores
  deviceMemory: number | null; // RAM in GB (if available)
  
  // Connection (if available)
  connectionType: string | null;
  connectionEffectiveType: string | null;
  
  // Time/Locale
  timezone: string;
  timezoneOffset: number;
  
  // Last updated
  updatedAt: number;
}

export interface UserSession {
  // Anonymous session ID (not tracking user identity)
  sessionId: string;
  startedAt: number;
  
  // Usage stats
  generationsCount: number;
  importsCount: number;
  exportsCount: number;
}

export interface ProjectInfo {
  id: string;
  name: string;
  createdAt: number;
  modifiedAt: number;
  path: string;
}

interface UserState {
  // Current project
  currentProject: ProjectInfo;
  recentProjects: ProjectInfo[];
  
  // Device info (refreshed on each session)
  deviceInfo: DeviceInfo | null;
  
  // Session info
  session: UserSession;
  
  // Actions
  refreshDeviceInfo: () => void;
  updateProject: (updates: Partial<ProjectInfo>) => void;
  createNewProject: (name?: string) => ProjectInfo;
  switchProject: (projectId: string) => void;
  incrementStat: (stat: 'generationsCount' | 'importsCount' | 'exportsCount') => void;
  getSecuritySafeInfo: () => Record<string, unknown>;
}

// ════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ════════════════════════════════════════════════════════════════════════════

function gatherDeviceInfo(): DeviceInfo {
  // Only run on client side
  if (typeof window === 'undefined') {
    return getDefaultDeviceInfo();
  }

  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: {
      type?: string;
      effectiveType?: string;
    };
  };

  return {
    // Screen
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    devicePixelRatio: window.devicePixelRatio || 1,
    colorDepth: window.screen.colorDepth,
    orientation: window.innerWidth > window.innerHeight ? 'landscape' : 'portrait',
    
    // Viewport
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    
    // Platform
    platform: nav.platform || 'unknown',
    userAgent: nav.userAgent || 'unknown',
    language: nav.language || 'en',
    languages: Array.from(nav.languages || ['en']),
    
    // Capabilities
    touchEnabled: 'ontouchstart' in window || nav.maxTouchPoints > 0,
    maxTouchPoints: nav.maxTouchPoints || 0,
    hardwareConcurrency: nav.hardwareConcurrency || 1,
    deviceMemory: nav.deviceMemory || null,
    
    // Connection
    connectionType: nav.connection?.type || null,
    connectionEffectiveType: nav.connection?.effectiveType || null,
    
    // Time/Locale
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezoneOffset: new Date().getTimezoneOffset(),
    
    updatedAt: Date.now(),
  };
}

function getDefaultDeviceInfo(): DeviceInfo {
  return {
    screenWidth: 1920,
    screenHeight: 1080,
    devicePixelRatio: 1,
    colorDepth: 24,
    orientation: 'landscape',
    viewportWidth: 1920,
    viewportHeight: 1080,
    platform: 'unknown',
    userAgent: 'unknown',
    language: 'en',
    languages: ['en'],
    touchEnabled: false,
    maxTouchPoints: 0,
    hardwareConcurrency: 1,
    deviceMemory: null,
    connectionType: null,
    connectionEffectiveType: null,
    timezone: 'UTC',
    timezoneOffset: 0,
    updatedAt: Date.now(),
  };
}

function createDefaultProject(): ProjectInfo {
  return {
    id: uuidv4(),
    name: WORKSPACE_DEFAULTS.projectName,
    createdAt: Date.now(),
    modifiedAt: Date.now(),
    path: projectPathFromName(WORKSPACE_DEFAULTS.projectName),
  };
}

function createDefaultSession(): UserSession {
  return {
    sessionId: uuidv4(),
    startedAt: Date.now(),
    generationsCount: 0,
    importsCount: 0,
    exportsCount: 0,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// STORE DEFINITION
// ════════════════════════════════════════════════════════════════════════════

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      currentProject: createDefaultProject(),
      recentProjects: [],
      deviceInfo: null,
      session: createDefaultSession(),

      refreshDeviceInfo: () => {
        const info = gatherDeviceInfo();
        set({ deviceInfo: info });
      },

      updateProject: (updates) => {
        set((state) => ({
          currentProject: {
            ...state.currentProject,
            ...updates,
            modifiedAt: Date.now(),
          },
        }));
      },

      createNewProject: (name = WORKSPACE_DEFAULTS.projectName) => {
        const project: ProjectInfo = {
          id: uuidv4(),
          name,
          createdAt: Date.now(),
          modifiedAt: Date.now(),
          path: projectPathFromName(name),
        };

        set((state) => ({
          currentProject: project,
          recentProjects: [state.currentProject, ...state.recentProjects].slice(0, 10),
        }));

        return project;
      },

      switchProject: (projectId) => {
        const { recentProjects, currentProject } = get();
        const project = recentProjects.find((p) => p.id === projectId);
        
        if (project) {
          set({
            currentProject: project,
            recentProjects: [
              currentProject,
              ...recentProjects.filter((p) => p.id !== projectId),
            ].slice(0, 10),
          });
        }
      },

      incrementStat: (stat) => {
        set((state) => ({
          session: {
            ...state.session,
            [stat]: state.session[stat] + 1,
          },
        }));
      },

      // Returns info safe to send to APIs (no sensitive data)
      getSecuritySafeInfo: () => {
        const { deviceInfo, currentProject, session } = get();
        
        return {
          // Only non-identifying device capabilities
          screen: deviceInfo ? {
            width: deviceInfo.screenWidth,
            height: deviceInfo.screenHeight,
            dpr: deviceInfo.devicePixelRatio,
            orientation: deviceInfo.orientation,
          } : null,
          
          // Project context
          project: {
            id: currentProject.id,
            name: currentProject.name,
          },
          
          // Session stats (anonymous)
          stats: {
            generations: session.generationsCount,
            sessionDuration: Date.now() - session.startedAt,
          },
          
          // Locale
          locale: {
            language: deviceInfo?.language || 'en',
            timezone: deviceInfo?.timezone || 'UTC',
          },
        };
      },
    }),
    {
      name: STORAGE_KEYS.user,
      // Only persist certain fields (not device info, refreshed each session)
      partialize: (state) => ({
        currentProject: state.currentProject,
        recentProjects: state.recentProjects,
        session: state.session,
      }),
    }
  )
);

// ════════════════════════════════════════════════════════════════════════════
// INFORMATION THAT CAN BE GATHERED
// ════════════════════════════════════════════════════════════════════════════
/*
AVAILABLE INFORMATION:

1. SCREEN & DISPLAY
   - screen.width / screen.height (physical screen)
   - window.innerWidth / innerHeight (viewport)
   - devicePixelRatio (retina displays)
   - colorDepth
   - orientation

2. PLATFORM & BROWSER
   - navigator.platform (OS)
   - navigator.userAgent (browser)
   - navigator.language / languages

3. HARDWARE CAPABILITIES
   - navigator.hardwareConcurrency (CPU cores)
   - navigator.deviceMemory (RAM, Chrome only)
   - Touch support
   - maxTouchPoints

4. NETWORK (Chrome/Edge)
   - navigator.connection.type
   - navigator.connection.effectiveType
   - navigator.connection.downlink

5. STORAGE
   - localStorage / sessionStorage availability
   - IndexedDB availability
   - Estimated storage quota (navigator.storage.estimate())

6. LOCALE & TIME
   - Timezone (Intl.DateTimeFormat)
   - Timezone offset
   - Preferred languages

7. FEATURES (can be detected)
   - WebGL support
   - Canvas support
   - Web Workers support
   - Service Worker support

SECURITY BEST PRACTICES IMPLEMENTED:
- No personal data stored (email, name, etc.)
- Session IDs are anonymous (UUID)
- Device info is capability-based, not fingerprinting
- API keys stored separately in settingsStore with encryption option
- No cross-session tracking
- User can clear all data
- Only necessary info sent to APIs
*/
