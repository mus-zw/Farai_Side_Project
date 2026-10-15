import React, { useState } from 'react';
import {
  Sparkles,
  Layers,
  Scale,
  Files,
  BarChart3,
  Video,
  Keyboard,
  ArrowUp,
  Plus,
  X,
} from 'lucide-react';

interface FloatingActionsProps {
  mediaMode: 'image' | 'video';
  activeTab: 'single' | 'batch' | 'compare' | 'analytics';
  onSelectMediaMode: (mode: 'image' | 'video') => void;
  onSelectTab: (tab: 'single' | 'batch' | 'compare' | 'analytics') => void;
  onOpenShortcuts: () => void;
}

export default function FloatingActions({
  mediaMode,
  activeTab,
  onSelectMediaMode,
  onSelectTab,
  onOpenShortcuts,
}: FloatingActionsProps) {
  const [isOpen, setIsOpen] = useState(false);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setIsOpen(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2.5">
      {/* Menu expansion options */}
      {isOpen && (
        <div className="flex flex-col items-end gap-2 mb-1 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <button
            type="button"
            onClick={scrollToTop}
            className="flex items-center gap-2 rounded-xl bg-[#0F1419] border border-[#16213E] px-3.5 py-2 text-xs font-medium text-[#CCCCCC] shadow-xl hover:text-white hover:border-[#32FF00]/40 transition-colors"
          >
            <span>Scroll to Top</span>
            <ArrowUp className="h-3.5 w-3.5 text-[#32FF00]" />
          </button>

          <button
            type="button"
            onClick={() => {
              onOpenShortcuts();
              setIsOpen(false);
            }}
            className="flex items-center gap-2 rounded-xl bg-[#0F1419] border border-[#16213E] px-3.5 py-2 text-xs font-medium text-[#CCCCCC] shadow-xl hover:text-white hover:border-[#32FF00]/40 transition-colors"
          >
            <span>Shortcuts</span>
            <Keyboard className="h-3.5 w-3.5 text-[#32FF00]" />
          </button>

          {/* Toggle Video Processing Mode */}
          <button
            type="button"
            onClick={() => {
              onSelectMediaMode('video');
              setIsOpen(false);
            }}
            className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-medium shadow-xl transition-colors ${
              mediaMode === 'video'
                ? 'bg-[#32FF00] text-[#0F1419] font-bold border-[#32FF00]'
                : 'bg-[#0F1419] border-[#16213E] text-[#CCCCCC] hover:text-white'
            }`}
          >
            <span>Video Processing Suite</span>
            <Video className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => {
              onSelectMediaMode('image');
              onSelectTab('analytics');
              setIsOpen(false);
            }}
            className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-medium shadow-xl transition-colors ${
              mediaMode === 'image' && activeTab === 'analytics'
                ? 'bg-[#32FF00] text-[#0F1419] font-bold border-[#32FF00]'
                : 'bg-[#0F1419] border-[#16213E] text-[#CCCCCC] hover:text-white'
            }`}
          >
            <span>Analytics Dashboard</span>
            <BarChart3 className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => {
              onSelectMediaMode('image');
              onSelectTab('compare');
              setIsOpen(false);
            }}
            className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-medium shadow-xl transition-colors ${
              mediaMode === 'image' && activeTab === 'compare'
                ? 'bg-[#32FF00] text-[#0F1419] font-bold border-[#32FF00]'
                : 'bg-[#0F1419] border-[#16213E] text-[#CCCCCC] hover:text-white'
            }`}
          >
            <span>Model Comparison</span>
            <Scale className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => {
              onSelectMediaMode('image');
              onSelectTab('batch');
              setIsOpen(false);
            }}
            className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-medium shadow-xl transition-colors ${
              mediaMode === 'image' && activeTab === 'batch'
                ? 'bg-[#32FF00] text-[#0F1419] font-bold border-[#32FF00]'
                : 'bg-[#0F1419] border-[#16213E] text-[#CCCCCC] hover:text-white'
            }`}
          >
            <span>Batch Processing</span>
            <Files className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => {
              onSelectMediaMode('image');
              onSelectTab('single');
              setIsOpen(false);
            }}
            className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-medium shadow-xl transition-colors ${
              mediaMode === 'image' && activeTab === 'single'
                ? 'bg-[#32FF00] text-[#0F1419] font-bold border-[#32FF00]'
                : 'bg-[#0F1419] border-[#16213E] text-[#CCCCCC] hover:text-white'
            }`}
          >
            <span>Image Inspection</span>
            <Layers className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Primary Floating Action Button (FAB) */}
      <button
        type="button"
        aria-label={isOpen ? 'Close navigation quick menu' : 'Open navigation quick menu'}
        onClick={() => setIsOpen(!isOpen)}
        className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-2xl bg-[#32FF00] text-[#0F1419] shadow-[0_0_20px_rgba(50,255,0,0.4)] hover:bg-[#00FF41] active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-[#32FF00]"
      >
        {isOpen ? <X className="h-5 w-5 font-bold" /> : <Plus className="h-6 w-6 font-bold" />}
      </button>
    </div>
  );
}
