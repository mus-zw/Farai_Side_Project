import { GalleryItem } from '../types';

const GALLERY_STORAGE_KEY = 'farai_cv_gallery_v2';
const MAX_GALLERY_ITEMS = 24;

/**
 * Creates a lightweight downscaled thumbnail data URL to avoid exceeding localStorage quota.
 */
export async function createThumbnail(imageSrc: string, maxDim = 320): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        let width = img.naturalWidth || 400;
        let height = img.naturalHeight || 300;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(imageSrc);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        // Use JPEG with 0.72 quality for high compression
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      } catch {
        resolve(imageSrc);
      }
    };
    img.onerror = () => resolve(imageSrc);
    img.src = imageSrc;
  });
}

/**
 * Loads the gallery from localStorage with graceful fallback.
 */
export function loadGallery(): GalleryItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(GALLERY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // Sort newest first
      return parsed.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    }
  } catch (err) {
    console.warn('Failed to parse gallery from localStorage:', err);
  }
  return [];
}

/**
 * Saves the gallery to localStorage with automatic quota management.
 */
export function saveGallery(items: GalleryItem[]): boolean {
  if (typeof window === 'undefined') return false;

  // Trim to max items
  let toSave = items.slice(0, MAX_GALLERY_ITEMS);

  while (toSave.length > 0) {
    try {
      localStorage.setItem(GALLERY_STORAGE_KEY, JSON.stringify(toSave));
      return true;
    } catch (err: any) {
      if (err?.name === 'QuotaExceededError' || err?.code === 22) {
        console.warn('LocalStorage quota exceeded. Pruning oldest gallery item.');
        // Prune the oldest item and try again
        toSave = toSave.slice(0, toSave.length - 1);
      } else {
        console.error('LocalStorage write failed:', err);
        return false;
      }
    }
  }

  // If even 1 item failed, clear the gallery storage key
  try {
    localStorage.removeItem(GALLERY_STORAGE_KEY);
  } catch {}
  return false;
}

/**
 * Clears the gallery completely.
 */
export function clearGalleryStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(GALLERY_STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear gallery storage:', err);
  }
}
