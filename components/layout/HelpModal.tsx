import React from 'react';
import { X } from 'lucide-react';
import styles from './HelpModal.module.css';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Help</h2>
          <button type="button" className={styles.closeButton} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.body}>
          <section className={styles.section}>
            <h3>Creative process</h3>
            <p className={styles.description}>
              Ars Technic AI is built around four modes that match how you work:
            </p>
            <ul className={styles.list}>
              <li>
                <strong>Create</strong> — Generate new images from prompts. Add assets to the canvas and iterate.
              </li>
              <li>
                <strong>Rework</strong> — Edit or vary existing images. Select an asset and refine with new prompts.
              </li>
              <li>
                <strong>Composite</strong> — Arrange and layer assets on the canvas. Resize, reorder, and combine.
              </li>
              <li>
                <strong>Timeline</strong> — Work with sequences and motion. Plan shots and export sequences.
              </li>
            </ul>
          </section>

          <section className={styles.section}>
            <h3>Keyboard shortcuts</h3>
            <div className={styles.shortcuts}>
              <div className={styles.shortcut}>
                <span>Open Settings</span>
                <kbd>⌘ ,</kbd>
              </div>
              <div className={styles.shortcut}>
                <span>Toggle Explorer</span>
                <kbd>⌘ 1</kbd>
              </div>
              <div className={styles.shortcut}>
                <span>Toggle Timeline</span>
                <kbd>⌘ 2</kbd>
              </div>
              <div className={styles.shortcut}>
                <span>Toggle Inspector</span>
                <kbd>⌘ 3</kbd>
              </div>
              <div className={styles.shortcut}>
                <span>Delete selected</span>
                <kbd>⌫</kbd>
              </div>
              <div className={styles.shortcut}>
                <span>Copy</span>
                <kbd>⌘ C</kbd>
              </div>
              <div className={styles.shortcut}>
                <span>Paste</span>
                <kbd>⌘ V</kbd>
              </div>
              <div className={styles.shortcut}>
                <span>Select all</span>
                <kbd>⌘ A</kbd>
              </div>
              <div className={styles.shortcut}>
                <span>Zoom in</span>
                <kbd>+</kbd>
              </div>
              <div className={styles.shortcut}>
                <span>Zoom out</span>
                <kbd>-</kbd>
              </div>
              <div className={styles.shortcut}>
                <span>Reset view</span>
                <kbd>0</kbd>
              </div>
              <div className={styles.shortcut}>
                <span>New project</span>
                <kbd>⌘ N</kbd>
              </div>
              <div className={styles.shortcut}>
                <span>Open project</span>
                <kbd>⌘ O</kbd>
              </div>
              <div className={styles.shortcut}>
                <span>Save project</span>
                <kbd>⌘ S</kbd>
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <h3>Know-how</h3>
            <ul className={styles.list}>
              <li>Use the <strong>Explorer</strong> to manage files and generated assets. Drag items onto the canvas.</li>
              <li>Use the <strong>Inspector</strong> to edit prompts, run variations, and adjust properties of the selected asset.</li>
              <li>Projects are saved locally. Use <strong>Save Project</strong> from the project menu to export a <code>.arstechnic</code> file.</li>
              <li>Configure your API key in <strong>Settings</strong> (gear icon or ⌘ ,) to enable image generation.</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
};
