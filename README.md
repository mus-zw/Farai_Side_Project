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
- **Side-by-Side Model Comparison**: Head-to-head benchmarking between Farai's Custom FPN, YOLOv8x, Mask R-CNN, and RetinaNet with speedup and certainty metrics.
- **Real-Time Video Suite**: Upload video streams up to 500MB, MOT tracking with trajectories, frame scrubber, and dual stream sync comparison.
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
  - **Dynamic Confidence Slider**: Interactive slider (0–100%) with dynamic color gradient (red → yellow → green) and real-time bounding box re-filtering
  - **Model Architecture Switcher**: Test between Farai's Custom FPN-DomainNet, YOLOv8x Benchmark, Mask R-CNN (ResNet-50-FPN), and RetinaNet Focal Loss
  - **Class-by-Class Isolation**: Click any detected class to isolate its bounding boxes and mask overlays

- **High-Throughput Batch Processing**:
  - Drag-and-drop multiple images simultaneously into an asynchronous worker queue
  - Sequential inference execution with step-by-step progress indicator (*"3 of 10 images processed"*)
  - **Automated ZIP Export**: Download all batch outputs as a bundled `.zip` archive containing annotated frames and a `batch_summary.json` manifest

- **Multi-Model Side-by-Side Benchmarking**:
  - Select candidate models (Model A vs Model B) to run head-to-head on identical frames
  - Automated comparative metrics: **Throughput Winner** (+X% speedup), **Certainty Winner**, and **Object Recall** differences
  - Class-by-class discrepancy breakdown table identifying precision variances

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

### 2. Real-Time Video Processing Suite (`/demo` Video Tab)
- **High-Capacity Ingestion**: Supports MP4, WebM, MOV, and AVI video streams up to **500MB** with real-time video duration and dimension extraction.
- **Custom Synthetic Benchmark Generator**: Built-in client-side canvas synthesizer rendering 1080p/720p 24fps traffic benchmark videos on demand for instant testing.
- **Processing Modes**:
  - *Full Stream*: Sequential analysis of every frame
  - *Sampled Frames*: Configurable sampling rate (1–30 FPS) with step progress indicators
  - *Real-time Stream Overlay*: In-sync HTML5 canvas bounding box overlays
- **Multi-Object Tracking (MOT)**: Unique entity tracking IDs, trajectory motion history vectors, and velocity vectors.
- **Interactive Video Player**:
  - Variable playback rates (`0.5x`, `1.0x`, `1.5x`, `2.0x`)
  - Class-specific filter isolation (highlight cars, pedestrians, bikes during playback)
  - Toggle bounding boxes and motion trails
- **Temporal Occurrence Timeline**: Clickable timeline visualizing when specific object classes enter and exit the scene.
- **Forensic Frame-by-Frame Inspector**: Scrub through video frames with fine step controls, confidence inspection, and PNG snapshot export.
- **Kinematic & Density Analytics**: Object density bar charts across temporal slices and class frequency breakdown.
- **Synchronized Dual-Stream Comparison**: Side-by-side synchronized video playback for visual model verification and difference analysis.

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

## Backend API Integration (Optional)

The application communicates with a computer vision detection API endpoint via `POST /api/detect` with multipart form data:

- **Default Endpoint**: `http://localhost:8000/api/detect` (or configured via `VITE_API_URL`)
- **Configurable**: You can change the target endpoint URL directly inside the Demo page UI by clicking **"API Config"**.

### Sample Python FastAPI Backend
You can launch a companion Python server in seconds:

```python
# main.py
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
import time

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/detect")
async def detect(
    image: UploadFile = File(...),
    model_id: str = Form("farai-fpn")
):
    start = time.time()
    contents = await image.read()
    
    # Process with your PyTorch / YOLO / Mask R-CNN model here:
    # results = model(contents, model_id=model_id)
    
    return {
        "total_objects": 6,
        "detections": {
            "person": {"count": 2, "confidence_scores": [0.96, 0.92]},
            "car": {"count": 3, "confidence_scores": [0.97, 0.94, 0.89]},
            "dog": {"count": 1, "confidence_scores": [0.91]}
        },
        "processing_time_ms": int((time.time() - start) * 1000) + 95,
        "annotated_image_base64": "data:image/png;base64,..."
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

> **Note**: If no external server is running, the app automatically runs an in-browser high-precision computer vision inference engine using the HTML5 Canvas API, allowing instant exploration with zero configuration.

---

## Component Architecture
- `src/pages/Demo.tsx` - Central orchestrator for Single Image, Batch, Compare, Analytics, and Video modes
- `src/components/video/VideoProcessor.tsx` - Main orchestrator for video analysis lifecycle and subtab navigation
- `src/components/video/VideoUpload.tsx` - Video drag & drop ingestion, metadata extraction, and benchmark generator
- `src/components/video/VideoPlayer.tsx` - Custom HTML5 video player with real-time dynamic canvas bounding box overlay
- `src/components/video/VideoTimeline.tsx` - Temporal occurrence and presence timeline
- `src/components/video/FrameAnalysis.tsx` - Frame-by-frame forensic scrubber and snapshot exporter
- `src/components/video/VideoAnalytics.tsx` - Density charts, temporal statistics, and JSON export
- `src/components/video/VideoComparison.tsx` - Synchronized dual-stream video comparison
- `src/components/BatchUpload.tsx` - Multi-image ingestion, queue runner, and ZIP packaging
- `src/components/ConfidenceSlider.tsx` - Interactive threshold slider with dynamic color gradient
- `src/components/BeforeAfterSlider.tsx` - Draggable split slider with keyboard support
- `src/components/ModelComparison.tsx` - Head-to-head model benchmarking
- `src/components/ComparisonMetrics.tsx` - KPI cards and class discrepancy table
- `src/components/Analytics.tsx` - Aggregate KPI metrics, class frequency chart, and CSV/JSON export
- `src/components/Gallery.tsx` - Client-side search, filtering, and sorting
- `src/components/FloatingActions.tsx` - Floating action navigation button
- `src/services/visionApi.ts` - Image inference API service with client engine fallback
- `src/services/videoApi.ts` - Video detection API service with client engine fallback
- `src/utils/models.ts` - Model architecture registry and characteristics
- `src/utils/galleryStorage.ts` - Quota-safe compressed thumbnailing and LRU pruning

---

## 📬 Contact & Inquiries
- **Email**: [fbmfari@gmail.com](mailto:fbmfari@gmail.com)
- **LinkedIn**: [linkedin.com/in/farai-musariri](https://linkedin.com/in/farai-musariri)
- **GitHub**: [github.com/farai-musariri](https://github.com/farai-musariri)
- **Location**: Kempton Park, South Africa

