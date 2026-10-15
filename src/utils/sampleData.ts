import { SampleImageOption } from '../types';

// Input images only. These carry no detection results on purpose: anything
// shown as a detection must come from the backend.
export const SAMPLE_IMAGES: SampleImageOption[] = [
  {
    id: 'african-penguins',
    title: 'African Penguin Colony (Boulders Beach, South Africa)',
    description: 'Farai Musariri core MSc research dataset: dense small-object detection (~20px) under natural coastal granite terrain and colony huddles.',
    category: 'Wildlife Conservation & Small-Object Research',
    dataUrl: '/samples/african_penguins_colony_opt.jpg',
    metadata: {
      width: 960,
      height: 640,
      sizeBytes: 235723,
      sizeFormatted: '230 KB',
      format: 'image/jpeg',
    },
  },
  {
    id: 'urban-traffic',
    title: 'Urban Traffic & Multi-Lane Highway',
    description: 'Real-world commuter traffic scene featuring sedans, commercial trucks, SUVs, and road lane markings.',
    category: 'Autonomous Driving & Surveillance',
    dataUrl: '/samples/urban_traffic_opt.jpg',
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
    metadata: {
      width: 960,
      height: 576,
      sizeBytes: 225316,
      sizeFormatted: '220 KB',
      format: 'image/jpeg',
    },
  },
];
