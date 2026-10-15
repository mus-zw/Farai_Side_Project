import React from 'react';
import { ChevronLeft, ChevronRight, Download, Camera, Target, Clock } from 'lucide-react';
import { FrameDetection, VideoDetectionResponse } from '../../types';
import { getClassColor } from '../../utils/colors';
import { capitalizeClass, formatConfidencePercent } from '../../utils/formatters';

interface FrameAnalysisProps {
  detectionData: VideoDetectionResponse;
  currentFrameIndex: number;
  onSelectFrame: (frameIdx: number) => void;
  onExportFrameImage?: (frameIdx: number) => void;
}

export default function FrameAnalysis({
  detectionData,
  currentFrameIndex,
  onSelectFrame,
  onExportFrameImage,
}: FrameAnalysisProps) {
  const { total_frames, frame_detections } = detectionData;
  const frame = frame_detections[currentFrameIndex] || frame_detections[0];

  const handlePrev = () => {
    onSelectFrame(Math.max(0, currentFrameIndex - 1));
  };

  const handleNext = () => {
    onSelectFrame(Math.min(total_frames - 1, currentFrameIndex + 1));
  };

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5 space-y-4">
      {/* Header and Stepper */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-3">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-[#32FF00]" />
          <h4 className="font-display text-sm font-bold text-white uppercase tracking-wider">
            Frame-by-Frame Forensic Inspector
          </h4>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrev}
            disabled={currentFrameIndex <= 0}
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-300 hover:text-white disabled:opacity-40"
            title="Previous Frame"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <span className="font-mono text-xs text-neutral-300 tabular-nums px-2">
            Frame <strong className="text-[#32FF00]">#{frame?.frame_number ?? 0}</strong> of {total_frames} ({frame?.timestamp.toFixed(2)}s)
          </span>

          <button
            type="button"
            onClick={handleNext}
            disabled={currentFrameIndex >= total_frames - 1}
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-300 hover:text-white disabled:opacity-40"
            title="Next Frame"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Frame Detections List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-neutral-400">
          <span>Active Targets in this Frame ({frame?.boxes?.length || 0}):</span>
          {onExportFrameImage && (
            <button
              type="button"
              onClick={() => onExportFrameImage(currentFrameIndex)}
              className="flex items-center gap-1.5 text-[#32FF00] hover:text-[#32FF00] font-semibold"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Snapshot Frame (PNG)</span>
            </button>
          )}
        </div>

        {(!frame?.boxes || frame.boxes.length === 0) ? (
          <p className="text-xs text-neutral-500 py-4 text-center">
            No objects detected in this specific frame.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {frame.boxes.map((box) => {
              const color = getClassColor(box.className);

              return (
                <div
                  key={box.id}
                  className="rounded-xl border border-neutral-800 bg-neutral-950 p-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: color.hex }}
                    />
                    <div>
                      <div className="text-xs font-semibold text-white">
                        {capitalizeClass(box.className)}{' '}
                        <span className="font-mono text-neutral-400 font-normal">
                          (Track #{box.trackId})
                        </span>
                      </div>
                      <div className="text-[10px] text-neutral-500 font-mono">
                        Coord: [{box.bbox.map((v) => v.toFixed(2)).join(', ')}]
                      </div>
                    </div>
                  </div>

                  <span className="font-mono text-xs text-[#32FF00] font-bold tabular-nums">
                    {formatConfidencePercent(box.confidence)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
