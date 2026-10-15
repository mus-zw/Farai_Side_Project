# Farai Bodias Musariri — Computer Vision & AI Portfolio

> **"Building smart systems that see and understand. MSc researcher in small-object detection and domain adaptation."**  
> *"I design models that find tiny things in crowded pictures. Currently focused on African penguin monitoring."*

A production-grade, authentic portfolio and interactive computer vision suite developed by **Farai Bodias Musariri**, MSc Computer Science candidate at Rhodes University, Grahamstown, South Africa.

---

## 🎨 Theme: Lime Green Modern Design System
- **Primary Accent**: `#32FF00` (Lime Green)
- **Highlight & Glow**: `#00FF41` (Bright Lime)
- **Main Canvas**: `#0F1419` (Dark Navy)
- **Card Surfaces**: `#16213E` (Dark Secondary)
- **Deep Recessed & Footer**: `#0A0E17`
- **Typography**: `Poppins` (display headings), `Inter` (body interface), `JetBrains Mono` (code & metrics)
- **Accessibility**: High-contrast ratios, lime glow hover animations, and subtle 1px border framing.

---

## 🔬 Core Research & Academic Achievements
- **MSc Thesis**: Small-object detection and domain adaptation in dense environments (Rhodes University, 2025).
- **Conference Papers (2024)**: *"NMS vs End-to-End Decoding for Small-Object Detection in Aerial Imagery"*, published at **SATNAC 2024** and **SACAIR 2024**.
- **Conservation Application**: Automated census of endangered African penguins (*Spheniscus demersus*) from drone aerial surveys, detecting micro-targets (~20px) under natural coastal granite terrain.

---

## 🚀 Interactive Computer Vision Suite (`/demo`)
- **Flagship African Penguin Dataset**: Instant one-click test scan loaded with 12 dense small-object detections in coastal terrain.
- **Split Before/After Inspection**: Draggable slider with keyboard support (`←`/`→`) and side-by-side mode.
- **Dynamic Confidence Filtering**: Smooth slider (0–100%) with dynamic color gradient (`#ef4444` → `#eab308` → `#32FF00`).
- **Batch Processing Mode**: Sequential processing of multi-image queues with automated packaged `.zip` export and JSON manifest.
- **Side-by-Side Model Comparison**: Head-to-head runs of YOLOv8-seg sizes (Nano to Extra Large) on the same image, with timing, per-class counts and box-level agreement.
- **Video Suite**: Upload videos up to 500MB, frame-by-frame detection at a chosen stride, box overlay on playback, frame inspector and occurrence timeline.
- **Persistent Local Gallery**: Quota-safe client-side cache with search, class filtering, and sorting.

---

## 🛠️ Skills & Technologies
- **Languages**: Python, JavaScript, SQL, Bash
- **ML / Computer Vision**: PyTorch, TensorFlow, OpenCV, YOLOv8, Mask R-CNN, RT-DETR
- **Web & Deployment**: React, FastAPI, REST APIs, Docker, Vite, Tailwind CSS
- **Tools**: Git, VS Code, Jupyter, Linux (Ubuntu)
- **Single Image Analysis**:
  - Drag-and-drop ingestion (up to 50MB, JPG/PNG/WebP) with real-time streaming progress tracking
  - **Before/After Split Slider**: Draggable comparison slider with keyboard accessibility (arrow keys) and instant toggle to side-by-side mode
  - **Confidence Slider**: Re-runs detection on the backend at the chosen threshold (red → yellow → green gradient)
  - **Backend Status**: Live indicator of the served model and device, from `/api/health`
  - **Class Breakdown**: Per-class counts and confidences, in the same colours as the annotated image

- **High-Throughput Batch Processing**:
  - Drag-and-drop multiple images simultaneously into an asynchronous worker queue
  - Sequential inference execution with step-by-step progress indicator (*"3 of 10 images processed"*)
  - **Automated ZIP Export**: Download all batch outputs as a bundled `.zip` archive containing annotated frames and a `batch_summary.json` manifest

- **Multi-Model Side-by-Side Benchmarking**:
  - Select candidate models (Model A vs Model B) to run head-to-head on identical frames
  - Metrics from `/api/compare`: fastest model, most objects found, highest mean confidence, and agreement (pairwise F1 of matched boxes)
  - Class-by-class count table across models

- **Analytics Dashboard & Data Export**:
  - Aggregate KPIs: Total images analyzed, average latency in ms, total objects detected, and unique taxonomy classes
  - Class frequency distribution bar chart
  - Recent inference latency history log
  - One-click exports in **CSV** and **JSON** formats

- **Enhanced Gallery with Client-Side Filtering**:
  - Client-side search by title or detected class
  - Multi-criteria filtering by object class and object count density (`1-5`, `6-10`, `11+`)
  - Sorting by newest, highest object count, or fastest latency
  - Quota-safe compressed JPEG thumbnailing (320px) preventing `QuotaExceededError` in browser storage
  - Deletion confirmation dialogs and clear-all protection

