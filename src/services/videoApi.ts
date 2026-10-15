import axios, { AxiosProgressEvent } from 'axios';
import { VideoDetectionResponse, VideoProcessingOptions, VideoMetadata } from '../types';
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

  // The backend's UploadFile parameter is named `file`.
  const formData = new FormData();
  formData.append('file', videoFile);
  formData.append('mode', options.mode);
  formData.append('sampling_fps', String(options.samplingFps));
  formData.append('confidence_threshold', String(options.confidenceThreshold));
  formData.append('model_id', options.modelId);
  formData.append('enable_tracking', String(options.enableTracking));

  let response;
  try {
    response = await axios.post<VideoDetectionResponse>(endpoint, formData, {
      timeout: VIDEO_REQUEST_TIMEOUT_MS,
      signal: options.signal,
      onUploadProgress: (progressEvent: AxiosProgressEvent) => {
        if (progressEvent.total && options.onProgress) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          options.onProgress(0, 100, Math.min(50, Math.round(percent / 2)));
        }
      },
    });
  } catch (err) {
    throw toApiError(err, endpoint, VIDEO_REQUEST_TIMEOUT_MS);
  }

  if (!response.data || !Array.isArray(response.data.frame_detections)) {
    throw new Error(`Unexpected response from ${endpoint}: missing frame_detections.`);
  }

  return {
    ...response.data,
    processing_time_ms: Math.round(performance.now() - startTime),
  };
}
