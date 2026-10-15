import React, { useState, useMemo } from 'react';
import {
  Trash2,
  Maximize2,
  Clock,
  Layers,
  Sparkles,
  Search,
  Filter,
  ArrowUpDown,
} from 'lucide-react';
import { GalleryItem } from '../types';
import { formatRelativeTime, capitalizeClass } from '../utils/formatters';
import { getClassColor } from '../utils/colors';

interface GalleryProps {
  items: GalleryItem[];
  onSelectItem: (item: GalleryItem) => void;
  onDeleteItem: (item: GalleryItem) => void;
  onClearAll: () => void;
  onExpandFullscreen?: (src: string, title: string) => void;
}

export default function Gallery({
  items,
  onSelectItem,
  onDeleteItem,
  onClearAll,
  onExpandFullscreen,
}: GalleryProps) {
  // Filter & Sort State
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [objectCountFilter, setObjectCountFilter] = useState<'all' | '1-5' | '6-10' | '10+'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'most-objects' | 'fastest'>('newest');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Extract all unique classes in gallery for filter dropdown
  const availableClasses = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      Object.keys(item.detections || {}).forEach((cls) => set.add(cls));
    });
    return Array.from(set).sort();
  }, [items]);

  // Client-side filtering & sorting
  const filteredItems = useMemo(() => {
    return items
      .filter((item) => {
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = item.title.toLowerCase().includes(q);
          const matchClasses = Object.keys(item.detections || {}).some((c) =>
            c.toLowerCase().includes(q)
          );
          if (!matchTitle && !matchClasses) return false;
        }

        // Class filter
        if (selectedClass !== 'all') {
          if (!item.detections || !item.detections[selectedClass]) return false;
        }

        // Object count range filter
        if (objectCountFilter === '1-5') {
          if (item.totalObjects < 1 || item.totalObjects > 5) return false;
        } else if (objectCountFilter === '6-10') {
          if (item.totalObjects < 6 || item.totalObjects > 10) return false;
        } else if (objectCountFilter === '10+') {
          if (item.totalObjects < 11) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'most-objects') {
          return b.totalObjects - a.totalObjects;
        }
        if (sortBy === 'fastest') {
          return a.processingTimeMs - b.processingTimeMs;
        }
        // default newest
        return (b.timestamp || 0) - (a.timestamp || 0);
      });
  }, [items, selectedClass, objectCountFilter, sortBy, searchQuery]);

  return (
    <section className="space-y-6 pt-6 border-t border-[#16213E]">
      {/* Gallery Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
            <span>Inspection History & Gallery</span>
            <span className="text-xs font-mono font-semibold text-[#32FF00] bg-[#32FF00]/10 px-2.5 py-0.5 rounded-full border border-[#32FF00]/30">
              {items.length} scan{items.length === 1 ? '' : 's'}
            </span>
          </h2>
          <p className="text-xs text-[#CCCCCC]">
            Persisted locally with quota-safe compressed thumbnail generation.
          </p>
        </div>

        {items.length > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className="min-h-[44px] flex items-center gap-1.5 text-xs text-[#CCCCCC] hover:text-rose-400 self-start sm:self-auto transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            <span>Clear History</span>
          </button>
        )}
      </div>

      {/* Filter and Sort Toolbar */}
      {items.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-[#16213E] bg-[#16213E]/60 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative min-w-[180px]">
              <Search className="h-3.5 w-3.5 text-[#888888] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search class or title..."
                className="w-full rounded-lg border border-[#16213E] bg-[#0F1419] pl-8 pr-3 py-1.5 text-xs text-white placeholder-[#888888] focus:border-[#32FF00] focus:outline-none"
              />
            </div>

            {/* Class Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[#CCCCCC]">Class:</span>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="rounded-lg border border-[#16213E] bg-[#0F1419] px-2.5 py-1.5 text-xs text-white focus:border-[#32FF00] focus:outline-none"
              >
                <option value="all">All Classes</option>
                {availableClasses.map((cls) => (
                  <option key={cls} value={cls}>
                    {capitalizeClass(cls)}
                  </option>
                ))}
              </select>
            </div>

            {/* Object Count Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[#CCCCCC]">Objects:</span>
              <select
                value={objectCountFilter}
                onChange={(e) => setObjectCountFilter(e.target.value as any)}
                className="rounded-lg border border-[#16213E] bg-[#0F1419] px-2.5 py-1.5 text-xs text-white focus:border-[#32FF00] focus:outline-none"
              >
                <option value="all">All Counts</option>
                <option value="1-5">1 – 5 objects</option>
                <option value="6-10">6 – 10 objects</option>
                <option value="10+">11+ objects</option>
              </select>
            </div>
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-3.5 w-3.5 text-[#32FF00]" />
            <span className="text-[#CCCCCC]">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="rounded-lg border border-[#16213E] bg-[#0F1419] px-2.5 py-1.5 text-xs text-white focus:border-[#32FF00] focus:outline-none"
            >
              <option value="newest">Most Recent</option>
              <option value="most-objects">Highest Object Count</option>
              <option value="fastest">Lowest Latency (Speed)</option>
            </select>
          </div>
        </div>
      )}

      {/* Grid View */}
      {filteredItems.length === 0 ? (
        <div className="rounded-xl border border-[#16213E] bg-[#0F1419] p-8 text-center text-xs text-[#888888]">
          {items.length === 0
            ? 'No gallery scans recorded yet. Upload an image to start.'
            : 'No gallery items match your current filter criteria.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              onClick={() => onSelectItem(item)}
              className="group relative cursor-pointer overflow-hidden rounded-xl border border-[#16213E] bg-[#0F1419] p-3 hover:border-[#32FF00] hover:shadow-[0_0_18px_rgba(50,255,0,0.22)] transition-all flex flex-col justify-between"
            >
              {/* Thumbnail */}
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-[#0A0E17]">
                <img
                  src={item.thumbnailImage || item.annotatedImage || item.originalImage}
                  alt={item.title}
                  loading="lazy"
                  className="h-full w-full object-cover group-hover:scale-102 transition-transform duration-200"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect width="300" height="200" fill="%2316213e"/><text x="50%" y="50%" fill="%2332ff00" font-family="sans-serif" font-size="12" text-anchor="middle">Thumbnail</text></svg>';
                  }}
                />
                <div className="absolute top-2 right-2 rounded-md bg-[#32FF00] px-2 py-0.5 font-mono text-[10px] text-[#0F1419] font-bold tabular-nums shadow-md">
                  {item.totalObjects} objs
                </div>
                {item.modelName && (
                  <div className="absolute bottom-2 left-2 rounded bg-[#0F1419]/90 border border-[#16213E] px-1.5 py-0.5 font-mono text-[9px] text-[#CCCCCC]">
                    {item.modelName.split(' ')[0]}
                  </div>
                )}
              </div>

              {/* Details & Metadata */}
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white truncate max-w-[140px] group-hover:text-[#32FF00] transition-colors">
                    {item.title}
                  </span>
                  <span className="font-mono text-[10px] text-[#32FF00] font-bold tabular-nums">
                    {item.processingTimeMs}ms
                  </span>
                </div>

                {/* Top Classes Tags */}
                <div className="flex flex-wrap items-center gap-1">
                  {item.topClasses.map((cls) => {
                    const color = getClassColor(cls.name);
                    return (
                      <span
                        key={cls.name}
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded border"
                        style={{
                          backgroundColor: `${color.hex}18`,
                          borderColor: `${color.hex}40`,
                          color: color.hex,
                        }}
                      >
                        {capitalizeClass(cls.name)} ×{cls.count}
                      </span>
                    );
                  })}
                </div>

                {/* Footer and Action Icons */}
                <div className="flex items-center justify-between pt-2 border-t border-[#16213E] text-[10px] text-[#888888]">
                  <span>{formatRelativeTime(item.timestamp)}</span>
                  <div className="flex items-center gap-1">
                    {onExpandFullscreen && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onExpandFullscreen(item.annotatedImage, item.title);
                        }}
                        className="min-h-[32px] min-w-[32px] flex items-center justify-center text-[#CCCCCC] hover:text-[#32FF00] p-1"
                        title="Expand"
                      >
                        <Maximize2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteItem(item);
                      }}
                      className="min-h-[32px] min-w-[32px] flex items-center justify-center text-[#CCCCCC] hover:text-rose-400 p-1"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
