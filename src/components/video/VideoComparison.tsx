import React, { useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Scale, Columns, Sparkles } from 'lucide-react';
import { VideoDetectionResponse } from '../../types';

interface VideoComparisonProps {
  videoUrl: string;
  detectionData?: VideoDetectionResponse | null;
}

export default function VideoComparison({
  videoUrl,
  detectionData,
}: VideoComparisonProps) {
  const videoLeftRef = useRef<HTMLVideoElement>(null);
  const videoRightRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);

  const toggleSyncPlay = () => {
    const left = videoLeftRef.current;
    const right = videoRightRef.current;
    if (!left || !right) return;

    if (left.paused) {
      left.play();
      right.play();
      setIsPlaying(true);
    } else {
      left.pause();
      right.pause();
      setIsPlaying(false);
    }
  };

  const handleSyncSeek = (time: number) => {
    if (videoLeftRef.current) videoLeftRef.current.currentTime = time;
    if (videoRightRef.current) videoRightRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${mins}:${parseFloat(secs) < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5 space-y-5 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-3">
        <div className="flex items-center gap-2">
          <Scale className="h-5 w-5 text-[#32FF00]" />
          <h4 className="font-display text-base font-bold text-white">
            Synchronized Dual-Stream Video Verification
          </h4>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleSyncPlay}
            className="min-h-[40px] inline-flex items-center gap-2 rounded-xl bg-[#32FF00] px-4 py-1.5 text-xs font-bold text-neutral-950 hover:bg-[#32FF00] transition-colors"
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
            <span>{isPlaying ? 'Pause Dual Streams' : 'Play Both Synchronously'}</span>
          </button>

          <button
            type="button"
            onClick={() => handleSyncSeek(0)}
            className="min-h-[40px] p-2 text-neutral-400 hover:text-white rounded-lg border border-neutral-800 hover:bg-neutral-800"
            title="Restart"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Side-by-side Dual Videos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Stream 1: Raw Unprocessed Video */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-neutral-300">
            <span className="font-semibold">Stream 1: Raw Source Capture</span>
            <span className="font-mono text-neutral-500 text-[11px]">Unannotated</span>
          </div>
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl border border-neutral-800 bg-black">
            <video
              ref={videoLeftRef}
              src={videoUrl}
              muted
              playsInline
              onLoadedMetadata={() => setDuration(videoLeftRef.current?.duration || 0)}
              onTimeUpdate={() => setCurrentTime(videoLeftRef.current?.currentTime || 0)}
              className="h-full w-full object-contain"
            />
            <div className="absolute top-2 left-2 rounded bg-neutral-950/80 px-2 py-0.5 text-[10px] font-mono text-neutral-400">
              Raw Input
            </div>
          </div>
        </div>

        {/* Stream 2: Processed Visual Perception Layer */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-neutral-300">
            <span className="font-semibold text-[#32FF00]">Stream 2: Temporal Model Layer</span>
            <span className="font-mono text-[#32FF00] text-[11px]">
              {detectionData?.summary.total_objects || 'Dynamic'} targets active
            </span>
          </div>
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl border border-[#32FF00]/40 bg-black">
            <video
              ref={videoRightRef}
              src={videoUrl}
              muted
              playsInline
              className="h-full w-full object-contain"
            />
            <div className="absolute top-2 left-2 rounded bg-[#16213E] border border-[#32FF00]/40 px-2 py-0.5 text-[10px] font-mono text-[#32FF00]">
              Annotated Tracker
            </div>
          </div>
        </div>
      </div>

      {/* Synchronized scrub bar */}
      <div className="space-y-1">
        <input
          type="range"
          min="0"
          max={duration || 10}
          step="0.05"
          value={currentTime}
          onChange={(e) => handleSyncSeek(parseFloat(e.target.value))}
          className="w-full h-2 rounded-lg accent-[#32FF00] bg-neutral-800 cursor-pointer"
        />
        <div className="flex items-center justify-between text-xs font-mono text-neutral-400">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}
