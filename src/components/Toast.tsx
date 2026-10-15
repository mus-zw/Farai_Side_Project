import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export default function Toast({ toasts, onDismiss }: ToastProps) {
  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => {
      onDismiss(toasts[0].id);
    }, 4500);
    return () => clearTimeout(timer);
  }, [toasts, onDismiss]);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
    >
      {toasts.map((toast) => {
        let icon = <Info className="h-4 w-4 text-cyan-400 shrink-0" />;
        let borderClass = 'border-cyan-500/30';
        let bgClass = 'bg-neutral-900/95';

        if (toast.type === 'success') {
          icon = <CheckCircle2 className="h-4 w-4 text-[#32FF00] shrink-0" />;
          borderClass = 'border-[#32FF00]/40';
        } else if (toast.type === 'error') {
          icon = <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />;
          borderClass = 'border-rose-500/40';
        }

        return (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex items-start justify-between gap-3 p-3.5 rounded-xl border ${borderClass} ${bgClass} shadow-xl backdrop-blur-md transition-all duration-200 animate-in fade-in slide-in-from-bottom-2`}
          >
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5">{icon}</span>
              <p className="text-xs text-neutral-200 leading-relaxed font-medium">
                {toast.message}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="text-neutral-500 hover:text-neutral-300 p-0.5 transition-colors"
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
