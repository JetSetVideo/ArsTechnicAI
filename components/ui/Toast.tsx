import React, { useEffect, useState } from 'react';
import { X, AlertCircle, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { useToastStore, type Toast as ToastType, type ToastType as ToastVariant } from '@/stores';
import styles from './Toast.module.css';

const icons: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle2 size={20} />,
  error: <AlertCircle size={20} />,
  warning: <AlertTriangle size={20} />,
  info: <Info size={20} />,
};

interface ToastItemProps {
  toast: ToastType;
  onRemove: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onRemove }) => {
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!toast.duration) return;

    const startTime = Date.now();
    const endTime = startTime + toast.duration;

    const updateProgress = () => {
      const now = Date.now();
      const remaining = Math.max(0, endTime - now);
      const newProgress = (remaining / toast.duration!) * 100;
      setProgress(newProgress);

      if (newProgress > 0) {
        requestAnimationFrame(updateProgress);
      }
    };

    requestAnimationFrame(updateProgress);
  }, [toast.duration]);

  const handleRemove = () => {
    setIsExiting(true);
    setTimeout(() => {
      onRemove(toast.id);
    }, 200); // Match animation duration
  };

  return (
    <div
      className={`${styles.toast} ${styles[toast.type]} ${isExiting ? styles.exiting : ''}`}
      role="alert"
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
    >
      <div className={styles.iconWrapper}>
        {icons[toast.type]}
      </div>
      
      <div className={styles.content}>
        <div className={styles.title}>{toast.title}</div>
        <div className={styles.message}>{toast.message}</div>
        
        {toast.action && (
          <button
            type="button"
            className={styles.actionButton}
            onClick={() => {
              toast.action!.onClick();
              handleRemove();
            }}
          >
            {toast.action.label}
          </button>
        )}
      </div>

      <button
        type="button"
        className={styles.closeButton}
        onClick={handleRemove}
        aria-label="Dismiss notification"
      >
        <X size={16} />
      </button>

      {toast.duration && (
        <div
          className={styles.progressBar}
          style={{ width: `${progress}%` }}
        />
      )}
    </div>
  );
};

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className={styles.container} aria-label="Notifications">
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onRemove={removeToast}
        />
      ))}
    </div>
  );
};

// Helper hook for common toast patterns in generation flow
export function useGenerationToasts() {
  const toast = useToastStore();

  return {
    showMissingApiKey: (openSettings?: () => void) => {
      toast.error(
        'API Key Required',
        'Please add your Google Nano Banana API key in Settings',
        openSettings ? undefined : 8000 // Persistent if action available
      );
    },

    showEmptyPrompt: () => {
      toast.warning(
        'Prompt Required',
        'Please describe the image you want to generate.',
        5000
      );
    },

    showGenerationStarted: (prompt: string) => {
      toast.info(
        'Generation Started',
        `Creating: "${prompt.slice(0, 50)}${prompt.length > 50 ? '...' : ''}"`,
        3000
      );
    },

    showGenerationComplete: (filename: string) => {
      toast.success(
        'Image Generated',
        `Successfully created: ${filename}`,
        5000
      );
    },

    showGenerationError: (errorMessage: string) => {
      toast.error(
        'Generation Failed',
        errorMessage,
        8000
      );
    },

    showNetworkError: () => {
      toast.error(
        'Connection Error',
        'Unable to reach the API. Please check your internet connection.',
        8000
      );
    },

    showRateLimited: () => {
      toast.warning(
        'Rate Limited',
        'Too many requests. Please wait a moment before trying again.',
        6000
      );
    },

    showInvalidApiKey: () => {
      toast.error(
        'Invalid API Key',
        'Your API key is invalid or expired. Please update it in Settings.',
        8000
      );
    },
  };
}
