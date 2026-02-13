/**
 * Profile Store
 * 
 * Manages user profile, preference learning, and avatar generation.
 * Implements MidJourney-style A/B preference gathering.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { 
  UserProfile, 
  PreferenceScores, 
  PreferenceChoice, 
  PreferenceCategory,
  PreferenceOption,
  UserAvatar 
} from '../types/dashboard';

// ============================================
// DEFAULT PREFERENCES
// ============================================

const DEFAULT_PREFERENCES: PreferenceScores = {
  visualStyle: { realistic: 0.5, stylized: 0.5 },
  colorTemp: { warm: 0.5, cool: 0.5 },
  saturation: { vivid: 0.5, muted: 0.5 },
  composition: { centered: 0.5, dynamic: 0.5 },
  detail: { minimal: 0.5, rich: 0.5 },
  mood: { dramatic: 0.5, calm: 0.5 },
  era: { modern: 0.5, vintage: 0.5 },
};

// ============================================
// SAMPLE PREFERENCE CHOICES
// ============================================

const SAMPLE_CHOICES: Array<{ category: PreferenceCategory; optionA: PreferenceOption; optionB: PreferenceOption }> = [
  {
    category: 'visualStyle',
    optionA: {
      imageUrl: '/preferences/realistic-1.jpg',
      tags: ['photorealistic', 'detailed', 'lifelike'],
      weight: { visualStyle: { key: 'realistic', value: 0.8 } },
    },
    optionB: {
      imageUrl: '/preferences/stylized-1.jpg',
      tags: ['artistic', 'stylized', 'illustrated'],
      weight: { visualStyle: { key: 'stylized', value: 0.8 } },
    },
  },
  {
    category: 'colorTemp',
    optionA: {
      imageUrl: '/preferences/warm-1.jpg',
      tags: ['warm', 'golden', 'sunset'],
      weight: { colorTemp: { key: 'warm', value: 0.8 } },
    },
    optionB: {
      imageUrl: '/preferences/cool-1.jpg',
      tags: ['cool', 'blue', 'twilight'],
      weight: { colorTemp: { key: 'cool', value: 0.8 } },
    },
  },
  {
    category: 'saturation',
    optionA: {
      imageUrl: '/preferences/vivid-1.jpg',
      tags: ['vivid', 'colorful', 'vibrant'],
      weight: { saturation: { key: 'vivid', value: 0.8 } },
    },
    optionB: {
      imageUrl: '/preferences/muted-1.jpg',
      tags: ['muted', 'subtle', 'desaturated'],
      weight: { saturation: { key: 'muted', value: 0.8 } },
    },
  },
  {
    category: 'composition',
    optionA: {
      imageUrl: '/preferences/centered-1.jpg',
      tags: ['centered', 'symmetrical', 'balanced'],
      weight: { composition: { key: 'centered', value: 0.8 } },
    },
    optionB: {
      imageUrl: '/preferences/dynamic-1.jpg',
      tags: ['dynamic', 'rule-of-thirds', 'asymmetric'],
      weight: { composition: { key: 'dynamic', value: 0.8 } },
    },
  },
  {
    category: 'detail',
    optionA: {
      imageUrl: '/preferences/minimal-1.jpg',
      tags: ['minimal', 'clean', 'simple'],
      weight: { detail: { key: 'minimal', value: 0.8 } },
    },
    optionB: {
      imageUrl: '/preferences/rich-1.jpg',
      tags: ['rich', 'detailed', 'complex'],
      weight: { detail: { key: 'rich', value: 0.8 } },
    },
  },
  {
    category: 'mood',
    optionA: {
      imageUrl: '/preferences/dramatic-1.jpg',
      tags: ['dramatic', 'intense', 'moody'],
      weight: { mood: { key: 'dramatic', value: 0.8 } },
    },
    optionB: {
      imageUrl: '/preferences/calm-1.jpg',
      tags: ['calm', 'peaceful', 'serene'],
      weight: { mood: { key: 'calm', value: 0.8 } },
    },
  },
  {
    category: 'era',
    optionA: {
      imageUrl: '/preferences/modern-1.jpg',
      tags: ['modern', 'contemporary', 'futuristic'],
      weight: { era: { key: 'modern', value: 0.8 } },
    },
    optionB: {
      imageUrl: '/preferences/vintage-1.jpg',
      tags: ['vintage', 'retro', 'classic'],
      weight: { era: { key: 'vintage', value: 0.8 } },
    },
  },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function calculateProgress(choiceHistory: PreferenceChoice[]): number {
  // Minimum 10 choices for a basic profile, 30 for refined
  const minChoices = 10;
  const maxChoices = 30;
  const count = choiceHistory.length;
  return Math.min(100, Math.round((count / maxChoices) * 100));
}

function deriveStyleTags(preferences: PreferenceScores): string[] {
  const tags: string[] = [];
  
  // Visual style
  if (preferences.visualStyle.realistic > 0.6) tags.push('Realistic');
  else if (preferences.visualStyle.stylized > 0.6) tags.push('Stylized');
  
  // Color
  if (preferences.colorTemp.warm > 0.6) tags.push('Warm Tones');
  else if (preferences.colorTemp.cool > 0.6) tags.push('Cool Tones');
  
  if (preferences.saturation.vivid > 0.6) tags.push('Vibrant');
  else if (preferences.saturation.muted > 0.6) tags.push('Muted');
  
  // Composition
  if (preferences.composition.centered > 0.6) tags.push('Balanced');
  else if (preferences.composition.dynamic > 0.6) tags.push('Dynamic');
  
  // Detail
  if (preferences.detail.minimal > 0.6) tags.push('Minimalist');
  else if (preferences.detail.rich > 0.6) tags.push('Detailed');
  
  // Mood
  if (preferences.mood.dramatic > 0.6) tags.push('Dramatic');
  else if (preferences.mood.calm > 0.6) tags.push('Calm');
  
  // Era
  if (preferences.era.modern > 0.6) tags.push('Modern');
  else if (preferences.era.vintage > 0.6) tags.push('Vintage');
  
  return tags;
}

// ============================================
// STORE INTERFACE
// ============================================

interface ProfileState {
  profile: UserProfile | null;
  currentSessionId: string | null;
  currentChoiceIndex: number;
  isGathering: boolean;
}

interface ProfileActions {
  // Profile management
  initializeProfile: (displayName?: string, email?: string) => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  resetProfile: () => void;
  deleteProfile: () => void;
  
  // Consent
  giveConsent: () => void;
  revokeConsent: () => void;
  hasConsent: () => boolean;
  
  // Preference gathering
  startGathering: () => void;
  stopGathering: () => void;
  getNextChoice: () => { category: PreferenceCategory; optionA: PreferenceOption; optionB: PreferenceOption } | null;
  recordChoice: (selected: 'A' | 'B') => void;
  skipChoice: () => void;
  
  // Preference calculations
  updatePreferences: (choice: PreferenceChoice) => void;
  getPreferenceScore: (category: PreferenceCategory) => { key1: string; value1: number; key2: string; value2: number };
  getDominantPreference: (category: PreferenceCategory) => string;
  
  // Avatar
  generateAvatar: () => Promise<UserAvatar | null>;
  setAvatar: (avatar: UserAvatar) => void;
  
  // Getters
  getProfile: () => UserProfile | null;
  getProgress: () => number;
  getStyleTags: () => string[];
  getChoiceHistory: () => PreferenceChoice[];
}

type ProfileStore = ProfileState & ProfileActions;

// ============================================
// STORE IMPLEMENTATION
// ============================================

export const useProfileStore = create<ProfileStore>()(
  persist(
    (set, get) => ({
      // Initial state
      profile: null,
      currentSessionId: null,
      currentChoiceIndex: 0,
      isGathering: false,

      // Profile management
      initializeProfile: (displayName, email) => {
        const existingProfile = get().profile;
        if (existingProfile) return;
        
        const newProfile: UserProfile = {
          id: `profile-${Date.now()}`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          displayName,
          email,
          preferences: { ...DEFAULT_PREFERENCES },
          avatar: null,
          choiceHistory: [],
          styleTags: [],
          preferenceGatheringProgress: 0,
          consentGiven: false,
        };
        
        set({ profile: newProfile });
      },

      updateProfile: (updates) => {
        set((state) => {
          if (!state.profile) return state;
          return {
            profile: {
              ...state.profile,
              ...updates,
              updatedAt: Date.now(),
            },
          };
        });
      },

      resetProfile: () => {
        set((state) => {
          if (!state.profile) return state;
          return {
            profile: {
              ...state.profile,
              preferences: { ...DEFAULT_PREFERENCES },
              choiceHistory: [],
              styleTags: [],
              preferenceGatheringProgress: 0,
              updatedAt: Date.now(),
            },
            currentChoiceIndex: 0,
          };
        });
      },

      deleteProfile: () => {
        set({
          profile: null,
          currentSessionId: null,
          currentChoiceIndex: 0,
          isGathering: false,
        });
      },

      // Consent
      giveConsent: () => {
        set((state) => {
          if (!state.profile) return state;
          return {
            profile: {
              ...state.profile,
              consentGiven: true,
              consentTimestamp: Date.now(),
              updatedAt: Date.now(),
            },
          };
        });
      },

      revokeConsent: () => {
        // Revoking consent also resets preferences
        set((state) => {
          if (!state.profile) return state;
          return {
            profile: {
              ...state.profile,
              consentGiven: false,
              consentTimestamp: undefined,
              preferences: { ...DEFAULT_PREFERENCES },
              choiceHistory: [],
              styleTags: [],
              preferenceGatheringProgress: 0,
              updatedAt: Date.now(),
            },
            currentChoiceIndex: 0,
            isGathering: false,
          };
        });
      },

      hasConsent: () => get().profile?.consentGiven ?? false,

      // Preference gathering
      startGathering: () => {
        if (!get().hasConsent()) return;
        
        set({
          currentSessionId: generateSessionId(),
          isGathering: true,
        });
      },

      stopGathering: () => {
        set({
          isGathering: false,
        });
      },

      getNextChoice: () => {
        const { currentChoiceIndex, isGathering } = get();
        if (!isGathering) return null;
        
        // Cycle through sample choices, could be expanded with more variety
        const choiceData = SAMPLE_CHOICES[currentChoiceIndex % SAMPLE_CHOICES.length];
        return choiceData;
      },

      recordChoice: (selected) => {
        const { profile, currentSessionId, currentChoiceIndex, isGathering } = get();
        if (!profile || !currentSessionId || !isGathering) return;
        
        const choiceData = SAMPLE_CHOICES[currentChoiceIndex % SAMPLE_CHOICES.length];
        
        const choice: PreferenceChoice = {
          id: `choice-${Date.now()}`,
          category: choiceData.category,
          optionA: choiceData.optionA,
          optionB: choiceData.optionB,
          selected,
          timestamp: Date.now(),
          sessionId: currentSessionId,
        };
        
        // Update preferences based on choice
        get().updatePreferences(choice);
        
        // Add to history and advance
        set((state) => {
          if (!state.profile) return state;
          
          const newHistory = [...state.profile.choiceHistory, choice];
          const progress = calculateProgress(newHistory);
          const styleTags = deriveStyleTags(state.profile.preferences);
          
          return {
            profile: {
              ...state.profile,
              choiceHistory: newHistory,
              preferenceGatheringProgress: progress,
              styleTags,
              updatedAt: Date.now(),
            },
            currentChoiceIndex: state.currentChoiceIndex + 1,
          };
        });
      },

      skipChoice: () => {
        set((state) => ({
          currentChoiceIndex: state.currentChoiceIndex + 1,
        }));
      },

      // Preference calculations
      updatePreferences: (choice) => {
        set((state) => {
          if (!state.profile) return state;
          
          const selectedOption = choice.selected === 'A' ? choice.optionA : choice.optionB;
          const weight = selectedOption.weight[choice.category];
          
          if (!weight) return state;
          
          const currentPrefs = state.profile.preferences[choice.category];
          if (!currentPrefs) return state;
          
          const keys = Object.keys(currentPrefs);
          if (keys.length < 2) return state;
          
          const key = weight.key;
          const otherKey = keys.find(k => k !== key);
          if (!otherKey || !(key in currentPrefs)) return state;
          
          const typedKey = key as keyof typeof currentPrefs;
          const typedOtherKey = otherKey as keyof typeof currentPrefs;
          
          // Exponential moving average for smooth preference updates
          const alpha = 0.3;
          const newValue = currentPrefs[typedKey] + alpha * (weight.value - currentPrefs[typedKey]);
          const newOtherValue = 1 - newValue;
          
          return {
            profile: {
              ...state.profile,
              preferences: {
                ...state.profile.preferences,
                [choice.category]: {
                  [typedKey]: Math.max(0, Math.min(1, newValue)),
                  [typedOtherKey]: Math.max(0, Math.min(1, newOtherValue)),
                },
              },
              updatedAt: Date.now(),
            },
          };
        });
      },

      getPreferenceScore: (category) => {
        const prefs = get().profile?.preferences[category];
        if (!prefs) {
          const defaultPrefs = DEFAULT_PREFERENCES[category];
          const keys = Object.keys(defaultPrefs);
          return { key1: keys[0], value1: 0.5, key2: keys[1], value2: 0.5 };
        }
        
        const keys = Object.keys(prefs);
        return {
          key1: keys[0],
          value1: prefs[keys[0] as keyof typeof prefs],
          key2: keys[1],
          value2: prefs[keys[1] as keyof typeof prefs],
        };
      },

      getDominantPreference: (category) => {
        const score = get().getPreferenceScore(category);
        return score.value1 > score.value2 ? score.key1 : score.key2;
      },

      // Avatar
      generateAvatar: async () => {
        try {
          const profile = get().profile;
          if (!profile || profile.preferenceGatheringProgress < 30) {
            return null;
          }
          
          // In a real implementation, this would call an AI model
          // For now, create a placeholder avatar
          const avatar: UserAvatar = {
            imageUrl: '', // Would be generated by AI backend
            style: profile.styleTags.join(', '),
            generatedAt: Date.now(),
            seed: Math.random().toString(36).substring(2),
            preferences: profile.preferences,
          };
          
          set((state) => {
            if (!state.profile) return state;
            return {
              profile: {
                ...state.profile,
                avatar,
                updatedAt: Date.now(),
              },
            };
          });
          
          return avatar;
        } catch (error) {
          console.error('Avatar generation failed:', error);
          return null;
        }
      },

      setAvatar: (avatar) => {
        set((state) => {
          if (!state.profile) return state;
          return {
            profile: {
              ...state.profile,
              avatar,
              updatedAt: Date.now(),
            },
          };
        });
      },

      // Getters
      getProfile: () => get().profile,
      getProgress: () => get().profile?.preferenceGatheringProgress ?? 0,
      getStyleTags: () => get().profile?.styleTags ?? [],
      getChoiceHistory: () => get().profile?.choiceHistory ?? [],
    }),
    {
      name: 'ars-technicai-profile',
      version: 1,
    }
  )
);
