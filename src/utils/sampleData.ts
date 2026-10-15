import { SampleImageOption, BoundingBox } from '../types';

// Helper to create inline SVG data URLs for robust offline-ready sample images
function createSvgDataUrl(svgContent: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent.trim())}`;
}

// 0. African Penguin Colony Aerial Survey (Farai's Core MSc Research Dataset)
const africanPenguinSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
  <defs>
    <linearGradient id="oceanShore" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0284c7"/>
      <stop offset="35%" stop-color="#0ea5e9"/>
      <stop offset="50%" stop-color="#38bdf8"/>
      <stop offset="58%" stop-color="#e0f2fe"/>
      <stop offset="65%" stop-color="#d6d3d1"/>
      <stop offset="100%" stop-color="#a8a29e"/>
    </linearGradient>
    <radialGradient id="graniteBoulder" cx="40%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#78716c"/>
      <stop offset="60%" stop-color="#57534e"/>
      <stop offset="100%" stop-color="#292524"/>
    </radialGradient>
  </defs>

  <!-- Coastal Terrain & Ocean Surface -->
  <rect width="800" height="600" fill="url(#oceanShore)"/>

  <!-- Wave Crests & Sea Foam -->
  <path d="M0,180 Q100,160 200,190 T400,175 T600,195 T800,170" fill="none" stroke="#ffffff" stroke-width="4" opacity="0.6"/>
  <path d="M0,240 Q150,225 300,245 T600,230 T800,240" fill="none" stroke="#ffffff" stroke-width="6" opacity="0.75"/>
  <path d="M0,280 Q120,270 260,285 T540,275 T800,280" fill="none" stroke="#e0f2fe" stroke-width="8" opacity="0.85"/>

  <!-- Boulders & Rocky Coastline (Stony Point / Boulders Beach) -->
  <ellipse cx="140" cy="460" rx="90" ry="70" fill="url(#graniteBoulder)" opacity="0.95"/>
  <ellipse cx="280" cy="510" rx="110" ry="65" fill="url(#graniteBoulder)" opacity="0.95"/>
  <ellipse cx="680" cy="420" rx="100" ry="80" fill="url(#graniteBoulder)" opacity="0.95"/>
  <ellipse cx="520" cy="480" rx="85" ry="55" fill="url(#graniteBoulder)" opacity="0.95"/>
  <ellipse cx="400" cy="380" rx="55" ry="40" fill="url(#graniteBoulder)" opacity="0.9"/>
  <ellipse cx="60" cy="360" rx="50" ry="35" fill="url(#graniteBoulder)" opacity="0.9"/>

  <!-- Small Shrub / Coastal Fynbos -->
  <circle cx="210" cy="390" r="22" fill="#15803d" opacity="0.8"/>
  <circle cx="230" cy="405" r="18" fill="#166534" opacity="0.8"/>
  <circle cx="470" cy="540" r="26" fill="#15803d" opacity="0.8"/>
  <circle cx="730" cy="530" r="24" fill="#166534" opacity="0.8"/>

  <!-- Dense Colony of African Penguins (Spheniscus demersus) (~20-25px top-down micro targets) -->
  <!-- Penguin 1 -->
  <g transform="translate(180, 420)">
    <ellipse cx="0" cy="0" rx="6" ry="11" fill="#0f172a"/>
    <ellipse cx="0" cy="1" rx="4" ry="7" fill="#f8fafc"/>
    <polygon points="-1,-11 1,-11 0,-14" fill="#f59e0b"/>
  </g>
  <!-- Penguin 2 -->
  <g transform="translate(205, 435)">
    <ellipse cx="0" cy="0" rx="7" ry="12" fill="#0f172a"/>
    <ellipse cx="0" cy="1" rx="4.5" ry="8" fill="#f8fafc"/>
    <polygon points="-1,-12 1,-12 0,-15" fill="#f59e0b"/>
  </g>
  <!-- Penguin 3 -->
  <g transform="translate(230, 445)">
    <ellipse cx="0" cy="0" rx="6" ry="11" fill="#0f172a"/>
    <ellipse cx="0" cy="1" rx="4" ry="7" fill="#f8fafc"/>
    <polygon points="-1,-11 1,-11 0,-14" fill="#f59e0b"/>
  </g>
  <!-- Penguin 4 -->
  <g transform="translate(340, 430)">
    <ellipse cx="0" cy="0" rx="6.5" ry="11.5" fill="#0f172a"/>
    <ellipse cx="0" cy="1" rx="4.2" ry="7.5" fill="#f8fafc"/>
    <polygon points="-1,-11.5 1,-11.5 0,-14.5" fill="#f59e0b"/>
  </g>
  <!-- Penguin 5 -->
  <g transform="translate(365, 440)">
    <ellipse cx="0" cy="0" rx="6" ry="11" fill="#0f172a"/>
    <ellipse cx="0" cy="1" rx="4" ry="7" fill="#f8fafc"/>
    <polygon points="-1,-11 1,-11 0,-14" fill="#f59e0b"/>
  </g>
  <!-- Penguin 6 -->
  <g transform="translate(385, 460)">
    <ellipse cx="0" cy="0" rx="7" ry="12" fill="#0f172a"/>
    <ellipse cx="0" cy="1" rx="4.5" ry="8" fill="#f8fafc"/>
    <polygon points="-1,-12 1,-12 0,-15" fill="#f59e0b"/>
  </g>
  <!-- Penguin 7 (Near shoreline) -->
  <g transform="translate(310, 330)">
    <ellipse cx="0" cy="0" rx="6" ry="11" fill="#0f172a"/>
    <ellipse cx="0" cy="1" rx="4" ry="7" fill="#f8fafc"/>
    <polygon points="-1,-11 1,-11 0,-14" fill="#f59e0b"/>
  </g>
  <!-- Penguin 8 -->
  <g transform="translate(430, 420)">
    <ellipse cx="0" cy="0" rx="6" ry="11" fill="#0f172a"/>
    <ellipse cx="0" cy="1" rx="4" ry="7" fill="#f8fafc"/>
    <polygon points="-1,-11 1,-11 0,-14" fill="#f59e0b"/>
  </g>
  <!-- Penguin 9 -->
  <g transform="translate(460, 440)">
    <ellipse cx="0" cy="0" rx="6.5" ry="12" fill="#0f172a"/>
    <ellipse cx="0" cy="1" rx="4.2" ry="8" fill="#f8fafc"/>
    <polygon points="-1,-12 1,-12 0,-15" fill="#f59e0b"/>
  </g>
  <!-- Penguin 10 -->
  <g transform="translate(580, 410)">
    <ellipse cx="0" cy="0" rx="6" ry="11" fill="#0f172a"/>
    <ellipse cx="0" cy="1" rx="4" ry="7" fill="#f8fafc"/>
    <polygon points="-1,-11 1,-11 0,-14" fill="#f59e0b"/>
  </g>
  <!-- Penguin 11 -->
  <g transform="translate(610, 430)">
    <ellipse cx="0" cy="0" rx="6.5" ry="11.5" fill="#0f172a"/>
    <ellipse cx="0" cy="1" rx="4.2" ry="7.5" fill="#f8fafc"/>
    <polygon points="-1,-11.5 1,-11.5 0,-14.5" fill="#f59e0b"/>
  </g>
  <!-- Penguin 12 -->
  <g transform="translate(635, 450)">
    <ellipse cx="0" cy="0" rx="6" ry="11" fill="#0f172a"/>
    <ellipse cx="0" cy="1" rx="4" ry="7" fill="#f8fafc"/>
    <polygon points="-1,-11 1,-11 0,-14" fill="#f59e0b"/>
  </g>
</svg>
`;

