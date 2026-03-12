/**
 * GenerationForm
 *
 * Pure UI component for the image generation form (prompt, negative prompt,
 * dimensions, generate button). State and actions come from useGeneration.
 */

import React from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input, Textarea } from '../ui/Input';
import styles from '../layout/InspectorPanel.module.css';

interface GenerationFormProps {
  prompt: string;
  negativePrompt: string;
  width: number;
  height: number;
  isGenerating: boolean;
  onPromptChange: (value: string) => void;
  onNegativePromptChange: (value: string) => void;
  onDimensionsChange: (w: number, h: number) => void;
  onGenerate: () => void;
}

export const GenerationForm: React.FC<GenerationFormProps> = ({
  prompt,
  negativePrompt,
  width,
  height,
  isGenerating,
  onPromptChange,
  onNegativePromptChange,
  onDimensionsChange,
  onGenerate,
}) => (
  <>
    <div className={styles.formGroup}>
      <Textarea
        label="Prompt"
        placeholder="Describe the image you want to create..."
        value={prompt}
        onChange={(e) => onPromptChange(e.target.value)}
        rows={4}
      />
    </div>

    <div className={styles.formGroup}>
      <Textarea
        label="Negative Prompt (optional)"
        placeholder="What to avoid..."
        value={negativePrompt}
        onChange={(e) => onNegativePromptChange(e.target.value)}
        rows={2}
      />
    </div>

    <div className={styles.formRow}>
      <div className={styles.formGroup}>
        <Input
          label="Width"
          type="number"
          value={width}
          onChange={(e) => onDimensionsChange(parseInt(e.target.value) || 1024, height)}
          min={256}
          max={2048}
          step={64}
        />
      </div>
      <div className={styles.formGroup}>
        <Input
          label="Height"
          type="number"
          value={height}
          onChange={(e) => onDimensionsChange(width, parseInt(e.target.value) || 1024)}
          min={256}
          max={2048}
          step={64}
        />
      </div>
    </div>

    <Button
      variant="primary"
      className={styles.generateButton}
      onClick={onGenerate}
      disabled={!prompt.trim() || isGenerating}
      loading={isGenerating}
      icon={<Sparkles size={16} />}
    >
      {isGenerating ? 'Generating...' : 'Generate'}
    </Button>
  </>
);
