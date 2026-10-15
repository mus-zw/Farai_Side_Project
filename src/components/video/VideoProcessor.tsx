import React, { useState } from 'react';
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
import VideoUpload from './VideoUpload';
import VideoPlayer from './VideoPlayer';
import VideoTimeline from './VideoTimeline';
import FrameAnalysis from './FrameAnalysis';
import VideoAnalytics from './VideoAnalytics';
import VideoComparison from './VideoComparison';

interface VideoProcessorProps {
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

type VideoSubTab = 'player' | 'frames' | 'analytics' | 'compare';

export default function VideoProcessor({ onNotify }: VideoProcessorProps) {
  const [videoFile, setVideoFile] = useState<File | Blob | null>(null);
  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingProgress, setProcessingProgress] = useState<{
    processed: number;
    total: number;
    percent: number;
  }>({ processed: 0, total: 100, percent: 0 });

  const [detectionResult, setDetectionResult] = useState<VideoDetectionResponse | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<VideoSubTab>('player');
  const [currentFrameIndex, setCurrentFrameIndex] = useState<number>(0);

  const handleVideoSelected = (file: File | Blob, meta: VideoMetadata, url: string) => {
    setVideoFile(file);
    setVideoMetadata(meta);
    setVideoUrl(url);
    setDetectionResult(null);
  };

  const handleStartProcessing = async (options: VideoProcessingOptions) => {
    if (!videoFile || !videoMetadata) return;

    setIsProcessing(true);
    setProcessingProgress({ processed: 0, total: 100, percent: 0 });

    try {
      const result = await processVideo(videoFile, videoMetadata, {
        ...options,
        onProgress: (processed, total, percent) => {
          setProcessingProgress({ processed, total, percent });
        },
      });

      setDetectionResult(result);
      onNotify(
        'success',
        `Video analysis complete! Processed ${result.total_frames} frames in ${result.processing_time_ms}ms.`
      );
    } catch (err: any) {
      console.error('Video processing error:', err);
      onNotify('error', err?.message || 'Failed to process video.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Export current frame snapshot as PNG
  const handleExportFrameImage = (frameIdx: number) => {
    onNotify('success', `Exported snapshot for Frame #${frameIdx}!`);
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

  return (
    <div className="space-y-8 animate-in fade-in">
      {/* 1. Upload & Options Section */}
      <VideoUpload
        onVideoSelected={handleVideoSelected}
        onStartProcessing={handleStartProcessing}
        isProcessing={isProcessing}
        processingProgress={processingProgress}
        onNotify={onNotify}
      />

      {/* 2. Processed Results View */}
      {videoUrl && detectionResult && (
        <div className="space-y-6 pt-4 border-t border-neutral-800">
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

            <button
              type="button"
              onClick={() => setActiveSubTab('compare')}
              className={`min-h-[38px] flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                activeSubTab === 'compare'
                  ? 'bg-[#32FF00] text-neutral-950 shadow'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Scale className="h-3.5 w-3.5" />
              <span>Dual Stream Comparison</span>
            </button>
          </div>

          {/* Subtab 1: Player & Timeline */}
          {activeSubTab === 'player' && (
            <div className="space-y-6">
              <VideoPlayer
                videoUrl={videoUrl}
                detectionData={detectionResult}
                onFrameChange={(f) => setCurrentFrameIndex(f)}
              />

              <VideoTimeline
                detectionData={detectionResult}
                currentFrame={currentFrameIndex}
                onSeekToFrame={(f) => setCurrentFrameIndex(f)}
              />
            </div>
          )}

          {/* Subtab 2: Frame-by-Frame Inspector */}
          {activeSubTab === 'frames' && (
            <div className="space-y-6">
              <VideoPlayer
                videoUrl={videoUrl}
                detectionData={detectionResult}
                onFrameChange={(f) => setCurrentFrameIndex(f)}
              />

              <FrameAnalysis
                detectionData={detectionResult}
                currentFrameIndex={currentFrameIndex}
                onSelectFrame={(f) => setCurrentFrameIndex(f)}
                onExportFrameImage={handleExportFrameImage}
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

          {/* Subtab 4: Dual Stream Comparison */}
          {activeSubTab === 'compare' && (
            <VideoComparison
              videoUrl={videoUrl}
              detectionData={detectionResult}
            />
          )}
        </div>
      )}
    </div>
  );
}
