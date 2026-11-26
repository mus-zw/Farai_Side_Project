/**
 * The before/after examples on the /demo "Launching Soon" page. Each "after" image is real output
 * from the app's own in-browser detector (YOLO11n through ONNX Runtime Web) run on the matching
 * photo in public/samples/, saved to public/demo-preview/. Nothing here is mocked up.
 *
 * To add or refresh one: run the photo through /demo, save the annotated result into
 * public/demo-preview/, and add it below. If an image is missing the page shows a placeholder
 * card instead of a broken picture, so removing a file never breaks the page.
 */
const BASE = import.meta.env.BASE_URL;

export interface PreviewItem {
  id: string;
  label: string;
  /** The photo as uploaded. */
  before: string;
  /** What the detector drew on it. */
  after: string;
  headline: string;
  detail: string;
}

export const PREVIEW_ITEMS: readonly PreviewItem[] = [
  {
    id: 'traffic',
    label: 'Busy traffic',
    before: `${BASE}samples/urban_traffic_opt.jpg`,
    after: `${BASE}demo-preview/urban_traffic_detected.jpg`,
    headline: '25 cars and a bus, found in one pass',
    detail: 'Dense, overlapping vehicles at night, each with a box and a confidence score.',
  },
  {
    id: 'street',
    label: 'People and a bus',
    before: `${BASE}samples/bus.jpg`,
    after: `${BASE}demo-preview/bus_detected.jpg`,
    headline: '4 people and a bus',
    detail: 'Different object types in the same frame, from a tall phone-style photo.',
  },
  {
    id: 'wildlife',
    label: 'Wildlife',
    before: `${BASE}samples/wildlife_safari_opt.jpg`,
    after: `${BASE}demo-preview/wildlife_safari_detected.jpg`,
    headline: '2 zebra',
    detail: 'Animals in the wild, detected with the standard 80-class model.',
  },
];

/** What it can do so far. Kept to things the demo really does today. */
export const CAPABILITIES = [
  { title: 'Detects 80 kinds of object', body: 'People, vehicles, animals and everyday items, with boxes and confidence scores you can filter live.' },
  { title: 'Runs in your browser', body: 'The model runs on your own device (WebGPU, with a CPU fallback). Your photos and video are not uploaded.' },
  { title: 'Batches and video', body: 'Label a folder of images, or pull frames out of a video and label those too.' },
  { title: 'Exports training data', body: 'YOLO label files for free, plus COCO JSON and ready-to-train dataset ZIPs in Pro.' },
] as const;
