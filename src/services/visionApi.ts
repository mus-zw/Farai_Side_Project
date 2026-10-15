import axios, { AxiosProgressEvent } from 'axios';
import { DetectionResponse, ImageMetadata, VisionModelId } from '../types';
import { formatBytes } from '../utils/formatters';
import { VISION_MODELS } from '../utils/models';
import { apiUrl, toApiError } from './apiClient';

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
// Generous on purpose: a cold model load on the server can take tens of
// seconds, and a premature timeout reads to the user as a broken backend.
export const REQUEST_TIMEOUT_MS = 120_000;

export interface AnalysisOptions {
  confidenceThreshold?: number;
  modelId?: VisionModelId;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

export interface VisionDetectionResult extends DetectionResponse {
  metadata?: ImageMetadata;
  modelId?: VisionModelId;
  modelName?: string;
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
 * Runs object detection on the backend.
 *
 * There is deliberately no offline fallback: any failure is thrown as an
 * error describing what went wrong, so a misconfigured backend can never
 * masquerade as a working one.
 */
export async function detectObjects(
  fileOrBlob: File | Blob,
  options: AnalysisOptions = {},
  imageMeta?: ImageMetadata
): Promise<VisionDetectionResult> {
  const endpoint = apiUrl('/api/detect');
  const modelId = options.modelId || 'farai-fpn';
  const modelInfo = VISION_MODELS[modelId] || VISION_MODELS['farai-fpn'];

  // The backend's UploadFile parameter is named `file`.
  const formData = new FormData();
  formData.append('file', fileOrBlob);
  formData.append('model_id', modelId);

  let response;
  try {
    response = await axios.post<DetectionResponse>(endpoint, formData, {
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

  return {
    ...response.data,
    metadata: imageMeta,
    modelId,
    modelName: modelInfo.name,
  };
}
