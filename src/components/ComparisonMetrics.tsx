import React from 'react';
import { Zap, Target, Award, ArrowUp, ArrowDown, Sparkles } from 'lucide-react';
import { ModelComparisonResult } from '../types';
import { formatConfidencePercent, capitalizeClass } from '../utils/formatters';
import { getClassColor } from '../utils/colors';

interface ComparisonMetricsProps {
  comparison: ModelComparisonResult;
}

export default function ComparisonMetrics({ comparison }: ComparisonMetricsProps) {
  const { modelA, modelB, fasterModel, moreConfidentModel, speedupPercentage, classComparison } = comparison;

  return (
    <div className="space-y-6">
      {/* Executive Performance Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Latency Winner */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span className="font-semibold text-neutral-300 flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-amber-400" />
              Throughput Winner
            </span>
            <span className="font-mono text-amber-400 font-bold">
              {speedupPercentage > 0 ? `+${speedupPercentage}% Faster` : 'Equal Speed'}
            </span>
          </div>
          <div className="text-sm font-bold text-white">
            {fasterModel === 'A' ? modelA.info.name : fasterModel === 'B' ? modelB.info.name : 'Tie'}
          </div>
          <div className="flex items-center justify-between text-xs text-neutral-400 font-mono pt-1">
            <span>Model A: {modelA.processingTimeMs}ms</span>
            <span>vs</span>
            <span>Model B: {modelB.processingTimeMs}ms</span>
          </div>
        </div>

        {/* Confidence Winner */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span className="font-semibold text-neutral-300 flex items-center gap-1.5">
              <Target className="h-4 w-4 text-[#32FF00]" />
              Certainty Winner
            </span>
            <span className="font-mono text-[#32FF00] font-bold">
              {formatConfidencePercent(Math.max(modelA.avgConfidence, modelB.avgConfidence))}
            </span>
          </div>
          <div className="text-sm font-bold text-white">
            {moreConfidentModel === 'A'
              ? modelA.info.name
              : moreConfidentModel === 'B'
              ? modelB.info.name
              : 'Tie'}
          </div>
          <div className="flex items-center justify-between text-xs text-neutral-400 font-mono pt-1">
            <span>{formatConfidencePercent(modelA.avgConfidence)}</span>
            <span>vs</span>
            <span>{formatConfidencePercent(modelB.avgConfidence)}</span>
          </div>
        </div>

        {/* Total Recall / Objects */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span className="font-semibold text-neutral-300 flex items-center gap-1.5">
              <Award className="h-4 w-4 text-cyan-400" />
              Object Recall
            </span>
            <span className="font-mono text-cyan-400 font-bold">
              {Math.abs(modelA.totalObjects - modelB.totalObjects)} diff
            </span>
          </div>
          <div className="text-sm font-bold text-white">
            {modelA.totalObjects > modelB.totalObjects
              ? `${modelA.info.name} (+${modelA.totalObjects - modelB.totalObjects})`
              : modelB.totalObjects > modelA.totalObjects
              ? `${modelB.info.name} (+${modelB.totalObjects - modelA.totalObjects})`
              : 'Identical Recall'}
          </div>
          <div className="flex items-center justify-between text-xs text-neutral-400 font-mono pt-1">
            <span>Model A: {modelA.totalObjects} objs</span>
            <span>vs</span>
            <span>Model B: {modelB.totalObjects} objs</span>
          </div>
        </div>
      </div>

      {/* Class-by-Class Comparative Breakdown Table */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
            Class-by-Class Detection Discrepancy
          </h4>
          <span className="text-[11px] text-neutral-500 font-mono">
            {classComparison.length} classes detected
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-neutral-800 text-neutral-400 font-medium pb-2">
                <th className="py-2">Object Class</th>
                <th className="py-2 font-mono">Model A ({modelA.info.name})</th>
                <th className="py-2 font-mono">Model B ({modelB.info.name})</th>
                <th className="py-2 font-mono text-right">Discrepancy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60 font-mono">
              {classComparison.map((row) => {
                const color = getClassColor(row.className);
                return (
                  <tr key={row.className} className="hover:bg-neutral-800/40">
                    <td className="py-2.5 font-sans font-medium text-white flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color.hex }} />
                      <span>{capitalizeClass(row.className)}</span>
                    </td>
                    <td className="py-2.5 text-neutral-300 tabular-nums">
                      {row.countA}
                    </td>
                    <td className="py-2.5 text-neutral-300 tabular-nums">
                      {row.countB}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">
                      {row.diff > 0 ? (
                        <span className="text-[#32FF00] font-bold inline-flex items-center gap-1">
                          +{row.diff} (Model A)
                        </span>
                      ) : row.diff < 0 ? (
                        <span className="text-cyan-400 font-bold inline-flex items-center gap-1">
                          +{Math.abs(row.diff)} (Model B)
                        </span>
                      ) : (
                        <span className="text-neutral-500">Parity (0)</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
