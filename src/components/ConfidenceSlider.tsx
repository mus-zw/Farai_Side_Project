import React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { formatConfidencePercent } from '../utils/formatters';

interface ConfidenceSliderProps {
  value: number; // 0 to 1
  onChange: (newValue: number) => void;
  totalAvailable?: number;
  shownCount?: number;
  disabled?: boolean;
}

export default function ConfidenceSlider({
  value,
  onChange,
  totalAvailable = 0,
  shownCount = 0,
  disabled = false,
}: ConfidenceSliderProps) {
  const percent = Math.round(value * 100);

  // Dynamic color calculations: red (0-35) -> yellow/amber (36-65) -> lime green (66-100)
  let badgeColor = 'bg-rose-950/70 border-rose-500/40 text-rose-300';
  let accentHex = '#ef4444';
  if (percent >= 66) {
    badgeColor = 'bg-[#32FF00]/15 border-[#32FF00]/50 text-[#32FF00] shadow-[0_0_8px_rgba(50,255,0,0.3)]';
    accentHex = '#32FF00';
  } else if (percent >= 36) {
    badgeColor = 'bg-amber-950/70 border-amber-500/40 text-amber-300';
    accentHex = '#eab308';
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-[#16213E] bg-[#16213E]/60 shadow-md">
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors border"
          style={{
            backgroundColor: `${accentHex}18`,
            color: accentHex,
            borderColor: `${accentHex}40`,
          }}
        >
          <SlidersHorizontal className="h-4 w-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <label
              htmlFor="confidence-threshold-slider"
              className="text-xs font-semibold uppercase tracking-wider text-white"
            >
              Confidence Threshold
            </label>
            <span
              className={`font-mono text-xs font-bold px-2 py-0.5 rounded-md border tabular-nums transition-colors ${badgeColor}`}
            >
              {formatConfidencePercent(value)}
            </span>
          </div>
          <p className="text-[11px] text-[#CCCCCC] mt-0.5">
            {totalAvailable > 0 ? (
              <span>
                Showing <strong className="text-[#32FF00]">{shownCount}</strong> of{' '}
                <strong className="text-white">{totalAvailable}</strong> candidates (threshold:{' '}
                {percent}%)
              </span>
            ) : (
              <span>Filter predictions by minimum model certainty</span>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:w-64">
        <span className="font-mono text-[10px] text-rose-400 font-medium">0%</span>
        <div className="relative flex-1 flex items-center">
          <input
            id="confidence-threshold-slider"
            type="range"
            min="0.05"
            max="0.95"
            step="0.01"
            value={value}
            disabled={disabled}
            aria-label="Filter detections by confidence threshold"
            aria-valuemin={5}
            aria-valuemax={95}
            aria-valuenow={percent}
            aria-valuetext={`${percent} percent confidence`}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer disabled:opacity-40 transition-all accent-[#32FF00]"
            style={{
              background: `linear-gradient(to right, #ef4444 0%, #eab308 50%, #32FF00 100%)`,
            }}
          />
        </div>
        <span className="font-mono text-[10px] text-[#32FF00] font-bold">100%</span>
      </div>
    </div>
  );
}
