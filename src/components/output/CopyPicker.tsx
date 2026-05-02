import { useEffect, useRef, useState } from 'react';
import { Tooltip } from '../ui/Tooltip';

interface CopyPickerProps {
  currentIndex: number;
  others: number[];
  onCopy: (target: number) => void;
  channelLabel: string; // "Out" or "In"
}

export function CopyPicker({ currentIndex, others, onCopy, channelLabel }: CopyPickerProps) {
  const [open, setOpen] = useState(false);
  const [flash, setFlash] = useState<number | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  function handleCopy(target: number) {
    onCopy(target);
    setFlash(target);
    setTimeout(() => setFlash(null), 1200);
    setOpen(false);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <Tooltip content={`One-shot copy: snapshot the current ${channelLabel.toLowerCase()}'s settings (gain, mute, phase, delay, PEQ, crossover) onto a target channel. Unlike Link, the channels stay independent afterwards.`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-xs px-2 py-0.5 rounded border bg-control-bg text-text-dimmed border-surface-bg hover:text-text-secondary transition-colors flex items-center gap-1"
        aria-expanded={open}
      >
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="4" y="4" width="9" height="9" rx="1" />
          <path d="M2 11V3a1 1 0 0 1 1-1h8" />
        </svg>
        {flash !== null ? `Copied → ${channelLabel} ${flash + 1}` : 'Copy →'}
        <span className="opacity-60">▾</span>
      </button>
      </Tooltip>

      {open && (
        <div className="glass-panel-strong absolute z-30 mt-1 left-0 min-w-[8rem] py-1"
             style={{ borderRadius: 'var(--radius-panel)' }}>
          <div className="px-3 py-1 section-label">Copy to</div>
          {others.map((i) => (
            <button key={i}
              onClick={() => handleCopy(i)}
              className="w-full text-left px-3 py-1 hover:bg-surface-bg/50 text-xs">
              {channelLabel} {i + 1}
            </button>
          ))}
          <div className="px-3 pt-1.5 pb-1 text-[0.65rem] text-text-dimmed border-t border-surface-bg/40 mt-1">
            Replaces the target's settings with a snapshot of {channelLabel} {currentIndex + 1}.
          </div>
        </div>
      )}
    </div>
  );
}
