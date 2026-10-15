import React, { useState, useRef } from 'react';
import {
  Video,
  Upload,
  Play,
  Settings2,
  Sparkles,
  RefreshCw,
  Film,
  Sliders,
  CheckCircle2,
  Clock,
  Layers,
} from 'lucide-react';
import { VideoMetadata, VideoProcessingOptions, VisionModelId } from '../../types';
import { validateAndExtractVideoMetadata } from '../../services/videoApi';
import { generateBenchmarkTrafficVideo } from '../../utils/sampleVideo';
import { formatBytes } from '../../utils/formatters';
import { VISION_MODELS, MODEL_LIST } from '../../utils/models';

interface VideoUploadProps {
  onVideoSelected: (file: File | Blob, metadata: VideoMetadata, previewUrl: string) => void;
  onStartProcessing: (options: VideoProcessingOptions) => void;
  isProcessing: boolean;
  processingProgress: { processed: number; total: number; percent: number };
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

export default function VideoUpload({
  onVideoSelected,
  onStartProcessing,
  isProcessing,
  processingProgress,
  onNotify,
}: VideoUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<{
    file: File | Blob;
    meta: VideoMetadata;
    url: string;
  } | null>(null);

  // Video processing configuration
  const [mode, setMode] = useState<'entire' | 'sample' | 'realtime'>('sample');
  const [samplingFps, setSamplingFps] = useState<number>(10);
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0.5);
  const [modelId, setModelId] = useState<VisionModelId>('farai-fpn');
  const [enableTracking, setEnableTracking] = useState<boolean>(true);
  const [enableTrajectory, setEnableTrajectory] = useState<boolean>(true);
  const [isGeneratingSample, setIsGeneratingSample] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    try {
      const meta = await validateAndExtractVideoMetadata(file);
      const url = URL.createObjectURL(file);
      setSelectedVideo({ file, meta, url });
      onVideoSelected(file, meta, url);
      onNotify('success', `Loaded "${file.name}" (${meta.sizeFormatted}, ${meta.durationFormatted})`);
    } catch (err: any) {
      onNotify('error', err?.message || 'Invalid video file.');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleLoadSampleVideo = async () => {
    setIsGeneratingSample(true);
    try {
      onNotify('info', 'Rendering HD benchmark surveillance stream...');
      const { blob, url } = await generateBenchmarkTrafficVideo(8, 24);

      const meta: VideoMetadata = {
        name: 'benchmark_traffic_surveillance.webm',
        sizeBytes: blob.size,
        sizeFormatted: formatBytes(blob.size),
        durationSeconds: 8.0,
        durationFormatted: '0:08 (8.0s)',
        width: 640,
        height: 360,
        format: 'video/webm',
      };

      setSelectedVideo({ file: blob, meta, url });
      onVideoSelected(blob, meta, url);
      onNotify('success', 'Loaded benchmark traffic video! Ready to analyze.');
    } catch (e) {
      console.error('Failed to create sample video:', e);
      onNotify('error', 'Could not synthesize sample video.');
    } finally {
      setIsGeneratingSample(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVideo) {
      onNotify('error', 'Please select or generate a video first.');
      return;
    }

    onStartProcessing({
      mode,
      samplingFps,
      confidenceThreshold,
      modelId,
      enableTracking,
      enableTrajectory,
    });
  };

  return (
    <div className="space-y-6">
      {/* Drag & Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
          }
        }}
        className={`relative rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
          isDragging
            ? 'border-[#32FF00] bg-[#32FF00]/10'
            : 'border-neutral-800 bg-neutral-900/40 hover:border-neutral-700 hover:bg-neutral-900/60'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4, video/webm, video/quicktime, video/x-msvideo"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleFile(e.target.files[0]);
            }
          }}
          className="hidden"
          id="video-file-upload"
        />

        <div className="mx-auto flex max-w-lg flex-col items-center justify-center space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-800 text-[#32FF00] shadow-inner">
            <Film className="h-6 w-6" />
          </div>

          <div className="space-y-1">
            <p className="text-sm font-semibold text-white">
              Drag and drop your video file here, or{' '}
              <label
                htmlFor="video-file-upload"
                className="cursor-pointer text-[#32FF00] hover:underline"
              >
                browse files
              </label>
            </p>
            <p className="text-xs text-neutral-400">
              Supports MP4, WebM, MOV, AVI (up to <strong className="text-neutral-200">500MB</strong>)
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleLoadSampleVideo}
              disabled={isGeneratingSample}
              className="min-h-[40px] inline-flex items-center gap-2 rounded-xl bg-[#32FF00]/10 border border-[#32FF00]/30 px-4 py-2 text-xs font-semibold text-[#32FF00] hover:bg-[#32FF00]/20 transition-colors disabled:opacity-50"
            >
              {isGeneratingSample ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Synthesizing Traffic Stream...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Load Benchmark Traffic Video</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Selected Video Card & Processing Options Form */}
      {selectedVideo && (
        <form onSubmit={handleSubmit} className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 space-y-6 shadow-xl animate-in fade-in">
          {/* Video Metadata Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#16213E] border border-[#32FF00]/30 text-[#32FF00]">
                <Video className="h-5 w-5" />
              </div>
              <div>
                <span className="text-sm font-bold text-white truncate max-w-[280px] sm:max-w-md block">
                  {selectedVideo.meta.name}
                </span>
                <div className="flex items-center gap-2 text-xs text-neutral-400 font-mono mt-0.5">
                  <span>{selectedVideo.meta.sizeFormatted}</span>
                  <span aria-hidden="true">·</span>
                  <span>{selectedVideo.meta.durationFormatted}</span>
                  <span aria-hidden="true">·</span>
                  <span>{selectedVideo.meta.width} × {selectedVideo.meta.height}</span>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isProcessing}
              className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#32FF00] px-6 py-2.5 text-xs font-bold text-neutral-950 hover:bg-[#32FF00] shadow-md transition-all disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Processing Frames ({processingProgress.percent}%)...</span>
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 fill-current" />
                  <span>Start Video Inference</span>
                </>
              )}
            </button>
          </div>

          {/* Progress Indicator */}
          {isProcessing && (
            <div className="space-y-2 rounded-xl border border-[#32FF00]/30 bg-[#32FF00]/10 p-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#32FF00]">
                  Frame-by-frame analysis in progress
                </span>
                <span className="font-mono text-[#32FF00] font-bold tabular-nums">
                  {processingProgress.processed} of {processingProgress.total} frames processed ({processingProgress.percent}%)
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-neutral-800 overflow-hidden">
                <div
                  className="h-full bg-[#32FF00] transition-all duration-200"
                  style={{ width: `${Math.max(5, processingProgress.percent)}%` }}
                />
              </div>
            </div>
          )}

          {/* Options Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Mode Selection */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-300">
                Processing Strategy
              </label>
              <div className="space-y-2 text-xs">
                <label className="flex items-center gap-2.5 p-2 rounded-lg border border-neutral-800 bg-neutral-950 cursor-pointer hover:border-neutral-700">
                  <input
                    type="radio"
                    name="proc-mode"
                    value="sample"
                    checked={mode === 'sample'}
                    onChange={() => setMode('sample')}
                    className="accent-[#32FF00]"
                  />
                  <div>
                    <span className="font-semibold text-white block">Sample Frames (Recommended)</span>
                    <span className="text-[11px] text-neutral-400">Process every Nth frame for fast edge preview</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-2 rounded-lg border border-neutral-800 bg-neutral-950 cursor-pointer hover:border-neutral-700">
                  <input
                    type="radio"
                    name="proc-mode"
                    value="entire"
                    checked={mode === 'entire'}
                    onChange={() => setMode('entire')}
                    className="accent-[#32FF00]"
                  />
                  <div>
                    <span className="font-semibold text-white block">Process Entire Video</span>
                    <span className="text-[11px] text-neutral-400">Exhaustive frame-by-frame verification</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-2 rounded-lg border border-neutral-800 bg-neutral-950 cursor-pointer hover:border-neutral-700">
                  <input
                    type="radio"
                    name="proc-mode"
                    value="realtime"
                    checked={mode === 'realtime'}
                    onChange={() => setMode('realtime')}
                    className="accent-[#32FF00]"
                  />
                  <div>
                    <span className="font-semibold text-white block">Real-Time Overlay</span>
                    <span className="text-[11px] text-neutral-400">Stream predictions dynamically during playback</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Frame Sampling Rate & Model */}
            <div className="space-y-4">
              {mode === 'sample' && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold uppercase tracking-wider text-neutral-300">
                      Sampling Rate:
                    </span>
                    <span className="font-mono text-[#32FF00] font-bold tabular-nums">
                      {samplingFps} FPS
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="30"
                    step="1"
                    value={samplingFps}
                    onChange={(e) => setSamplingFps(parseInt(e.target.value, 10))}
                    className="w-full accent-[#32FF00] cursor-pointer"
                  />
                  <p className="text-[11px] text-neutral-500">
                    Extracts {samplingFps} frame{samplingFps === 1 ? '' : 's'} per second of video
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-300">
                  Target Neural Backbone
                </label>
                <select
                  value={modelId}
                  onChange={(e) => setModelId(e.target.value as VisionModelId)}
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-xs text-white focus:border-[#32FF00] focus:outline-none"
                >
                  {MODEL_LIST.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-neutral-500">
                  {VISION_MODELS[modelId].tagline}
                </p>
              </div>
            </div>

            {/* Tracking & Trajectory Toggles */}
            <div className="space-y-3">
              <span className="block text-xs font-semibold uppercase tracking-wider text-neutral-300">
                Temporal Vision Features
              </span>

              <label className="flex items-center gap-2.5 p-2 rounded-lg border border-neutral-800 bg-neutral-950 text-xs cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={enableTracking}
                  onChange={(e) => setEnableTracking(e.target.checked)}
                  className="rounded border-neutral-700 bg-neutral-800 text-[#32FF00] focus:ring-[#32FF00]"
                />
                <div>
                  <span className="font-semibold text-white block">Multi-Object Tracking (MOT)</span>
                  <span className="text-[11px] text-neutral-400">Persistent ID association across frames</span>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-2 rounded-lg border border-neutral-800 bg-neutral-950 text-xs cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={enableTrajectory}
                  onChange={(e) => setEnableTrajectory(e.target.checked)}
                  className="rounded border-neutral-700 bg-neutral-800 text-[#32FF00] focus:ring-[#32FF00]"
                />
                <div>
                  <span className="font-semibold text-white block">Trajectory Path Trails</span>
                  <span className="text-[11px] text-neutral-400">Draw motion vectors behind moving targets</span>
                </div>
              </label>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
