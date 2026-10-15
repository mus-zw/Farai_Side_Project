# Contract audit: frontend ↔ backend

**Snapshot.** Frontend `Farai_Side_Project` at commit `f7609db` (branch
`integration`, after Task 1 removed the fallback engine). Backend
`cv-backend` as delivered. Compared against the real `app/schemas.py`,
`app/routes/*.py` and `app/services/detector.py`, not the frontend README.

**Network calls in the frontend:**

| # | File | Call |
|---|---|---|
| 1 | `src/services/visionApi.ts` `detectObjects` | `POST {base}/api/detect` |
| 2 | `src/services/videoApi.ts` `processVideo` | `POST {base}/api/detect-video` |
| 3 | `src/pages/Demo.tsx` `handleSelectSample` | `fetch(sample.dataUrl)`, a same-origin static JPEG from `public/samples/`. It isn't an API call and has no contract. |

`detectObjects` has three callers: `Demo.tsx` (single image),
`BatchUpload.tsx` (one call per file in a loop) and `ModelComparison.tsx`
(two calls, A then B).

**Backend endpoints the frontend never calls:** `/api/detect-batch`,
`/api/health`, `/api/model-info`, `/api/cache-stats`, `/api/cache-clear`.

**Verdict key:**
- **MATCH:** works as intended.
- **MISMATCH:** both sides exist but disagree.
- **MISSING:** one side has nothing to meet the other.

---

## 1. `POST /api/detect` (single image)

### Request

| Item | Frontend sends | Backend expects | Verdict |
|---|---|---|---|
| Method / path | `POST {base}/api/detect` | `POST /api/detect` | MATCH |
| Image | multipart field `file` (fixed in Task 1; was `image` and `file`) | `file: UploadFile` | MATCH |
| Content type of part | browser sets from `File.type` (jpeg/png/webp; sample images now carry their real type) | allowed set in `image_utils.ALLOWED_IMAGE_TYPES`, else 415 | MATCH |
| Confidence | **not sent**. The UI slider (`confidenceThreshold`, default 0.5) only feeds `AnalysisOptions` and goes nowhere. | `confidence` **query** param, 0–1, default 0.25 | **MISMATCH**. The slider has no effect; the backend always uses 0.25. |
| Model | multipart field `model_id` = `farai-fpn` / `yolov8x` / `mask-rcnn` / `retinanet` | no model parameter; the server uses `settings.MODEL_NAME` | **MISMATCH**. The field is silently ignored, and the IDs are fictional. |
| Size limit | client check 50 MB | `MAX_IMAGE_SIZE` 50 MB → 413 | MATCH |
| Timeout | 120 s | n/a | — |

### Response

`DetectionResponse` in `schemas.py`:
`total_objects, detections{cls: ClassDetections}, processing_time_ms,
annotated_image_base64, image_width, image_height, model_name,
confidence_threshold, cached`. `ClassDetections` is `count,
confidence_scores, bounding_boxes ([x1,y1,x2,y2] px), color (hex)`.

| Field the frontend reads | Where | Backend | Verdict |
|---|---|---|---|
| `total_objects` | visionApi (validity check), Demo, ResultsDisplay, BatchUpload, ModelComparison, gallery | `int` | MATCH |
| `detections[cls].count` | ResultsDisplay, Demo (topClasses), ModelComparison, Analytics, Gallery | `int` | MATCH |
| `detections[cls].confidence_scores` | ResultsDisplay, ModelComparison (avg confidence) | `list[float]` | MATCH |
| `detections[cls].average_confidence` | ResultsDisplay (optional; recomputes from scores if absent) | not returned | MATCH (handled as optional) |
| `processing_time_ms` | Demo, ResultsDisplay, Batch, Comparison, Analytics | `int`. This is model time only, not decode/encode/upload. | MATCH (worth labelling as "inference time") |
| `annotated_image_base64` | BeforeAfterSlider, gallery thumbnail, PNG download, batch ZIP | `data:image/jpeg;base64,…` (JPEG, q90) | **MISMATCH**. See the two notes below. |
| `modelName` (frontend-added) | ResultsDisplay, gallery, JSON report | backend's `model_name` is **not read**. The frontend shows the name from its fictional `VISION_MODELS` table. | **MISMATCH**. The UI names a model that did not run. |
| `detections[cls].color` | not read. Badges use `utils/colors.getClassColor`. | hex per class, matching the drawn boxes | MISMATCH (cosmetic: badge colours differ from the box colours in the image) |
| `bounding_boxes` | not read | returned | Unused. Fine. |
| `image_width`, `image_height` | not read. The frontend measures the file in the browser. | returned | Unused. Fine. |
| `confidence_threshold` | not read. The frontend records its slider value, which was never sent. | returned | **MISMATCH**. Gallery/JSON report record a threshold that was not applied. |
| `cached` | not read | returned | Unused (could show a badge). |

