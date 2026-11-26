import { BarChart2, FileJson } from 'lucide-react';
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

  // Mean objects per analysed frame, bucketed by position in the source
  // video. Buckets are placed by frame_number because frame_detections only
  // holds every frame_stride-th frame.
  const bucketCount = Math.max(1, Math.min(32, frame_detections.length));
  const sums = new Array<number>(bucketCount).fill(0);
  const counts = new Array<number>(bucketCount).fill(0);
  for (const f of frame_detections) {
    const b = Math.min(bucketCount - 1, Math.floor((f.frame_number / Math.max(1, total_frames)) * bucketCount));
    sums[b] += f.total_objects;
    counts[b] += 1;
  }
  const densityBuckets = sums.map((sum, i) => (counts[i] ? Math.round(sum / counts[i]) : 0));

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
            Detection Density Breakdown
          </h4>
          <p className="text-xs text-neutral-400 mt-0.5">
            {detectionData.frames_analysed} of {total_frames} frames analysed (every {detectionData.frame_stride === 1 ? 'frame' : `${detectionData.frame_stride}th frame`}) with {detectionData.model_name}
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
          <span className="text-xs text-neutral-400">Peak Frame</span>
          <div className="font-mono text-2xl font-bold text-[#32FF00] tabular-nums">
            {summary.peak_frame_count} objs
          </div>
          <p className="text-[10px] text-neutral-500">at frame #{summary.peak_frame}</p>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 space-y-1">
          <span className="text-xs text-neutral-400">Source Frame Rate</span>
          <div className="font-mono text-2xl font-bold text-cyan-400 tabular-nums">
            {detectionData.fps} FPS
          </div>
          <p className="text-[10px] text-neutral-500">As encoded in the uploaded file</p>
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
            const conf = summary.average_confidence_per_class[cls] ?? 0;
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
