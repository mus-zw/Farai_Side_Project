import axios, { AxiosProgressEvent } from 'axios';
import {
  FrameDetection,
  VideoBox,
  VideoDetectionResponse,
  VideoMetadata,
  VideoProcessingOptions,
} from '../types';
import { formatBytes } from '../utils/formatters';
import { apiUrl, toApiError } from './apiClient';

export const MAX_VIDEO_SIZE_BYTES = 500 * 1024 * 1024; // 500MB
// Video runs every analysed frame through the model in one synchronous
// request, so minutes are normal for longer clips.
export const VIDEO_REQUEST_TIMEOUT_MS = 600_000;

/**
 * Validates and extracts duration, width, height, and file metadata for video uploads.
 */
export async function validateAndExtractVideoMetadata(file: File): Promise<VideoMetadata> {
  if (file.size > MAX_VIDEO_SIZE_BYTES) {
    throw new Error(
      `Video size (${formatBytes(file.size)}) exceeds the 500MB limit. Please upload a smaller video clip.`
    );
  }

  const validTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/avi'];
  // Also check extension if MIME is generic
  const hasValidExt = /\.(mp4|webm|mov|avi)$/i.test(file.name);

  if (!validTypes.includes(file.type.toLowerCase()) && !hasValidExt) {
    throw new Error('Unsupported video format. Please upload MP4, WebM, MOV, or AVI video.');
  }

  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';

    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl);
      const durationSec = video.duration || 0;
      const mins = Math.floor(durationSec / 60);
      const secs = Math.floor(durationSec % 60);
      const formattedDuration = `${mins}:${secs < 10 ? '0' : ''}${secs} (${durationSec.toFixed(1)}s)`;

      resolve({
        name: file.name,
        sizeBytes: file.size,
        sizeFormatted: formatBytes(file.size),
        durationSeconds: durationSec,
        durationFormatted: formattedDuration,
        width: video.videoWidth || 1280,
        height: video.videoHeight || 720,
        format: file.type || 'video/mp4',
      });
    };

    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Corrupted or unreadable video file. Could not decode video track.'));
    };
  });
}

/**
 * Sends a video to the backend's /api/detect-video endpoint.
 *
 * Failures are thrown, never replaced with synthetic tracks: fabricated video
 * detections are indistinguishable from real ones once rendered.
 */
export async function processVideo(
  videoFile: File | Blob,
  options: VideoProcessingOptions
): Promise<VideoDetectionResponse> {
  const endpoint = apiUrl('/api/detect-video');
  const startTime = performance.now();

  // The backend's UploadFile parameter is named `file`; everything else is a
  // query parameter.
  const formData = new FormData();
  formData.append('file', videoFile);

  let response;
  try {
    response = await axios.post<VideoDetectionResponse>(endpoint, formData, {
      params: {
        confidence: options.confidenceThreshold,
        frame_stride: options.frameStride,
        // The UI overlays boxes on the original video, so skip building and
        // base64-encoding an annotated copy nobody reads.
        return_video: false,
      },
      timeout: VIDEO_REQUEST_TIMEOUT_MS,
      signal: options.signal,
      onUploadProgress: (progressEvent: AxiosProgressEvent) => {
        if (progressEvent.total && options.onUploadProgress) {
          options.onUploadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
        }
      },
    });
  } catch (err) {
    throw toApiError(err, endpoint, VIDEO_REQUEST_TIMEOUT_MS);
  }

  if (!response.data || !Array.isArray(response.data.frame_detections)) {
    throw new Error(`Unexpected response from ${endpoint}: missing frame_detections.`);
  }

  const data = response.data;
  return {
    ...data,
    frame_detections: data.frame_detections.map((f) => withBoxes(f, data.width, data.height)),
    // Wall-clock round trip, including upload and decode, is the honest
    // number for video; the backend's figure covers inference only.
    processing_time_ms: Math.round(performance.now() - startTime),
  };
}

/**
 * Flattens the backend's per-class pixel boxes ([x1, y1, x2, y2]) into
 * normalised [x, y, w, h] boxes the overlay can scale to any render size.
 */
function withBoxes(frame: FrameDetection, width: number, height: number): FrameDetection {
  if (!width || !height) return { ...frame, boxes: [] };

  const boxes: VideoBox[] = [];
  for (const [className, entry] of Object.entries(frame.detections)) {
    const coords = entry.bounding_boxes ?? [];
    coords.forEach(([x1, y1, x2, y2], i) => {
      boxes.push({
        id: `${frame.frame_number}-${className}-${i}`,
        className,
        confidence: entry.confidence_scores[i] ?? 0,
        bbox: [x1 / width, y1 / height, (x2 - x1) / width, (y2 - y1) / height],
        color: entry.color ?? '#32FF00',
      });
    });
  }
  return { ...frame, boxes };
}
