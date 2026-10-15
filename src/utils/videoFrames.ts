import { FrameDetection } from '../types';

/**
 * Lookups over the backend's frame_detections list.
 *
 * That list holds only the *analysed* frames (every frame_stride-th), in
 * order, so a frame's array position is not its frame number. Everything that
 * maps playback time or a frame number to detections must go through here.
 */

/** Latest analysed frame at or before `seconds`, or the first frame. */
export function frameIndexAtTime(frames: FrameDetection[], seconds: number): number {
  if (frames.length === 0) return -1;
  let lo = 0;
  let hi = frames.length - 1;
  let best = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].timestamp <= seconds) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}

/** Index of the analysed frame closest to a source-video frame number. */
export function frameIndexForFrameNumber(frames: FrameDetection[], frameNumber: number): number {
  if (frames.length === 0) return -1;
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < frames.length; i++) {
    const dist = Math.abs(frames[i].frame_number - frameNumber);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  return bestIdx;
}
