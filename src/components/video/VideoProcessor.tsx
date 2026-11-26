import React, { useMemo, useState } from 'react';
import {
  Video,
  Play,
  Layers,
  Camera,
  BarChart2,
  Scale,
  Download,
  FileJson,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import {
  VideoMetadata,
  VideoProcessingOptions,
  VideoDetectionResponse,
} from '../../types';
import { processVideo } from '../../services/videoApi';
import { frameIndexAtTime } from '../../utils/videoFrames';
import { activeCountsByClass, overlayAtTime } from '../../utils/videoOverlay';
import VideoUpload from './VideoUpload';
import BrowserVideoDetector from './BrowserVideoDetector';
import type { InferenceEngine } from '../../services/visionApi';
import { useConsent } from '../ConsentProvider';
import { getApiBaseUrl } from '../../services/apiClient';
import VideoPlayer from './VideoPlayer';
import VideoTimeline from './VideoTimeline';
import FrameAnalysis from './FrameAnalysis';
import VideoAnalytics from './VideoAnalytics';

interface VideoProcessorProps {
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
  /** Where detection runs. 'browser' plays the file locally and never uses the backend. */
  engine?: InferenceEngine;
  onEngineChange?: (engine: InferenceEngine) => void;
  confidenceThreshold?: number;
  onConfidenceChange?: (value: number) => void;
}

function VideoEngineSwitch({ engine, onChange }: { engine: InferenceEngine; onChange: (e: InferenceEngine) => void }) {
  return (
    <div
      role="group"
      aria-label="Video inference engine"
      className="inline-flex rounded-xl border border-neutral-800 bg-neutral-900/60 p-1 text-xs"
    >
      {([
        ['backend', 'Backend server'],
        ['browser', 'In this browser'],
      ] as const).map(([value, label]) => (
        <button
          key={value}
          type="button"
          data-testid={`video-engine-${value}`}
          aria-pressed={engine === value}
          onClick={() => onChange(value)}
          className={`min-h-[36px] rounded-lg px-3.5 py-1.5 font-semibold transition-colors ${
            engine === value ? 'bg-[#32FF00] text-neutral-950' : 'text-neutral-400 hover:text-white'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

type VideoSubTab = 'player' | 'frames' | 'analytics';

export default function VideoProcessor({
  onNotify,
  engine = 'backend',
  onEngineChange,
  confidenceThreshold = 0.25,
  onConfidenceChange,
}: VideoProcessorProps) {
  const { ensure } = useConsent();
  const [videoFile, setVideoFile] = useState<File | Blob | null>(null);
  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [uploadPercent, setUploadPercent] = useState<number>(0);

  const [detectionResult, setDetectionResult] = useState<VideoDetectionResponse | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<VideoSubTab>('player');
  // Playback position in seconds, shared by the player, timeline and inspector.
  // The player reports it as the frame on screen changes; the timeline and
  // inspector send seek requests back through `seekRequest`.
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [seekRequest, setSeekRequest] = useState<{ time: number; nonce: number } | null>(null);

  const seekTo = (seconds: number) => {
    const t = Math.max(0, seconds);
    setCurrentTime(t); // move the playhead now; the video follows
    setSeekRequest({ time: t, nonce: (seekRequest?.nonce ?? 0) + 1 });
  };

  // What is on screen at currentTime, for the timeline's "now" counts.
  const activeCounts = useMemo(
    () =>
      detectionResult
        ? activeCountsByClass(overlayAtTime(detectionResult.frame_detections, currentTime))
        : {},
    [detectionResult, currentTime]
  );

  const handleVideoSelected = (file: File | Blob, meta: VideoMetadata, url: string) => {
    setVideoFile(file);
    setVideoMetadata(meta);
    setVideoUrl(url);
    setDetectionResult(null);
    setCurrentTime(0);
    setSeekRequest(null);
  };

  const handleStartProcessing = async (options: VideoProcessingOptions) => {
    if (!videoFile || !videoMetadata) return;

    // This path uploads the video to the backend, so it needs its own, plainly worded consent.
    if (!(await ensure('upload', { uploadHost: getApiBaseUrl() }))) return;

    setIsProcessing(true);
    setUploadPercent(0);

    try {
      const result = await processVideo(videoFile, {
        ...options,
        onUploadProgress: setUploadPercent,
      });

      setDetectionResult(result);
      setCurrentTime(0);
      setSeekRequest(null);
      onNotify(
        'success',
        `Video analysis complete: ${result.frames_analysed} of ${result.total_frames} frames analysed in ${result.processing_time_ms}ms.`
      );
    } catch (err: any) {
      console.error('Video processing error:', err);
      onNotify('error', err?.message || 'Failed to process video.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Export full video metrics report as JSON
  const handleDownloadVideoJson = () => {
    if (!detectionResult) return;
    const blob = new Blob([JSON.stringify(detectionResult, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `farai-cv-video-metrics-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onNotify('success', 'Video detection JSON metrics downloaded!');
  };

  if (engine === 'browser') {
    return (
      <div className="space-y-5">
        {onEngineChange && <VideoEngineSwitch engine={engine} onChange={onEngineChange} />}
        <BrowserVideoDetector
          confidenceThreshold={confidenceThreshold}
          onConfidenceChange={onConfidenceChange ?? (() => undefined)}
          onNotify={onNotify}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in">
      {onEngineChange && <VideoEngineSwitch engine={engine} onChange={onEngineChange} />}
      {/* 1. Upload & Options Section */}
      <VideoUpload
        onVideoSelected={handleVideoSelected}
        onStartProcessing={handleStartProcessing}
        isProcessing={isProcessing}
        uploadPercent={uploadPercent}
        onNotify={onNotify}
      />

      {/* 2. Processed Results View */}
      {videoUrl && detectionResult && (
        <div className="space-y-6 pt-4 border-t border-neutral-800">
          {/* What the clean-up removed, so filtered results are never silent */}
          {detectionResult.filtering &&
            (detectionResult.filtering.removed_weak > 0 ||
              detectionResult.filtering.removed_transient > 0 ||
              detectionResult.filtering.removed_by_size > 0) && (
              <p
                data-testid="cleanup-report"
                className="rounded-xl border border-cyan-500/30 bg-cyan-950/30 p-3 text-xs leading-relaxed text-cyan-100"
              >
                <span className="font-semibold">Busy-scene clean-up: </span>
                kept {detectionResult.filtering.detections_after} of{' '}
                {detectionResult.filtering.detections_before} detections.
                {detectionResult.filtering.removed_weak > 0 &&
                  ` ${detectionResult.filtering.removed_weak} belonged to objects never detected above ${Math.round(
                    detectionResult.filtering.min_track_confidence * 100
                  )}% confidence.`}
                {detectionResult.filtering.removed_transient > 0 &&
                  ` ${detectionResult.filtering.removed_transient} appeared in only one analysed frame.`}
                {detectionResult.filtering.removed_by_size > 0 &&
                  ` ${detectionResult.filtering.removed_by_size} were smaller than ${detectionResult.filtering.min_box_area_pct}% of the frame.`}{' '}
                Untick &quot;Clean up busy scenes&quot; and re-run to see them.
              </p>
            )}

          {/* Subtabs for Video View */}
          <div className="flex items-center gap-2 p-1 rounded-xl border border-neutral-800 bg-neutral-900/80 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveSubTab('player')}
              className={`min-h-[38px] flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                activeSubTab === 'player'
                  ? 'bg-[#32FF00] text-neutral-950 shadow'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Real-Time Playback & Overlay</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('frames')}
              className={`min-h-[38px] flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                activeSubTab === 'frames'
                  ? 'bg-[#32FF00] text-neutral-950 shadow'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Camera className="h-3.5 w-3.5" />
              <span>Frame-by-Frame Forensic View</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('analytics')}
              className={`min-h-[38px] flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                activeSubTab === 'analytics'
                  ? 'bg-[#32FF00] text-neutral-950 shadow'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <BarChart2 className="h-3.5 w-3.5" />
              <span>Video Density Analytics</span>
            </button>

          </div>

          {/* Subtab 1: Player & Timeline */}
          {activeSubTab === 'player' && (
            <div className="space-y-6">
              <VideoPlayer
                videoUrl={videoUrl}
                detectionData={detectionResult}
                startTime={currentTime}
                seekRequest={seekRequest}
                onFrameChange={(_frame, t) => setCurrentTime(t)}
              />

              <VideoTimeline
                detectionData={detectionResult}
                currentTime={currentTime}
                activeCounts={activeCounts}
                onSeekToTime={seekTo}
              />
            </div>
          )}

          {/* Subtab 2: Frame-by-Frame Inspector */}
          {activeSubTab === 'frames' && (
            <div className="space-y-6">
              <VideoPlayer
                videoUrl={videoUrl}
                detectionData={detectionResult}
                startTime={currentTime}
                seekRequest={seekRequest}
                onFrameChange={(_frame, t) => setCurrentTime(t)}
              />

              <FrameAnalysis
                detectionData={detectionResult}
                currentFrameIndex={Math.max(
                  0,
                  frameIndexAtTime(detectionResult.frame_detections, currentTime)
                )}
                onSelectFrame={(idx) => {
                  const target = detectionResult.frame_detections[idx];
                  if (target) seekTo(target.timestamp);
                }}
              />
            </div>
          )}

          {/* Subtab 3: Video Analytics */}
          {activeSubTab === 'analytics' && (
            <VideoAnalytics
              detectionData={detectionResult}
              onDownloadReport={handleDownloadVideoJson}
            />
          )}

        </div>
      )}
    </div>
  );
}