- **Floating Actions & Keyboard Shortcuts**:
  - Floating Action Button (FAB) for fast navigation between modes
  - Shortcuts: `Spacebar` (run inference), `S` (download annotated image), `C` (toggle comparison mode), `?` (show shortcuts cheatsheet)

### 2. Video Processing Suite (`/demo` Video Tab)
- **High-Capacity Ingestion**: Supports MP4, WebM, MOV, and AVI video streams up to **500MB** with real-time video duration and dimension extraction.
- **Sample Video Generator**: Client-side canvas generator for a short synthetic traffic clip to use as *input* when you have no video handy.
- **Frame Stride**: Analyse every Nth frame (1–60), plus a confidence threshold; both are passed straight to `/api/detect-video`.
- **No tracking**: detections are per frame; objects carry no identity across frames.
- **Interactive Video Player**:
  - Variable playback rates (`0.5x`, `1.0x`, `1.5x`, `2.0x`)
  - Backend boxes overlaid on the original video, holding the latest analysed frame between strides
  - Class filter
- **Temporal Occurrence Timeline**: Clickable timeline visualizing when specific object classes enter and exit the scene.
- **Frame Inspector**: Step through the analysed frames and see each box with its confidence.
- **Density Analytics**: Mean objects per analysed frame across the video, and class frequency breakdown.

---

## Local Setup & Quick Start

### 1. Prerequisites
- Node.js 18+ installed on your system
- npm or yarn

### 2. Environment Configuration
Create a `.env` file in the root directory (optional):
```bash
# Target FastAPI / Python computer vision backend URL (defaults to http://localhost:8000)
VITE_API_URL=http://localhost:8000
```

### 3. Installation
```bash
# Clone the repository and navigate into the project directory
npm install
```

### 4. Run the Development Server
```bash
npm run dev
```
The application will be live at `http://localhost:3000`.

---

## Backend API

The app needs the FastAPI backend in `cv-backend` (YOLOv8-seg); see its
`README.md`. It has no offline mode: every detection shown comes from the
backend, and if the backend is unreachable or errors, the UI shows the error.

- **Base URL**: `VITE_API_URL` (default `http://localhost:8000`), overridable at
  runtime from **API Config** on the Demo page (stored as a base URL in
  localStorage).
- **Calls made**: `POST /api/detect`, `POST /api/compare`,
  `POST /api/detect-video`, `GET /api/health`, `GET /api/model-info`. Uploads
  go in the multipart field `file`; options (`confidence`, `models`,
  `frame_stride`, `return_video`) are query parameters.
- The full request/response contract is in `docs/CONTRACT_AUDIT.md`. That
  file is the pre-reconciliation snapshot; the backend's `app/schemas.py` is
  the source of truth.

---

## Component Architecture
- `src/pages/Demo.tsx` - Central orchestrator for Single Image, Batch, Compare, Analytics, and Video modes
- `src/components/video/VideoProcessor.tsx` - Main orchestrator for video analysis lifecycle and subtab navigation
- `src/components/video/VideoUpload.tsx` - Video drag & drop ingestion, metadata extraction, and benchmark generator
- `src/components/video/VideoPlayer.tsx` - Custom HTML5 video player with real-time dynamic canvas bounding box overlay
- `src/components/video/VideoTimeline.tsx` - Temporal occurrence and presence timeline
- `src/components/video/FrameAnalysis.tsx` - Frame-by-frame forensic scrubber and snapshot exporter
- `src/components/video/VideoAnalytics.tsx` - Density charts, temporal statistics, and JSON export
- `src/components/BatchUpload.tsx` - Multi-image ingestion, queue runner, and ZIP packaging
- `src/components/ConfidenceSlider.tsx` - Interactive threshold slider with dynamic color gradient
- `src/components/BeforeAfterSlider.tsx` - Draggable split slider with keyboard support
- `src/components/ModelComparison.tsx` - Head-to-head model benchmarking
- `src/components/ComparisonMetrics.tsx` - KPI cards and class discrepancy table
- `src/components/Analytics.tsx` - Aggregate KPI metrics, class frequency chart, and CSV/JSON export
- `src/components/Gallery.tsx` - Client-side search, filtering, and sorting
- `src/components/FloatingActions.tsx` - Floating action navigation button
- `src/services/visionApi.ts` - Image inference API client (`/api/detect`)
- `src/services/videoApi.ts` - Video inference API client (`/api/detect-video`)
- `src/services/systemApi.ts` / `compareApi.ts` - `/api/health`, `/api/model-info`, `/api/compare` clients
- `src/services/apiClient.ts` - Backend base URL (env + API Config override) and error translation
- `src/utils/models.ts` - Model architecture registry and characteristics
- `src/utils/galleryStorage.ts` - Quota-safe compressed thumbnailing and LRU pruning

---

## 📬 Contact & Inquiries
- **Email**: [fbmfari@gmail.com](mailto:fbmfari@gmail.com)
- **LinkedIn**: [linkedin.com/in/farai-musariri](https://linkedin.com/in/farai-musariri)
- **GitHub**: [github.com/farai-musariri](https://github.com/farai-musariri)
- **Location**: Kempton Park, South Africa

