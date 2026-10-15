import axios from 'axios';
import { apiUrl, toApiError } from './apiClient';

/**
 * Read-only system endpoints. Mirrors HealthResponse and ModelInfoResponse
 * in cv-backend/app/schemas.py.
 */

const SYSTEM_TIMEOUT_MS = 10_000;

export interface HealthResponse {
  status: 'healthy' | 'idle' | 'loading' | string;
  model_loaded: boolean;
  model_name: string;
  device: string;
  gpu_available: boolean;
  gpu_type: string;
  uptime_seconds: number;
  requests_served: number;
  average_processing_time_ms: number;
  idle_unload_seconds: number;
  idle_seconds: number;
  times_unloaded: number;
  gpu_memory_used_mb: number | null;
  gpu_memory_total_mb: number | null;
}

export interface SelectableModel {
  name: string;
  label: string;
  speed?: string;
  accuracy?: string;
  resident?: boolean;
}

export interface ModelInfoResponse {
  current_model: string;
  device: string;
  available_classes: string[];
  num_classes: number;
  supports_segmentation: boolean;
  input_size: number;
  selectable_models: SelectableModel[];
}

async function getJson<T>(path: string): Promise<T> {
  const url = apiUrl(path);
  try {
    const response = await axios.get<T>(url, { timeout: SYSTEM_TIMEOUT_MS });
    return response.data;
  } catch (err) {
    throw toApiError(err, url, SYSTEM_TIMEOUT_MS);
  }
}

export const getHealth = () => getJson<HealthResponse>('/api/health');
export const getModelInfo = () => getJson<ModelInfoResponse>('/api/model-info');