**JPEG vs PNG.**
- `BatchUpload` ZIP export strips only the `data:image/png;base64,` prefix
  and writes `.png` files. With a JPEG data URL the prefix is not stripped,
  so JSZip receives `data:image/jpeg;base64,...` as base64 and writes
  corrupt files.
- The single-image "Download PNG" writes JPEG bytes into a `.png` filename.

**Client-side display controls with no backend counterpart.** The "Instance
Segmentation Masks" and "Bounding Box Tags" checkboxes and the class
highlight filter each re-send the image. The backend has no parameters for
any of them, so the returned image is identical and the controls do
nothing. MISSING on the backend. This is a legitimate UI need, but it's not
worth a backend change: see Task 3.

**Re-request on every control change.** Each toggle and each slider change
re-uploads the full image. With confidence actually sent, the slider is the
only control where re-requesting is meaningful. The backend's cache keys on
`(bytes, confidence, model)`, so repeated values are cheap.

---

## 2. Batch processing (frontend loop over `POST /api/detect`)

| Item | Frontend | Backend | Verdict |
|---|---|---|---|
| Endpoint | calls `/api/detect` once per file, sequentially | `/api/detect-batch` exists (one synchronous request, returns all at once) | MATCH. The per-file loop is what drives the honest "N of M" counter. `/api/detect-batch` is unused, and that's correct for this UI. |
| Per-file request/response | same as §1 | same as §1 | inherits §1 MISMATCHes (confidence, model, JPEG) |
| ZIP export | strips `data:image/png;base64,` only | JPEG data URL | **MISMATCH**: corrupt files in the ZIP (see §1) |
| Batch limit | none client-side | `MAX_BATCH_FILES` 20 applies to `/detect-batch` only | n/a for the loop |

---

## 3. Model comparison (frontend: two `POST /api/detect` calls)

| Item | Frontend | Backend | Verdict |
|---|---|---|---|
| Endpoint | `/api/detect` twice, with `model_id` A and B | no comparison endpoint; `/api/detect` ignores `model_id` | **MISSING**. Both calls run the same server model, so the comparison compares a model with itself. Differences are cache hits and timing noise. |
| Model list | four fictional models from `utils/models.ts` | `/api/model-info.selectable_models` lists four YOLOv8-seg sizes, but nothing can select one | **MISSING** |
| Fields read | `total_objects`, `processing_time_ms`, `detections[*].count / confidence_scores`, `annotated_image_base64` | present | MATCH per call |
| Derived metrics | faster model, more-confident model, speedup %, per-class count diff, computed client-side | — | OK once real models run |

This is the gap you already knew about. Task 3 of the original brief
specifies the fix (ModelRegistry + `POST /api/compare`). I've noted it here
and not designed it in this audit.

---

## 4. `POST /api/detect-video`

### Request

| Item | Frontend sends | Backend expects | Verdict |
|---|---|---|---|
| Method / path | `POST {base}/api/detect-video` | same | MATCH |
| Video | multipart `file` (fixed in Task 1) | `file: UploadFile` | MATCH |
| `mode` (`entire` / `sample` / `realtime`) | form field | not accepted | **MISMATCH** (ignored) |
| `sampling_fps` (1–30) | form field | `frame_stride` **query** int 1–60, default 5. Stride is "every Nth frame", not frames per second. | **MISMATCH** (ignored; different unit) |
| `confidence_threshold` | form field | `confidence` **query** | **MISMATCH** (ignored) |
| `model_id` | form field | not accepted | **MISMATCH** (ignored) |
| `enable_tracking` | form field | not accepted; the backend has **no tracking** | **MISMATCH** (ignored) |
| `return_video` | not sent → defaults to `true` | query bool | MISMATCH (minor). The backend encodes the whole annotated video as base64 and the frontend never reads it. That's wasted time and response size. |
| Size limit | 500 MB | 500 MB | MATCH |

### Response

`VideoResponse`: `total_frames, frames_analysed, fps, duration_seconds,
frame_stride, processing_time_ms, frame_detections[], annotated_video_base64,
summary, model_name, confidence_threshold`. `FrameDetection` is
`frame_number, timestamp, total_objects, detections{cls: ClassDetections}`.
`VideoSummary` is `total_objects, classes_detected,
object_count_per_class, average_confidence_per_class, peak_frame,
peak_frame_count`.

