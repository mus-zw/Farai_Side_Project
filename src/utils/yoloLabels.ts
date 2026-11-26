/**
 * Export detections as YOLO-format annotation text, for human review and
 * retraining (e.g. in Label Studio, CVAT or Roboflow, or straight into an
 * Ultralytics dataset). One line per box:
 *
 *   <class_id> <x_center> <y_center> <width> <height>
 *
 * all four box values normalised to 0-1 by the image size. No DOM here.
 */

export interface LabelBox {
  classId: number;
  /** [x1, y1, x2, y2] in source pixels. */
  box: ArrayLike<number>;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const fmt = (v: number) => clamp01(v).toFixed(6);

/** One YOLO line per box. Boxes with no area after clamping to the image are skipped. */
export function toYoloLines(boxes: readonly LabelBox[], imageW: number, imageH: number): string[] {
  if (!(imageW > 0) || !(imageH > 0)) return [];
  const lines: string[] = [];
  for (const { classId, box } of boxes) {
    const x1 = Math.min(imageW, Math.max(0, box[0]));
    const y1 = Math.min(imageH, Math.max(0, box[1]));
    const x2 = Math.min(imageW, Math.max(0, box[2]));
    const y2 = Math.min(imageH, Math.max(0, box[3]));
    if (x2 <= x1 || y2 <= y1) continue;
    lines.push(
      `${classId} ${fmt((x1 + x2) / 2 / imageW)} ${fmt((y1 + y2) / 2 / imageH)} ${fmt((x2 - x1) / imageW)} ${fmt((y2 - y1) / imageH)}`
    );
  }
  return lines;
}

/** The file's text: lines joined by newlines, with a final newline (empty file when there are no boxes). */
export function toYoloText(boxes: readonly LabelBox[], imageW: number, imageH: number): string {
  const lines = toYoloLines(boxes, imageW, imageH);
  return lines.length ? lines.join('\n') + '\n' : '';
}

/** Browser download of a text file (YOLO labels by default; pass a mime type for JSON or CSV). */
export function downloadTextFile(filename: string, text: string, mime = 'text/plain;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** "photo.final.jpg" -> "photo.final"; safe for a file name. */
export function baseName(name: string): string {
  const stem = name.replace(/\.[^./\\]+$/, '') || 'image';
  return stem.replace(/[^\w.-]+/g, '_');
}