// 1. Urban Traffic Scene
const urbanTrafficSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#bae6fd"/>
    </linearGradient>
    <linearGradient id="road" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#334155"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
    <linearGradient id="building" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#64748b"/>
      <stop offset="100%" stop-color="#475569"/>
    </linearGradient>
  </defs>

  <!-- Sky -->
  <rect width="800" height="320" fill="url(#sky)" />

  <!-- City Skyline / Buildings -->
  <rect x="20" y="80" width="120" height="240" fill="url(#building)" rx="4"/>
  <rect x="160" y="50" width="140" height="270" fill="#475569" rx="4"/>
  <rect x="320" y="100" width="100" height="220" fill="#334155" rx="4"/>
  <rect x="440" y="40" width="160" height="280" fill="#475569" rx="4"/>
  <rect x="620" y="90" width="160" height="230" fill="url(#building)" rx="4"/>

  <!-- Building Windows -->
  <g fill="#fef08a" opacity="0.6">
    <rect x="40" y="100" width="16" height="20"/>
    <rect x="70" y="100" width="16" height="20"/>
    <rect x="100" y="100" width="16" height="20"/>
    <rect x="40" y="140" width="16" height="20"/>
    <rect x="70" y="140" width="16" height="20"/>
    <rect x="180" y="70" width="20" height="25"/>
    <rect x="220" y="70" width="20" height="25"/>
    <rect x="260" y="70" width="20" height="25"/>
    <rect x="470" y="70" width="22" height="25"/>
    <rect x="510" y="70" width="22" height="25"/>
    <rect x="550" y="70" width="22" height="25"/>
  </g>

  <!-- Sidewalk & Crosswalk -->
  <rect y="310" width="800" height="50" fill="#94a3b8"/>
  <rect y="360" width="800" height="240" fill="url(#road)"/>

  <!-- Crosswalk zebra stripes -->
  <g fill="#f8fafc">
    <rect x="80" y="360" width="28" height="240"/>
    <rect x="140" y="360" width="28" height="240"/>
    <rect x="200" y="360" width="28" height="240"/>
    <rect x="260" y="360" width="28" height="240"/>
  </g>

  <!-- Road markings -->
  <line x1="0" y1="480" x2="800" y2="480" stroke="#facc15" stroke-width="4" stroke-dasharray="25 20"/>

  <!-- Traffic Light Post -->
  <rect x="60" y="170" width="8" height="150" fill="#1e293b"/>
  <rect x="48" y="130" width="32" height="75" rx="6" fill="#0f172a"/>
  <circle cx="64" cy="145" r="9" fill="#ef4444"/>
  <circle cx="64" cy="167" r="9" fill="#713f12"/>
  <circle cx="64" cy="189" r="9" fill="#14532d"/>

  <!-- Pedestrian 1 (Crossing) -->
  <g id="person-1">
    <circle cx="160" cy="380" r="14" fill="#fca5a5"/>
    <path d="M150,396 Q160,392 170,396 L174,450 L146,450 Z" fill="#2563eb"/>
    <line x1="152" y1="450" x2="148" y2="510" stroke="#1e293b" stroke-width="8" stroke-linecap="round"/>
    <line x1="168" y1="450" x2="174" y2="505" stroke="#1e293b" stroke-width="8" stroke-linecap="round"/>
  </g>

  <!-- Pedestrian 2 (Crossing) -->
  <g id="person-2">
    <circle cx="230" cy="400" r="13" fill="#fed7aa"/>
    <path d="M220,415 Q230,411 240,415 L244,465 L216,465 Z" fill="#db2777"/>
    <line x1="222" y1="465" x2="218" y2="520" stroke="#0f172a" stroke-width="8" stroke-linecap="round"/>
    <line x1="238" y1="465" x2="242" y2="518" stroke="#0f172a" stroke-width="8" stroke-linecap="round"/>
  </g>

  <!-- Pedestrian 3 (On sidewalk) -->
  <g id="person-3">
    <circle cx="320" cy="300" r="11" fill="#fbcfe8"/>
    <path d="M312,312 Q320,309 328,312 L331,348 L309,348 Z" fill="#059669"/>
    <line x1="314" y1="348" x2="312" y2="385" stroke="#1e293b" stroke-width="6" stroke-linecap="round"/>
    <line x1="326" y1="348" x2="328" y2="385" stroke="#1e293b" stroke-width="6" stroke-linecap="round"/>
  </g>

  <!-- Car 1 (Red Sedan in foreground lane) -->
  <g id="car-1">
    <rect x="420" y="440" width="220" height="75" rx="14" fill="#dc2626"/>
    <path d="M460,440 L490,395 L580,395 L615,440 Z" fill="#991b1b"/>
    <path d="M495,402 L525,402 L525,435 L475,435 Z" fill="#93c5fd" opacity="0.85"/>
    <path d="M535,402 L572,402 L602,435 L535,435 Z" fill="#93c5fd" opacity="0.85"/>
    <circle cx="465" cy="515" r="24" fill="#0f172a"/>
    <circle cx="465" cy="515" r="10" fill="#94a3b8"/>
    <circle cx="595" cy="515" r="24" fill="#0f172a"/>
    <circle cx="595" cy="515" r="10" fill="#94a3b8"/>
    <rect x="630" y="465" width="10" height="18" fill="#facc15" rx="3"/>
  </g>

  <!-- Car 2 (Blue Hatchback in middle lane) -->
  <g id="car-2">
    <rect x="360" y="375" width="150" height="52" rx="10" fill="#0284c7"/>
    <path d="M390,375 L415,342 L475,342 L495,375 Z" fill="#0369a1"/>
    <circle cx="395" cy="427" r="16" fill="#0f172a"/>
    <circle cx="395" cy="427" r="6" fill="#94a3b8"/>
    <circle cx="480" cy="427" r="16" fill="#0f172a"/>
    <circle cx="480" cy="427" r="6" fill="#94a3b8"/>
  </g>

  <!-- Bus (Large Transit Bus in background lane) -->
  <g id="bus-1">
    <rect x="580" y="335" width="200" height="95" rx="8" fill="#0d9488"/>
    <rect x="590" y="350" width="30" height="30" fill="#bae6fd" rx="3"/>
    <rect x="630" y="350" width="30" height="30" fill="#bae6fd" rx="3"/>
    <rect x="670" y="350" width="30" height="30" fill="#bae6fd" rx="3"/>
    <rect x="710" y="350" width="30" height="30" fill="#bae6fd" rx="3"/>
    <circle cx="620" cy="430" r="18" fill="#0f172a"/>
    <circle cx="730" cy="430" r="18" fill="#0f172a"/>
  </g>

  <!-- Bicycle with rider on right side -->
  <g id="bicycle-1">
    <!-- Wheels -->
    <circle cx="710" cy="510" r="26" stroke="#f59e0b" stroke-width="4" fill="none"/>
    <circle cx="770" cy="510" r="26" stroke="#f59e0b" stroke-width="4" fill="none"/>
    <!-- Frame -->
    <path d="M710,510 L735,475 L765,475 L770,510 L740,510 L725,480" stroke="#f59e0b" stroke-width="4" fill="none"/>
    <!-- Cyclist -->
    <circle cx="740" cy="430" r="11" fill="#fed7aa"/>
    <path d="M732,442 L745,442 L748,475 L730,475 Z" fill="#7c3aed"/>
  </g>
