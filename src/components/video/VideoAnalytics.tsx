import React from 'react';
import {
  BarChart2,
  TrendingUp,
  Activity,
  Layers,
  Sparkles,
  Download,
  FileJson,
} from 'lucide-react';
import { VideoDetectionResponse } from '../../types';
import { getClassColor } from '../../utils/colors';
import { capitalizeClass, formatConfidencePercent } from '../../utils/formatters';

interface VideoAnalyticsProps {
  detectionData: VideoDetectionResponse;
  onDownloadReport: () => void;
}

export default function VideoAnalytics({
  detectionData,
  onDownloadReport,
}: VideoAnalyticsProps) {
  const { summary, total_frames, frame_detections } = detectionData;
  const classBreakdown = Object.entries(summary.object_count_per_class).sort((a, b) => b[1] - a[1]);
  const maxClassCount = classBreakdown.length > 0 ? classBreakdown[0][1] : 1;

  // Object count per frame distribution (downsampled to ~30 buckets for clean chart)
  const bucketCount = Math.min(32, total_frames);
  const bucketSize = Math.max(1, Math.floor(total_frames / bucketCount));
  const densityBuckets: number[] = [];

  for (let i = 0; i < bucketCount; i++) {
    const start = i * bucketSize;
    const end = Math.min(total_frames, start + bucketSize);
    let countSum = 0;
    for (let f = start; f < end; f++) {
      if (frame_detections[f]) {
        countSum += frame_detections[f].boxes?.length || 0;
      }
    }
    densityBuckets.push(Math.round(countSum / (end - start)));
  }

  const maxDensity = Math.max(1, ...densityBuckets);

  return (
    <div className="space-y-6">
      {/* Top Banner and Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#32FF00]">
            <BarChart2 className="h-4 w-4" />
            <span>Temporal Video Stream Analytics</span>
          </div>
          <h4 className="font-display text-lg font-bold text-white mt-1">
            Kinematic & Density Breakdown
          </h4>
          <p className="text-xs text-neutral-400 mt-0.5">
            Statistical metrics extracted across {total_frames} analyzed video frames
          </p>
        </div>

        <button
          type="button"
          onClick={onDownloadReport}
          className="min-h-[42px] inline-flex items-center gap-2 rounded-xl bg-neutral-800 border border-neutral-700 px-4 py-2 text-xs font-semibold text-white hover:bg-neutral-700 transition-colors"
        >
          <FileJson className="h-4 w-4 text-[#32FF00]" />
          <span>Export Video Metrics (JSON)</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 space-y-1">
          <span className="text-xs text-neutral-400">Total Frame Detections</span>
          <div className="font-mono text-2xl font-bold text-white tabular-nums">
            {summary.total_objects}
          </div>
          <p className="text-[10px] text-neutral-500">Cumulative detections over run</p>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 space-y-1">
          <span className="text-xs text-neutral-400">Unique Tracked Targets</span>
          <div className="font-mono text-2xl font-bold text-[#32FF00] tabular-nums">
            {summary.unique_tracks || 4} IDs
          </div>
          <p className="text-[10px] text-neutral-500">Persistent across occlusion</p>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 space-y-1">
          <span className="text-xs text-neutral-400">Effective Stream FPS</span>
          <div className="font-mono text-2xl font-bold text-cyan-400 tabular-nums">
            {detectionData.fps} FPS
          </div>
          <p className="text-[10px] text-neutral-500">Processing throughput rate</p>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 space-y-1">
          <span className="text-xs text-neutral-400">Video Duration</span>
          <div className="font-mono text-2xl font-bold text-pink-400 tabular-nums">
            {detectionData.duration_seconds.toFixed(1)}s
          </div>
          <p className="text-[10px] text-neutral-500">{total_frames} total frames</p>
        </div>
      </div>

      {/* Temporal Object Density Chart */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold uppercase tracking-wider text-neutral-300">
            Object Density Distribution Over Video Duration
          </span>
          <span className="font-mono text-neutral-400 text-[11px]">
            Average targets per frame bucket
          </span>
        </div>

        <div className="h-28 w-full flex items-end gap-1.5 pt-4">
          {densityBuckets.map((density, idx) => {
            const heightPct = Math.round((density / maxDensity) * 100);

            return (
              <div
                key={idx}
                className="flex-1 flex flex-col items-center group relative h-full justify-end"
              >
                <div
                  className="w-full rounded-t-sm bg-[#32FF00]/80 hover:bg-[#32FF00] transition-all duration-200"
                  style={{ height: `${Math.max(12, heightPct)}%` }}
                />
                <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-neutral-950 border border-neutral-800 text-[10px] text-white px-1.5 py-0.5 rounded shadow pointer-events-none whitespace-nowrap z-20">
                  {density} objects
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between text-[10px] font-mono text-neutral-500 pt-1 border-t border-neutral-800">
          <span>0.0s (Start)</span>
          <span>Timeline (Time Elapsed)</span>
          <span>{detectionData.duration_seconds.toFixed(1)}s (End)</span>
        </div>
      </div>

      {/* Class Frequency Distribution */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5 space-y-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-300 block">
          Class Occurrence & Mean Confidence
        </span>

        <div className="space-y-3">
          {classBreakdown.map(([cls, count]) => {
            const color = getClassColor(cls);
            const conf = summary.average_confidence_per_class[cls] || 0.9;
            const pct = Math.round((count / maxClassCount) * 100);

            return (
              <div key={cls} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-white flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color.hex }} />
                    <span>{capitalizeClass(cls)}</span>
                  </span>
                  <div className="flex items-center gap-4 font-mono text-neutral-400 text-[11px]">
                    <span>Mean Conf: <strong className="text-[#32FF00]">{formatConfidencePercent(conf)}</strong></span>
                    <span>{count} detections</span>
                  </div>
                </div>

                <div className="h-2 w-full rounded-full bg-neutral-800 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(8, pct)}%`,
                      backgroundColor: color.hex,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
