/**
 * ProfileCard Component
 * 
 * User profile with avatar, preferences summary, and preference gathering.
 */

import { useState } from 'react';
import { 
  User, 
  RefreshCw, 
  Trash2, 
  Check, 
  X,
} from 'lucide-react';
import { useProfileStore } from '../../stores';
import { Button } from '../ui';
import styles from './ProfileCard.module.css';

export function ProfileCard() {
  const { 
    profile,
    initializeProfile,
    giveConsent,
    revokeConsent,
    hasConsent,
    startGathering,
    stopGathering,
    isGathering,
    getNextChoice,
    recordChoice,
    skipChoice,
    getProgress,
    getStyleTags,
    resetProfile,
    generateAvatar,
  } = useProfileStore();

  const [showPreferenceGathering, setShowPreferenceGathering] = useState(false);

  // Initialize profile if needed
  if (!profile) {
    return (
      <div className={styles.initCard}>
        <div className={styles.initIcon}>
          <User size={48} />
        </div>
        <h2>Create Your Profile</h2>
        <p>Build a personalized experience by creating your profile and sharing your preferences.</p>
        <Button 
          variant="primary" 
          onClick={() => initializeProfile()}
        >
          Get Started
        </Button>
      </div>
    );
  }

  const progress = getProgress();
  const styleTags = getStyleTags();
  const currentChoice = showPreferenceGathering ? getNextChoice() : null;

  const handleStartGathering = () => {
    if (!hasConsent()) {
      giveConsent();
    }
    startGathering();
    setShowPreferenceGathering(true);
  };

  const handleChoice = (selected: 'A' | 'B') => {
    recordChoice(selected);
  };

  const handleSkip = () => {
    skipChoice();
  };

  const handleStopGathering = () => {
    stopGathering();
    setShowPreferenceGathering(false);
  };

  // Preference Gathering View
  if (showPreferenceGathering && currentChoice) {
    return (
      <div className={styles.gatheringCard}>
        <div className={styles.gatheringHeader}>
          <h2>Refine Your Style</h2>
          <button 
            className={styles.closeButton}
            onClick={handleStopGathering}
          >
            <X size={20} />
          </button>
        </div>

        <p className={styles.gatheringPrompt}>Which do you prefer?</p>

        <div className={styles.choiceGrid}>
          <button 
            className={styles.choiceOption}
            onClick={() => handleChoice('A')}
          >
            <div className={styles.choiceImage}>
              {/* Placeholder for actual images */}
              <div className={styles.imagePlaceholder}>
                <span>Option A</span>
              </div>
            </div>
            <div className={styles.choiceTags}>
              {currentChoice.optionA.tags.slice(0, 3).map((tag) => (
                <span key={tag} className={styles.tag}>{tag}</span>
              ))}
            </div>
          </button>

          <button 
            className={styles.choiceOption}
            onClick={() => handleChoice('B')}
          >
            <div className={styles.choiceImage}>
              <div className={styles.imagePlaceholder}>
                <span>Option B</span>
              </div>
            </div>
            <div className={styles.choiceTags}>
              {currentChoice.optionB.tags.slice(0, 3).map((tag) => (
                <span key={tag} className={styles.tag}>{tag}</span>
              ))}
            </div>
          </button>
        </div>

        <div className={styles.gatheringFooter}>
          <button className={styles.skipButton} onClick={handleSkip}>
            Skip this one
          </button>
          <div className={styles.progressBar}>
            <div 
              className={styles.progressFill} 
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className={styles.progressText}>{progress}% complete</span>
        </div>
      </div>
    );
  }

  // Profile View
  return (
    <div className={styles.profileCard}>
      <div className={styles.columns}>
        {/* Left Column - Profile Info */}
        <div className={styles.profileSection}>
          <div className={styles.avatarSection}>
            {profile.avatar ? (
              <img 
                src={profile.avatar.imageUrl} 
                alt="Avatar" 
                className={styles.avatar}
              />
            ) : (
              <div className={styles.avatarPlaceholder}>
                <User size={48} />
              </div>
            )}
            <div className={styles.avatarInfo}>
              <h2 className={styles.displayName}>
                {profile.displayName || 'Anonymous User'}
              </h2>
              {styleTags.length > 0 && (
                <p className={styles.styleDescription}>
                  Style: {styleTags.join(', ')}
                </p>
              )}
            </div>
          </div>

          <div className={styles.actions}>
            <Button 
              variant="primary" 
              size="sm"
              onClick={handleStartGathering}
            >
              {progress < 30 ? 'Build Your Profile' : 'Refine Preferences'}
            </Button>
            
            {profile.avatar && (
              <Button 
                variant="secondary" 
                size="sm"
                onClick={() => generateAvatar()}
              >
                <RefreshCw size={14} />
                Regenerate Avatar
              </Button>
            )}
          </div>

          {/* Progress */}
          <div className={styles.progressSection}>
            <div className={styles.progressHeader}>
              <span>Profile Completion</span>
              <span>{progress}%</span>
            </div>
            <div className={styles.progressBar}>
              <div 
                className={styles.progressFill} 
                style={{ width: `${progress}%` }}
              />
            </div>
            {progress < 30 && (
              <p className={styles.progressHint}>
                Answer more questions to unlock your personalized avatar
              </p>
            )}
          </div>
        </div>

        {/* Right Column - Preferences Summary */}
        <div className={styles.preferencesSection}>
          <h3 className={styles.sectionTitle}>Your Style Profile</h3>
          
          <div className={styles.preferencesList}>
            {Object.entries(profile.preferences).map(([key, value]) => {
              const keys = Object.keys(value);
              const values = Object.values(value) as number[];
              const dominant = values[0] > values[1] ? keys[0] : keys[1];
              const percentage = Math.round(Math.max(...values) * 100);
              
              return (
                <div key={key} className={styles.preferenceItem}>
                  <div className={styles.preferenceHeader}>
                    <span className={styles.preferenceLabel}>
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                    <span className={styles.preferenceValue}>
                      {dominant} ({percentage}%)
                    </span>
                  </div>
                  <div className={styles.preferenceBar}>
                    <div 
                      className={styles.preferenceBarLeft}
                      style={{ width: `${values[0] * 100}%` }}
                    />
                    <div 
                      className={styles.preferenceBarRight}
                      style={{ width: `${values[1] * 100}%` }}
                    />
                  </div>
                  <div className={styles.preferenceLabels}>
                    <span>{keys[0]}</span>
                    <span>{keys[1]}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className={styles.privacyNote}>
            <Check size={14} />
            <span>Your preferences are stored locally and used only to enhance your experience.</span>
          </div>

          <button 
            className={styles.resetButton}
            onClick={() => {
              if (confirm('Reset all preferences? This cannot be undone.')) {
                resetProfile();
              }
            }}
          >
            <Trash2 size={14} />
            Reset Preferences
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProfileCard;