</svg>
`;

// 2. Wildlife & Park Scene
const wildlifeParkSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
  <defs>
    <linearGradient id="parkSky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#60a5fa"/>
      <stop offset="100%" stop-color="#e0f2fe"/>
    </linearGradient>
    <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#4ade80"/>
      <stop offset="100%" stop-color="#16a34a"/>
    </linearGradient>
  </defs>

  <rect width="800" height="300" fill="url(#parkSky)"/>
  <rect y="250" width="800" height="350" fill="url(#grass)"/>

  <!-- Background Trees -->
  <g fill="#15803d">
    <circle cx="120" cy="220" r="80"/>
    <circle cx="260" cy="200" r="95"/>
    <circle cx="480" cy="210" r="85"/>
    <circle cx="680" cy="230" r="90"/>
  </g>

  <!-- Park Pathway -->
  <path d="M0,520 Q350,450 800,480 L800,600 L0,600 Z" fill="#e2e8f0"/>

  <!-- Park Bench -->
  <g id="bench-1">
    <rect x="100" y="380" width="160" height="15" rx="3" fill="#78350f"/>
    <rect x="100" y="405" width="160" height="18" rx="3" fill="#92400e"/>
    <line x1="115" y1="423" x2="110" y2="470" stroke="#1f2937" stroke-width="7" stroke-linecap="round"/>
    <line x1="245" y1="423" x2="250" y2="470" stroke="#1f2937" stroke-width="7" stroke-linecap="round"/>
    <line x1="115" y1="360" x2="115" y2="423" stroke="#1f2937" stroke-width="7"/>
    <line x1="245" y1="360" x2="245" y2="423" stroke="#1f2937" stroke-width="7"/>
  </g>

  <!-- Dog 1 (Golden Retriever running) -->
  <g id="dog-1">
    <!-- Dog body -->
    <ellipse cx="440" cy="430" rx="60" ry="32" fill="#d97706"/>
    <!-- Head -->
    <circle cx="510" cy="395" r="26" fill="#d97706"/>
    <ellipse cx="528" cy="402" rx="14" ry="10" fill="#b45309"/>
    <circle cx="538" cy="398" r="4" fill="#0f172a"/>
    <!-- Ears -->
    <path d="M495,385 C485,395 488,420 500,415 Z" fill="#92400e"/>
    <!-- Tail -->
    <path d="M380,420 C360,400 350,370 370,365 C380,380 390,405 385,420 Z" fill="#d97706"/>
    <!-- Legs -->
    <line x1="410" y1="450" x2="390" y2="490" stroke="#b45309" stroke-width="10" stroke-linecap="round"/>
    <line x1="430" y1="450" x2="435" y2="495" stroke="#b45309" stroke-width="10" stroke-linecap="round"/>
    <line x1="470" y1="450" x2="490" y2="488" stroke="#b45309" stroke-width="10" stroke-linecap="round"/>
    <line x1="490" y1="445" x2="520" y2="475" stroke="#b45309" stroke-width="10" stroke-linecap="round"/>
  </g>

  <!-- Dog 2 (Small Terrier walking) -->
  <g id="dog-2">
    <ellipse cx="320" cy="490" rx="30" ry="20" fill="#fff"/>
    <circle cx="355" cy="475" r="16" fill="#fff"/>
    <path d="M340,465 L350,450 L358,465 Z" fill="#71717a"/>
    <line x1="305" y1="505" x2="305" y2="530" stroke="#e4e4e7" stroke-width="6" stroke-linecap="round"/>
    <line x1="335" y1="505" x2="335" y2="530" stroke="#e4e4e7" stroke-width="6" stroke-linecap="round"/>
  </g>

  <!-- Person (Walking near trees) -->
  <g id="person-park">
    <circle cx="650" cy="330" r="15" fill="#fcd34d"/>
    <path d="M638,348 Q650,344 662,348 L668,410 L632,410 Z" fill="#0284c7"/>
    <line x1="640" y1="410" x2="635" y2="480" stroke="#334155" stroke-width="9" stroke-linecap="round"/>
    <line x1="660" y1="410" x2="665" y2="478" stroke="#334155" stroke-width="9" stroke-linecap="round"/>
  </g>

  <!-- Backpack on Bench -->
  <g id="backpack-1">
    <rect x="200" y="380" width="30" height="35" rx="7" fill="#7c3aed"/>
    <rect x="205" y="395" width="20" height="15" rx="3" fill="#6d28d9"/>
  </g>
</svg>
`;

