import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Play, Pause, RotateCcw, FastForward, Rewind } from 'lucide-react';
import { VideoDetectionResponse } from '../../types';
import {
  activeCountsByClass,
  clampBox,
  layoutLabel,
  overlayAtTime,
  playbackFrameNumber,
  readableTextColor,
  shouldDrawLabel,
  weakBoxOpacity,
} from '../../utils/videoOverlay';
import { capitalizeClass } from '../../utils/formatters';

interface VideoPlayerProps {
  videoUrl: string;
  detectionData?: VideoDetectionResponse | null;
  /** Called when the frame on screen changes: source frame number and its time in seconds. */
  onFrameChange?: (frameNumber: number, timestamp: number) => void;
  /** A new `nonce` makes the player jump to `time` (seconds). The initial value is ignored. */
  seekRequest?: { time: number; nonce: number } | null;
  /** Where to start when this player mounts (e.g. after switching sub-tabs). */
  startTime?: number;
  filterClass?: string | null;
}

interface Hud {
  time: number;
  frame: number;
  count: number;
}

// Pixel sizes below are in *screen* pixels; they are divided by the video's
// display scale before drawing, so a tall portrait clip shown small still gets
// readable labels and a 4K clip shown small does not get hairlines.
const FONT_PX = 12;
const LINE_PX = 2;

