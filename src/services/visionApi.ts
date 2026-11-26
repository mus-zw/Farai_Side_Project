import axios, { AxiosProgressEvent } from 'axios';
import { DetectionResponse, ImageMetadata } from '../types';
import { formatBytes } from '../utils/formatters';
import { apiUrl, toApiError } from './apiClient';

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
// Generous on purpose: a cold model load on the server can take tens of
// seconds, and a premature timeout reads to the user as a broken backend.
export const REQUEST_TIMEOUT_MS = 120_000;

// Where detection runs: on the backend server, or in this browser (ONNX
// Runtime Web; see browserInference.ts). The backend is the default.
export type InferenceEngine = 'backend' | 'browser';

export interface AnalysisOptions {
  // Sent as the `confidence` query parameter. Omitted means the backend's
  // configured default (CONFIDENCE_THRESHOLD, 0.25).
  confidenceThreshold?: number;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
  // Defaults to 'backend'.
  engine?: InferenceEngine;
  // In-browser runs only: what it is doing right now (loading, downloading...).
  onPhase?: (message: string) => void;
}

export interface VisionDetectionResult extends DetectionResponse {
  metadata?: ImageMetadata;
}

/**
 * Validates an image file for size, type, and corruptibility.
 */
export async function validateAndExtractImageMetadata(file: File): Promise<ImageMetadata> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `File size (${formatBytes(file.size)}) exceeds the 50MB limit. Please upload an image under 50MB.`
    );
  }

  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!validTypes.includes(file.type.toLowerCase())) {
    throw new Error('Unsupported format. Please upload a standard JPG, PNG, or WebP image.');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        if (img.naturalWidth === 0 || img.naturalHeight === 0) {
          reject(new Error('Invalid image: File contains zero-width or zero-height dimensions.'));
          return;
        }

        resolve({
          width: img.naturalWidth,
          height: img.naturalHeight,
          sizeBytes: file.size,
          sizeFormatted: formatBytes(file.size),
          format: file.type || 'image/jpeg',
          name: file.name,
        });
      };

      img.onerror = () => {
        reject(new Error('Corrupted image file: Browser could not decode image bitmap.'));
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file from disk.'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Runs object detection, on the backend by default or in this browser when
 * `options.engine` is 'browser'.
 *
 * There is deliberately no silent fallback between the two, and no fake
 * results: any failure is thrown as an error describing what went wrong, so a
 * misconfigured backend or a browser without WebAssembly can never
 * masquerade as a working one. The UI offers the other engine as an explicit
 * choice instead.
 */
export async function detectObjects(
  fileOrBlob: File | Blob,
  options: AnalysisOptions = {},
  imageMeta?: ImageMetadata
): Promise<VisionDetectionResult> {
  if (options.engine === 'browser') {
    // Loaded on demand so ONNX Runtime stays out of the initial bundle.
    const { detectInBrowser } = await import('./browserInference');
    return detectInBrowser(fileOrBlob, options, imageMeta);
  }

  const endpoint = apiUrl('/api/detect');

  // The backend's UploadFile parameter is named `file`. It serves whichever
  // model it is configured with; the name comes back as `model_name`.
  const formData = new FormData();
  formData.append('file', fileOrBlob);

  let response;
  try {
    response = await axios.post<DetectionResponse>(endpoint, formData, {
      params:
        options.confidenceThreshold !== undefined
          ? { confidence: options.confidenceThreshold }
          : undefined,
      timeout: REQUEST_TIMEOUT_MS,
      signal: options.signal,
      onUploadProgress: (progressEvent: AxiosProgressEvent) => {
        if (progressEvent.total && options.onProgress) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          options.onProgress(Math.min(90, percent));
        }
      },
    });
  } catch (err) {
    throw toApiError(err, endpoint, REQUEST_TIMEOUT_MS);
  }

  if (!response.data || typeof response.data.total_objects !== 'number') {
    throw new Error(`Unexpected response from ${endpoint}: missing total_objects.`);
  }

  if (options.onProgress) options.onProgress(100);

  return { ...response.data, metadata: imageMeta };
}
