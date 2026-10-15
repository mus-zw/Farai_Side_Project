import React, { useState } from 'react';
import { RefreshCw, Play, SlidersHorizontal, Sparkles, Scale, Maximize2 } from 'lucide-react';
import { VisionModelId, ModelComparisonResult, ImageMetadata } from '../types';
import { VISION_MODELS, MODEL_LIST } from '../utils/models';
import { detectObjects } from '../services/visionApi';
import ComparisonMetrics from './ComparisonMetrics';
import ConfidenceSlider from './ConfidenceSlider';

interface ModelComparisonProps {
  currentFile: File | null;
  originalImageUrl: string | null;
  activeSampleId?: string | null;
  imageMetadata?: ImageMetadata | null;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
  onExpandFullscreen?: (src: string, title: string) => void;
}

export default function ModelComparison({
  currentFile,
  originalImageUrl,
  activeSampleId,
  imageMetadata,
  onNotify,
  onExpandFullscreen,
}: ModelComparisonProps) {
  const [modelAId, setModelAId] = useState<VisionModelId>('farai-fpn');
  const [modelBId, setModelBId] = useState<VisionModelId>('yolov8x');
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0.5);
  const [isComparing, setIsComparing] = useState<boolean>(false);
  const [comparisonResult, setComparisonResult] = useState<ModelComparisonResult | null>(null);

  const runComparison = async () => {
    if (!originalImageUrl || !currentFile) {
      onNotify('error', 'Please select or upload an image before running model comparison.');
      return;
    }

    setIsComparing(true);
    try {
      // 1. Run Model A
      const resA = await detectObjects(
        currentFile,
        originalImageUrl,
        activeSampleId || undefined,
        {
          modelId: modelAId,
          confidenceThreshold,
          showMasks: true,
          showLabels: true,
        },
        imageMetadata || undefined
      );

      // 2. Run Model B
      const resB = await detectObjects(
        currentFile,
        originalImageUrl,
        activeSampleId || undefined,
        {
          modelId: modelBId,
          confidenceThreshold,
          showMasks: true,
          showLabels: true,
        },
        imageMetadata || undefined
      );

      // Calculate confidence averages
      const scoresA = Object.values(resA.detections).flatMap((d) => d.confidence_scores);
      const avgA = scoresA.length > 0 ? scoresA.reduce((a, b) => a + b, 0) / scoresA.length : 0;

      const scoresB = Object.values(resB.detections).flatMap((d) => d.confidence_scores);
      const avgB = scoresB.length > 0 ? scoresB.reduce((a, b) => a + b, 0) / scoresB.length : 0;

      // Class difference comparison
      const allClasses = Array.from(
        new Set([...Object.keys(resA.detections), ...Object.keys(resB.detections)])
      );

      const classComparison = allClasses.map((className) => {
        const countA = resA.detections[className]?.count || 0;
        const countB = resB.detections[className]?.count || 0;
        return {
          className,
          countA,
          countB,
          diff: countA - countB,
        };
      });

      // Latency speedup calculation
      const minLatency = Math.min(resA.processing_time_ms, resB.processing_time_ms);
      const maxLatency = Math.max(resA.processing_time_ms, resB.processing_time_ms);
      const speedup = Math.round(((maxLatency - minLatency) / maxLatency) * 100);

      const comparison: ModelComparisonResult = {
        modelA: {
          info: VISION_MODELS[modelAId],
          totalObjects: resA.total_objects,
          processingTimeMs: resA.processing_time_ms,
          avgConfidence: avgA,
          detections: resA.detections,
          annotatedImage: resA.annotated_image_base64,
        },
        modelB: {
          info: VISION_MODELS[modelBId],
          totalObjects: resB.total_objects,
          processingTimeMs: resB.processing_time_ms,
          avgConfidence: avgB,
          detections: resB.detections,
          annotatedImage: resB.annotated_image_base64,
        },
        fasterModel:
          resA.processing_time_ms < resB.processing_time_ms
            ? 'A'
            : resB.processing_time_ms < resA.processing_time_ms
            ? 'B'
            : 'Tie',
        moreConfidentModel: avgA > avgB ? 'A' : avgB > avgA ? 'B' : 'Tie',
        speedupPercentage: speedup,
        classComparison,
      };

      setComparisonResult(comparison);
      onNotify('success', `Comparison completed: ${comparison.modelA.info.name} vs ${comparison.modelB.info.name}`);
    } catch (err: any) {
      console.error('Model comparison error:', err);
      onNotify('error', err?.message || 'Failed to complete model comparison.');
    } finally {
      setIsComparing(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in">
      {/* Model Selection and Controls */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#16213E] border border-[#32FF00]/30 text-[#32FF00]">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-white">
                Multi-Model Comparative Benchmarking
              </h3>
              <p className="text-xs text-neutral-400">
                Run side-by-side inference on identical frames to evaluate speed, recall, and certainty
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={runComparison}
            disabled={isComparing || !originalImageUrl}
            className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#32FF00] px-5 py-2.5 text-xs font-semibold text-neutral-950 hover:bg-[#32FF00] transition-all disabled:opacity-50"
          >
            {isComparing ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Benchmarking Both Models...</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4 fill-current" />
                <span>Execute Benchmark</span>
              </>
            )}
          </button>
        </div>

        {/* Model Dropdowns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Model A */}
          <div className="space-y-2 rounded-xl border border-neutral-800 bg-neutral-950/80 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#32FF00]">
                Candidate Model A
              </span>
              <span className="text-[10px] text-neutral-500 font-mono">Primary Architecture</span>
            </div>
            <select
              value={modelAId}
              onChange={(e) => setModelAId(e.target.value as VisionModelId)}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs font-medium text-white focus:border-[#32FF00] focus:outline-none"
            >
              {MODEL_LIST.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} — {m.architecture}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-neutral-400">
              {VISION_MODELS[modelAId].description}
            </p>
          </div>

          {/* Model B */}
          <div className="space-y-2 rounded-xl border border-neutral-800 bg-neutral-950/80 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                Candidate Model B
              </span>
              <span className="text-[10px] text-neutral-500 font-mono">Baseline Architecture</span>
            </div>
            <select
              value={modelBId}
              onChange={(e) => setModelBId(e.target.value as VisionModelId)}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs font-medium text-white focus:border-[#32FF00] focus:outline-none"
            >
              {MODEL_LIST.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} — {m.architecture}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-neutral-400">
              {VISION_MODELS[modelBId].description}
            </p>
          </div>
        </div>

        {/* Global Confidence Threshold for comparison */}
        <ConfidenceSlider
          value={confidenceThreshold}
          onChange={(newVal) => setConfidenceThreshold(newVal)}
          disabled={isComparing}
        />
      </div>

      {/* Comparison Results */}
      {comparisonResult && (
        <div className="space-y-8 animate-in fade-in">
          {/* Side-by-Side Visual Outputs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Model A View */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-neutral-300">
                <span className="font-semibold text-[#32FF00]">
                  Model A: {comparisonResult.modelA.info.name}
                </span>
                <span className="font-mono text-neutral-400">
                  {comparisonResult.modelA.totalObjects} objs · {comparisonResult.modelA.processingTimeMs} ms
                </span>
              </div>
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-[#32FF00]/40 bg-neutral-950 flex items-center justify-center group">
                <img
                  src={comparisonResult.modelA.annotatedImage}
                  alt={comparisonResult.modelA.info.name}
                  className="max-h-full max-w-full object-contain"
                  referrerPolicy="no-referrer"
                />
                {onExpandFullscreen && (
                  <button
                    type="button"
                    onClick={() =>
                      onExpandFullscreen(
                        comparisonResult.modelA.annotatedImage,
                        `Model A: ${comparisonResult.modelA.info.name}`
                      )
                    }
                    className="absolute bottom-3 right-3 rounded-lg bg-neutral-900/80 p-2 text-neutral-300 hover:text-white backdrop-blur-sm opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                    title="Expand"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Model B View */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-neutral-300">
                <span className="font-semibold text-cyan-400">
                  Model B: {comparisonResult.modelB.info.name}
                </span>
                <span className="font-mono text-neutral-400">
                  {comparisonResult.modelB.totalObjects} objs · {comparisonResult.modelB.processingTimeMs} ms
                </span>
              </div>
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-cyan-500/40 bg-neutral-950 flex items-center justify-center group">
                <img
                  src={comparisonResult.modelB.annotatedImage}
                  alt={comparisonResult.modelB.info.name}
                  className="max-h-full max-w-full object-contain"
                  referrerPolicy="no-referrer"
                />
                {onExpandFullscreen && (
                  <button
                    type="button"
                    onClick={() =>
                      onExpandFullscreen(
                        comparisonResult.modelB.annotatedImage,
                        `Model B: ${comparisonResult.modelB.info.name}`
                      )
                    }
                    className="absolute bottom-3 right-3 rounded-lg bg-neutral-900/80 p-2 text-neutral-300 hover:text-white backdrop-blur-sm opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                    title="Expand"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Detailed Performance Metrics & Discrepancies */}
          <ComparisonMetrics comparison={comparisonResult} />
        </div>
      )}
    </div>
  );
}
