export interface DetectionScoreBreakdown {
  count: number;
  confidence_scores: number[];
  average_confidence?: number;
}

export interface DetectionResponse {
  total_objects: number;
  detections: Record<string, DetectionScoreBreakdown>;
  processing_time_ms: number;
  annotated_image_base64: string;
}

export interface BoundingBox {
  id: string;
  className: string;
  confidence: number;
  // Normalized 0 to 1 coordinates: [x_min, y_min, width, height]
  bbox: [number, number, number, number];
  color: string;
  polygon?: [number, number][]; // Optional segmentation polygon
}

export interface ImageMetadata {
  width: number;
  height: number;
  sizeBytes: number;
  sizeFormatted: string;
  format: string;
  name: string;
}

export type VisionModelId = 'farai-fpn' | 'yolov8x' | 'mask-rcnn' | 'retinanet';

export interface VisionModelInfo {
  id: VisionModelId;
  name: string;
  tagline: string;
  architecture: string;
  description: string;
  latencyFactor: number;
  confidenceBias: number;
  smallObjectBonus: number;
  supportsMasks: boolean;
}

export interface GalleryItem {
  id: string;
  timestamp: number;
  title: string;
  originalImage: string;
  annotatedImage: string;
  thumbnailImage?: string; // Downscaled for localStorage quota safety
  totalObjects: number;
  processingTimeMs: number;
  detections: Record<string, DetectionScoreBreakdown>;
  topClasses: { name: string; count: number }[];
  modelId?: VisionModelId;
  modelName?: string;
  thresholdUsed?: number;
  metadata?: ImageMetadata;
}

export interface SampleImageOption {
  id: string;
  title: string;
  description: string;
  category: string;
  dataUrl: string;
  expectedObjects: number;
  mockDetections: Record<string, DetectionScoreBreakdown>;
  boxes: BoundingBox[];
  metadata: {
    width: number;
    height: number;
    sizeBytes: number;
    sizeFormatted: string;
    format: string;
  };
}

export interface BatchItem {
  id: string;
  file: File;
  previewUrl: string;
  status: 'queued' | 'processing' | 'done' | 'error';
  progress: number;
  result?: {
    totalObjects: number;
    processingTimeMs: number;
    annotatedImage: string;
    detections: Record<string, DetectionScoreBreakdown>;
  };
  error?: string;
}

export interface ModelComparisonResult {
  modelA: {
    info: VisionModelInfo;
    totalObjects: number;
    processingTimeMs: number;
    avgConfidence: number;
    detections: Record<string, DetectionScoreBreakdown>;
    annotatedImage: string;
  };
  modelB: {
    info: VisionModelInfo;
    totalObjects: number;
    processingTimeMs: number;
    avgConfidence: number;
    detections: Record<string, DetectionScoreBreakdown>;
    annotatedImage: string;
  };
  fasterModel: 'A' | 'B' | 'Tie';
  moreConfidentModel: 'A' | 'B' | 'Tie';
  speedupPercentage: number;
  classComparison: {
    className: string;
    countA: number;
    countB: number;
    diff: number;
  }[];
}

export interface AnalyticsStats {
  totalAnalyzed: number;
  avgLatencyMs: number;
  totalObjectsDetected: number;
  modelCounts: Record<string, number>;
  classCounts: Record<string, number>;
  recentRuns: {
    timestamp: number;
    latencyMs: number;
    objects: number;
    model: string;
  }[];
}

export interface VideoTrackedObject {
  id: string;
  trackId: number;
  className: string;
  confidence: number;
  bbox: [number, number, number, number]; // [x, y, w, h] normalized
  trajectory?: [number, number][]; // center trajectory coordinates
  color: string;
  polygon?: [number, number][];
}

export interface FrameDetection {
  frame_number: number;
  timestamp: number; // in seconds
  detections: Record<string, DetectionScoreBreakdown>;
  boxes?: VideoTrackedObject[];
  sceneChange?: boolean;
  snapshotUrl?: string;
}

export interface VideoSummary {
  total_objects: number;
  unique_tracks?: number;
  object_count_per_class: Record<string, number>;
  average_confidence_per_class: Record<string, number>;
}

export interface VideoDetectionResponse {
  total_frames: number;
  fps: number;
  duration_seconds: number;
  annotated_video_url?: string;
  frame_detections: FrameDetection[];
  summary: VideoSummary;
  processing_time_ms?: number;
  source?: 'live_backend' | 'client_engine';
}

export interface VideoProcessingOptions {
  mode: 'entire' | 'sample' | 'realtime';
  samplingFps: number; // 1-30
  confidenceThreshold: number;
  modelId: VisionModelId;
  enableTracking: boolean;
  enableTrajectory: boolean;
  onProgress?: (processed: number, total: number, percent: number) => void;
  signal?: AbortSignal;
}

export interface VideoMetadata {
  name: string;
  sizeBytes: number;
  sizeFormatted: string;
  durationSeconds: number;
  durationFormatted: string;
  width: number;
  height: number;
  format: string;
}

