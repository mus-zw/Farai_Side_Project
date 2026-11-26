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
