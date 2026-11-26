import { Download, FileCode, RefreshCw, Info } from 'lucide-react';
import { ImageMetadata, DetectionScoreBreakdown } from '../types';
import { VisionDetectionResult } from '../services/visionApi';
import BeforeAfterSlider from './BeforeAfterSlider';
import ConfidenceSlider from './ConfidenceSlider';
import { getClassColor } from '../utils/colors';
import { capitalizeClass, formatConfidencePercent } from '../utils/formatters';

interface ResultsDisplayProps {
  originalImageUrl: string;
  detectionResult: VisionDetectionResult;
  imageMetadata: ImageMetadata | null;
  confidenceThreshold: number;
  highlightClass: string | null;
  onThresholdChange: (newThreshold: number) => void;
  // False when the original file isn't available (e.g. a gallery restore).
  canRerun: boolean;
  onSelectClassFilter: (className: string | null) => void;
  onDownloadImage: () => void;
  onDownloadJson: () => void;
  onReset: () => void;
  onExpandFullscreen?: (src: string, title: string) => void;
}

export default function ResultsDisplay({
  originalImageUrl,
  detectionResult,
  imageMetadata,
  confidenceThreshold,
  highlightClass,
  onThresholdChange,
  canRerun,
  onSelectClassFilter,
  onDownloadImage,
  onDownloadJson,
  onReset,
  onExpandFullscreen,
}: ResultsDisplayProps) {
  return (
    <div className="space-y-6">
      {/* 1. Confidence threshold: changing it re-runs detection on the backend. */}
      <ConfidenceSlider
        value={confidenceThreshold}
        onChange={onThresholdChange}
        disabled={!canRerun}
      />

      {/* 2. Before/After Slider & Visual Inspection */}
      <div className="rounded-2xl border border-[#16213E] bg-[#16213E]/50 p-4 sm:p-5 shadow-xl lime-glow">
        <BeforeAfterSlider
          originalImage={originalImageUrl}
          annotatedImage={detectionResult.annotated_image_base64}
          altTitle={imageMetadata?.name || 'Inspection Frame'}
          onExpandFullscreen={onExpandFullscreen}
        />
      </div>

      {/* 3. Controls & Toggles Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#16213E] bg-[#16213E]/60 p-4">
        <div className="text-xs text-[#CCCCCC]">
          {detectionResult.cached
            ? 'Served from backend cache'
            : detectionResult.inference_engine === 'webgpu' || detectionResult.inference_engine === 'wasm'
            ? `Annotated in your browser (${detectionResult.inference_engine === 'webgpu' ? 'WebGPU' : 'WASM'})`
            : 'Annotated by the backend'}
          {' · '}threshold {formatConfidencePercent(detectionResult.confidence_threshold)}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDownloadImage}
            className="btn-lime min-h-[40px] flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold shadow-md"
          >
            <Download className="h-3.5 w-3.5 text-[#0F1419]" />
            <span>Download Image</span>
          </button>

          <button
            type="button"
            onClick={onDownloadJson}
            className="min-h-[40px] flex items-center gap-1.5 rounded-lg border border-[#16213E] bg-[#0F1419] hover:border-[#32FF00]/50 px-3.5 py-1.5 text-xs font-medium text-[#CCCCCC] hover:text-white transition-colors"
          >
            <FileCode className="h-3.5 w-3.5 text-[#32FF00]" />
            <span>JSON Report</span>
          </button>

          <button
            type="button"
            onClick={onReset}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center p-2 text-[#CCCCCC] hover:text-rose-400 rounded-lg transition-colors border border-[#16213E] bg-[#0F1419]"
            title="Reset workspace"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 4. Detection Summary & Class Breakdown Table */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
        {/* Detection Summary Card */}
        <div className="rounded-xl border-t-2 border-[#32FF00] border-l border-r border-b border-[#16213E] bg-[#16213E]/50 p-5 space-y-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#32FF00]">
            Detection Summary
          </span>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-[#16213E] pb-2">
              <span className="text-[#CCCCCC]">Total Objects Detected</span>
              <span className="font-mono text-2xl font-bold text-white tabular-nums">
                {detectionResult.total_objects}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-[#16213E] pb-2">
              <span className="text-[#CCCCCC]">Processing Latency</span>
              <span className="font-mono text-sm font-semibold text-[#32FF00] tabular-nums">
                {detectionResult.processing_time_ms} ms
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-[#16213E] pb-2">
              <span className="text-[#CCCCCC]">Detected Classes</span>
              <span className="font-mono text-sm font-semibold text-white tabular-nums">
                {Object.keys(detectionResult.detections).length}
              </span>
            </div>

            {imageMetadata && (
              <div className="flex items-center justify-between border-b border-[#16213E] pb-2">
                <span className="text-[#CCCCCC]">Resolution</span>
                <span className="font-mono text-xs text-[#CCCCCC] tabular-nums">
                  {imageMetadata.width} × {imageMetadata.height} px
                </span>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <span className="text-[#CCCCCC]">Active Model</span>
              <span className="font-mono text-xs text-white">
                {detectionResult.model_name}
              </span>
            </div>
          </div>
        </div>

        {/* Breakdown by Class */}
        <div className="md:col-span-2 rounded-xl border-t-2 border-[#32FF00] border-l border-r border-b border-[#16213E] bg-[#16213E]/50 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#32FF00]">
              Detection Breakdown by Class
            </span>
            <span className="text-xs text-[#888888]">Click a class to highlight it</span>
          </div>

          {Object.keys(detectionResult.detections).length === 0 ? (
            <div className="rounded-xl border border-[#16213E] bg-[#0F1419] p-8 text-center space-y-2">
              <Info className="h-6 w-6 text-[#666666] mx-auto" />
              <p className="text-sm font-semibold text-white">No objects detected</p>
              <p className="text-xs text-[#888888] max-w-sm mx-auto">
                No detections met the current threshold ({formatConfidencePercent(confidenceThreshold)}). Try lowering the slider above.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#16213E] max-h-72 overflow-y-auto pr-1">
              {(Object.entries(detectionResult.detections) as [string, DetectionScoreBreakdown][]).map(([className, data]) => {
                // Prefer the backend's colour so the badge matches the box drawn in the image.
                const swatch = data.color || getClassColor(className).hex;
                const avgConf = data.average_confidence !== undefined
                  ? data.average_confidence
                  : data.confidence_scores.reduce((a: number, b: number) => a + b, 0) / (data.confidence_scores.length || 1);
                const isHighlighted = highlightClass?.toLowerCase() === className.toLowerCase();

                return (
                  <div
                    key={className}
                    onClick={() => {
                      const next = isHighlighted ? null : className;
                      onSelectClassFilter(next);
                    }}
                    className={`flex items-center justify-between py-2.5 px-3 rounded-lg cursor-pointer transition-colors ${
                      isHighlighted
                        ? 'bg-[#16213E] ring-1 ring-[#32FF00]'
                        : 'hover:bg-[#16213E]/60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="h-3 w-3 rounded-full shrink-0 shadow-[0_0_6px_currentColor]"
                        style={{ backgroundColor: swatch, color: swatch }}
                      />
                      <div>
                        <span className="text-sm font-semibold text-white">
                          {capitalizeClass(className)}
                        </span>
                        <span className="text-xs text-[#888888] ml-2 font-mono">
                          (
                          {data.confidence_scores
                            .map((s: number) => formatConfidencePercent(s))
                            .join(', ')}
                          )
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <span className="text-xs text-[#888888]">Count: </span>
                        <span className="font-mono text-sm font-bold text-white tabular-nums">
                          {data.count}
                        </span>
                      </div>
                      <div className="text-right min-w-[80px]">
                        <span className="text-xs text-[#888888]">Avg: </span>
                        <span className="font-mono text-sm font-bold text-[#32FF00] tabular-nums">
                          {formatConfidencePercent(avgConf)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {highlightClass && (
            <div className="pt-2 flex items-center justify-between text-xs text-[#32FF00] bg-[#32FF00]/10 border border-[#32FF00]/30 px-3 py-1.5 rounded-lg">
              <span>Highlighting "{capitalizeClass(highlightClass)}"</span>
              <button
                type="button"
                onClick={() => onSelectClassFilter(null)}
                className="text-[#CCCCCC] hover:text-white underline"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
