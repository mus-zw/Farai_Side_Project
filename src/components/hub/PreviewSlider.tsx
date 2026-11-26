import { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import BeforeAfterSlider from '../BeforeAfterSlider';
import { PREVIEW_ITEMS, type PreviewItem } from '../../data/demoPreview';

type Loaded = Record<string, 'ok' | 'missing'>;

/** Preload both images of an item; resolves to whether BOTH are present. */
function bothLoad(item: PreviewItem): Promise<boolean> {
  const load = (src: string) =>
    new Promise<boolean>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = src;
    });
  return Promise.all([load(item.before), load(item.after)]).then(([a, b]) => a && b);
}

/**
 * Interactive before/after slider over the example photos. An example whose images are not in the
 * build (or fail to load) shows a placeholder card, and if none load the section hides itself, so
 * the page never shows a broken image.
 */
export default function PreviewSlider() {
  const [status, setStatus] = useState<Loaded | null>(null);
  const [activeId, setActiveId] = useState(PREVIEW_ITEMS[0]?.id);

  useEffect(() => {
    let alive = true;
    Promise.all(PREVIEW_ITEMS.map(async (it) => [it.id, (await bothLoad(it)) ? 'ok' : 'missing'] as const)).then((pairs) => {
      if (!alive) return;
      const map = Object.fromEntries(pairs) as Loaded;
      setStatus(map);
      // Start on the first example that actually has its images.
      const first = PREVIEW_ITEMS.find((i) => map[i.id] === 'ok');
      if (first) setActiveId(first.id);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (status && PREVIEW_ITEMS.every((i) => status[i.id] === 'missing')) return null; // nothing to show: hide, do not break

  const active = PREVIEW_ITEMS.find((i) => i.id === activeId) ?? PREVIEW_ITEMS[0];
  const ready = status?.[active.id] === 'ok';

  return (
    <div className="space-y-4" data-testid="preview-slider">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Example photos">
        {PREVIEW_ITEMS.map((it) => (
          <button
            key={it.id}
            type="button"
            role="tab"
            aria-selected={it.id === active.id}
            onClick={() => setActiveId(it.id)}
            data-testid={`preview-tab-${it.id}`}
            className={`min-h-[40px] rounded-full border px-4 text-xs font-semibold transition-colors ${
              it.id === active.id ? 'border-[#32FF00] bg-[#32FF00]/15 text-[#32FF00]' : 'border-neutral-700 text-neutral-300 hover:border-neutral-500'
            }`}
          >
            {it.label}
          </button>
        ))}
      </div>

      {ready ? (
        <div className="overflow-hidden rounded-2xl border border-[#16213E]" data-testid="preview-active" data-id={active.id}>
          <BeforeAfterSlider originalImage={active.before} annotatedImage={active.after} altTitle={active.label} />
        </div>
      ) : (
        <div className="flex aspect-[16/10] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-neutral-700 bg-neutral-900/50 p-6 text-center" data-testid="preview-placeholder">
          <ImageOff className="h-6 w-6 text-neutral-400" />
          <p className="text-sm font-semibold text-neutral-300">{status ? 'Preview image coming soon' : 'Loading preview…'}</p>
          {status && <p className="max-w-sm text-xs text-neutral-400">{active.headline}</p>}
        </div>
      )}

      <div data-testid="preview-caption">
        <p className="text-sm font-bold text-white">{active.headline}</p>
        <p className="mt-0.5 text-xs text-neutral-400">{active.detail}</p>
        <p className="mt-2 text-xs text-neutral-400">Drag the handle to compare. Real output from the in-browser detector, not a mock-up.</p>
      </div>
    </div>
  );
}
