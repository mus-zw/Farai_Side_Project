import React from 'react';
import {
  BarChart3,
  TrendingUp,
  Cpu,
  Layers,
  Clock,
  Sparkles,
  Download,
  FileSpreadsheet,
  FileJson,
} from 'lucide-react';
import { GalleryItem } from '../types';
import { capitalizeClass } from '../utils/formatters';
import { getClassColor } from '../utils/colors';

interface AnalyticsProps {
  galleryItems: GalleryItem[];
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

export default function Analytics({ galleryItems, onNotify }: AnalyticsProps) {
  // Aggregate statistics
  const totalAnalyzed = galleryItems.length;

  const totalObjectsDetected = galleryItems.reduce((acc, item) => acc + (item.totalObjects || 0), 0);

  const avgLatency =
    totalAnalyzed > 0
      ? Math.round(galleryItems.reduce((acc, item) => acc + (item.processingTimeMs || 0), 0) / totalAnalyzed)
      : 0;

  // Class frequencies
  const classCounts: Record<string, number> = {};
  galleryItems.forEach((item) => {
    Object.entries(item.detections || {}).forEach(([cls, data]) => {
      classCounts[cls] = (classCounts[cls] || 0) + (data.count || 0);
    });
  });

  const sortedClasses = Object.entries(classCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const maxClassCount = sortedClasses.length > 0 ? sortedClasses[0][1] : 1;

  // Export as CSV
  const handleExportCSV = () => {
    if (galleryItems.length === 0) {
      onNotify('error', 'No analytics records available to export.');
      return;
    }

    const headers = ['Scan ID', 'Timestamp', 'Title', 'Total Objects', 'Latency (ms)', 'Model', 'Top Classes'];
    const rows = galleryItems.map((item) => [
      item.id,
      new Date(item.timestamp).toISOString(),
      `"${item.title.replace(/"/g, '""')}"`,
      item.totalObjects,
      item.processingTimeMs,
      item.modelName || 'Farai FPN',
      `"${item.topClasses.map((c) => `${c.name}:${c.count}`).join(';')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `farai-cv-analytics-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onNotify('success', 'Exported analytics dataset as CSV.');
  };

  // Export as JSON
  const handleExportJSON = () => {
    if (galleryItems.length === 0) {
      onNotify('error', 'No analytics records available to export.');
      return;
    }

    const payload = {
      pipeline: 'Farai Bodias Musariri Computer Vision Inference Engine',
      exportedAt: new Date().toISOString(),
      totalScans: totalAnalyzed,
      avgLatencyMs: avgLatency,
      totalObjectsDetected,
      classFrequency: classCounts,
      records: galleryItems,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `farai-cv-analytics-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onNotify('success', 'Exported analytics dataset as JSON.');
  };

  return (
    <div className="space-y-8 animate-in fade-in">
      {/* Top Banner and Quick Export Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#32FF00]">
            <BarChart3 className="h-4 w-4" />
            <span>Computer Vision Analytics Dashboard</span>
          </div>
          <h3 className="font-display text-xl font-bold text-white mt-1">
            Empirical Inference & Distribution Metrics
          </h3>
          <p className="text-xs text-neutral-400 mt-0.5">
            Aggregated statistics collected from recent client and edge server evaluations
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportCSV}
            className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl bg-neutral-800 border border-neutral-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-neutral-700 transition-colors"
          >
            <FileSpreadsheet className="h-4 w-4 text-[#32FF00]" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={handleExportJSON}
            className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl bg-neutral-800 border border-neutral-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-neutral-700 transition-colors"
          >
            <FileJson className="h-4 w-4 text-cyan-400" />
            <span>Export JSON</span>
          </button>
        </div>
      </div>

      {/* Aggregate KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span className="font-medium">Total Images Analyzed</span>
            <Layers className="h-4 w-4 text-[#32FF00]" />
          </div>
          <span className="font-mono text-3xl font-extrabold text-white tabular-nums">
            {totalAnalyzed}
          </span>
          <p className="text-[11px] text-neutral-500">Across local and benchmark test frames</p>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span className="font-medium">Average Latency</span>
            <Clock className="h-4 w-4 text-amber-400" />
          </div>
          <span className="font-mono text-3xl font-extrabold text-[#32FF00] tabular-nums">
            {avgLatency} <span className="text-sm font-normal text-neutral-400">ms</span>
          </span>
          <p className="text-[11px] text-neutral-500">Real-time edge forward pass timing</p>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span className="font-medium">Total Objects Detected</span>
            <TrendingUp className="h-4 w-4 text-cyan-400" />
          </div>
          <span className="font-mono text-3xl font-extrabold text-white tabular-nums">
            {totalObjectsDetected}
          </span>
          <p className="text-[11px] text-neutral-500">Across all evaluated frames</p>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span className="font-medium">Unique Classes Seen</span>
            <Sparkles className="h-4 w-4 text-pink-400" />
          </div>
          <span className="font-mono text-3xl font-extrabold text-white tabular-nums">
            {Object.keys(classCounts).length}
          </span>
          <p className="text-[11px] text-neutral-500">From COCO and custom aerial taxonomy</p>
        </div>
      </div>

      {/* Class Frequency Distribution Chart */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-display text-sm font-bold uppercase tracking-wider text-white">
              Most Detected Object Classes
            </h4>
            <p className="text-xs text-neutral-400">
              Distribution of target classifications across scanned sessions
            </p>
          </div>
          <span className="font-mono text-xs text-neutral-500">Ranked by count</span>
        </div>

        {sortedClasses.length === 0 ? (
          <p className="text-xs text-neutral-500 py-6 text-center">
            No detection data recorded yet. Run a scan or sample test to populate analytics.
          </p>
        ) : (
          <div className="space-y-3">
            {sortedClasses.map(([cls, count]) => {
              const color = getClassColor(cls);
              const percentOfMax = Math.round((count / maxClassCount) * 100);

              return (
                <div key={cls} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-white flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color.hex }} />
                      <span>{capitalizeClass(cls)}</span>
                    </span>
                    <span className="font-mono text-neutral-300 font-semibold tabular-nums">
                      {count} instance{count === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div className="h-2.5 w-full rounded-full bg-neutral-800 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.max(6, percentOfMax)}%`,
                        backgroundColor: color.hex,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Scans Latency Log */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 space-y-4">
        <h4 className="font-display text-sm font-bold uppercase tracking-wider text-white">
          Recent Inference Latency History
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-neutral-800 text-neutral-400 font-medium pb-2">
                <th className="py-2">Image Title</th>
                <th className="py-2">Model Architecture</th>
                <th className="py-2 font-mono">Detections</th>
                <th className="py-2 font-mono text-right">Inference Latency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60 font-mono">
              {galleryItems.slice(0, 6).map((item) => (
                <tr key={item.id} className="hover:bg-neutral-800/40">
                  <td className="py-2.5 font-sans font-medium text-white truncate max-w-[200px]">
                    {item.title}
                  </td>
                  <td className="py-2.5 font-sans text-neutral-400">
                    {item.modelName || "Farai's FPN-DomainNet"}
                  </td>
                  <td className="py-2.5 text-neutral-300 tabular-nums">
                    {item.totalObjects} objs
                  </td>
                  <td className="py-2.5 text-right text-[#32FF00] font-semibold tabular-nums">
                    {item.processingTimeMs} ms
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
