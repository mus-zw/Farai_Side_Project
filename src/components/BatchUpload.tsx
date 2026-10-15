import React, { useState, useRef } from 'react';
import JSZip from 'jszip';
import {
  Upload,
  Files,
  Play,
  Download,
  Trash2,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Maximize2,
  Clock,
  Layers,
  Sparkles,
  X,
} from 'lucide-react';
import { BatchItem, VisionModelId } from '../types';
import { detectObjects, validateAndExtractImageMetadata } from '../services/visionApi';
import { formatBytes, capitalizeClass } from '../utils/formatters';
import { getClassColor } from '../utils/colors';

interface BatchUploadProps {
  modelId: VisionModelId;
  confidenceThreshold: number;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
  onExpandFullscreen?: (src: string, title: string) => void;
}

export default function BatchUpload({
  modelId,
  confidenceThreshold,
  onNotify,
  onExpandFullscreen,
}: BatchUploadProps) {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFilesAdded = async (fileList: FileList | File[]) => {
    const newItems: BatchItem[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      try {
        await validateAndExtractImageMetadata(file);
        const previewUrl = URL.createObjectURL(file);
        newItems.push({
          id: `batch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          file,
          previewUrl,
          status: 'queued',
          progress: 0,
        });
      } catch (err: any) {
        onNotify('error', `${file.name}: ${err?.message || 'File rejected'}`);
      }
    }

    if (newItems.length > 0) {
      setItems((prev) => [...prev, ...newItems]);
      onNotify('info', `Queued ${newItems.length} files for batch processing.`);
    }
  };

  const removeBatchItem = (id: string) => {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target?.previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((i) => i.id !== id);
    });
  };

  const clearAllBatch = () => {
    items.forEach((item) => {
      if (item.previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(item.previewUrl);
      }
    });
    setItems([]);
  };

  const runBatchProcessing = async () => {
    if (items.length === 0) {
      onNotify('error', 'Please queue at least one image to process.');
      return;
    }

    setIsProcessing(true);
    let successCount = 0;

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      setCurrentIndex(idx);

      // Update item status to processing
      setItems((prev) =>
        prev.map((it, i) => (i === idx ? { ...it, status: 'processing', progress: 20 } : it))
      );

      try {
        const result = await detectObjects(
          item.file,
          item.previewUrl,
          undefined,
          {
            modelId,
            confidenceThreshold,
            showMasks: true,
            showLabels: true,
            onProgress: (p) => {
              setItems((prev) =>
                prev.map((it, i) => (i === idx ? { ...it, progress: Math.min(95, p) } : it))
              );
            },
          }
        );

        setItems((prev) =>
          prev.map((it, i) =>
            i === idx
              ? {
                  ...it,
                  status: 'done',
                  progress: 100,
                  result: {
                    totalObjects: result.total_objects,
                    processingTimeMs: result.processing_time_ms,
                    annotatedImage: result.annotated_image_base64,
                    detections: result.detections,
                  },
                }
              : it
          )
        );
        successCount++;
      } catch (err: any) {
        console.error(`Batch processing failed for ${item.file.name}:`, err);
        setItems((prev) =>
          prev.map((it, i) =>
            i === idx
              ? {
                  ...it,
                  status: 'error',
                  progress: 0,
                  error: err?.message || 'Processing failed',
                }
              : it
          )
        );
      }
    }

    setIsProcessing(false);
    onNotify('success', `Batch complete: ${successCount} of ${items.length} images processed.`);
  };

  // Export batch results as a ZIP archive
  const handleDownloadBatchZip = async () => {
    const doneItems = items.filter((i) => i.status === 'done' && i.result?.annotatedImage);
    if (doneItems.length === 0) {
      onNotify('error', 'No completed results available to export.');
      return;
    }

    const zip = new JSZip();
    const folder = zip.folder('farai_cv_batch_results');

    // Add images
    doneItems.forEach((item, idx) => {
      const base64Data = item.result!.annotatedImage.replace(/^data:image\/png;base64,/, '');
      const filename = `annotated_${idx + 1}_${item.file.name.replace(/\.[^/.]+$/, '')}.png`;
      folder?.file(filename, base64Data, { base64: true });
    });

    // Add summary manifest JSON
    const summaryData = {
      pipeline: 'Farai Bodias Musariri Computer Vision Batch Engine',
      timestamp: new Date().toISOString(),
      modelId,
      confidenceThreshold,
      totalProcessed: doneItems.length,
      items: doneItems.map((item) => ({
        filename: item.file.name,
        totalObjects: item.result?.totalObjects,
        processingTimeMs: item.result?.processingTimeMs,
        detections: item.result?.detections,
      })),
    };
    folder?.file('batch_summary.json', JSON.stringify(summaryData, null, 2));

    try {
      const content = await zip.generateAsync({ type: 'blob' });
      const downloadUrl = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `farai-cv-batch-${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
      onNotify('success', `Exported ${doneItems.length} annotated frames to ZIP archive!`);
    } catch (e) {
      console.error('Failed to generate ZIP archive:', e);
      onNotify('error', 'Failed to generate ZIP package.');
    }
  };

  const completedCount = items.filter((i) => i.status === 'done').length;

  return (
    <div className="space-y-8 animate-in fade-in">
      {/* Upload Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files) {
            handleFilesAdded(e.dataTransfer.files);
          }
        }}
        className={`relative rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
          isDragging
            ? 'border-[#32FF00] bg-[#32FF00]/10'
            : 'border-neutral-800 bg-neutral-900/40 hover:border-neutral-700 hover:bg-neutral-900/60'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/png, image/jpeg, image/jpg, image/webp"
          onChange={(e) => {
            if (e.target.files) {
              handleFilesAdded(e.target.files);
            }
          }}
          className="hidden"
          id="batch-image-upload"
        />

        <div className="mx-auto flex max-w-lg flex-col items-center justify-center space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-800 text-[#32FF00] shadow-inner">
            <Files className="h-6 w-6" />
          </div>

          <div className="space-y-1">
            <p className="text-sm font-semibold text-white">
              Select multiple images or drag & drop a batch here, or{' '}
              <label
                htmlFor="batch-image-upload"
                className="cursor-pointer text-[#32FF00] hover:underline"
              >
                browse local directory
              </label>
            </p>
            <p className="text-xs text-neutral-400">
              High-throughput sequential pipeline with automated ZIP package generation
            </p>
          </div>
        </div>
      </div>

      {/* Batch Control Bar */}
      {items.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-neutral-800 bg-neutral-900/70 p-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-white">
                Queue Status:
              </span>
              <span className="font-mono text-xs text-[#32FF00] font-bold">
                {completedCount} of {items.length} images processed
              </span>
            </div>
            {isProcessing && (
              <p className="text-[11px] text-neutral-400">
                Processing item {currentIndex + 1}: <strong className="text-white">{items[currentIndex]?.file.name}</strong>
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={runBatchProcessing}
              disabled={isProcessing}
              className="min-h-[42px] inline-flex items-center gap-2 rounded-xl bg-[#32FF00] px-5 py-2 text-xs font-semibold text-neutral-950 hover:bg-[#32FF00] transition-all disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Processing Batch...</span>
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 fill-current" />
                  <span>Analyze All ({items.length})</span>
                </>
              )}
            </button>

            {completedCount > 0 && (
              <button
                type="button"
                onClick={handleDownloadBatchZip}
                disabled={isProcessing}
                className="min-h-[42px] inline-flex items-center gap-2 rounded-xl bg-neutral-800 border border-neutral-700 px-4 py-2 text-xs font-semibold text-white hover:bg-neutral-700 transition-colors"
              >
                <Download className="h-4 w-4 text-[#32FF00]" />
                <span>Download All (ZIP)</span>
              </button>
            )}

            <button
              type="button"
              onClick={clearAllBatch}
              disabled={isProcessing}
              className="min-h-[42px] px-3 py-2 text-xs text-neutral-400 hover:text-rose-400 transition-colors"
              title="Clear Batch"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      {isProcessing && (
        <div className="h-2 w-full rounded-full bg-neutral-800 overflow-hidden">
          <div
            className="h-full bg-[#32FF00] transition-all duration-300"
            style={{ width: `${Math.round(((currentIndex + 1) / items.length) * 100)}%` }}
          />
        </div>
      )}

      {/* Grid View of Batch Results */}
      {items.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="group relative rounded-xl border border-neutral-800 bg-neutral-900/60 p-3 hover:border-neutral-700 transition-all flex flex-col justify-between"
            >
              {/* Image Preview / Annotated Output */}
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-neutral-950 flex items-center justify-center">
                <img
                  src={item.result?.annotatedImage || item.previewUrl}
                  alt={item.file.name}
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />

                {/* Status Overlay */}
                {item.status === 'processing' && (
                  <div className="absolute inset-0 bg-neutral-950/70 backdrop-blur-xs flex flex-col items-center justify-center gap-2">
                    <RefreshCw className="h-6 w-6 animate-spin text-[#32FF00]" />
                    <span className="text-[11px] font-mono text-[#32FF00]">Analyzing...</span>
                  </div>
                )}

                {item.status === 'done' && item.result && (
                  <div className="absolute top-2 right-2 rounded bg-neutral-950/80 px-2 py-0.5 font-mono text-[10px] text-[#32FF00] font-bold tabular-nums">
                    {item.result.totalObjects} objs
                  </div>
                )}

                {item.status === 'error' && (
                  <div className="absolute inset-0 bg-rose-950/80 flex flex-col items-center justify-center p-2 text-center">
                    <AlertCircle className="h-5 w-5 text-rose-400 mb-1" />
                    <span className="text-[10px] text-rose-200">{item.error || 'Failed'}</span>
                  </div>
                )}
              </div>

              {/* Details & Metadata */}
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white truncate max-w-[140px]">
                    {item.file.name}
                  </span>
                  <span className="font-mono text-[10px] text-neutral-400 tabular-nums">
                    {formatBytes(item.file.size)}
                  </span>
                </div>

                {item.result ? (
                  <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400 pt-1 border-t border-neutral-800">
                    <span className="text-[#32FF00] font-semibold">{item.result.processingTimeMs} ms</span>
                    <span>{Object.keys(item.result.detections).length} classes</span>
                  </div>
                ) : (
                  <div className="text-[10px] text-neutral-500 pt-1 border-t border-neutral-800">
                    Status: <span className="capitalize">{item.status}</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1 text-[11px]">
                  {item.result && onExpandFullscreen ? (
                    <button
                      type="button"
                      onClick={() => onExpandFullscreen(item.result!.annotatedImage, item.file.name)}
                      className="text-[#32FF00] hover:text-[#32FF00] flex items-center gap-1 font-medium"
                    >
                      <Maximize2 className="h-3 w-3" />
                      <span>Expand</span>
                    </button>
                  ) : (
                    <span />
                  )}

                  {!isProcessing && (
                    <button
                      type="button"
                      onClick={() => removeBatchItem(item.id)}
                      className="text-neutral-500 hover:text-rose-400 p-1"
                      title="Remove"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
