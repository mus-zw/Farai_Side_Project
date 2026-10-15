import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Upload,
  Image as ImageIcon,
  Sparkles,
  Layers,
  Scale,
  Files,
  BarChart3,
  Server,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  Keyboard,
  Command,
} from 'lucide-react';
import {
  detectObjects,
  VisionDetectionResult,
  getBackendEndpoint,
  setBackendEndpoint,
  validateAndExtractImageMetadata,
  AnalysisOptions,
} from '../services/visionApi';
import { SAMPLE_IMAGES } from '../utils/sampleData';
import { VISION_MODELS, MODEL_LIST } from '../utils/models';
import {
  loadGallery,
  saveGallery,
  clearGalleryStorage,
  createThumbnail,
} from '../utils/galleryStorage';
import { GalleryItem, SampleImageOption, ImageMetadata, VisionModelId } from '../types';
import ResultsDisplay from '../components/ResultsDisplay';
import BeforeAfterSlider from '../components/BeforeAfterSlider';
import ModelComparison from '../components/ModelComparison';
import BatchUpload from '../components/BatchUpload';
import Gallery from '../components/Gallery';
import Analytics from '../components/Analytics';
import FloatingActions from '../components/FloatingActions';
import VideoProcessor from '../components/video/VideoProcessor';
import { Video } from 'lucide-react';

interface DemoProps {
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

type DemoTabMode = 'single' | 'batch' | 'compare' | 'analytics';

export default function Demo({ onNotify }: DemoProps) {
  const [searchParams] = useSearchParams();

  // High-level modality: Image vs Video
  const [mediaMode, setMediaMode] = useState<'image' | 'video'>('image');

  // Navigation Mode (for image suite)
  const [activeTab, setActiveTab] = useState<DemoTabMode>('single');

  // Active Model
  const [selectedModel, setSelectedModel] = useState<VisionModelId>('farai-fpn');

  // Single Image State
  const [status, setStatus] = useState<'idle' | 'uploading' | 'analyzing' | 'complete' | 'error'>('idle');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [imageMetadata, setImageMetadata] = useState<ImageMetadata | null>(null);
  const [activeSampleId, setActiveSampleId] = useState<string | null>(null);
  const [detectionResult, setDetectionResult] = useState<VisionDetectionResult | null>(null);

  // Inspector Options
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0.5);
  const [showMasks, setShowMasks] = useState<boolean>(true);
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [highlightClass, setHighlightClass] = useState<string | null>(null);

