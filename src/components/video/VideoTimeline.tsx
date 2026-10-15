import React from 'react';
import { Clock, Layers, Sparkles } from 'lucide-react';
import { VideoDetectionResponse } from '../../types';
import { getClassColor } from '../../utils/colors';
import { capitalizeClass } from '../../utils/formatters';

interface VideoTimelineProps {
  detectionData: VideoDetectionResponse;
  currentFrame: number;
  onSeekToFrame: (frameNumber: number) => void;
}

export default function VideoTimeline({
  detectionData,
  currentFrame,
  onSeekToFrame,
}: VideoTimelineProps) {
  const { total_frames, frame_detections, summary } = detectionData;
  const classes = Object.keys(summary.object_count_per_class);

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5 space-y-4">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-[#32FF00]" />
          <h4 className="font-display text-sm font-bold text-white uppercase tracking-wider">
            Temporal Object Occurrence Timeline
          </h4>
        </div>
        <span className="text-neutral-400 font-mono text-[11px]">
          Click along timeline to jump to frame
        </span>
      </div>

      {/* Class Occurrence Rows */}
      <div className="space-y-3 pt-1">
        {classes.map((cls) => {
          const color = getClassColor(cls);

          return (
            <div key={cls} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color.hex }} />
                  <span>{capitalizeClass(cls)}</span>
                </span>
                <span className="font-mono text-[11px] text-neutral-400">
                  {summary.object_count_per_class[cls]} frame appearances
                </span>
              </div>

              {/* Bar track */}
              <div
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const ratio = (e.clientX - rect.left) / rect.width;
                  const targetFrame = Math.round(ratio * total_frames);
                  onSeekToFrame(Math.max(0, Math.min(total_frames - 1, targetFrame)));
                }}
                className="relative h-4 w-full rounded-md bg-neutral-950 cursor-pointer overflow-hidden border border-neutral-800 hover:border-neutral-700 transition-colors"
              >
                {/* Segments where this class is detected */}
                {frame_detections.map((f) => {
                  const hasClass = f.detections[cls] && f.detections[cls].count > 0;
                  if (!hasClass) return null;

                  const leftPct = (f.frame_number / total_frames) * 100;
                  const widthPct = Math.max(0.6, (1 / total_frames) * 100);

                  return (
                    <div
                      key={f.frame_number}
                      className="absolute top-0 bottom-0 opacity-80"
                      style={{
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                        backgroundColor: color.hex,
                      }}
                    />
                  );
                })}

                {/* Current Playhead Indicator */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg pointer-events-none z-10"
                  style={{ left: `${(currentFrame / total_frames) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
