import React, { useEffect, useRef, useState } from 'react';
import { ChevronRight, X } from 'lucide-react';
import { nodeIcon } from './PipelineNodeCard';
import {
  childBoxes,
  menuBridge,
  optionBoxes,
  packWheelSlices,
  wedgeMidAngle,
  wedgePolygon,
  WHEEL_SIZE,
  type MenuSpace,
  type WheelSlice,
} from '@/lib/pipeline/wheelSlices';
import styles from './WorkshopFlow.module.css';

interface Props {
  slices: WheelSlice[];
  style?: React.CSSProperties;
  space?: MenuSpace;
  onPick: (sliceId: string, optionId: string) => void;
  onCancel: () => void;
}

export const ChoiceWheel: React.FC<Props> = ({ slices, style, space, onPick, onCancel }) => {
  const { ring, overflow } = packWheelSlices(slices);
  const shown: WheelSlice[] = overflow.length === 0 ? ring : [
    ...ring,
    { id: '__more', label: 'More', icon: 'boxes', color: '#8a8aa2', options: [] },
  ];
  const [openId, setOpenId] = useState<string | null>(null);
  const [drillId, setDrillId] = useState<string | null>(null);
  const closeTimer = useRef<number | null>(null);
  const holdOpen = () => {
    if (closeTimer.current != null) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const scheduleClose = () => {
    holdOpen();
    closeTimer.current = window.setTimeout(() => {
      setOpenId(null);
      setDrillId(null);
    }, 220);
  };
  useEffect(() => () => holdOpen(), []);
  const count = shown.length;
  const openSlice = shown.find((slice) => slice.id === openId) ?? null;
  const drilled = overflow.find((slice) => slice.id === drillId) ?? null;

  const fan: { id: string; label: string; hint?: string; icon: string; color: string; sliceId: string; optionId: string; drill: string }[] = (() => {
    if (!openSlice) return [];
    if (openSlice.id !== '__more') {
      return openSlice.options.map((option) => ({
        ...option, sliceId: openSlice.id, optionId: option.id, drill: '',
      }));
    }
    return overflow.flatMap((slice) => (
      slice.options.length === 1
        ? [{ ...slice.options[0], sliceId: slice.id, optionId: slice.options[0].id, drill: '' }]
        : [{
            id: slice.id,
            label: slice.label,
            hint: `${slice.options.length} choices`,
            icon: slice.icon,
            color: slice.color,
            sliceId: slice.id,
            optionId: '',
            drill: slice.id,
          }]
    ));
  })();

  return (
    <div
      data-wheel
      className={styles.wheel}
      style={style}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerEnter={holdOpen}
      onPointerLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node)) return;
        scheduleClose();
      }}
    >
      <div className={styles.wheelPlate} />
      {shown.map((slice, index) => {
        const mid = wedgeMidAngle(index, count);
        const open = openId === slice.id;
        return (
          <button
            key={slice.id}
            type="button"
            className={styles.wedge}
            data-open={open ? 'true' : undefined}
            style={{
              clipPath: wedgePolygon(index, count),
              background: `radial-gradient(circle at 50% 50%, color-mix(in srgb, ${slice.color} 58%, transparent) 16%, color-mix(in srgb, ${slice.color} 26%, transparent) 52%, color-mix(in srgb, ${slice.color} 6%, transparent) 74%)`,
              ['--stage-color' as string]: slice.color,
            }}
            title={slice.label}
            onPointerEnter={() => {
              setOpenId(slice.id);
              setDrillId(null);
            }}
            onClick={() => {
              if (slice.id === '__more') {
                setOpenId(slice.id);
                return;
              }
              if (slice.options.length === 1) {
                onPick(slice.id, slice.options[0].id);
                return;
              }
              setOpenId(slice.id);
            }}
          >
            <span
              className={styles.wedgeLabel}
              style={{
                left: `${50 + Math.cos(mid) * 33}%`,
                top: `${50 + Math.sin(mid) * 33}%`,
              }}
            >
              {nodeIcon(slice.icon, 15)}
              <span>{slice.label}</span>
            </span>
          </button>
        );
      })}
      <button type="button" className={styles.wheelCancel} onClick={onCancel} aria-label="Close">
        <X size={16} />
      </button>
      {openSlice && fan.length > 0 && (() => {
        const mid = wedgeMidAngle(shown.findIndex((slice) => slice.id === openSlice.id), count);
        const boxes = optionBoxes(mid, fan.length, space);
        const parentIndex = fan.findIndex((row) => row.drill && row.drill === drillId);
        const kids = drilled
          ? drilled.options.map((option) => ({ ...option, sliceId: drilled.id, optionId: option.id }))
          : [];
        const kidBoxes = parentIndex >= 0 ? childBoxes(boxes[parentIndex], mid, kids.length, space, boxes) : [];
        const aim = (box: { left: number; top: number; width: number; height: number }) => {
          const angle = Math.atan2(box.top + box.height / 2 - WHEEL_SIZE / 2, box.left + box.width / 2 - WHEEL_SIZE / 2);
          return `rotate(${(angle * 180) / Math.PI}deg)`;
        };
        return (
          <>
            <div className={styles.wheelBridge} style={{ clipPath: menuBridge(mid, [...boxes, ...kidBoxes]) }} />
            {fan.map((row, index) => {
              const box = boxes[index];
              return (
                <button
                  key={`${openId}-${row.id}`}
                  type="button"
                  className={styles.fanItem}
                  data-open={row.drill && row.drill === drillId ? 'true' : undefined}
                  style={{
                    left: box.left,
                    top: box.top,
                    width: box.width,
                    height: box.height,
                    ['--stage-color' as string]: row.color,
                    animationDelay: `${index * 28}ms`,
                  }}
                  onPointerEnter={() => {
                    holdOpen();
                    setDrillId(row.drill || null);
                  }}
                  onClick={() => {
                    if (row.drill) {
                      setDrillId(row.drill);
                      return;
                    }
                    if (row.sliceId && row.optionId) onPick(row.sliceId, row.optionId);
                  }}
                >
                  <span className={styles.fanIcon}>{nodeIcon(row.icon, 13)}</span>
                  <span className={styles.fanText}>
                    <span className={styles.fanLabel}>{row.label}</span>
                    {row.hint ? <span className={styles.fanHint}>{row.hint}</span> : null}
                  </span>
                  {row.drill ? <ChevronRight className={styles.fanChevron} size={13} style={{ transform: aim(box) }} /> : null}
                </button>
              );
            })}
            {kids.map((row, index) => {
              const box = kidBoxes[index];
              return (
                <button
                  key={`${drillId}-${row.id}`}
                  type="button"
                  className={styles.fanItem}
                  data-child="true"
                  style={{
                    left: box.left,
                    top: box.top,
                    width: box.width,
                    height: box.height,
                    ['--stage-color' as string]: row.color,
                    animationDelay: `${index * 24}ms`,
                  }}
                  onPointerEnter={holdOpen}
                  onClick={() => onPick(row.sliceId, row.optionId)}
                >
                  <span className={styles.fanIcon}>{nodeIcon(row.icon, 13)}</span>
                  <span className={styles.fanText}>
                    <span className={styles.fanLabel}>{row.label}</span>
                    {row.hint ? <span className={styles.fanHint}>{row.hint}</span> : null}
                  </span>
                </button>
              );
            })}
          </>
        );
      })()}
    </div>
  );
};
