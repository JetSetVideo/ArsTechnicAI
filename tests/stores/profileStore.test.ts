/**
 * Profile Store Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useProfileStore } from '../../stores/profileStore';

describe('profileStore', () => {
  beforeEach(() => {
    useProfileStore.setState(useProfileStore.getInitialState());
  });

  describe('initial state', () => {
    it('should have no profile initially', () => {
      expect(useProfileStore.getState().profile).toBeNull();
    });

    it('should not be gathering', () => {
      expect(useProfileStore.getState().isGathering).toBe(false);
    });
  });

  describe('initializeProfile', () => {
    it('should create a new profile with defaults', () => {
      useProfileStore.getState().initializeProfile('John', 'john@test.com');
      
      const profile = useProfileStore.getState().profile;
      expect(profile).not.toBeNull();
      expect(profile!.displayName).toBe('John');
      expect(profile!.email).toBe('john@test.com');
      expect(profile!.consentGiven).toBe(false);
      expect(profile!.preferenceGatheringProgress).toBe(0);
      expect(profile!.avatar).toBeNull();
    });

    it('should not overwrite existing profile', () => {
      useProfileStore.getState().initializeProfile('John');
      useProfileStore.getState().initializeProfile('Jane');
      
      expect(useProfileStore.getState().profile!.displayName).toBe('John');
    });
  });

  describe('consent', () => {
    it('should give consent and set timestamp', () => {
      useProfileStore.getState().initializeProfile();
      useProfileStore.getState().giveConsent();
      
      const profile = useProfileStore.getState().profile;
      expect(profile!.consentGiven).toBe(true);
      expect(profile!.consentTimestamp).toBeGreaterThan(0);
    });

    it('should revoke consent and reset preferences', () => {
      useProfileStore.getState().initializeProfile();
      useProfileStore.getState().giveConsent();
      useProfileStore.getState().revokeConsent();
      
      const profile = useProfileStore.getState().profile;
      expect(profile!.consentGiven).toBe(false);
      expect(profile!.choiceHistory.length).toBe(0);
      expect(profile!.preferenceGatheringProgress).toBe(0);
    });

    it('hasConsent should reflect current state', () => {
      useProfileStore.getState().initializeProfile();
      expect(useProfileStore.getState().hasConsent()).toBe(false);
      
      useProfileStore.getState().giveConsent();
      expect(useProfileStore.getState().hasConsent()).toBe(true);
    });
  });

  describe('preference gathering', () => {
    beforeEach(() => {
      useProfileStore.getState().initializeProfile();
      useProfileStore.getState().giveConsent();
    });

    it('should start and stop gathering', () => {
      useProfileStore.getState().startGathering();
      expect(useProfileStore.getState().isGathering).toBe(true);
      expect(useProfileStore.getState().currentSessionId).not.toBeNull();
      
      useProfileStore.getState().stopGathering();
      expect(useProfileStore.getState().isGathering).toBe(false);
    });

    it('should not start gathering without consent', () => {
      useProfileStore.getState().revokeConsent();
      useProfileStore.getState().startGathering();
      expect(useProfileStore.getState().isGathering).toBe(false);
    });

    it('should return a next choice when gathering', () => {
      useProfileStore.getState().startGathering();
      const choice = useProfileStore.getState().getNextChoice();
      expect(choice).not.toBeNull();
      expect(choice).toHaveProperty('category');
      expect(choice).toHaveProperty('optionA');
      expect(choice).toHaveProperty('optionB');
    });

    it('should return null when not gathering', () => {
      expect(useProfileStore.getState().getNextChoice()).toBeNull();
    });

    it('should record a choice and update progress', () => {
      useProfileStore.getState().startGathering();
      useProfileStore.getState().recordChoice('A');
      
      const profile = useProfileStore.getState().profile;
      expect(profile!.choiceHistory.length).toBe(1);
      expect(profile!.preferenceGatheringProgress).toBeGreaterThan(0);
    });

    it('should advance choice index on skip', () => {
      useProfileStore.getState().startGathering();
      const initialIndex = useProfileStore.getState().currentChoiceIndex;
      
      useProfileStore.getState().skipChoice();
      expect(useProfileStore.getState().currentChoiceIndex).toBe(initialIndex + 1);
    });
  });

  describe('updateProfile', () => {
    it('should update profile fields', () => {
      useProfileStore.getState().initializeProfile();
      useProfileStore.getState().updateProfile({ displayName: 'Updated Name' });
      
      expect(useProfileStore.getState().profile!.displayName).toBe('Updated Name');
    });

    it('should not update if no profile exists', () => {
      useProfileStore.getState().updateProfile({ displayName: 'Test' });
      expect(useProfileStore.getState().profile).toBeNull();
    });
  });

  describe('resetProfile', () => {
    it('should reset preferences but keep profile', () => {
      useProfileStore.getState().initializeProfile('John');
      useProfileStore.getState().giveConsent();
      useProfileStore.getState().startGathering();
      useProfileStore.getState().recordChoice('A');
      
      useProfileStore.getState().resetProfile();
      
      const profile = useProfileStore.getState().profile;
      expect(profile).not.toBeNull();
      expect(profile!.choiceHistory.length).toBe(0);
      expect(profile!.preferenceGatheringProgress).toBe(0);
    });
  });

  describe('deleteProfile', () => {
    it('should remove the profile entirely', () => {
      useProfileStore.getState().initializeProfile();
      useProfileStore.getState().deleteProfile();
      
      expect(useProfileStore.getState().profile).toBeNull();
      expect(useProfileStore.getState().isGathering).toBe(false);
    });
  });

  describe('getProgress / getStyleTags', () => {
    it('should return 0 with no profile', () => {
      expect(useProfileStore.getState().getProgress()).toBe(0);
      expect(useProfileStore.getState().getStyleTags()).toEqual([]);
    });
  });

  describe('generateAvatar', () => {
    it('should return null if progress is below 30%', async () => {
      useProfileStore.getState().initializeProfile();
      const result = await useProfileStore.getState().generateAvatar();
      expect(result).toBeNull();
    });
  });
});
