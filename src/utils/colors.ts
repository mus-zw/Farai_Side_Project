// Deterministic color assignment for computer vision classes
export interface ClassColor {
  hex: string;
  rgb: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
}

const CLASS_COLOR_MAP: Record<string, ClassColor> = {
  penguin: {
    hex: '#32FF00',
    rgb: '50, 255, 0',
    badgeBg: 'bg-[#32FF00]/15',
    badgeBorder: 'border-[#32FF00]/50',
    badgeText: 'text-[#32FF00]',
  },
  'african penguin': {
    hex: '#32FF00',
    rgb: '50, 255, 0',
    badgeBg: 'bg-[#32FF00]/15',
    badgeBorder: 'border-[#32FF00]/50',
    badgeText: 'text-[#32FF00]',
  },
  'small object': {
    hex: '#00FF41',
    rgb: '0, 255, 65',
    badgeBg: 'bg-[#00FF41]/15',
    badgeBorder: 'border-[#00FF41]/50',
    badgeText: 'text-[#00FF41]',
  },
  person: {
    hex: '#3b82f6',
    rgb: '59, 130, 246',
    badgeBg: 'bg-blue-950/60',
    badgeBorder: 'border-blue-500/40',
    badgeText: 'text-blue-400',
  },
  car: {
    hex: '#10b981',
    rgb: '16, 185, 129',
    badgeBg: 'bg-emerald-950/60',
    badgeBorder: 'border-emerald-500/40',
    badgeText: 'text-emerald-400',
  },
  truck: {
    hex: '#14b8a6',
    rgb: '20, 184, 166',
    badgeBg: 'bg-[#16213E]/60',
    badgeBorder: 'border-[#32FF00]/40',
    badgeText: 'text-[#32FF00]',
  },
  bus: {
    hex: '#06b6d4',
    rgb: '6, 182, 212',
    badgeBg: 'bg-cyan-950/60',
    badgeBorder: 'border-cyan-500/40',
    badgeText: 'text-cyan-400',
  },
  bicycle: {
    hex: '#f59e0b',
    rgb: '245, 158, 11',
    badgeBg: 'bg-amber-950/60',
    badgeBorder: 'border-amber-500/40',
    badgeText: 'text-amber-400',
  },
  motorcycle: {
    hex: '#f97316',
    rgb: '249, 115, 22',
    badgeBg: 'bg-orange-950/60',
    badgeBorder: 'border-orange-500/40',
    badgeText: 'text-orange-400',
  },
  dog: {
    hex: '#ec4899',
    rgb: '236, 72, 153',
    badgeBg: 'bg-pink-950/60',
    badgeBorder: 'border-pink-500/40',
    badgeText: 'text-pink-400',
  },
  cat: {
    hex: '#d946ef',
    rgb: '217, 70, 239',
    badgeBg: 'bg-fuchsia-950/60',
    badgeBorder: 'border-fuchsia-500/40',
    badgeText: 'text-fuchsia-400',
  },
  bench: {
    hex: '#8b5cf6',
    rgb: '139, 92, 246',
    badgeBg: 'bg-violet-950/60',
    badgeBorder: 'border-violet-500/40',
    badgeText: 'text-violet-400',
  },
  'traffic light': {
    hex: '#ef4444',
    rgb: '239, 68, 68',
    badgeBg: 'bg-red-950/60',
    badgeBorder: 'border-red-500/40',
    badgeText: 'text-red-400',
  },
  'stop sign': {
    hex: '#dc2626',
    rgb: '220, 38, 38',
    badgeBg: 'bg-red-950/60',
    badgeBorder: 'border-red-600/40',
    badgeText: 'text-red-400',
  },
  boat: {
    hex: '#0284c7',
    rgb: '2, 132, 199',
    badgeBg: 'bg-sky-950/60',
    badgeBorder: 'border-sky-500/40',
    badgeText: 'text-sky-400',
  },
  airplane: {
    hex: '#6366f1',
    rgb: '99, 102, 241',
    badgeBg: 'bg-indigo-950/60',
    badgeBorder: 'border-indigo-500/40',
    badgeText: 'text-indigo-400',
  },
  backpack: {
    hex: '#a855f7',
    rgb: '168, 85, 247',
    badgeBg: 'bg-purple-950/60',
    badgeBorder: 'border-purple-500/40',
    badgeText: 'text-purple-400',
  },
};

const FALLBACK_PALETTE: ClassColor[] = [
  { hex: '#06b6d4', rgb: '6, 182, 212', badgeBg: 'bg-cyan-950/60', badgeBorder: 'border-cyan-500/40', badgeText: 'text-cyan-400' },
  { hex: '#10b981', rgb: '16, 185, 129', badgeBg: 'bg-emerald-950/60', badgeBorder: 'border-emerald-500/40', badgeText: 'text-emerald-400' },
  { hex: '#f59e0b', rgb: '245, 158, 11', badgeBg: 'bg-amber-950/60', badgeBorder: 'border-amber-500/40', badgeText: 'text-amber-400' },
  { hex: '#8b5cf6', rgb: '139, 92, 246', badgeBg: 'bg-violet-950/60', badgeBorder: 'border-violet-500/40', badgeText: 'text-violet-400' },
  { hex: '#ec4899', rgb: '236, 72, 153', badgeBg: 'bg-pink-950/60', badgeBorder: 'border-pink-500/40', badgeText: 'text-pink-400' },
  { hex: '#3b82f6', rgb: '59, 130, 246', badgeBg: 'bg-blue-950/60', badgeBorder: 'border-blue-500/40', badgeText: 'text-blue-400' },
];

export function getClassColor(className: string): ClassColor {
  const normalized = className.toLowerCase().trim();
  if (CLASS_COLOR_MAP[normalized]) {
    return CLASS_COLOR_MAP[normalized];
  }
  // Generate deterministic index from string
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % FALLBACK_PALETTE.length;
  return FALLBACK_PALETTE[idx];
}
