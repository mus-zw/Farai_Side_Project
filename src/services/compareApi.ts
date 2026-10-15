import axios from 'axios';
import { CompareResponse } from '../types';
import { apiUrl, toApiError } from './apiClient';

// Each model not yet resident loads on first use (several seconds for the
// large ones), and they run one after another, so allow plenty of time.
export const COMPARE_TIMEOUT_MS = 300_000;

/**
 * Runs one image through several models via POST /api/compare.
 * Valid model names come from /api/model-info `selectable_models`.
 */
export async function compareModels(
  file: File | Blob,
  models: string[],
  confidenceThreshold: number,
  signal?: AbortSignal
): Promise<CompareResponse> {
  const endpoint = apiUrl('/api/compare');
  const formData = new FormData();
  formData.append('file', file);

  // FastAPI reads a list query parameter from repeated keys:
  // ?models=a&models=b, not axios' default models[]=a.
  const params = new URLSearchParams();
  models.forEach((m) => params.append('models', m));
  params.append('confidence', String(confidenceThreshold));

  try {
    const response = await axios.post<CompareResponse>(`${endpoint}?${params.toString()}`, formData, {
      timeout: COMPARE_TIMEOUT_MS,
      signal,
    });
    return response.data;
  } catch (err) {
    throw toApiError(err, endpoint, COMPARE_TIMEOUT_MS);
  }
}
