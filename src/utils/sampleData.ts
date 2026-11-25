import { SampleImageOption } from '../types';

// Shown beside the penguin sample (picker and Demo). Context, not a caveat:
// the interesting part is *why* the output looks the way it does.
export const PENGUIN_CONTEXT_NOTE =
  "General-purpose COCO models aren't trained on penguins: COCO has no penguin class, so a " +
  "detector trained on it can only call them 'bird' (or miss them in a dense colony). " +
  "A dedicated small-object penguin detector is part of my ongoing MSc research, and " +
  "this photo shows the kind of scene it is being built for.";

// Input images only. These carry no detection results on purpose: anything
// shown as a detection must come from the backend.
export const SAMPLE_IMAGES: SampleImageOption[] = [
  {
    id: 'city-bus',
    title: 'City Bus & Pedestrians',
    description: 'Street scene with a bus and several people, the standard Ultralytics demo image. COCO models handle it well.',
    category: 'General COCO scene',
    dataUrl: '/samples/bus.jpg',
    section: 'general',
    source: {
      label: 'Ultralytics sample image (ultralytics/assets/bus.jpg, shipped with the ultralytics package)',
      url: 'https://ultralytics.com/images/bus.jpg',
    },
    metadata: {
      width: 810,
      height: 1080,
      sizeBytes: 137419,
      sizeFormatted: '134 KB',
      format: 'image/jpeg',
    },
  },
  {
    id: 'urban-traffic',
    title: 'Urban Traffic & Multi-Lane Highway',
    description: 'Real-world commuter traffic scene featuring sedans, commercial trucks, SUVs, and road lane markings.',
    category: 'Autonomous Driving & Surveillance',
    dataUrl: '/samples/urban_traffic_opt.jpg',
    section: 'general',
    metadata: {
      width: 960,
      height: 634,
      sizeBytes: 180715,
      sizeFormatted: '176 KB',
      format: 'image/jpeg',
    },
  },
  {
    id: 'wildlife-park',
    title: 'South African Wildlife Reserve (Kruger)',
    description: 'Authentic 2024 wildlife conservation photograph of a herd of zebras grazing in natural bushveld habitat.',
    category: 'Wildlife & Natural Scenes',
    dataUrl: '/samples/wildlife_safari_opt.jpg',
    section: 'general',
    metadata: {
      width: 960,
      height: 640,
      sizeBytes: 242865,
      sizeFormatted: '237 KB',
      format: 'image/jpeg',
    },
  },
  {
    id: 'aerial-harbor',
    title: 'Aerial Maritime Marina & Boats',
    description: 'Authentic overhead coastal maritime photograph of moored yachts, motorboats, docks, and ocean water.',
    category: 'Aerial & Remote Sensing',
    dataUrl: '/samples/aerial_harbor_opt.jpg',
    section: 'general',
    metadata: {
      width: 960,
      height: 576,
      sizeBytes: 225316,
      sizeFormatted: '220 KB',
      format: 'image/jpeg',
    },
  },
  {
    id: 'african-penguins',
    title: 'African Penguin Colony (Boulders Beach, South Africa)',
    description: 'Dense colony of small birds on coastal granite, the kind of scene my MSc research targets.',
    category: 'Research context: penguins',
    dataUrl: '/samples/african_penguins_colony_opt.jpg',
    section: 'research-context',
    note: PENGUIN_CONTEXT_NOTE,
    metadata: {
      width: 960,
      height: 640,
      sizeBytes: 235723,
      sizeFormatted: '230 KB',
      format: 'image/jpeg',
    },
  },
];

// The first sample is the default: a scene COCO models handle well.
export const DEFAULT_SAMPLE = SAMPLE_IMAGES[0];
