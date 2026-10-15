# Architecture Upgrades & Advanced Capabilities Document

This document outlines the advanced technical features, performance safeguards, and architectural upgrades implemented into Farai Bodias Musariri's Computer Vision Portfolio application.

---

## 1. Batch Processing (High-Throughput Multi-Image Engine)
- **Component**: `BatchUpload.tsx`
- **Capabilities**:
  - Drag-and-drop ingestion of multiple frames simultaneously (up to 50MB per frame).
  - Queue management with sequential asynchronous worker pipeline.
  - Per-item progress tracking with real-time status indicators (`queued`, `processing`, `done`, `error`).
  - Automated client-side ZIP archive packaging utilizing `jszip`, bundling all annotated detection outputs alongside a `batch_summary.json` metadata manifest.

---

## 2. Interactive Confidence Filtering Slider
- **Component**: `ConfidenceSlider.tsx`
- **Capabilities**:
  - Smooth 0% to 100% threshold adjustment with real-time re-filtering of candidate bounding boxes without re-uploading or re-fetching.
  - Dynamic gradient track transitioning smoothly from red (low threshold, high false positives) to yellow to emerald green (strict certainty).
  - Live feedback banner: *"Showing X of Y detections (threshold: Z%)"*.
  - Full ARIA accessibility support (`aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-valuetext`).

---

## 3. Before/After Split Slider Visualization
- **Component**: `BeforeAfterSlider.tsx`
- **Capabilities**:
  - Draggable interactive slider overlaying the raw input frame and the annotated model predictions.
  - Dual inspection mode: seamlessly toggle between Split Slider view and Side-by-Side dual view.
  - Touch and pointer capture support guaranteeing responsiveness on mobile devices and desktop trackpads.
  - Full keyboard accessibility: Arrow Left/Right to step by 5%, Home to 0%, End to 100%.

---

## 4. Multi-Model Side-by-Side Benchmarking
- **Components**: `ModelComparison.tsx`, `ComparisonMetrics.tsx`, `src/utils/models.ts`
- **Capabilities**:
  - Allows comparing any two neural architectures on identical input frames:
    1. **Farai's FPN-DomainNet** (Custom dual-path FPN optimized for small targets and domain adaptation)
    2. **YOLOv8x Benchmark** (One-stage anchor-free model)
    3. **Mask R-CNN ResNet-50-FPN** (Two-stage instance segmentation model)
    4. **RetinaNet Focal Loss** (Focal loss foreground-background imbalance model)
  - Detailed comparative metrics: Throughput Winner (+X% faster), Certainty Winner, and Recall differences.
  - Full class-by-class discrepancy breakdown table identifying which model predicted extra instances per category.

---

## 5. Enhanced Gallery with Metadata & Advanced Filtering
- **Component**: `Gallery.tsx`, `src/utils/galleryStorage.ts`
- **Capabilities**:
  - Instant client-side search by title or detected class.
  - Filter by object class (e.g. `person`, `car`, `boat`, etc.).
  - Filter by object density (`1-5`, `6-10`, `11+` objects).
  - Multi-criteria sorting: Most Recent, Highest Object Count, or Lowest Latency (Speed).
  - Quota-safe compressed JPEG thumbnailing (320px) preventing `QuotaExceededError` in `localStorage`.
  - Individual item deletion with confirmation modal and clear-all protection.

---

## 6. Analytics Dashboard & Multi-Format Data Export
- **Component**: `Analytics.tsx`
- **Capabilities**:
  - Aggregate KPIs: Total images analyzed, average forward-pass latency, total objects detected, and unique taxonomy classes seen.
  - Visual class frequency horizontal distribution bar chart.
  - Real-time inference latency history log.
  - One-click dataset export as structured CSV or comprehensive JSON.

---

## 7. Workflow Shortcuts & Floating Action Navigation
- **Component**: `FloatingActions.tsx`
- **Capabilities**:
  - Keyboard shortcuts:
    - `Spacebar`: Run / re-run inference
    - `S`: Save / download annotated PNG
    - `C`: Toggle Comparison Mode
    - `?`: Open Keyboard Shortcuts cheatsheet modal
  - Floating Action Button (FAB) offering quick navigation to Single View, Batch, Compare, Analytics, and Scroll-to-Top.
