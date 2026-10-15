// Mirrors ClassDetections / DetectionResponse in cv-backend/app/schemas.py.
export interface DetectionScoreBreakdown {
  count: number;
  confidence_scores: number[];
  // [x1, y1, x2, y2] in pixels of the analysed image.
  bounding_boxes?: number[][];
  // Hex colour the backend used for this class in the annotated image.
  color?: string;
  // Not sent by the backend; some views compute and cache it.
  average_confidence?: number;
}

export interface DetectionResponse {
  total_objects: number;
  detections: Record<string, DetectionScoreBreakdown>;
  processing_time_ms: number;
  // data: URL; the backend encodes JPEG.
  annotated_image_base64: string;
  model_name: string;
  confidence_threshold: number;
  // Optional only because results restored from the gallery don't carry them.
  image_width?: number;
  image_height?: number;
  cached?: boolean;
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
    modelName: string;
    detections: Record<string, DetectionScoreBreakdown>;
  };
  error?: string;
}

// Mirrors CompareResponse and friends in cv-backend/app/schemas.py.
export interface ModelComparisonEntry {
  model_name: string;
  label: string;
  total_objects: number;
  detections: Record<string, DetectionScoreBreakdown>;
  processing_time_ms: number;
  annotated_image_base64: string;
  cached?: boolean;
}

export interface ClassCountComparison {
  class_name: string;
  counts: Record<string, number>;
}

export interface PairwiseAgreement {
  model_a: string;
  model_b: string;
  matched: number;
  f1: number;
}

export interface ComparisonSummary {
  classes: ClassCountComparison[];
  fastest_model: string;
  most_objects_model: string;
  agreement: number;
  agreement_method: string;
  pairwise: PairwiseAgreement[];
}

export interface CompareResponse {
  image_width: number;
  image_height: number;
  confidence_threshold: number;
  results: ModelComparisonEntry[];
  comparison: ComparisonSummary;
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

// One detected box in a video frame, derived client-side from the backend's
// per-class bounding_boxes. There is no tracking: boxes carry no identity
// across frames.
export interface VideoBox {
  id: string;
  className: string;
  confidence: number;
  bbox: [number, number, number, number]; // [x, y, w, h] normalised 0-1
  color: string;
}

// Mirrors FrameDetection / VideoSummary / VideoResponse in cv-backend/app/schemas.py.
export interface FrameDetection {
  frame_number: number;
  timestamp: number; // in seconds
  total_objects: number;
  detections: Record<string, DetectionScoreBreakdown>;
  // Added by videoApi from `detections`; not part of the backend response.
  boxes?: VideoBox[];
}

export interface VideoSummary {
  total_objects: number;
  classes_detected: string[];
  object_count_per_class: Record<string, number>;
  average_confidence_per_class: Record<string, number>;
  peak_frame: number;
  peak_frame_count: number;
}

export interface VideoDetectionResponse {
  total_frames: number;
  frames_analysed: number;
  fps: number;
  duration_seconds: number;
  frame_stride: number;
  width: number;
  height: number;
  processing_time_ms: number;
  frame_detections: FrameDetection[];
  annotated_video_base64: string | null;
  summary: VideoSummary;
  model_name: string;
  confidence_threshold: number;
}

export interface VideoProcessingOptions {
  // Analyse every Nth frame (backend `frame_stride`, 1-60).
  frameStride: number;
  confidenceThreshold: number;
  onUploadProgress?: (percent: number) => void;
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

