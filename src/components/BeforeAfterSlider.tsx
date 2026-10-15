import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Columns, SplitSquareVertical, Maximize2 } from 'lucide-react';

interface BeforeAfterSliderProps {
  originalImage: string;
  annotatedImage: string;
  altTitle?: string;
  onExpandFullscreen?: (src: string, title: string) => void;
}

export default function BeforeAfterSlider({
  originalImage,
  annotatedImage,
  altTitle = 'Image Comparison',
  onExpandFullscreen,
}: BeforeAfterSliderProps) {
  const [sliderPosition, setSliderPosition] = useState<number>(50); // 0 to 100%
  const [viewMode, setViewMode] = useState<'slider' | 'side-by-side'>('slider');
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef<boolean>(false);

  // Pointer move handler for smooth drag on both desktop & mobile touch
  const handlePointerMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const position = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(position);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    handlePointerMove(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDraggingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  // Keyboard navigation support for accessibility
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setSliderPosition((prev) => Math.max(0, prev - 5));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setSliderPosition((prev) => Math.min(100, prev + 5));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setSliderPosition(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setSliderPosition(100);
    }
  };

  return (
    <div className="space-y-3">
      {/* View Switcher Header */}
      <div className="flex items-center justify-between text-xs text-[#CCCCCC]">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white">Visual Inspection Mode:</span>
          <div className="flex rounded-lg border border-[#16213E] bg-[#0F1419] p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('slider')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors ${
                viewMode === 'slider'
                  ? 'bg-[#16213E] text-[#32FF00] font-bold shadow-sm'
                  : 'text-[#CCCCCC] hover:text-white'
              }`}
            >
              <SplitSquareVertical className="h-3.5 w-3.5" />
              <span>Split Slider</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('side-by-side')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors ${
                viewMode === 'side-by-side'
                  ? 'bg-[#16213E] text-[#32FF00] font-bold shadow-sm'
                  : 'text-[#CCCCCC] hover:text-white'
              }`}
            >
              <Columns className="h-3.5 w-3.5" />
              <span>Side-by-Side</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {viewMode === 'slider' && (
            <span className="hidden sm:inline font-mono text-[11px] text-[#888888]">
              Drag bar or use ←/→ arrows
            </span>
          )}
          {onExpandFullscreen && (
            <button
              type="button"
              onClick={() => onExpandFullscreen(annotatedImage, altTitle)}
              className="flex items-center gap-1 hover:text-[#32FF00] p-1 transition-colors text-white"
              title="Expand in fullscreen"
            >
              <Maximize2 className="h-3.5 w-3.5 text-[#32FF00]" />
              <span className="text-[11px]">Fullscreen</span>
            </button>
          )}
        </div>
      </div>

      {viewMode === 'slider' ? (
        /* 1. Before/After Split Draggable Slider View */
        <div
          ref={containerRef}
          tabIndex={0}
          role="slider"
          aria-label="Image comparison slider"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(sliderPosition)}
          onKeyDown={handleKeyDown}
          onPointerDown={handlePointerDown}
          onPointerMove={(e) => {
            if (isDraggingRef.current) {
              handlePointerMove(e.clientX);
            }
          }}
          onPointerUp={handlePointerUp}
          className="relative aspect-[4/3] w-full max-h-[580px] overflow-hidden rounded-2xl border border-[#16213E] bg-[#0F1419] select-none cursor-ew-resize focus:outline-none focus:ring-2 focus:ring-[#32FF00] shadow-2xl"
        >
          {/* Layer 1: Annotated Image (Revealed on Right) */}
          <div className="absolute inset-0">
            <img
              src={annotatedImage}
              alt="Annotated detection output"
              className="h-full w-full object-contain"
              referrerPolicy="no-referrer"
            />
            <div className="absolute top-3 right-3 rounded-lg bg-[#0F1419]/90 border border-[#32FF00]/50 px-2.5 py-1 text-[11px] font-bold text-[#32FF00] backdrop-blur-sm pointer-events-none shadow-lg">
              Detected Output (Right)
            </div>
          </div>

          {/* Layer 2: Original Image (Clipped by slider position on Left using clipPath) */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
          >
            <img
              src={originalImage}
              alt="Raw original input"
              className="h-full w-full object-contain"
              referrerPolicy="no-referrer"
            />
            <div className="absolute top-3 left-3 rounded-lg bg-[#0F1419]/90 border border-[#16213E] px-2.5 py-1 text-[11px] font-semibold text-[#CCCCCC] backdrop-blur-sm pointer-events-none shadow-lg">
              Original Input (Left)
            </div>
          </div>

          {/* Draggable Divider Bar with Lime Accent */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-[#32FF00] shadow-[0_0_12px_#32FF00] pointer-events-none"
            style={{ left: `${sliderPosition}%` }}
          >
            <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-8 w-8 rounded-full bg-[#32FF00] text-[#0F1419] flex items-center justify-center text-xs font-black shadow-[0_0_15px_rgba(50,255,0,0.6)] ring-4 ring-[#0F1419]">
              ⇄
            </div>
          </div>
        </div>
      ) : (
        /* 2. Side-by-Side Dual View */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-[#CCCCCC]">Original Raw Image</span>
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-[#16213E] bg-[#0F1419] flex items-center justify-center">
              <img
                src={originalImage}
                alt="Original"
                className="h-full w-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-[#32FF00]">Model Detections & Segmentations</span>
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-[#32FF00]/40 bg-[#0F1419] flex items-center justify-center">
              <img
                src={annotatedImage}
                alt="Annotated"
                className="h-full w-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
