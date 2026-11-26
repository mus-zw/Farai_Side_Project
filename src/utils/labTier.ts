/** The Auto-Labeler's free sandbox limits. Pro lifts them. Pure. */

/** Images per batch in the free sandbox. */
export const FREE_BATCH_LIMIT = 10;

export interface Allowance {
  /** How many of the `adding` files may be added. */
  allowed: number;
  /** How many were turned away by the limit. */
  blocked: number;
}

export function batchAllowance(isPro: boolean, existing: number, adding: number): Allowance {
  if (isPro) return { allowed: adding, blocked: 0 };
  const allowed = Math.max(0, Math.min(adding, FREE_BATCH_LIMIT - existing));
  return { allowed, blocked: adding - allowed };
}

export const LAB_FEATURES = {
  free: ['Single-image labeling', `Small batches (up to ${FREE_BATCH_LIMIT} images)`, 'YOLO .txt export', 'Runs in your browser'],
  pro: ['Unlimited local batch folders', 'Video-frame extraction', 'Multi-format export: YOLO + COCO', 'Dataset ZIP with data.yaml'],
} as const;
