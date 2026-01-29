import React, { useCallback, useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize2,
  Plus,
  Minus,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { useCanvasStore, useLogStore } from '@/stores';
import styles from './Timeline.module.css';

interface TimelineProps {
  height: number;
}

export const Timeline: React.FC<TimelineProps> = ({ height }) => {
  const items = useCanvasStore((s) => s.items);
  const log = useLogStore((s) => s.log);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration] = useState(30); // 30 seconds default
  const [zoom, setZoom] = useState(1);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const frames = Math.floor((seconds % 1) * 24); // 24fps
    return `${mins.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = useCallback(() => {
    setIsPlaying(!isPlaying);
    log('canvas_move', isPlaying ? 'Paused playback' : 'Started playback');
  }, [isPlaying, log]);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    setCurrentTime(percent * duration);
  }, [duration]);

  const playheadPosition = (currentTime / duration) * 100;

  return (
    <div className={styles.timeline} style={{ height }}>
      {/* Transport controls */}
      <div className={styles.transport}>
        <div className={styles.transportControls}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentTime(0)}
            title="Go to start"
          >
            <SkipBack size={14} />
          </Button>
          <Button
            variant={isPlaying ? 'secondary' : 'primary'}
            size="sm"
            onClick={handlePlayPause}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentTime(duration)}
            title="Go to end"
          >
            <SkipForward size={14} />
          </Button>
        </div>

        <div className={styles.timecode}>
          <span className={styles.currentTime}>{formatTime(currentTime)}</span>
          <span className={styles.separator}>/</span>
          <span className={styles.duration}>{formatTime(duration)}</span>
        </div>

        <div className={styles.transportRight}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMuted(!isMuted)}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </Button>
          <div className={styles.zoomControls}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
              title="Zoom out"
            >
              <Minus size={12} />
            </Button>
            <span className={styles.zoomLevel}>{Math.round(zoom * 100)}%</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setZoom(Math.min(4, zoom + 0.25))}
              title="Zoom in"
            >
              <Plus size={12} />
            </Button>
          </div>
        </div>
      </div>

      {/* Timeline ruler */}
      <div className={styles.ruler}>
        <div className={styles.rulerContent} style={{ transform: `scaleX(${zoom})` }}>
          {Array.from({ length: Math.ceil(duration) + 1 }).map((_, i) => (
            <div key={i} className={styles.rulerMark} style={{ left: `${(i / duration) * 100}%` }}>
              <span>{i}s</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tracks area */}
      <div className={styles.tracks} onClick={handleSeek}>
        {/* Video track */}
        <div className={styles.track}>
          <div className={styles.trackHeader}>
            <span className={styles.trackLabel}>V1</span>
          </div>
          <div className={styles.trackContent} style={{ transform: `scaleX(${zoom})` }}>
            {items
              .filter((item) => item.type === 'image' || item.type === 'generated')
              .map((item, index) => (
                <div
                  key={item.id}
                  className={styles.clip}
                  style={{
                    left: `${(index * 5) % 80}%`,
                    width: '15%',
                  }}
                  title={item.name}
                >
                  {item.src && (
                    <img src={item.src} alt="" className={styles.clipThumb} />
                  )}
                  <span className={styles.clipName}>{item.name}</span>
                </div>
              ))}
          </div>
        </div>

        {/* Audio track placeholder */}
        <div className={styles.track}>
          <div className={styles.trackHeader}>
            <span className={styles.trackLabel}>A1</span>
          </div>
          <div className={styles.trackContent}>
            <div className={styles.emptyTrack}>
              <span>Drop audio files here</span>
            </div>
          </div>
        </div>

        {/* Playhead */}
        <div
          className={styles.playhead}
          style={{ left: `calc(60px + ${playheadPosition}% * (100% - 60px) / 100)` }}
        >
          <div className={styles.playheadHead} />
          <div className={styles.playheadLine} />
        </div>
      </div>
    </div>
  );
};
