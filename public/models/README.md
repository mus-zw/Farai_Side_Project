# In-browser detection models

`/demo` → "In this browser" loads ONNX files from this folder. Only `yolo11n.onnx`
(640×640, about 10.7 MB) is committed; the rest are optional. If you pick a model
or size whose file is missing, the page falls back to `yolo11n.onnx` at 640 and
says so.

| File                | Model   | Input   | Approx. size (fp32) |
| ------------------- | ------- | ------- | ------------------- |
| `yolo11n.onnx`      | YOLO11n | 640×640 | 11 MB (committed)   |
| `yolo11s.onnx`      | YOLO11s | 640×640 | 38 MB               |
| `yolo11m.onnx`      | YOLO11m | 640×640 | 80 MB               |
| `yolo11n-960.onnx`  | YOLO11n | 960×960 | 11 MB               |
| `yolo11s-960.onnx`  | YOLO11s | 960×960 | 38 MB               |
| `yolo11m-960.onnx`  | YOLO11m | 960×960 | 80 MB               |

The input size is baked into each file, so **a 960 input needs a model exported
at 960** (the 640 file cannot be fed 960 pixels). Export with Ultralytics, then
copy and rename the result into this folder:

```bash
pip install ultralytics onnx onnxsim
yolo export model=yolo11s.pt format=onnx imgsz=640 opset=17 simplify=True   # -> yolo11s.onnx
yolo export model=yolo11s.pt format=onnx imgsz=960 opset=17 simplify=True   # -> rename to yolo11s-960.onnx
```

Requirements the loader checks: static shapes, input `[1, 3, S, S]`, output
`[1, 84, N]` with N = 8400 at 640 or 18900 at 960 (the 80 COCO classes, no NMS
in the graph). Do not export with `dynamic=True`, `half=True` or `nms=True`.

Notes: larger models and 960 are much slower, especially on the WASM (CPU)
fallback, and every model is a one-time download the browser then caches.
Committing the larger files makes the repo and the deployed site heavier; Vercel
serves them statically. Only the model the visitor picks is downloaded.

## Custom-class models (e.g. the single-class penguin detector)

The decoder reads the class count from the ONNX output (`1 x (4 + numClasses) x N`),
so a model with its own classes works without code changes. A single-class model
outputs `1x5x8400` at 640. Class names come from the catalog entry in
`src/utils/browserModels.ts` (`penguin` → `['penguin']`); if the count and the list
disagree the page shows `class_0`, `class_1`, … instead of wrong names.

To add a fine-tuned penguin checkpoint:

```bash
# After training with Ultralytics (nc: 1, names: [penguin]):
yolo export model=runs/detect/train/weights/best.pt format=onnx imgsz=640 opset=17 simplify=True
cp runs/detect/train/weights/best.onnx public/models/penguin.onnx
# optional 960 variant, trained/exported at 960:
#   yolo export model=best.pt format=onnx imgsz=960 opset=17 simplify=True  ->  public/models/penguin-960.onnx
```

Then pick "Penguin (custom, 1 class)" on `/demo` → In this browser. The file must be
a static-shape export (no `dynamic`, `half` or `nms`) at the chosen size. For another
custom model, add an entry to `BROWSER_MODELS` with its `id` (the file prefix) and
`classNames`, and extend `BrowserModelId`.

## Exporting labels for review and retraining

In browser mode, **Export YOLO Labels (.txt)** (under the image, or beside the video
while paused) downloads one line per box at the current confidence:
`class_id x_center y_center width height`, all normalised 0–1. Save it next to the
image with the same base name (`photo.jpg` → `photo.txt`) and add a `classes.txt` /
dataset YAML listing the names in id order, then correct the boxes in a labelling tool.
