import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Upload, Image as ImageIcon, Sparkles, Layers, Scale, Files, BarChart3, Server, RefreshCw, CheckCircle2, AlertCircle, X, Keyboard } from 'lucide-react';
import {
  detectObjects,
  VisionDetectionResult,
  validateAndExtractImageMetadata,
  AnalysisOptions,
  InferenceEngine,
} from '../services/visionApi';
import { getApiBaseUrl, setApiBaseUrl } from '../services/apiClient';
import { getHealth, getModelInfo, HealthResponse, ModelInfoResponse } from '../services/systemApi';
import { SAMPLE_IMAGES } from '../utils/sampleData';
import { dataUrlExtension } from '../utils/dataUrl';
import {
  loadGallery,
  saveGallery,
  clearGalleryStorage,
  createThumbnail,
} from '../utils/galleryStorage';
import { GalleryItem, SampleImageOption, ImageMetadata } from '../types';
import ResultsDisplay from '../components/ResultsDisplay';
import ModelComparison from '../components/ModelComparison';
import BatchUpload from '../components/BatchUpload';
import Gallery from '../components/Gallery';
import Analytics from '../components/Analytics';
import FloatingActions from '../components/FloatingActions';
import VideoProcessor from '../components/video/VideoProcessor';
import {
  BROWSER_INPUT_SIZES,
  BROWSER_MODELS,
  BrowserModelConfig,
  DEFAULT_MODEL_CONFIG,
  configKey,
  modelFileName,
  parseConfig,
  sameConfig,
} from '../utils/browserModels';
import { Video, FileText, Lock } from 'lucide-react';
import { baseName, downloadTextFile, toYoloText } from '../utils/yoloLabels';
import { toCoco } from '../utils/labelExport';
import { isLabPro } from '../utils/entitlements';
import { useEntitlements } from '../utils/useEntitlements';
import { useUnlockUi } from '../components/pro/EntitlementProvider';
import LabTierStrip from '../components/pro/LabTierStrip';

interface DemoProps {
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

type DemoTabMode = 'single' | 'batch' | 'compare' | 'analytics';

// Remembers whether the visitor chose to run detection in their browser.
const ENGINE_STORAGE_KEY = 'farai_cv_engine';
// ...and which model and input size it used.
const MODEL_STORAGE_KEY = 'farai_cv_browser_model';
const SIZE_STORAGE_KEY = 'farai_cv_browser_size';

export default function Demo({ onNotify }: DemoProps) {
  const [searchParams] = useSearchParams();

  const labPro = isLabPro(useEntitlements());
  const { openLabUnlock } = useUnlockUi();
  // High-level modality: Image vs Video
  const [mediaMode, setMediaMode] = useState<'image' | 'video'>('image');

  // Navigation Mode (for image suite)
  const [activeTab, setActiveTab] = useState<DemoTabMode>('single');

  // What the backend reports about itself. null until the first poll answers.
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [modelInfo, setModelInfo] = useState<ModelInfoResponse | null>(null);

  // Single Image State
  const [status, setStatus] = useState<'idle' | 'uploading' | 'analyzing' | 'complete' | 'error'>('idle');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Where single-image detection runs. 'backend' is the default; 'browser'
  // runs the ONNX model locally (services/browserInference.ts), no server needed.
  const [engine, setEngine] = useState<InferenceEngine>(() => {
    try {
      return localStorage.getItem(ENGINE_STORAGE_KEY) === 'browser' ? 'browser' : 'backend';
    } catch {
      return 'backend';
    }
  });
  const [browserPhase, setBrowserPhase] = useState<string>('');
  const [browserBackend, setBrowserBackend] = useState<'webgpu' | 'wasm' | null>(null);
  const [browserNote, setBrowserNote] = useState<string | null>(null);
  const [browserLoadError, setBrowserLoadError] = useState<string | null>(null);
  // Which ONNX model and input size to run, and which one actually loaded
  // (they differ when the chosen file is not in public/models/).
  const [browserModelCfg, setBrowserModelCfg] = useState<BrowserModelConfig>(() => {
    try {
      return parseConfig(localStorage.getItem(MODEL_STORAGE_KEY), localStorage.getItem(SIZE_STORAGE_KEY));
    } catch {
      return DEFAULT_MODEL_CONFIG;
    }
  });
  const browserModelCfgRef = useRef<BrowserModelConfig>(browserModelCfg);
  const [browserLoadedCfg, setBrowserLoadedCfg] = useState<BrowserModelConfig | null>(null);
  // Which (model, size) files exist in public/models/, once probed.
  const [modelAvailability, setModelAvailability] = useState<Record<string, boolean>>({});

  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [imageMetadata, setImageMetadata] = useState<ImageMetadata | null>(null);
  const [activeSampleId, setActiveSampleId] = useState<string | null>(null);
  const activeSample = SAMPLE_IMAGES.find((x) => x.id === activeSampleId);
  const [detectionResult, setDetectionResult] = useState<VisionDetectionResult | null>(null);

  // Inspector Options. 0.25 matches the backend's CONFIDENCE_THRESHOLD default.
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0.25);
  const [highlightClass, setHighlightClass] = useState<string | null>(null);

