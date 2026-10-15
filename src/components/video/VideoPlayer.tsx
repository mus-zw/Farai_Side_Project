import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Rewind,
  Volume2,
  VolumeX,
  Maximize2,
  SlidersHorizontal,
  Layers,
  Sparkles,
  Filter,
} from 'lucide-react';
import { VideoDetectionResponse, FrameDetection, VideoTrackedObject } from '../../types';
import { getClassColor } from '../../utils/colors';
import { capitalizeClass } from '../../utils/formatters';

interface VideoPlayerProps {
  videoUrl: string;
  detectionData?: VideoDetectionResponse | null;
  onFrameChange?: (frameNumber: number, timestamp: number) => void;
  filterClass?: string | null;
}

export default function VideoPlayer({
  videoUrl,
  detectionData,
  onFrameChange,
  filterClass = null,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [currentFrameNumber, setCurrentFrameNumber] = useState<number>(0);
  const [currentDetections, setCurrentDetections] = useState<VideoTrackedObject[]>([]);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [showMasks, setShowMasks] = useState<boolean>(true);
  const [showTrails, setShowTrails] = useState<boolean>(true);
  const [selectedClassFilter, setSelectedClassFilter] = useState<string | null>(filterClass);

  const fps = detectionData?.fps || 24;

  // Draw overlay bounding boxes and trajectories onto canvas
  const renderOverlay = useCallback(
    (timestamp: number) => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Sync canvas dimensions to video render size
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 360;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!detectionData?.frame_detections || detectionData.frame_detections.length === 0) {
        return;
      }

      // Find closest frame by timestamp
      const frameIdx = Math.min(
        detectionData.frame_detections.length - 1,
        Math.max(0, Math.floor(timestamp * fps))
      );
      const frame = detectionData.frame_detections[frameIdx];

      if (!frame || !frame.boxes) return;

      setCurrentFrameNumber(frame.frame_number);
      if (onFrameChange) {
        onFrameChange(frame.frame_number, frame.timestamp);
      }

      // Filter boxes
      const boxes = frame.boxes.filter(
        (b) => !selectedClassFilter || b.className.toLowerCase() === selectedClassFilter.toLowerCase()
      );
      setCurrentDetections(boxes);

      const width = canvas.width;
      const height = canvas.height;

      // 1. Draw trajectory paths
      if (showTrails) {
        for (const box of boxes) {
          if (box.trajectory && box.trajectory.length > 1) {
            ctx.save();
            ctx.strokeStyle = box.color;
            ctx.lineWidth = Math.max(2, Math.round(width * 0.003));
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(box.trajectory[0][0] * width, box.trajectory[0][1] * height);
            for (let i = 1; i < box.trajectory.length; i++) {
              ctx.lineTo(box.trajectory[i][0] * width, box.trajectory[i][1] * height);
            }
            ctx.stroke();
            ctx.restore();
          }
        }
      }

      // 2. Draw masks and bounding boxes
      for (const box of boxes) {
        const [nx, ny, nw, nh] = box.bbox;
        const bx = nx * width;
        const by = ny * height;
        const bw = nw * width;
        const bh = nh * height;
        const color = getClassColor(box.className);

        // Instance Mask
        if (showMasks) {
          ctx.save();
          ctx.fillStyle = `rgba(${color.rgb}, 0.25)`;
          ctx.beginPath();
          ctx.roundRect(bx, by, bw, bh, 6);
          ctx.fill();
          ctx.restore();
        }

        // Bounding Box
        ctx.save();
        ctx.strokeStyle = color.hex;
        ctx.lineWidth = Math.max(2.5, Math.round(width * 0.0035));
        ctx.strokeRect(bx, by, bw, bh);

        // Corner accents
        const notch = Math.min(14, bw * 0.25, bh * 0.25);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(3, Math.round(width * 0.0045));
        ctx.beginPath();
        ctx.moveTo(bx, by + notch);
        ctx.lineTo(bx, by);
        ctx.lineTo(bx + notch, by);
        ctx.stroke();

        // Label Badge with ID Tracking
        const fontSize = Math.max(11, Math.min(16, Math.round(width * 0.016)));
        ctx.font = `600 ${fontSize}px "Plus Jakarta Sans", sans-serif`;

        const labelText = `#${box.trackId} ${box.className.toUpperCase()} ${(box.confidence * 100).toFixed(0)}%`;
        const textMetrics = ctx.measureText(labelText);
        const textW = textMetrics.width;
        const textH = fontSize * 1.3;
        const padX = 6;
        const padY = 3;

        const chipY = by > textH + 6 ? by - textH - padY : by;

        ctx.fillStyle = color.hex;
        ctx.beginPath();
        ctx.roundRect(bx, chipY, textW + padX * 2, textH + padY, 4);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, bx + padX, chipY + (textH + padY) / 2);

        ctx.restore();
      }
    },
    [detectionData, fps, onFrameChange, selectedClassFilter, showMasks, showTrails]
  );

  // Animation frame loop synchronized with video playback
  useEffect(() => {
    let animId: number;

    const loop = () => {
      const video = videoRef.current;
      if (video) {
        setCurrentTime(video.currentTime);
        renderOverlay(video.currentTime);
      }
      if (isPlaying) {
        animId = requestAnimationFrame(loop);
      }
    };

    if (isPlaying) {
      animId = requestAnimationFrame(loop);
    } else {
      renderOverlay(videoRef.current?.currentTime || 0);
    }

    return () => cancelAnimationFrame(animId);
  }, [isPlaying, renderOverlay]);

  // Video event handlers
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration || 0);
      renderOverlay(0);
    }
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const handleSeek = (newTime: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = newTime;
    setCurrentTime(newTime);
    renderOverlay(newTime);
  };

  const handleSkip = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    const target = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
    handleSeek(target);
  };

  const handleSpeedChange = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  // Format time (00:04.2)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${mins}:${parseFloat(secs) < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 sm:p-6 space-y-4 shadow-xl">
      {/* Visual Canvas + Video Stage */}
      <div className="relative aspect-[16/9] w-full max-h-[580px] overflow-hidden rounded-xl border border-neutral-800 bg-black flex items-center justify-center">
        {/* HTML5 Video Element */}
        <video
          ref={videoRef}
          src={videoUrl}
          playsInline
          muted={isMuted}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => setIsPlaying(false)}
          className="h-full w-full object-contain pointer-events-none"
        />

        {/* Real-time Bounding Box & Trajectory Overlay Canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full object-contain pointer-events-none"
        />

        {/* Active Frame Info Tag */}
        <div className="absolute top-3 left-3 flex items-center gap-2 rounded-lg bg-neutral-950/80 border border-neutral-800 px-2.5 py-1 text-[11px] font-mono text-neutral-300 backdrop-blur-sm pointer-events-none shadow-md">
          <span className="text-[#32FF00] font-bold">FRAME #{currentFrameNumber}</span>
          <span>·</span>
          <span>{formatTime(currentTime)}</span>
          <span>·</span>
          <span className="text-cyan-300">{currentDetections.length} objects active</span>
        </div>

        {/* Big Center Play/Pause button on click */}
        <button
          type="button"
          onClick={togglePlay}
          aria-label={isPlaying ? 'Pause video' : 'Play video'}
          className="absolute inset-0 w-full h-full flex items-center justify-center group focus:outline-none"
        >
          {!isPlaying && (
            <div className="h-16 w-16 rounded-full bg-[#32FF00]/90 text-neutral-950 flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
              <Play className="h-7 w-7 fill-current ml-1" />
            </div>
          )}
        </button>
      </div>

      {/* Scrub Bar */}
      <div className="space-y-1">
        <input
          type="range"
          min="0"
          max={duration || 10}
          step="0.04"
          value={currentTime}
          onChange={(e) => handleSeek(parseFloat(e.target.value))}
          className="w-full h-2 rounded-lg accent-[#32FF00] bg-neutral-800 cursor-pointer"
        />
        <div className="flex items-center justify-between text-xs font-mono text-neutral-400">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
        {/* Playback Transport Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePlay}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-[#32FF00] text-neutral-950 hover:bg-[#32FF00] font-bold transition-colors"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current ml-0.5" />}
          </button>

          <button
            type="button"
            onClick={() => handleSkip(-5)}
            className="min-h-[40px] px-2.5 py-1 text-xs text-neutral-300 hover:text-white rounded-lg border border-neutral-800 hover:bg-neutral-800 transition-colors flex items-center gap-1"
            title="Rewind 5s"
          >
            <Rewind className="h-3.5 w-3.5" />
            <span>-5s</span>
          </button>

          <button
            type="button"
            onClick={() => handleSkip(5)}
            className="min-h-[40px] px-2.5 py-1 text-xs text-neutral-300 hover:text-white rounded-lg border border-neutral-800 hover:bg-neutral-800 transition-colors flex items-center gap-1"
            title="Fast Forward 5s"
          >
            <FastForward className="h-3.5 w-3.5" />
            <span>+5s</span>
          </button>

          <button
            type="button"
            onClick={() => handleSeek(0)}
            className="min-h-[40px] p-2 text-neutral-400 hover:text-white rounded-lg border border-neutral-800 hover:bg-neutral-800 transition-colors"
            title="Restart"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>

          {/* Speed Selector */}
          <div className="flex items-center rounded-lg border border-neutral-800 bg-neutral-950 p-0.5 text-xs font-mono ml-2">
            {[0.5, 1.0, 1.5, 2.0].map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() => handleSpeedChange(rate)}
                className={`px-2 py-1 rounded transition-colors ${
                  playbackRate === rate
                    ? 'bg-[#32FF00] text-neutral-950 font-bold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>
        </div>

        {/* Toggles & Filters */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-300">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showMasks}
              onChange={(e) => setShowMasks(e.target.checked)}
              className="rounded border-neutral-700 bg-neutral-800 text-[#32FF00] focus:ring-[#32FF00]"
            />
            <span>Masks</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showTrails}
              onChange={(e) => setShowTrails(e.target.checked)}
              className="rounded border-neutral-700 bg-neutral-800 text-[#32FF00] focus:ring-[#32FF00]"
            />
            <span>Trajectories</span>
          </label>

          {/* Class Filter Dropdown */}
          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-neutral-400" />
            <select
              value={selectedClassFilter || ''}
              onChange={(e) => setSelectedClassFilter(e.target.value || null)}
              className="rounded-lg border border-neutral-800 bg-neutral-950 px-2 py-1 text-xs text-white focus:border-[#32FF00] focus:outline-none"
            >
              <option value="">All Classes</option>
              {Object.keys(detectionData?.summary.object_count_per_class || {}).map((cls) => (
                <option key={cls} value={cls}>
                  {capitalizeClass(cls)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
