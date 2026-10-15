import React from 'react';
import { Zap, Target, Award, GitCompare } from 'lucide-react';
import { CompareResponse, ModelComparisonEntry } from '../types';
import { formatConfidencePercent, capitalizeClass } from '../utils/formatters';
import { getClassColor } from '../utils/colors';

interface ComparisonMetricsProps {
  comparison: CompareResponse;
}

function averageConfidence(entry: ModelComparisonEntry): number {
  const scores = Object.values(entry.detections).flatMap((d) => d.confidence_scores);
  return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
}

export default function ComparisonMetrics({ comparison }: ComparisonMetricsProps) {
  const { results, comparison: summary } = comparison;
  const byName = Object.fromEntries(results.map((r) => [r.model_name, r]));
  const labelOf = (name: string) => byName[name]?.label ?? name;

  const fastest = byName[summary.fastest_model];
  const slowest = results.reduce((a, b) => (b.processing_time_ms > a.processing_time_ms ? b : a));
  const speedup =
    fastest && slowest.processing_time_ms > 0
      ? Math.round(((slowest.processing_time_ms - fastest.processing_time_ms) / slowest.processing_time_ms) * 100)
      : 0;

  const confidences = results.map((r) => ({ r, avg: averageConfidence(r) }));
  const mostConfident = confidences.reduce((a, b) => (b.avg > a.avg ? b : a));

  const cards = [
    {
      icon: <Zap className="h-4 w-4 text-amber-400" />,
      title: 'Fastest Inference',
      badge: speedup > 0 ? `${speedup}% less time` : 'Equal time',
      badgeClass: 'text-amber-400',
      winner: labelOf(summary.fastest_model),
      detail: results.map((r) => `${r.label}: ${r.processing_time_ms}ms`),
    },
    {
      icon: <Award className="h-4 w-4 text-cyan-400" />,
      title: 'Most Objects Found',
      badge: `${byName[summary.most_objects_model]?.total_objects ?? 0} objs`,
      badgeClass: 'text-cyan-400',
      winner: labelOf(summary.most_objects_model),
      detail: results.map((r) => `${r.label}: ${r.total_objects}`),
    },
    {
      icon: <Target className="h-4 w-4 text-[#32FF00]" />,
      title: 'Highest Mean Confidence',
      badge: formatConfidencePercent(mostConfident.avg),
      badgeClass: 'text-[#32FF00]',
      winner: mostConfident.r.label,
      detail: confidences.map(({ r, avg }) => `${r.label}: ${formatConfidencePercent(avg)}`),
    },
    {
      icon: <GitCompare className="h-4 w-4 text-pink-400" />,
      title: 'Agreement',
      badge: formatConfidencePercent(summary.agreement),
      badgeClass: 'text-pink-400',
      winner: summary.pairwise
        .map((p) => `${p.matched} matching boxes`)
        .join(', '),
      detail: [summary.agreement_method],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.title} className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-neutral-400">
              <span className="font-semibold text-neutral-300 flex items-center gap-1.5">
                {card.icon}
                {card.title}
              </span>
              <span className={`font-mono font-bold ${card.badgeClass}`}>{card.badge}</span>
            </div>
            <div className="text-sm font-bold text-white">{card.winner}</div>
            <div className="space-y-0.5 text-[11px] text-neutral-400 font-mono pt-1">
              {card.detail.map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Class-by-class counts, union of every model's classes */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
            Class-by-Class Detection Counts
          </h4>
          <span className="text-[11px] text-neutral-500 font-mono">
            {summary.classes.length} classes detected · threshold {formatConfidencePercent(comparison.confidence_threshold)}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-neutral-800 text-neutral-400 font-medium pb-2">
                <th className="py-2">Object Class</th>
                {results.map((r) => (
                  <th key={r.model_name} className="py-2 font-mono">
                    {r.label}
                  </th>
                ))}
                <th className="py-2 font-mono text-right">Spread</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60 font-mono">
              {summary.classes.map((row) => {
                const color = byName[results[0].model_name]?.detections[row.class_name]?.color
                  ?? getClassColor(row.class_name).hex;
                const counts = results.map((r) => row.counts[r.model_name] ?? 0);
                const spread = Math.max(...counts) - Math.min(...counts);
                return (
                  <tr key={row.class_name} className="hover:bg-neutral-800/40">
                    <td className="py-2.5 font-sans font-medium text-white flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                      <span>{capitalizeClass(row.class_name)}</span>
                    </td>
                    {counts.map((c, i) => (
                      <td key={results[i].model_name} className="py-2.5 text-neutral-300 tabular-nums">
                        {c}
                      </td>
                    ))}
                    <td className="py-2.5 text-right tabular-nums">
                      {spread === 0 ? (
                        <span className="text-neutral-500">Same count</span>
                      ) : (
                        <span className="text-[#32FF00] font-bold">±{spread}</span>
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