  // Modals & Gallery
  const [fullscreenImage, setFullscreenImage] = useState<{ src: string; title: string } | null>(null);
  const [showBackendModal, setShowBackendModal] = useState<boolean>(false);
  const [endpointInput, setEndpointInput] = useState<string>(getApiBaseUrl());
  const [sampleModalOpen, setSampleModalOpen] = useState<boolean>(false);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<GalleryItem | null>(null);
  const [confirmClearGalleryOpen, setConfirmClearGalleryOpen] = useState<boolean>(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState<boolean>(false);

  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeObjectUrlRef = useRef<string | null>(null);
  const rerunTimerRef = useRef<number | null>(null);

  // Poll backend status so "backend down" is visible before an upload fails.
  const refreshBackendStatus = useCallback(async () => {
    try {
      const h = await getHealth();
      setHealth(h);
      setHealthError(null);
      setModelInfo(await getModelInfo());
    } catch (err: any) {
      setHealth(null);
      setHealthError(err?.message || 'Backend unreachable.');
    }
  }, []);

  useEffect(() => {
    refreshBackendStatus();
    const timer = window.setInterval(refreshBackendStatus, 15000);
    return () => window.clearInterval(timer);
  }, [refreshBackendStatus]);

  // Load the in-browser runtime and model ahead of the first image, so the
  // wait (about 40 MB on the very first visit) shows up in the engine bar.
  const preloadBrowserModel = useCallback((cfg: BrowserModelConfig = browserModelCfgRef.current) => {
    setBrowserLoadError(null);
    import('../services/browserInference')
      .then(({ loadBrowserModel, setActiveBrowserModel }) => {
        setActiveBrowserModel(cfg);
        return loadBrowserModel(setBrowserPhase, cfg);
      })
      .then((model) => {
        // Ignore a load that finished after the visitor picked something else.
        if (!sameConfig(cfg, browserModelCfgRef.current)) return;
        setBrowserLoadedCfg(model.config);
        setBrowserBackend(model.backend);
        setBrowserNote(model.fallbackReason ?? null);
        setBrowserPhase('');
      })
      .catch((err: any) => {
        setBrowserLoadError(err?.message || 'Could not start in-browser detection.');
        setBrowserPhase('');
      });
  }, []);

  // Probe which model files exist, so the pickers can say "not added" up front.
  useEffect(() => {
    if (engine !== 'browser') return;
    let cancelled = false;
    import('../services/browserInference').then(async ({ isModelAvailable }) => {
      const found: Record<string, boolean> = {};
      for (const m of BROWSER_MODELS) {
        for (const size of BROWSER_INPUT_SIZES) {
          const cfg = { modelId: m.id, size };
          found[configKey(cfg)] = await isModelAvailable(cfg);
        }
      }
      if (!cancelled) setModelAvailability(found);
    });
    return () => {
      cancelled = true;
    };
  }, [engine]);

  const chooseEngine = useCallback(
    (next: InferenceEngine) => {
      setEngine(next);
      try {
        localStorage.setItem(ENGINE_STORAGE_KEY, next);
      } catch {
        // Not persisting the choice is fine.
      }
      if (next === 'browser') preloadBrowserModel();
    },
    [preloadBrowserModel]
  );

  useEffect(() => {
    if (engine === 'browser') preloadBrowserModel();
    // Only on mount: a remembered 'browser' choice starts loading right away.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialize Gallery
  useEffect(() => {
    // Earlier builds seeded a fabricated penguin result into the gallery;
    // drop it from any browser that still has it stored.
    const stored = loadGallery();
    const loaded = stored.filter((g) => g.id !== 'seed-penguin-demo');
    if (loaded.length !== stored.length) saveGallery(loaded);
    setGallery(loaded);

    return () => {
      if (activeObjectUrlRef.current && activeObjectUrlRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(activeObjectUrlRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (rerunTimerRef.current) window.clearTimeout(rerunTimerRef.current);
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

  // After an in-browser run, remember which backend ran it and clear the phase text.
  const noteBrowserResult = (result: VisionDetectionResult) => {
    setBrowserPhase('');
    if (result.inference_engine === 'webgpu' || result.inference_engine === 'wasm') {
      setBrowserBackend(result.inference_engine);
    }
  };

  // Offered after a failure: switch engines and run the same image again.
  const switchEngineAndRetry = (next: InferenceEngine) => {
    chooseEngine(next);
    if (currentFile && originalImageUrl) {
      processImage(currentFile, originalImageUrl, activeSampleId || undefined, currentFile.name, imageMetadata || undefined, next);
    }
  };

  // Process Single Image
  const processImage = async (
    fileOrBlob: File | Blob,
    previewUrl: string,
    _sampleId?: string, // kept so the call sites stay positional; the active sample is tracked in state
    title: string = 'User Upload',
    meta?: ImageMetadata,
    engineOverride?: InferenceEngine
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
        engine: engineOverride ?? engine,
        modelConfig: browserModelCfg,
        onPhase: setBrowserPhase,
        signal: abortControllerRef.current.signal,
        onProgress: (p) => {
          setUploadProgress(p);
          if (p >= 80) setStatus('analyzing');
        },
      };

      const result = await detectObjects(fileOrBlob, options, meta);
      noteBrowserResult(result);

      setDetectionResult(result);
      setStatus('complete');
      setUploadProgress(100);

      onNotify('success', `Detected ${result.total_objects} objects in ${result.processing_time_ms}ms.`);

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
        modelName: result.model_name,
        thresholdUsed: result.confidence_threshold,
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

  // Pick another model or input size: load it, then re-run the image on screen with it.
  const chooseBrowserModel = (next: BrowserModelConfig) => {
    if (sameConfig(next, browserModelCfgRef.current)) return;
    browserModelCfgRef.current = next;
    setBrowserModelCfg(next);
    try {
      localStorage.setItem(MODEL_STORAGE_KEY, next.modelId);
      localStorage.setItem(SIZE_STORAGE_KEY, String(next.size));
    } catch {
      // Not persisting the choice is fine.
    }
    setBrowserBackend(null);
    setBrowserNote(null);
    setBrowserLoadedCfg(null);
    preloadBrowserModel(next);

    if (!currentFile || engine !== 'browser') return;
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setStatus('analyzing');
    detectObjects(
      currentFile,
      { confidenceThreshold, engine, modelConfig: next, onPhase: setBrowserPhase, signal: controller.signal },
      imageMetadata || undefined
    )
      .then((result) => {
        noteBrowserResult(result);
        setDetectionResult(result);
        setStatus('complete');
        setErrorMessage(null);
      })
      .catch((err: any) => {
        if (controller.signal.aborted) return;
        const msg = err?.message || 'Failed to re-run detection.';
        setStatus('error');
        setErrorMessage(msg);
        onNotify('error', msg);
      });
  };

  // Re-run inference when the confidence threshold changes. The slider fires
  // on every step while dragging, so debounce, and abort any request still
  // in flight so a stale result can't land after a newer one.
  const rerunWithThreshold = (threshold: number) => {
    if (!currentFile) return;
    if (rerunTimerRef.current) window.clearTimeout(rerunTimerRef.current);

    rerunTimerRef.current = window.setTimeout(async () => {
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const result = await detectObjects(
          currentFile,
          { confidenceThreshold: threshold, engine, modelConfig: browserModelCfg, onPhase: setBrowserPhase, signal: controller.signal },
          imageMetadata || undefined
        );
        noteBrowserResult(result);
        setDetectionResult(result);
        setStatus('complete');
        setErrorMessage(null);
      } catch (err: any) {
        if (controller.signal.aborted) return;
        const msg = err?.message || 'Failed to re-run detection.';
        setStatus('error');
        setErrorMessage(msg);
        onNotify('error', msg);
      }
    }, 350);
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
        const ext = blob.type === 'image/png' ? 'png' : 'jpg';
        const file = new File([blob], `${sample.id}.${ext}`, { type: blob.type || 'image/jpeg' });
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
    // Restored results can't be re-run: the original file isn't stored.
    setCurrentFile(null);
    setDetectionResult({
      total_objects: item.totalObjects,
      detections: item.detections,
      processing_time_ms: item.processingTimeMs,
      annotated_image_base64: item.annotatedImage,
      model_name: item.modelName || 'unknown',
      confidence_threshold: item.thresholdUsed ?? confidenceThreshold,
    });
    if (item.thresholdUsed !== undefined) setConfidenceThreshold(item.thresholdUsed);
    setStatus('complete');
    setActiveTab('single');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    onNotify('info', `Loaded "${item.title}" into analysis view.`);
  };

  // Download utilities
  // YOLO annotations for the image on screen (in-browser runs only), at the current confidence.
  const handleExportYoloLabels = () => {
    if (!detectionResult?.raw_detections) return;
    const text = toYoloText(
      detectionResult.raw_detections,
      detectionResult.image_width ?? imageMetadata?.width ?? 0,
      detectionResult.image_height ?? imageMetadata?.height ?? 0
    );
    const name = `${baseName(currentFile?.name || activeSampleId || 'image')}.txt`;
    downloadTextFile(name, text);
    onNotify(
      'success',
      `Exported ${detectionResult.raw_detections.length} box(es) to ${name}. Class ids follow this model: ${(detectionResult.class_names ?? [])
        .map((n, i) => `${i}=${n}`)
        .join(', ')}`
    );
  };

  // COCO JSON for the image on screen: Pro / Batch Studio (YOLO .txt above stays free).
  const handleExportCoco = () => {
    if (!labPro) return openLabUnlock('COCO export is part of Pro / Batch Studio. YOLO .txt export stays free.');
    if (!detectionResult?.raw_detections || !detectionResult.class_names) return;
    const w = detectionResult.image_width ?? imageMetadata?.width ?? 0;
    const h = detectionResult.image_height ?? imageMetadata?.height ?? 0;
    const name = `${baseName(currentFile?.name || activeSampleId || 'image')}.coco.json`;
    const coco = toCoco([{ fileName: currentFile?.name || 'image.jpg', width: w, height: h, boxes: detectionResult.raw_detections }], detectionResult.class_names);
    downloadTextFile(name, JSON.stringify(coco, null, 2), 'application/json');
    onNotify('success', `Exported ${coco.annotations.length} annotation(s) to ${name} (COCO category ids are 1-based).`);
  };

  const handleDownloadAnnotated = () => {
    if (!detectionResult?.annotated_image_base64) return;
    const link = document.createElement('a');
    link.href = detectionResult.annotated_image_base64;
    link.download = `farai-cv-detection-${Date.now()}.${dataUrlExtension(detectionResult.annotated_image_base64)}`;
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
      model: detectionResult.model_name,
      processing_time_ms: detectionResult.processing_time_ms,
      total_objects: detectionResult.total_objects,
      detections: detectionResult.detections,
      threshold: detectionResult.confidence_threshold,
      cached: detectionResult.cached ?? false,
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

      {/* Context note for samples COCO models aren't trained on (the penguin photo) */}
      {mediaMode === 'image' && activeSample?.note && (
        <p className="rounded-xl border border-cyan-500/30 bg-cyan-950/30 p-3 text-xs leading-relaxed text-cyan-100">
          <span className="font-semibold">About this sample: </span>
          {activeSample.note}
        </p>
      )}

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
            ? 'Static frames · Detection · Instance masks'
            : 'Frame-by-frame detection · Timeline'}
        </div>
      </div>

      <LabTierStrip />

      {/* VIDEO SUITE VIEW */}
      {mediaMode === 'video' ? (
        <VideoProcessor
          onNotify={onNotify}
          engine={engine}
          onEngineChange={chooseEngine}
          confidenceThreshold={confidenceThreshold}
          onConfidenceChange={setConfidenceThreshold}
        />
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
            {/* Where detection runs: the backend, or in this browser (no server needed) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div
                role="group"
                aria-label="Inference engine"
                className="inline-flex rounded-xl border border-neutral-800 bg-neutral-900/60 p-1"
              >
                {([
                  ['backend', 'Backend server'],
                  ['browser', 'In this browser'],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    data-testid={`engine-${value}`}
                    aria-pressed={engine === value}
                    onClick={() => chooseEngine(value)}
                    className={`min-h-[36px] rounded-lg px-3.5 py-1.5 font-semibold transition-colors ${
                      engine === value
                        ? 'bg-[#32FF00] text-neutral-950'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-neutral-500">
                {engine === 'browser'
                  ? 'Images, batches and video files run on this device. Comparison always uses the backend.'
                  : 'Needs the backend server. No server? Run it in your browser instead.'}
              </p>
            </div>

            {/* In-browser engine: what is loaded and what it is doing */}
            {engine === 'browser' && (
              <div
                data-testid="browser-engine-bar"
                className="flex flex-col gap-1 p-3.5 rounded-xl border border-neutral-800 bg-neutral-900/60 text-xs"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-block h-2.5 w-2.5 rounded-full ${
                      browserLoadError ? 'bg-rose-500' : browserBackend ? 'bg-[#32FF00]' : 'bg-amber-400'
                    }`}
                  />
                  <span className="font-semibold text-neutral-300">In your browser:</span>
                  {browserLoadError ? (
                    <span className="text-rose-300" data-testid="browser-load-error">{browserLoadError}</span>
                  ) : browserBackend ? (
                    <span className="font-mono text-white" data-testid="browser-model-label">
                      {modelFileName(browserLoadedCfg ?? browserModelCfg)} · {browserBackend === 'webgpu' ? 'WebGPU' : 'WASM (CPU)'} ·{' '}
                      {(browserLoadedCfg ?? browserModelCfg).size}×{(browserLoadedCfg ?? browserModelCfg).size}
                    </span>
                  ) : (
                    <span className="text-amber-300">{browserPhase || 'Starting…'}</span>
                  )}
                </div>
                {/* Model and input size. Files that are not in public/models/ fall back to yolo11n @ 640. */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
                  <label className="flex items-center gap-2 text-neutral-400">
                    Model
                    <select
                      data-testid="browser-model-select"
                      value={browserModelCfg.modelId}
                      onChange={(e) => chooseBrowserModel(parseConfig(e.target.value, browserModelCfg.size))}
                      className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-200"
                    >
                      {BROWSER_MODELS.map((m) => {
                        const missing = modelAvailability[configKey({ modelId: m.id, size: browserModelCfg.size })] === false;
                        return (
                          <option key={m.id} value={m.id}>
                            {m.label} · ~{m.approxMB} MB{missing ? ' (not added)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-neutral-400">
                    Input size
                    <select
                      data-testid="browser-size-select"
                      value={browserModelCfg.size}
                      onChange={(e) => chooseBrowserModel(parseConfig(browserModelCfg.modelId, e.target.value))}
                      className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-200"
                    >
                      {BROWSER_INPUT_SIZES.map((size) => {
                        const missing = modelAvailability[configKey({ modelId: browserModelCfg.modelId, size })] === false;
                        return (
                          <option key={size} value={size}>
                            {size}×{size}
                            {missing ? ' (not added)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                </div>
                {browserNote && !browserLoadError && <p className="text-[11px] text-neutral-500">{browserNote}</p>}
                {!browserBackend && !browserLoadError && (
                  <p className="text-[11px] text-neutral-500">
                    First use downloads about 40 MB (runtime and model); your browser keeps it for next time.
                    Nothing you upload leaves this page.
                  </p>
                )}
                {browserLoadError && (
                  <button
                    type="button"
                    onClick={() => chooseEngine('backend')}
                    className="self-start underline text-neutral-300 hover:text-white"
                  >
                    Use the backend instead
                  </button>
                )}
              </div>
            )}

            {/* Backend status: what will actually run this image */}
            {engine === 'backend' && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-neutral-800 bg-neutral-900/60 text-xs">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${
                    health ? (health.status === 'loading' ? 'bg-amber-400' : 'bg-[#32FF00]') : 'bg-rose-500'
                  }`}
                />
                <span className="font-semibold text-neutral-300">Backend:</span>
                {health ? (
                  <span className="font-mono text-white">
                    {health.model_name} · {health.device}
                    {health.status !== 'healthy' && ` · ${health.status}`}
                  </span>
                ) : (
                  <span className="text-rose-300">{healthError || 'Checking...'}</span>
                )}
              </div>

              <div className="flex items-center gap-3 text-[11px] text-neutral-400">
                {modelInfo && (
                  <span>
                    {modelInfo.num_classes} classes
                    {modelInfo.supports_segmentation ? ' · segmentation' : ''}
                  </span>
                )}
                <button
                  type="button"
                  onClick={refreshBackendStatus}
                  className="underline hover:text-white"
                >
                  Recheck
                </button>
              </div>
            </div>
            )}

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
                        `Latency: ${detectionResult?.processing_time_ms}ms · Found ${detectionResult?.total_objects} objects${
                          detectionResult?.inference_engine === 'webgpu' || detectionResult?.inference_engine === 'wasm'
                            ? ` · in browser (${detectionResult.inference_engine})`
                            : ''
                        }`}
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

                {(status === 'uploading' || status === 'analyzing') && engine === 'browser' && browserPhase && (
                  <p className="text-[11px] text-neutral-400" data-testid="browser-phase">{browserPhase}</p>
                )}

                {/* One-click way out of a failure: the other engine, same image. */}
                {status === 'error' && engine === 'browser' && (
                  <button
                    type="button"
                    data-testid="use-backend-instead"
                    onClick={() => switchEngineAndRetry('backend')}
                    className="underline text-neutral-200 hover:text-white font-semibold"
                  >
                    Use the backend instead
                  </button>
                )}
                {status === 'error' && engine === 'backend' && /Cannot reach the backend/.test(errorMessage || '') && (
                  <button
                    type="button"
                    data-testid="run-in-browser-instead"
                    onClick={() => switchEngineAndRetry('browser')}
                    className="underline text-neutral-200 hover:text-white font-semibold"
                  >
                    No backend? Run it in this browser instead
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Browser mode: boxes as normalised YOLO labels, for review and retraining */}
          {engine === 'browser' && detectionResult?.raw_detections && (
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <button
                type="button"
                data-testid="export-yolo-labels"
                onClick={handleExportYoloLabels}
                className="inline-flex min-h-[36px] items-center gap-2 rounded-lg border border-neutral-700 px-3.5 py-1.5 font-semibold text-neutral-200 hover:border-neutral-500"
              >
                <FileText className="h-3.5 w-3.5" /> Export YOLO Labels (.txt)
              </button>
              <button
                type="button"
                data-testid="export-coco"
                onClick={handleExportCoco}
                className="inline-flex min-h-[36px] items-center gap-2 rounded-lg border border-neutral-700 px-3.5 py-1.5 font-semibold text-neutral-200 hover:border-neutral-500"
              >
                {labPro ? <FileText className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5 text-amber-300" />} Export COCO JSON{labPro ? '' : ' (Pro)'}
              </button>
              <span className="text-neutral-500">
                {detectionResult.raw_detections.length} box(es) at {Math.round(confidenceThreshold * 100)}% confidence · class 0 ={' '}
                {detectionResult.class_names?.[0] ?? '—'}
              </span>
            </div>
          )}

          {/* Results Display Component with BeforeAfterSlider & ConfidenceSlider */}
          {originalImageUrl && detectionResult && (
            <ResultsDisplay
              originalImageUrl={originalImageUrl}
              detectionResult={detectionResult}
              imageMetadata={imageMetadata}
              confidenceThreshold={confidenceThreshold}
              highlightClass={highlightClass}
              onThresholdChange={(t) => {
                setConfidenceThreshold(t);
                rerunWithThreshold(t);
              }}
              canRerun={currentFile !== null}
              onSelectClassFilter={setHighlightClass}
              onDownloadImage={handleDownloadAnnotated}
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
          confidenceThreshold={confidenceThreshold}
          onNotify={onNotify}
          onExpandFullscreen={(src, title) => setFullscreenImage({ src, title })}
          engine={engine}
          modelConfig={browserModelCfg}
          isPro={labPro}
          onRequestUpgrade={openLabUnlock}
        />
      )}

      {/* TAB 3: Model Comparison Mode */}
      {activeTab === 'compare' && (
        <ModelComparison
          currentFile={currentFile}
          originalImageUrl={originalImageUrl}
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
                  Select a Sample Image
                </h3>
                <p className="text-xs text-neutral-400">
                  Input images only: every detection shown comes from the live backend
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

            {/* General scenes first; the penguin photo sits in its own labelled section. */}
            <div className="mt-4 space-y-5 max-h-[70vh] overflow-y-auto pr-1">
              {([
                { key: 'general', title: 'General scenes (COCO models handle these well)' },
                { key: 'research-context', title: 'Research context: penguins' },
              ] as const).map((group) => {
                const items = SAMPLE_IMAGES.filter((x) => x.section === group.key);
                if (items.length === 0) return null;
                const groupNote = items.find((x) => x.note)?.note;
                return (
                  <section key={group.key} className="space-y-2">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-neutral-300">
                      {group.title}
                    </h4>
                    {groupNote && (
                      <p className="rounded-lg border border-cyan-500/30 bg-cyan-950/30 p-2.5 text-[11px] leading-relaxed text-cyan-100">
                        {groupNote}
                      </p>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {items.map((sample) => (
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
                          {sample.category}
                        </div>
                        {sample.source && (
                          <a
                            href={sample.source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="block text-[10px] text-neutral-500 underline hover:text-neutral-300"
                          >
                            Source: Ultralytics
                          </a>
                        )}
                      </div>
                    </div>
                      ))}
                    </div>
                  </section>
                );
              })}
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
                  Backend Base URL
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    id="endpoint-input"
                    type="url"
                    value={endpointInput}
                    onChange={(e) => setEndpointInput(e.target.value)}
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-xs font-mono text-white focus:border-[#32FF00] focus:outline-none"
                    placeholder="http://localhost:8000"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setApiBaseUrl(endpointInput);
                      setEndpointInput(getApiBaseUrl());
                      setShowBackendModal(false);
                      onNotify('success', `Saved backend URL: ${getApiBaseUrl()}`);
                    }}
                    className="min-h-[44px] rounded-lg bg-[#32FF00] px-4 py-2 text-xs font-semibold text-neutral-950 hover:bg-[#00FF41] shrink-0"
                  >
                    Save URL
                  </button>
                </div>
              </div>

              <div className="rounded-lg bg-neutral-950/80 border border-neutral-800 p-3 text-xs text-neutral-400">
                <p className="font-semibold text-neutral-200">All results come from this backend.</p>
                <p className="mt-0.5">
                  Image, video and comparison requests are sent to <code>{'{base}'}/api/...</code>. If the backend is unreachable or returns an error, the request fails and the error is shown; there is no offline simulation.
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