  // Modals & Gallery
  const [fullscreenImage, setFullscreenImage] = useState<{ src: string; title: string } | null>(null);
  const [showBackendModal, setShowBackendModal] = useState<boolean>(false);
  const [endpointInput, setEndpointInput] = useState<string>(getBackendEndpoint());
  const [sampleModalOpen, setSampleModalOpen] = useState<boolean>(false);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<GalleryItem | null>(null);
  const [confirmClearGalleryOpen, setConfirmClearGalleryOpen] = useState<boolean>(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState<boolean>(false);

  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeObjectUrlRef = useRef<string | null>(null);

  // Initialize Gallery & seed if needed
  useEffect(() => {
    const loaded = loadGallery();
    if (loaded.length > 0) {
      setGallery(loaded);
    } else {
      const sample = SAMPLE_IMAGES[0];
      const initialItem: GalleryItem = {
        id: 'seed-penguin-demo',
        timestamp: Date.now() - 3600000 * 2,
        title: sample.title,
        originalImage: sample.dataUrl,
        annotatedImage: sample.dataUrl,
        thumbnailImage: sample.dataUrl,
        totalObjects: 12,
        processingTimeMs: 142,
        detections: sample.mockDetections,
        topClasses: [
          { name: 'penguin', count: 12 },
        ],
        modelId: 'farai-fpn',
        modelName: "Farai's FPN-DomainNet",
        thresholdUsed: 0.5,
        metadata: {
          width: sample.metadata.width,
          height: sample.metadata.height,
          sizeBytes: sample.metadata.sizeBytes,
          sizeFormatted: sample.metadata.sizeFormatted,
          format: sample.metadata.format,
          name: 'boulders_beach_colony.jpg',
        },
      };
      setGallery([initialItem]);
      saveGallery([initialItem]);
    }

    return () => {
      if (activeObjectUrlRef.current && activeObjectUrlRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(activeObjectUrlRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Update object URL safely
  const setCleanObjectUrl = useCallback((newUrl: string) => {
    if (activeObjectUrlRef.current && activeObjectUrlRef.current.startsWith('blob:')) {
      URL.revokeObjectURL(activeObjectUrlRef.current);
    }
    activeObjectUrlRef.current = newUrl;
    setOriginalImageUrl(newUrl);
  }, []);

  // Process Single Image
  const processImage = async (
    fileOrBlob: File | Blob,
    previewUrl: string,
    sampleId?: string,
    title: string = 'User Upload',
    meta?: ImageMetadata
  ) => {
    try {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setErrorMessage(null);
      setStatus('uploading');
      setUploadProgress(20);

      const options: AnalysisOptions = {
        confidenceThreshold,
        showMasks,
        showLabels,
        activeFilterClass: highlightClass,
        modelId: selectedModel,
        signal: abortControllerRef.current.signal,
        onProgress: (p) => {
          setUploadProgress(p);
          if (p >= 80) setStatus('analyzing');
        },
      };

      const result = await detectObjects(fileOrBlob, previewUrl, sampleId, options, meta);

      setDetectionResult(result);
      setStatus('complete');
      setUploadProgress(100);

      if (result.source === 'live_backend') {
        onNotify('success', `Detected ${result.total_objects} objects via live backend in ${result.processing_time_ms}ms!`);
      } else {
        if (result.backendError) {
          onNotify('info', `FastAPI backend unavailable (${result.backendError}). Analyzed with local client engine.`);
        } else {
          onNotify('success', `Analyzed ${result.total_objects} objects in ${result.processing_time_ms}ms.`);
        }
      }

      // Generate lightweight thumbnail for gallery storage safety
      const thumbnail = await createThumbnail(result.annotated_image_base64 || previewUrl, 320);

      const topClasses = Object.entries(result.detections)
        .map(([name, data]) => ({ name, count: data.count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

      const newItem: GalleryItem = {
        id: `scan-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: Date.now(),
        title,
        originalImage: previewUrl,
        annotatedImage: result.annotated_image_base64,
        thumbnailImage: thumbnail,
        totalObjects: result.total_objects,
        processingTimeMs: result.processing_time_ms,
        detections: result.detections,
        topClasses,
        modelId: selectedModel,
        modelName: result.modelName,
        thresholdUsed: confidenceThreshold,
        metadata: meta,
      };

      const updated = [newItem, ...gallery.filter((g) => g.id !== newItem.id)].slice(0, 24);
      setGallery(updated);
      saveGallery(updated);
    } catch (err: any) {
      if (err?.message?.includes('canceled')) return;
      console.error('Detection pipeline error:', err);
      setStatus('error');
      const msg = err?.message || 'Failed to analyze image.';
      setErrorMessage(msg);
      onNotify('error', msg);
    }
  };

  // Re-run inference when options change on active image
  const handleOptionChange = async (
    newThreshold?: number,
    newShowMasks?: boolean,
    newShowLabels?: boolean,
    newHighlightClass?: string | null,
    newModel?: VisionModelId
  ) => {
    if (!originalImageUrl || !currentFile) return;

    const threshold = newThreshold ?? confidenceThreshold;
    const masks = newShowMasks ?? showMasks;
    const labels = newShowLabels ?? showLabels;
    const highlight = newHighlightClass !== undefined ? newHighlightClass : highlightClass;
    const model = newModel ?? selectedModel;

    try {
      const options: AnalysisOptions = {
        confidenceThreshold: threshold,
        showMasks: masks,
        showLabels: labels,
        activeFilterClass: highlight,
        modelId: model,
      };

      const result = await detectObjects(
        currentFile,
        originalImageUrl,
        activeSampleId || undefined,
        options,
        imageMetadata || undefined
      );
      setDetectionResult(result);
    } catch (err) {
      console.error('Failed to recompute annotations:', err);
    }
  };

  // File upload change
  const handleFileChange = async (file: File) => {
    try {
      setErrorMessage(null);
      const meta = await validateAndExtractImageMetadata(file);
      setImageMetadata(meta);

      const preview = URL.createObjectURL(file);
      setCleanObjectUrl(preview);
      setCurrentFile(file);
      setActiveSampleId(null);
      setHighlightClass(null);

      processImage(file, preview, undefined, file.name, meta);
    } catch (err: any) {
      const msg = err?.message || 'Invalid image file.';
      setErrorMessage(msg);
      setStatus('error');
      onNotify('error', msg);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Sample dataset select
  const handleSelectSample = (sample: SampleImageOption) => {
    setSampleModalOpen(false);
    setCleanObjectUrl(sample.dataUrl);
    setActiveSampleId(sample.id);
    setHighlightClass(null);

    const meta: ImageMetadata = {
      width: sample.metadata.width,
      height: sample.metadata.height,
      sizeBytes: sample.metadata.sizeBytes,
      sizeFormatted: sample.metadata.sizeFormatted,
      format: sample.metadata.format,
      name: `${sample.id}.png`,
    };
    setImageMetadata(meta);

    fetch(sample.dataUrl)
      .then((res) => res.blob())
      .then((blob) => {
        const file = new File([blob], `${sample.id}.png`, { type: 'image/png' });
        setCurrentFile(file);
        processImage(file, sample.dataUrl, sample.id, sample.title, meta);
      })
      .catch((e) => {
        console.error('Failed to load sample image:', e);
        onNotify('error', 'Failed to load sample dataset.');
      });
  };

  // Sync navigation query params (e.g. /demo?sample=african-penguins, /demo?mode=video, /demo?tab=compare)
  useEffect(() => {
    const urlMode = searchParams.get('mode');
    if (urlMode === 'video' || urlMode === 'image') {
      setMediaMode(urlMode);
    }

    const urlTab = searchParams.get('tab');
    if (urlTab === 'single' || urlTab === 'batch' || urlTab === 'compare' || urlTab === 'analytics') {
      setActiveTab(urlTab);
    }

    const sampleId = searchParams.get('sample');
    if (sampleId) {
      const match = SAMPLE_IMAGES.find((s) => s.id === sampleId);
      if (match) {
        handleSelectSample(match);
      }
    }
  }, [searchParams]);

  // Reset workspace
  const handleReset = () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    setStatus('idle');
    setUploadProgress(0);
    setOriginalImageUrl(null);
    setCurrentFile(null);
    setImageMetadata(null);
    setActiveSampleId(null);
    setDetectionResult(null);
    setHighlightClass(null);
    setErrorMessage(null);
    if (activeObjectUrlRef.current && activeObjectUrlRef.current.startsWith('blob:')) {
      URL.revokeObjectURL(activeObjectUrlRef.current);
      activeObjectUrlRef.current = null;
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
    onNotify('info', 'Workspace reset.');
  };

  // Gallery actions
  const executeDeleteItem = () => {
    if (!deleteConfirmItem) return;
    const updated = gallery.filter((item) => item.id !== deleteConfirmItem.id);
    setGallery(updated);
    saveGallery(updated);
    setDeleteConfirmItem(null);
    onNotify('info', 'Item removed from gallery.');
  };

  const executeClearGallery = () => {
    clearGalleryStorage();
    setGallery([]);
    setConfirmClearGalleryOpen(false);
    onNotify('info', 'Gallery history cleared.');
  };

  const handleLoadGalleryItem = (item: GalleryItem) => {
    setCleanObjectUrl(item.originalImage);
    setImageMetadata(item.metadata || null);
    if (item.modelId) setSelectedModel(item.modelId);
    setDetectionResult({
      total_objects: item.totalObjects,
      detections: item.detections,
      processing_time_ms: item.processingTimeMs,
      annotated_image_base64: item.annotatedImage,
      source: 'client_engine',
      modelId: item.modelId,
      modelName: item.modelName,
    });
    setStatus('complete');
    setActiveTab('single');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    onNotify('info', `Loaded "${item.title}" into analysis view.`);
  };

  // Download utilities
  const handleDownloadAnnotated = () => {
    if (!detectionResult?.annotated_image_base64) return;
    const link = document.createElement('a');
    link.href = detectionResult.annotated_image_base64;
    link.download = `farai-cv-detection-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onNotify('success', 'Annotated image downloaded!');
  };

  const handleDownloadJsonReport = () => {
    if (!detectionResult) return;
    const report = {
      engineer: 'Farai Bodias Musariri',
      timestamp: new Date().toISOString(),
      model: detectionResult.modelName || selectedModel,
      source: detectionResult.source,
      processing_time_ms: detectionResult.processing_time_ms,
      total_objects: detectionResult.total_objects,
      detections: detectionResult.detections,
      threshold: confidenceThreshold,
      image_metadata: imageMetadata,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cv-metrics-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onNotify('success', 'JSON metrics report downloaded!');
  };

  // Keyboard Shortcuts (Space: re-run, S: save, C: compare)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in input or textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.code === 'Space' && activeTab === 'single' && currentFile && originalImageUrl && status !== 'analyzing') {
        e.preventDefault();
        processImage(currentFile, originalImageUrl, activeSampleId || undefined, currentFile.name, imageMetadata || undefined);
      } else if (e.key === 's' || e.key === 'S') {
        if (detectionResult) {
          e.preventDefault();
          handleDownloadAnnotated();
        }
      } else if (e.key === 'c' || e.key === 'C') {
        setActiveTab((prev) => (prev === 'compare' ? 'single' : 'compare'));
      } else if (e.key === '?') {
        setShowShortcutsModal((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, currentFile, originalImageUrl, status, detectionResult]);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#32FF00]">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Interactive Computer Vision Suite</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight mt-1">
            Visual Perception & Multi-Class Inference Lab
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1">
            High-precision detection, instance masks, model benchmarking, and batch processing engine.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowShortcutsModal(true)}
            className="min-h-[44px] flex items-center gap-1.5 rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs font-medium text-neutral-400 hover:text-white transition-colors"
            title="Keyboard shortcuts"
          >
            <Keyboard className="h-4 w-4" />
            <span className="hidden sm:inline">Shortcuts</span>
          </button>

          <button
            type="button"
            onClick={() => setShowBackendModal(true)}
            className="min-h-[44px] flex items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900 px-3.5 py-2 text-xs font-medium text-neutral-300 hover:border-neutral-700 hover:text-white transition-colors"
          >
            <Server className="h-4 w-4 text-[#32FF00]" />
            <span>API Config</span>
          </button>

          <button
            type="button"
            onClick={() => setSampleModalOpen(true)}
            className="min-h-[44px] flex items-center gap-2 rounded-xl bg-[#32FF00]/10 border border-[#32FF00]/30 px-4 py-2 text-xs font-semibold text-[#32FF00] hover:bg-[#32FF00]/20 transition-colors"
          >
            <ImageIcon className="h-4 w-4" />
            <span>Load Sample Image</span>
          </button>
        </div>
      </div>

      {/* Primary Modality Switcher: Image vs Video */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-2 rounded-2xl border border-neutral-800 bg-neutral-900/90 shadow-lg">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMediaMode('image')}
            className={`min-h-[44px] flex items-center gap-2.5 px-5 py-2 rounded-xl text-xs font-bold transition-all ${
              mediaMode === 'image'
                ? 'bg-[#32FF00] text-[#0F1419] font-bold shadow-[0_0_15px_rgba(50,255,0,0.35)]'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
            }`}
          >
            <ImageIcon className="h-4 w-4" />
            <span>Image Vision Suite</span>
          </button>

          <button
            type="button"
            onClick={() => setMediaMode('video')}
            className={`min-h-[44px] flex items-center gap-2.5 px-5 py-2 rounded-xl text-xs font-bold transition-all ${
              mediaMode === 'video'
                ? 'bg-[#32FF00] text-[#0F1419] font-bold shadow-[0_0_15px_rgba(50,255,0,0.35)]'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
            }`}
          >
            <Video className="h-4 w-4" />
            <span>Real-Time Video Suite</span>
            <span className="text-[10px] bg-[#16213E] border border-[#32FF00]/40 text-[#32FF00] px-2 py-0.5 rounded-full font-mono">
              Temporal AI
            </span>
          </button>
        </div>

        <div className="text-xs text-neutral-400 hidden lg:block pr-3 font-mono">
          {mediaMode === 'image'
            ? 'Static frames · FPN multi-scale · Instance masks'
            : 'Frame-by-frame MOT tracking · Kinematic trajectory · Timeline'}
        </div>
      </div>

      {/* VIDEO SUITE VIEW */}
      {mediaMode === 'video' ? (
        <VideoProcessor onNotify={onNotify} />
      ) : (
        /* IMAGE SUITE VIEW */
        <div className="space-y-8 animate-in fade-in">
          {/* Mode Navigation Tabs */}
          <div className="flex items-center gap-2 p-1.5 rounded-2xl border border-neutral-800 bg-neutral-900/80 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('single')}
              className={`min-h-[40px] flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === 'single'
                  ? 'bg-[#32FF00] text-[#0F1419] font-bold shadow-[0_0_15px_rgba(50,255,0,0.35)]'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Layers className="h-4 w-4" />
              <span>Single Image (Split View)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('batch')}
              className={`min-h-[40px] flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === 'batch'
                  ? 'bg-[#32FF00] text-[#0F1419] font-bold shadow-[0_0_15px_rgba(50,255,0,0.35)]'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Files className="h-4 w-4" />
              <span>Batch Processing</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('compare')}
              className={`min-h-[40px] flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === 'compare'
                  ? 'bg-[#32FF00] text-[#0F1419] font-bold shadow-[0_0_15px_rgba(50,255,0,0.35)]'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Scale className="h-4 w-4" />
              <span>Model Comparison</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('analytics')}
              className={`min-h-[40px] flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === 'analytics'
                  ? 'bg-[#32FF00] text-[#0F1419] font-bold shadow-[0_0_15px_rgba(50,255,0,0.35)]'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              <span>Analytics & Metrics</span>
            </button>
          </div>

      {/* TAB 1: Single Image Mode */}
      {activeTab === 'single' && (
        <div className="space-y-8 animate-in fade-in">
          {/* Upload Zone & Architecture Selector */}
          <div className="space-y-4">
            {/* Architecture Selector Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-neutral-800 bg-neutral-900/60 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-neutral-300">Active Architecture:</span>
                <select
                  value={selectedModel}
                  onChange={(e) => {
                    const m = e.target.value as VisionModelId;
                    setSelectedModel(m);
                    handleOptionChange(undefined, undefined, undefined, undefined, m);
                  }}
                  className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-xs text-white font-medium focus:border-[#32FF00] focus:outline-none"
                >
                  {MODEL_LIST.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.architecture})
                    </option>
                  ))}
                </select>
              </div>

              <div className="text-[11px] text-neutral-400">
                {VISION_MODELS[selectedModel].tagline}
              </div>
            </div>

            {/* Drag & Drop Area */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFileChange(e.dataTransfer.files[0]);
                }
              }}
              className={`relative rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
                isDragging
                  ? 'border-[#32FF00] bg-[#32FF00]/10 shadow-[0_0_20px_rgba(50,255,0,0.2)]'
                  : 'border-neutral-800 bg-neutral-900/40 hover:border-neutral-700 hover:bg-neutral-900/60'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png, image/jpeg, image/jpg, image/webp"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileChange(e.target.files[0]);
                  }
                }}
                className="hidden"
                id="single-image-upload"
              />

              <div className="mx-auto flex max-w-lg flex-col items-center justify-center space-y-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-800 text-[#32FF00] shadow-inner">
                  <Upload className="h-6 w-6" />
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-semibold text-white">
                    Drag and drop your frame here, or{' '}
                    <label
                      htmlFor="single-image-upload"
                      className="cursor-pointer text-[#32FF00] hover:underline"
                    >
                      browse local file
                    </label>
                  </p>
                  <p className="text-xs text-neutral-400">
                    Supports JPG, PNG, and WebP (up to 50MB) · Real-time inference
                  </p>
                </div>
              </div>
            </div>

            {/* Real-time Status / Loading indicator */}
            {status !== 'idle' && (
              <div
                className={`rounded-xl p-3.5 text-xs border space-y-2 transition-all ${
                  status === 'uploading'
                    ? 'bg-blue-950/40 border-blue-500/30 text-blue-300'
                    : status === 'analyzing'
                    ? 'bg-amber-950/40 border-amber-500/30 text-amber-300'
                    : status === 'complete'
                    ? 'bg-[#32FF00]/10 border-[#32FF00]/30 text-[#32FF00]'
                    : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {status === 'uploading' && <RefreshCw className="h-4 w-4 animate-spin text-blue-400" />}
                    {status === 'analyzing' && <RefreshCw className="h-4 w-4 animate-spin text-amber-400" />}
                    {status === 'complete' && <CheckCircle2 className="h-4 w-4 text-[#32FF00]" />}
                    {status === 'error' && <AlertCircle className="h-4 w-4 text-rose-400" />}

                    <span className="font-semibold text-white capitalize">
                      {status === 'uploading'
                        ? 'Uploading...'
                        : status === 'analyzing'
                        ? 'Analyzing Feature Hierarchy...'
                        : status === 'complete'
                        ? 'Inference Complete!'
                        : 'Error'}
                    </span>
                    <span className="text-neutral-400 hidden sm:inline">
                      {status === 'complete' &&
                        `Latency: ${detectionResult?.processing_time_ms}ms · Found ${detectionResult?.total_objects} objects`}
                      {status === 'error' && errorMessage}
                    </span>
                  </div>

                  {status === 'complete' && (
                    <button
                      type="button"
                      onClick={handleReset}
                      className="hover:text-white text-neutral-400 underline font-medium text-xs"
                    >
                      Reset Workspace
                    </button>
                  )}
                </div>

                {(status === 'uploading' || status === 'analyzing') && (
                  <div className="h-1.5 w-full rounded-full bg-neutral-800 overflow-hidden">
                    <div
                      className="h-full bg-[#32FF00] transition-all duration-200"
                      style={{ width: `${Math.max(10, uploadProgress)}%` }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Results Display Component with BeforeAfterSlider & ConfidenceSlider */}
          {originalImageUrl && detectionResult && (
            <ResultsDisplay
              originalImageUrl={originalImageUrl}
              detectionResult={detectionResult}
              imageMetadata={imageMetadata}
              confidenceThreshold={confidenceThreshold}
              showMasks={showMasks}
              showLabels={showLabels}
              highlightClass={highlightClass}
              totalCandidateBoxes={
                detectionResult.rawBoxes ? detectionResult.rawBoxes.length : detectionResult.total_objects
              }
              onThresholdChange={(t) => {
                setConfidenceThreshold(t);
                handleOptionChange(t, undefined, undefined, undefined);
              }}
              onToggleMasks={(m) => {
                setShowMasks(m);
                handleOptionChange(undefined, m, undefined, undefined);
              }}
              onToggleLabels={(l) => {
                setShowLabels(l);
                handleOptionChange(undefined, undefined, l, undefined);
              }}
              onSelectClassFilter={(c) => {
                setHighlightClass(c);
                handleOptionChange(undefined, undefined, undefined, c);
              }}
              onDownloadPng={handleDownloadAnnotated}
              onDownloadJson={handleDownloadJsonReport}
              onReset={handleReset}
              onExpandFullscreen={(src, title) => setFullscreenImage({ src, title })}
            />
          )}

          {/* Gallery Component */}
          <Gallery
            items={gallery}
            onSelectItem={handleLoadGalleryItem}
            onDeleteItem={(item) => setDeleteConfirmItem(item)}
            onClearAll={() => setConfirmClearGalleryOpen(true)}
            onExpandFullscreen={(src, title) => setFullscreenImage({ src, title })}
          />
        </div>
      )}

      {/* TAB 2: Batch Processing Mode */}
      {activeTab === 'batch' && (
        <BatchUpload
          modelId={selectedModel}
          confidenceThreshold={confidenceThreshold}
          onNotify={onNotify}
          onExpandFullscreen={(src, title) => setFullscreenImage({ src, title })}
        />
      )}

      {/* TAB 3: Model Comparison Mode */}
      {activeTab === 'compare' && (
        <ModelComparison
          currentFile={currentFile}
          originalImageUrl={originalImageUrl}
          activeSampleId={activeSampleId}
          imageMetadata={imageMetadata}
          onNotify={onNotify}
          onExpandFullscreen={(src, title) => setFullscreenImage({ src, title })}
        />
      )}

      {/* TAB 4: Analytics Dashboard Mode */}
      {activeTab === 'analytics' && (
        <Analytics galleryItems={gallery} onNotify={onNotify} />
      )}
        </div>
      )}

      {/* Confirmation Modal for Individual Delete */}
      {deleteConfirmItem && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/80 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl space-y-4">
            <h3 className="font-display text-lg font-bold text-white">
              Delete Gallery Scan?
            </h3>
            <p className="text-xs text-neutral-400">
              Are you sure you want to remove <strong className="text-white">"{deleteConfirmItem.title}"</strong> from your saved history?
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmItem(null)}
                className="min-h-[44px] px-4 py-2 text-xs font-medium text-neutral-300 hover:text-white rounded-lg border border-neutral-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDeleteItem}
                className="min-h-[44px] px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Clear All Gallery */}
      {confirmClearGalleryOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/80 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl space-y-4">
            <h3 className="font-display text-lg font-bold text-white">
              Clear All Inspection History?
            </h3>
            <p className="text-xs text-neutral-400">
              This will remove all {gallery.length} cached scans from your browser's localStorage.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmClearGalleryOpen(false)}
                className="min-h-[44px] px-4 py-2 text-xs font-medium text-neutral-300 hover:text-white rounded-lg border border-neutral-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeClearGallery}
                className="min-h-[44px] px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sample Image Selection Modal */}
      {sampleModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/80 p-4 backdrop-blur-sm"
        >
          <div className="relative w-full max-w-2xl rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div>
                <h3 className="font-display text-lg font-bold text-white">
                  Select Benchmark Sample Image
                </h3>
                <p className="text-xs text-neutral-400">
                  Curated testing sets demonstrating multi-class object detection and segmentation
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSampleModalOpen(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-neutral-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {SAMPLE_IMAGES.map((sample) => (
                <div
                  key={sample.id}
                  onClick={() => handleSelectSample(sample)}
                  className="cursor-pointer rounded-xl border border-neutral-800 bg-neutral-950 p-3 hover:border-[#32FF00] transition-all flex flex-col justify-between"
                >
                  <div className="aspect-[4/3] w-full overflow-hidden rounded-lg bg-neutral-900">
                    <img
                      src={sample.dataUrl}
                      alt={sample.title}
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="mt-2 space-y-1">
                    <h4 className="text-xs font-semibold text-white truncate">
                      {sample.title}
                    </h4>
                    <p className="text-[11px] text-neutral-400 line-clamp-2">
                      {sample.description}
                    </p>
                    <div className="pt-1 text-[10px] text-[#32FF00] font-medium">
                      ~{sample.expectedObjects} objects · {sample.category}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Backend API Configuration Modal */}
      {showBackendModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/80 p-4 backdrop-blur-sm"
        >
          <div className="relative w-full max-w-2xl rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <Server className="h-5 w-5 text-[#32FF00]" />
                <h3 className="font-display text-lg font-bold text-white">
                  Backend API & Inference Settings
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowBackendModal(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-neutral-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="endpoint-input"
                  className="block text-xs font-semibold uppercase tracking-wider text-neutral-300 mb-1"
                >
                  Detection Endpoint URL
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    id="endpoint-input"
                    type="url"
                    value={endpointInput}
                    onChange={(e) => setEndpointInput(e.target.value)}
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-xs font-mono text-white focus:border-[#32FF00] focus:outline-none"
                    placeholder="http://localhost:8000/api/detect"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setBackendEndpoint(endpointInput);
                      setShowBackendModal(false);
                      onNotify('success', `Saved endpoint: ${endpointInput}`);
                    }}
                    className="min-h-[44px] rounded-lg bg-[#32FF00] px-4 py-2 text-xs font-semibold text-neutral-950 hover:bg-[#00FF41] shrink-0"
                  >
                    Save URL
                  </button>
                </div>
              </div>

              <div className="rounded-lg bg-neutral-950/80 border border-neutral-800 p-3 text-xs text-neutral-400">
                <p className="font-semibold text-neutral-200">Zero-Config Standalone Operation:</p>
                <p className="mt-0.5">
                  When the local FastAPI server is not running or CORS restricts direct browser calls, the app automatically switches to the built-in browser-based computer vision engine, allowing visitors to test uploads, bounding boxes, segmentation masks, and latency measurements without having to launch any terminal commands.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Modal */}
      {showShortcutsModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/80 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="font-display text-base font-bold text-white flex items-center gap-2">
                <Keyboard className="h-4 w-4 text-[#32FF00]" />
                Keyboard Shortcuts
              </h3>
              <button
                type="button"
                onClick={() => setShowShortcutsModal(false)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-neutral-800">
                <span className="text-neutral-300">Run Inference / Re-analyze</span>
                <kbd className="px-2 py-1 rounded bg-neutral-800 text-neutral-200 font-mono text-[11px]">
                  Space
                </kbd>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-neutral-800">
                <span className="text-neutral-300">Download Annotated Image</span>
                <kbd className="px-2 py-1 rounded bg-neutral-800 text-neutral-200 font-mono text-[11px]">
                  S
                </kbd>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-neutral-800">
                <span className="text-neutral-300">Toggle Comparison Mode</span>
                <kbd className="px-2 py-1 rounded bg-neutral-800 text-neutral-200 font-mono text-[11px]">
                  C
                </kbd>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-neutral-800">
                <span className="text-neutral-300">Drag Comparison Bar (in focus)</span>
                <kbd className="px-2 py-1 rounded bg-neutral-800 text-neutral-200 font-mono text-[11px]">
                  ← / →
                </kbd>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Viewer Modal */}
      {fullscreenImage && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-neutral-950/95 p-4 backdrop-blur-md"
        >
          <div className="flex w-full max-w-5xl items-center justify-between pb-3">
            <span className="text-sm font-semibold text-white">{fullscreenImage.title}</span>
            <button
              type="button"
              onClick={() => setFullscreenImage(null)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg bg-neutral-800 p-2 text-neutral-300 hover:text-white"
              title="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="relative max-h-[80vh] max-w-5xl overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 flex items-center justify-center">
            <img
              src={fullscreenImage.src}
              alt={fullscreenImage.title}
              className="max-h-[80vh] max-w-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      )}

      {/* Floating Action Navigation Button */}
      <FloatingActions
        mediaMode={mediaMode}
        activeTab={activeTab}
        onSelectMediaMode={(mode) => setMediaMode(mode)}
        onSelectTab={(tab) => setActiveTab(tab)}
        onOpenShortcuts={() => setShowShortcutsModal(true)}
      />
    </div>
  );
}