// 3. Aerial Drone Harbor Scene (Small-Object Detection Focus)
const aerialHarborSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
  <defs>
    <linearGradient id="sea" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0284c7"/>
      <stop offset="100%" stop-color="#0369a1"/>
    </linearGradient>
    <linearGradient id="dock" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#64748b"/>
      <stop offset="100%" stop-color="#475569"/>
    </linearGradient>
  </defs>

  <!-- Sea -->
  <rect width="800" height="600" fill="url(#sea)"/>

  <!-- Concrete Pier / Dock -->
  <path d="M0,0 L320,0 L320,600 L0,600 Z" fill="url(#dock)"/>
  <rect x="320" y="160" width="260" height="70" fill="#94a3b8"/>
  <rect x="320" y="380" width="240" height="60" fill="#94a3b8"/>

  <!-- Dock Roadway -->
  <line x1="160" y1="0" x2="160" y2="600" stroke="#facc15" stroke-width="3" stroke-dasharray="16 14"/>

  <!-- Small Cars & Trucks on Dock (Aerial perspective) -->
  <!-- Car 1 -->
  <rect x="80" y="110" width="24" height="42" rx="4" fill="#ef4444"/>
  <!-- Car 2 -->
  <rect x="82" y="240" width="22" height="38" rx="4" fill="#3b82f6"/>
  <!-- Car 3 -->
  <rect x="210" y="180" width="24" height="40" rx="4" fill="#f8fafc"/>
  <!-- Truck 1 -->
  <rect x="200" y="320" width="32" height="70" rx="5" fill="#f59e0b"/>
  <!-- Car 4 -->
  <rect x="80" y="440" width="24" height="40" rx="4" fill="#10b981"/>
  <!-- Truck 2 -->
  <rect x="205" y="480" width="30" height="65" rx="5" fill="#8b5cf6"/>

  <!-- Boats berthed at pier -->
  <!-- Boat 1 -->
  <path d="M420,120 Q560,120 580,140 Q560,160 420,160 Z" fill="#f1f5f9"/>
  <rect x="450" y="130" width="40" height="20" fill="#0284c7" rx="2"/>

  <!-- Boat 2 -->
  <path d="M400,240 Q550,240 570,258 Q550,275 400,275 Z" fill="#f8fafc"/>
  <rect x="430" y="248" width="50" height="18" fill="#e11d48" rx="2"/>

  <!-- Boat 3 (Larger cargo/patrol vessel in open water) -->
  <path d="M600,420 Q760,420 780,450 Q760,480 600,480 Z" fill="#334155"/>
  <rect x="630" y="435" width="80" height="30" fill="#f8fafc" rx="4"/>
