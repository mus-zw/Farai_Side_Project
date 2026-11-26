/**
 * Turning detections into dataset formats: YOLO (.txt, in utils/yoloLabels.ts)
 * and COCO JSON, plus a data.yaml for Ultralytics. Pure, no DOM.
 */
import { COCO_CLASSES } from './cocoClasses';

export interface RawBox {
  classId: number;
  /** [x1, y1, x2, y2] in source pixels. */
  box: ArrayLike<number>;
  score?: number;
}

/** A result from either engine, reduced to the fields export needs. */
export interface ExportableResult {
  raw_detections?: { classId: number; className: string; score: number; box: [number, number, number, number] }[];
  class_names?: string[];
  detections: Record<string, { confidence_scores: number[]; bounding_boxes?: number[][] }>;
}

export interface LabelSet {
  boxes: RawBox[];
  classNames: string[];
}

/**
 * The boxes and class list from a detection result. In-browser results carry
 * class ids; backend results only have names, so ids come from the COCO list when
 * every name is a COCO class, else from the names in order of first appearance.
 */
export function labelSetFromResult(result: ExportableResult): LabelSet {
  if (result.raw_detections && result.class_names) {
    return { boxes: result.raw_detections.map((d) => ({ classId: d.classId, box: d.box, score: d.score })), classNames: result.class_names };
  }
  const names = Object.keys(result.detections);
  const allCoco = names.every((n) => COCO_CLASSES.includes(n));
  const classNames = allCoco ? [...COCO_CLASSES] : names;
  const boxes: RawBox[] = [];
  for (const [name, group] of Object.entries(result.detections)) {
    const classId = classNames.indexOf(name);
    (group.bounding_boxes ?? []).forEach((b, i) => boxes.push({ classId, box: b, score: group.confidence_scores?.[i] }));
  }
  return { boxes, classNames };
}

export interface LabeledImage {
  fileName: string;
  width: number;
  height: number;
  boxes: RawBox[];
}

export interface CocoDataset {
  info: { description: string; date_created: string };
  images: { id: number; file_name: string; width: number; height: number }[];
  annotations: { id: number; image_id: number; category_id: number; bbox: number[]; area: number; iscrowd: 0; score?: number }[];
  categories: { id: number; name: string }[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** COCO detection JSON. Category ids are 1-based (the COCO convention); bbox is [x, y, width, height] in pixels. */
export function toCoco(images: readonly LabeledImage[], classNames: readonly string[], description = 'Exported from Farai CV Auto-Labeler', now: Date = new Date()): CocoDataset {
  const out: CocoDataset = {
    info: { description, date_created: now.toISOString() },
    images: [],
    annotations: [],
    categories: classNames.map((name, i) => ({ id: i + 1, name })),
  };
  let annId = 1;
  images.forEach((img, i) => {
    const imageId = i + 1;
    out.images.push({ id: imageId, file_name: img.fileName, width: img.width, height: img.height });
    for (const b of img.boxes) {
      const x1 = Math.max(0, Math.min(img.width, b.box[0]));
      const y1 = Math.max(0, Math.min(img.height, b.box[1]));
      const x2 = Math.max(0, Math.min(img.width, b.box[2]));
      const y2 = Math.max(0, Math.min(img.height, b.box[3]));
      const w = x2 - x1;
      const h = y2 - y1;
      if (w <= 0 || h <= 0 || b.classId < 0 || b.classId >= classNames.length) continue;
      out.annotations.push({ id: annId++, image_id: imageId, category_id: b.classId + 1, bbox: [r2(x1), r2(y1), r2(w), r2(h)], area: r2(w * h), iscrowd: 0, ...(b.score !== undefined ? { score: r2(b.score) } : {}) });
    }
  });
  return out;
}

/** An Ultralytics dataset file for a folder holding images/ and labels/. Names are JSON-quoted, which is valid YAML. */
export function dataYaml(classNames: readonly string[]): string {
  return ['path: .', 'train: images', 'val: images', 'names:', ...classNames.map((n, i) => `  ${i}: ${JSON.stringify(n)}`)].join('\n') + '\n';
}

/** classes.txt, one name per line in id order. */
export function classesTxt(classNames: readonly string[]): string {
  return classNames.join('\n') + '\n';
}
