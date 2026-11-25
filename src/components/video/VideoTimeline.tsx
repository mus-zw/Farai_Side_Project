import React, { useMemo } from 'react';
import { Clock } from 'lucide-react';
import { VideoDetectionResponse } from '../../types';
import { getClassColor } from '../../utils/colors';
import { capitalizeClass } from '../../utils/formatters';

interface VideoTimelineProps {
  detectionData: VideoDetectionResponse;
  /** Playback position in seconds, the same clock as the video and its scrub bar. */
  currentTime: number;
  /** Objects of each class on screen right now (what the overlay is drawing). */
  activeCounts?: Record<string, number>;
  onSeekToTime: (seconds: number) => void;
}

interface Segment {
  left: number; // percent of the timeline
  width: number;
}

/**
 * Runs of analysed frames in which `cls` appears, as percentages of `span`
 * seconds. Each analysed frame covers the time until the next analysed frame
 * (the last one until the end), so a run stays inside [0, 100].
 */
function segmentsFor(
  cls: string,
  frames: VideoDetectionResponse['frame_detections'],
  span: number
): Segment[] {
  const out: Segment[] = [];
  let runStart: number | null = null;
  frames.forEach((f, i) => {
    const present = (f.detections[cls]?.count ?? 0) > 0;
    const end = frames[i + 1]?.timestamp ?? span;
    if (present && runStart === null) runStart = f.timestamp;
    if (runStart !== null && (!present || i === frames.length - 1)) {
      const stop = present ? end : f.timestamp;
      const left = Math.max(0, Math.min(100, (runStart / span) * 100));
      const right = Math.max(left, Math.min(100, (stop / span) * 100));
      out.push({ left, width: Math.max(0.6, right - left) });
      runStart = null;
    }
  });
  return out;
}

export default function VideoTimeline({
  detectionData,
  currentTime,
  activeCounts = {},
  onSeekToTime,
}: VideoTimelineProps) {
  const { frame_detections, summary, fps, frame_stride } = detectionData;
  const classes = Object.keys(summary.object_count_per_class);

  // The axis is time, like the video's scrub bar. It always covers the last
  // analysed frame's span, even if the reported duration is a little short.
  const span = useMemo(() => {
    const last = frame_detections[frame_detections.length - 1];
    const lastEnd = last ? last.timestamp + frame_stride / (fps || 30) : 0;
    return Math.max(detectionData.duration_seconds, lastEnd, 0.001);
  }, [detectionData.duration_seconds, frame_detections, frame_stride, fps]);

  // Segments depend only on the data, not the playhead, so playback does not
  // rebuild them every frame.
  const rows = useMemo(
    () => classes.map((cls) => ({ cls, segments: segmentsFor(cls, frame_detections, span) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [detectionData, span]
  );

  const seekFromPointer = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    onSeekToTime(ratio * span);
  };

  const step = frame_stride / (fps || 30);
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') onSeekToTime(Math.max(0, currentTime - step));
    else if (e.key === 'ArrowRight') onSeekToTime(Math.min(span, currentTime + step));
    else return;
    e.preventDefault();
  };

  const playheadPct = Math.min(100, Math.max(0, (currentTime / span) * 100));

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
          Click along the timeline to seek the video
        </span>
      </div>

      <div className="space-y-3 pt-1">
        {rows.map(({ cls, segments }) => {
          const color = getClassColor(cls);
          const now = activeCounts[cls] ?? 0;

          return (
            <div key={cls} className="space-y-1" data-timeline-class={cls}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color.hex }} />
                  <span>{capitalizeClass(cls)}</span>
                </span>
                <span className="font-mono text-[11px] text-neutral-400">
                  <span className={now > 0 ? 'text-[#32FF00]' : ''} data-timeline-now>
                    {now} now
                  </span>
                  {' · '}
                  {summary.object_count_per_class[cls]} detections
                </span>
              </div>

              <div
                role="slider"
                tabIndex={0}
                aria-label={`${capitalizeClass(cls)} timeline`}
                aria-valuemin={0}
                aria-valuemax={Math.round(span * 10) / 10}
                aria-valuenow={Math.round(currentTime * 10) / 10}
                onClick={seekFromPointer}
                onKeyDown={onKeyDown}
                className="relative h-4 w-full rounded-md bg-neutral-950 cursor-pointer overflow-hidden border border-neutral-800 hover:border-neutral-700 focus:border-[#32FF00] focus:outline-none transition-colors"
              >
                {segments.map((s, i) => (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 opacity-80 pointer-events-none"
                    style={{ left: `${s.left}%`, width: `${s.width}%`, backgroundColor: color.hex }}
                  />
                ))}

                <div
                  data-timeline-playhead
                  className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg pointer-events-none z-10"
                  style={{ left: `${playheadPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