</svg>
`;

export const SAMPLE_IMAGES: SampleImageOption[] = [
  {
    id: 'african-penguins',
    title: 'African Penguin Colony (Boulders Beach, South Africa)',
    description: 'Farai Musariri core MSc research dataset: dense small-object detection (~20px) under natural coastal granite terrain and colony huddles.',
    category: 'Wildlife Conservation & Small-Object Research',
    dataUrl: '/samples/african_penguins_colony_opt.jpg',
    expectedObjects: 12,
    metadata: {
      width: 960,
      height: 640,
      sizeBytes: 235723,
      sizeFormatted: '230 KB',
      format: 'image/jpeg',
    },
    mockDetections: {
      penguin: {
        count: 12,
        confidence_scores: [0.98, 0.96, 0.95, 0.95, 0.94, 0.93, 0.92, 0.91, 0.90, 0.89, 0.88, 0.87],
        average_confidence: 0.92,
      },
    },
    boxes: [
      { id: 'pen-1', className: 'penguin', confidence: 0.98, bbox: [0.22, 0.62, 0.05, 0.08], color: '#32FF00' },
      { id: 'pen-2', className: 'penguin', confidence: 0.96, bbox: [0.28, 0.65, 0.05, 0.09], color: '#32FF00' },
      { id: 'pen-3', className: 'penguin', confidence: 0.95, bbox: [0.35, 0.58, 0.05, 0.08], color: '#32FF00' },
      { id: 'pen-4', className: 'penguin', confidence: 0.95, bbox: [0.42, 0.63, 0.05, 0.08], color: '#32FF00' },
      { id: 'pen-5', className: 'penguin', confidence: 0.94, bbox: [0.48, 0.68, 0.05, 0.09], color: '#32FF00' },
      { id: 'pen-6', className: 'penguin', confidence: 0.93, bbox: [0.53, 0.59, 0.05, 0.08], color: '#32FF00' },
      { id: 'pen-7', className: 'penguin', confidence: 0.92, bbox: [0.60, 0.64, 0.05, 0.08], color: '#32FF00' },
      { id: 'pen-8', className: 'penguin', confidence: 0.91, bbox: [0.66, 0.70, 0.05, 0.09], color: '#32FF00' },
      { id: 'pen-9', className: 'penguin', confidence: 0.90, bbox: [0.72, 0.62, 0.05, 0.08], color: '#32FF00' },
      { id: 'pen-10', className: 'penguin', confidence: 0.89, bbox: [0.78, 0.66, 0.05, 0.08], color: '#32FF00' },
      { id: 'pen-11', className: 'penguin', confidence: 0.88, bbox: [0.31, 0.72, 0.05, 0.09], color: '#32FF00' },
      { id: 'pen-12', className: 'penguin', confidence: 0.87, bbox: [0.84, 0.71, 0.05, 0.09], color: '#32FF00' },
    ],
  },
  {
    id: 'urban-traffic',
    title: 'Urban Traffic & Multi-Lane Highway',
    description: 'Real-world commuter traffic scene featuring sedans, commercial trucks, SUVs, and road lane markings.',
    category: 'Autonomous Driving & Surveillance',
    dataUrl: '/samples/urban_traffic_opt.jpg',
    expectedObjects: 7,
    metadata: {
      width: 960,
      height: 634,
      sizeBytes: 180715,
      sizeFormatted: '176 KB',
      format: 'image/jpeg',
    },
    mockDetections: {
      car: { count: 4, confidence_scores: [0.98, 0.95, 0.92, 0.89] },
      truck: { count: 2, confidence_scores: [0.96, 0.93] },
      bus: { count: 1, confidence_scores: [0.94] },
    },
    boxes: [
      {
        id: 'box-car-1',
        className: 'car',
        confidence: 0.98,
        bbox: [0.18, 0.48, 0.16, 0.22],
        color: '#3b82f6',
      },
      {
        id: 'box-car-2',
        className: 'car',
        confidence: 0.95,
        bbox: [0.38, 0.52, 0.18, 0.24],
        color: '#3b82f6',
      },
      {
        id: 'box-truck-1',
        className: 'truck',
        confidence: 0.96,
        bbox: [0.58, 0.42, 0.22, 0.32],
        color: '#8b5cf6',
      },
      {
        id: 'box-car-3',
        className: 'car',
        confidence: 0.92,
        bbox: [0.05, 0.56, 0.14, 0.20],
        color: '#3b82f6',
      },
      {
        id: 'box-car-4',
        className: 'car',
        confidence: 0.89,
        bbox: [0.79, 0.55, 0.15, 0.22],
        color: '#3b82f6',
      },
      {
        id: 'box-truck-2',
        className: 'truck',
        confidence: 0.93,
        bbox: [0.32, 0.36, 0.12, 0.16],
        color: '#8b5cf6',
      },
      {
        id: 'box-bus-1',
        className: 'bus',
        confidence: 0.94,
        bbox: [0.49, 0.35, 0.14, 0.18],
        color: '#ec4899',
      },
    ],
  },
  {
    id: 'wildlife-park',
    title: 'South African Wildlife Reserve (Kruger)',
    description: 'Authentic 2024 wildlife conservation photograph of a herd of zebras grazing in natural bushveld habitat.',
    category: 'Wildlife & Natural Scenes',
    dataUrl: '/samples/wildlife_safari_opt.jpg',
    expectedObjects: 5,
    metadata: {
      width: 960,
      height: 640,
      sizeBytes: 242865,
      sizeFormatted: '237 KB',
      format: 'image/jpeg',
    },
    mockDetections: {
      zebra: { count: 4, confidence_scores: [0.98, 0.96, 0.94, 0.91] },
      tree: { count: 1, confidence_scores: [0.89] },
    },
    boxes: [
      {
        id: 'box-z1',
        className: 'zebra',
        confidence: 0.98,
        bbox: [0.18, 0.32, 0.26, 0.44],
        color: '#10b981',
      },
      {
        id: 'box-z2',
        className: 'zebra',
        confidence: 0.96,
        bbox: [0.44, 0.36, 0.28, 0.42],
        color: '#10b981',
      },
      {
        id: 'box-z3',
        className: 'zebra',
        confidence: 0.94,
        bbox: [0.68, 0.38, 0.22, 0.38],
        color: '#10b981',
      },
      {
        id: 'box-z4',
        className: 'zebra',
        confidence: 0.91,
        bbox: [0.08, 0.40, 0.16, 0.32],
        color: '#10b981',
      },
      {
        id: 'box-t1',
        className: 'tree',
        confidence: 0.89,
        bbox: [0.82, 0.15, 0.16, 0.45],
        color: '#f59e0b',
      },
    ],
  },
  {
    id: 'aerial-harbor',
    title: 'Aerial Maritime Marina & Boats',
    description: 'Authentic overhead coastal maritime photograph of moored yachts, motorboats, docks, and ocean water.',
    category: 'Aerial & Remote Sensing',
    dataUrl: '/samples/aerial_harbor_opt.jpg',
    expectedObjects: 6,
    metadata: {
      width: 960,
      height: 576,
      sizeBytes: 225316,
      sizeFormatted: '220 KB',
      format: 'image/jpeg',
    },
    mockDetections: {
      boat: { count: 5, confidence_scores: [0.97, 0.95, 0.93, 0.91, 0.88] },
      dock: { count: 1, confidence_scores: [0.92] },
    },
    boxes: [
      {
        id: 'box-b1',
        className: 'boat',
        confidence: 0.97,
        bbox: [0.15, 0.22, 0.18, 0.35],
        color: '#0284c7',
      },
      {
        id: 'box-b2',
        className: 'boat',
        confidence: 0.95,
        bbox: [0.36, 0.25, 0.16, 0.34],
        color: '#0284c7',
      },
      {
        id: 'box-b3',
        className: 'boat',
        confidence: 0.93,
        bbox: [0.55, 0.28, 0.15, 0.32],
        color: '#0284c7',
      },
      {
        id: 'box-b4',
        className: 'boat',
        confidence: 0.91,
        bbox: [0.73, 0.32, 0.18, 0.36],
        color: '#0284c7',
      },
      {
        id: 'box-b5',
        className: 'boat',
        confidence: 0.88,
        bbox: [0.42, 0.65, 0.22, 0.26],
        color: '#0284c7',
      },
      {
        id: 'box-d1',
        className: 'dock',
        confidence: 0.92,
        bbox: [0.10, 0.18, 0.82, 0.12],
        color: '#d97706',
      },
    ],
  },
];