| Field the frontend reads | Where | Backend | Verdict |
|---|---|---|---|
| `frame_detections[].boxes[]` with `{trackId, className, confidence, bbox: [x,y,w,h] normalised, trajectory, color}` | VideoPlayer (canvas overlay), FrameAnalysis (target list), VideoAnalytics (density chart counts `boxes.length`) | **not returned**. The backend returns per-class `detections` with `bounding_boxes` as `[x1,y1,x2,y2]` **pixels**, no track IDs and no trajectories. | **MISMATCH / MISSING**. Every box-based video view renders empty. |
| `frame_detections[]` indexed by video frame number (`floor(t * fps)` in VideoPlayer; `0..total_frames` in VideoAnalytics) | VideoPlayer, VideoAnalytics, FrameAnalysis | array of *analysed* frames only (every `frame_stride`-th), so index ≠ frame number | **MISMATCH**. Wrong frame shown and density buckets skewed. |
| `frame_detections[].frame_number`, `.timestamp` | FrameAnalysis, VideoTimeline, VideoPlayer | returned | MATCH |
| `frame_detections[].detections` | VideoTimeline (class presence) | returned | MATCH |
| `total_frames`, `fps`, `duration_seconds` | VideoAnalytics, Timeline, FrameAnalysis, Player | returned | MATCH. However, FrameAnalysis steps `0..total_frames-1` as an index into the analysed-frames array, which is the indexing mismatch above. |
| `summary.total_objects`, `object_count_per_class`, `average_confidence_per_class` | VideoAnalytics, Timeline, Player, Comparison | returned | MATCH |
| `summary.unique_tracks` | VideoAnalytics, which falls back to the **hardcoded `4`** | not returned (no tracking) | **MISMATCH**. It shows an invented "4 IDs". |
| `average_confidence_per_class[cls] \|\| 0.9` | VideoAnalytics | returned | MATCH, but the `0.9` fallback invents a value for a missing class |
| `annotated_video_url` | type only; not rendered | backend returns `annotated_video_base64` instead | unused on both sides; see `return_video` above |
| `processing_time_ms` | VideoProcessor toast | returned (frontend overwrites it with wall-clock round-trip time) | MATCH (fine; the round trip is the more honest number for video) |
| `frames_analysed`, `frame_stride`, `model_name`, `peak_frame*` | not read | returned | Unused. `frames_analysed` should drive the "Processed N frames" toast, which currently says `total_frames`. |

**Progress.** `processVideo` only reports upload progress (0–50 %). The
backend is synchronous, so there's no honest progress after the upload.
This isn't a contract mismatch, but the UI shouldn't imply frame-level
progress.

---

## 5. `GET /api/health`, `GET /api/model-info`

| Endpoint | Frontend | Backend | Verdict |
|---|---|---|---|
| `/api/health` | not called. There's no backend status indicator anywhere. | returns status, device, model, GPU memory | MISSING on the frontend. With the fallback gone, a status pill is the quickest way to see "backend down" before uploading. |
| `/api/model-info` | not called. The model list and class names are hardcoded. | `current_model`, `available_classes`, `selectable_models` | MISSING on the frontend. The comparison and model pickers should be populated from here. |
| `/api/cache-stats`, `/api/cache-clear` | not called | exist | Unused. Fine (operator tools). |

---

## Summary

| # | Issue | Verdict | Planned side to change |
|---|---|---|---|
| A | Confidence slider never sent (image) | MISMATCH | Frontend: send `?confidence=` |
| B | `model_id` form field ignored; fictional model IDs and names shown as if they ran | MISMATCH | Frontend: drop the field, show `model_name` from the response, and use real models from `/api/model-info` |
| C | Annotated image is JPEG; the ZIP export corrupts it and downloads are mislabelled `.png` | MISMATCH | Frontend: derive the extension from the data URL |
| D | Mask/label/highlight toggles re-request and change nothing | MISSING | Frontend: remove the no-op toggles and turn highlight into a list filter |
| E | Badge colours ignore the backend's per-class `color` | MISMATCH | Frontend: prefer `color` from the response |
| F | Gallery/report record an un-applied threshold | MISMATCH | Frontend: record `confidence_threshold` from the response |
| G | Model comparison has no backend support | MISSING | Backend: `/api/compare` + registry (original brief Task 3) |
| H | Video options sent as ignored form fields; fps vs stride units | MISMATCH | Frontend: send `confidence`, `frame_stride`, `return_video=false` as query params; replace the fps control with stride |
| I | Video views expect tracked, normalised `boxes[]` per frame | MISMATCH / MISSING | Frontend: derive untracked boxes from `detections[*].bounding_boxes` (normalise by the video's dimensions); remove trajectory/track-ID claims. Tracking is a backend feature that doesn't exist. |
| J | Video frames indexed by array position, not frame number | MISMATCH | Frontend: look frames up by `frame_number` / timestamp |
| K | Hardcoded `unique_tracks \|\| 4` and confidence `\|\| 0.9` | MISMATCH | Frontend: show only what is returned |
| L | No health / model-info usage | MISSING | Frontend: status pill + model list from `/api/model-info` |