export default function VideoPlayer({
  videoUrl,
  detectionData,
  onFrameChange,
  seekRequest = null,
  startTime = 0,
  filterClass = null,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [duration, setDuration] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [isMuted] = useState<boolean>(true);
  const [selectedClassFilter, setSelectedClassFilter] = useState<string | null>(filterClass);

  // What the HUD, scrub bar and pills show. Written only when a value changes,
  // never once per animation frame.
  const [hud, setHud] = useState<Hud>({ time: 0, frame: 0, count: 0 });
  const [liveCounts, setLiveCounts] = useState<Record<string, number>>({});
  const hudRef = useRef<Hud>({ time: -1, frame: -1, count: -1 });
  const countsKeyRef = useRef<string>('');
  const reportedFrameRef = useRef<number>(-1);

  const onFrameChangeRef = useRef(onFrameChange);
  onFrameChangeRef.current = onFrameChange;

  const frames = detectionData?.frame_detections;
  const fps = detectionData?.fps ?? 30;
  const totalFrames = detectionData?.total_frames ?? 0;

  // Classes for the pills, most frequent first.
  const classes = useMemo(
    () =>
      Object.entries(detectionData?.summary.object_count_per_class ?? {})
        .sort((a, b) => b[1] - a[1])
        .map(([name]) => name),
    [detectionData]
  );
  const classColors = useMemo(() => {
    const colors: Record<string, string> = {};
    for (const f of frames ?? []) {
      for (const [name, entry] of Object.entries(f.detections)) {
        if (!colors[name] && entry.color) colors[name] = entry.color;
      }
    }
    return colors;
  }, [frames]);

  /** Draw the boxes for `mediaTime` and sync the HUD to it. */
  const draw = useCallback(
    (mediaTime: number) => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Canvas pixels = the video's displayed pixels (after any rotation).
      const cw = video.videoWidth || canvas.width || 640;
      const ch = video.videoHeight || canvas.height || 360;
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
      }
      ctx.clearRect(0, 0, cw, ch);

      const state = overlayAtTime(frames ?? [], mediaTime);
      const filter = selectedClassFilter?.toLowerCase() ?? null;
      const visible = filter ? state.boxes.filter((b) => b.className.toLowerCase() === filter) : state.boxes;
      const activeCount = filter
        ? visible.filter((b) => b.alpha >= 0.5).length
        : state.activeCount;

      // Screen pixels per canvas pixel under object-fit: contain.
      const rect = canvas.getBoundingClientRect();
      const scale = rect.width > 0 && rect.height > 0 ? Math.min(rect.width / cw, rect.height / ch) : 1;
      const px = (n: number) => n / scale;

      const fontSize = px(FONT_PX);
      const padX = px(6);
      const padY = px(3);
      const chipH = fontSize * 1.25 + padY * 2;
      ctx.font = `600 ${fontSize}px "Plus Jakarta Sans", sans-serif`;
      ctx.textBaseline = 'middle';

      for (const box of visible) {
        const [x, y, w, h] = clampBox(
          [box.bbox[0] * cw, box.bbox[1] * ch, box.bbox[2] * cw, box.bbox[3] * ch],
          cw,
          ch
        );
        if (w <= 0 || h <= 0) continue;

        ctx.save();
        ctx.globalAlpha = box.alpha * weakBoxOpacity(box.confidence);
        ctx.strokeStyle = box.color;
        ctx.lineWidth = px(LINE_PX);
        ctx.strokeRect(x, y, w, h);

        // Busy scene: no label on tiny or weak boxes (unless one class is isolated).
        if (!shouldDrawLabel(w * scale, h * scale, box.confidence, filter !== null)) {
          ctx.restore();
          continue;
        }

        const label = `${box.className.toUpperCase()} ${(box.confidence * 100).toFixed(0)}%`;
        const chip = layoutLabel({ x, y, w, h }, ctx.measureText(label).width + padX * 2, chipH, cw, ch);
        ctx.fillStyle = box.color;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') ctx.roundRect(chip.x, chip.y, chip.w, chip.h, px(3));
        else ctx.rect(chip.x, chip.y, chip.w, chip.h);
        ctx.fill();
        ctx.fillStyle = readableTextColor(box.color);
        ctx.fillText(label, chip.x + padX, chip.y + chip.h / 2);
        ctx.restore();
      }

      // --- HUD, kept in step with the frame actually on screen ---
      const frame = playbackFrameNumber(mediaTime, fps, totalFrames);
      const prev = hudRef.current;
      if (
        frame !== prev.frame ||
        activeCount !== prev.count ||
        Math.abs(mediaTime - prev.time) >= 0.04
      ) {
        hudRef.current = { time: mediaTime, frame, count: activeCount };
        setHud(hudRef.current);
      }

      const counts = activeCountsByClass(state);
      const key = JSON.stringify(counts);
      if (key !== countsKeyRef.current) {
        countsKeyRef.current = key;
        setLiveCounts(counts);
      }

      if (frame !== reportedFrameRef.current) {
        reportedFrameRef.current = frame;
        onFrameChangeRef.current?.(frame, mediaTime);
      }
    },
    [frames, fps, totalFrames, selectedClassFilter]
  );

  // Keep the overlay locked to the frame the browser presents. With
  // requestVideoFrameCallback we get the exact media time of each presented
  // frame (including after seeks); otherwise fall back to polling currentTime
  // while playing.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const redraw = () => draw(video.currentTime);
    const hasRvfc = typeof video.requestVideoFrameCallback === 'function';

    // Without frame callbacks, timeupdate/play also trigger redraws; with them
    // those would race the callback and flicker by a frame, so skip them.
    const events = hasRvfc
      ? ['seeked', 'loadeddata', 'pause', 'ended']
      : ['seeked', 'loadeddata', 'pause', 'ended', 'play', 'timeupdate', 'ratechange'];
    events.forEach((e) => video.addEventListener(e, redraw));

    let handle = 0;
    let raf = 0;
    if (hasRvfc) {
      const onFrame: VideoFrameRequestCallback = (_now, meta) => {
        draw(meta.mediaTime);
        handle = video.requestVideoFrameCallback(onFrame);
      };
      handle = video.requestVideoFrameCallback(onFrame);
    } else if (isPlaying) {
      const loop = () => {
        draw(video.currentTime);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }

    redraw(); // new detections, filter or size: repaint now

    return () => {
      events.forEach((e) => video.removeEventListener(e, redraw));
      if (hasRvfc && handle) video.cancelVideoFrameCallback(handle);
      cancelAnimationFrame(raf);
    };
  }, [draw, isPlaying]);

  // Repaint when the stage is resized, so label sizes follow the display scale.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => draw(videoRef.current?.currentTime ?? 0));
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [draw]);

  // External seek (timeline, frame inspector). The value present at mount is
  // not a request: it was already handled by whichever player was showing.
  const handledNonce = useRef<number | undefined>(seekRequest?.nonce);
  useEffect(() => {
    if (!seekRequest || seekRequest.nonce === handledNonce.current) return;
    handledNonce.current = seekRequest.nonce;
    const video = videoRef.current;
    if (!video) return;
    const limit = Number.isFinite(video.duration) ? video.duration : seekRequest.time;
    video.currentTime = Math.max(0, Math.min(seekRequest.time, limit));
  }, [seekRequest]);

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration || 0);
    if (startTime > 0) video.currentTime = Math.min(startTime, video.duration || startTime);
    draw(video.currentTime);
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => setIsPlaying(false));
    else video.pause();
  };

  const handleSeek = (newTime: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = newTime;
    draw(newTime);
  };

  const handleSkip = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    handleSeek(Math.max(0, Math.min(video.duration || 0, video.currentTime + seconds)));
  };

  const handleSpeedChange = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) videoRef.current.playbackRate = rate;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${mins}:${parseFloat(secs) < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 sm:p-6 space-y-4 shadow-xl">
      {/* Visual Canvas + Video Stage */}
      <div className="relative aspect-[16/9] w-full max-h-[580px] overflow-hidden rounded-xl border border-neutral-800 bg-black flex items-center justify-center">
        <video
          ref={videoRef}
          src={videoUrl}
          playsInline
          muted={isMuted}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          className="h-full w-full object-contain pointer-events-none"
        />

        {/* Bounding box overlay canvas (same object-contain box as the video) */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full object-contain pointer-events-none"
        />

        {/* HUD: source frame on screen, its time, and objects drawn right now */}
        <div
          data-testid="video-hud"
          className="absolute top-3 left-3 flex items-center gap-2 rounded-lg bg-neutral-950/80 border border-neutral-800 px-2.5 py-1 text-[11px] font-mono text-neutral-300 backdrop-blur-sm pointer-events-none shadow-md"
        >
          <span className="text-[#32FF00] font-bold">FRAME #{hud.frame}</span>
          <span>·</span>
          <span>{formatTime(hud.time)}</span>
          <span>·</span>
          <span className="text-cyan-300">
            {hud.count} {hud.count === 1 ? 'object' : 'objects'} active
          </span>
        </div>

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
          value={Math.min(hud.time, duration || 10)}
          onChange={(e) => handleSeek(parseFloat(e.target.value))}
          aria-label="Seek"
          className="w-full h-2 rounded-lg accent-[#32FF00] bg-neutral-800 cursor-pointer"
        />
        <div className="flex items-center justify-between text-xs font-mono text-neutral-400">
          <span>{formatTime(hud.time)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
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
      </div>

      {/* Class pills: live count of what is on screen now; click to show one class only */}
      {classes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by class">
          <button
            type="button"
            onClick={() => setSelectedClassFilter(null)}
            aria-pressed={selectedClassFilter === null}
            className={`min-h-[32px] rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
              selectedClassFilter === null
                ? 'border-[#32FF00] bg-[#32FF00]/15 text-[#32FF00]'
                : 'border-neutral-800 text-neutral-400 hover:text-white'
            }`}
          >
            All
          </button>
          {classes.map((cls) => {
            const selected = selectedClassFilter?.toLowerCase() === cls.toLowerCase();
            const now = liveCounts[cls] ?? 0;
            return (
              <button
                key={cls}
                type="button"
                onClick={() => setSelectedClassFilter(selected ? null : cls)}
                aria-pressed={selected}
                data-class-pill={cls}
                className={`min-h-[32px] inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                  selected
                    ? 'border-[#32FF00] bg-[#32FF00]/15 text-white'
                    : now > 0
                    ? 'border-neutral-600 text-white hover:border-neutral-400'
                    : 'border-neutral-800 text-neutral-500 hover:text-neutral-300'
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: classColors[cls] ?? '#32FF00' }}
                />
                <span>{capitalizeClass(cls)}</span>
                <span className="font-mono tabular-nums text-[11px] text-neutral-300" data-pill-count>
                  {now}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
