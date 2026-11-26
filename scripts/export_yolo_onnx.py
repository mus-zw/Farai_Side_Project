#!/usr/bin/env python3
"""
Export an Ultralytics YOLO detection model to the fixed-size ONNX file that the
in-browser demo loads, and regenerate the class-name list from the model itself.

    pip install ultralytics onnx
    python scripts/export_yolo_onnx.py yolo11n.pt

Writes (paths are the defaults the app expects):
    public/models/yolo11n.onnx     input  images  float32 [1, 3, 640, 640]
                                   output output0 float32 [1, 84, 8400]
    src/utils/cocoClasses.ts       class names in the model's own order

The export is checked before anything is written: if the tensor shapes are not
the ones src/utils/onnxDetect.ts decodes, the script stops. A different model
size (yolo11s.pt, ...) exports the same shapes and works unchanged; a
segmentation, pose or NMS-free model does not.

Note: Ultralytics YOLO weights are AGPL-3.0, and so is the ONNX file made from them.
"""

from __future__ import annotations

import argparse
import ast
import functools
import json
import shutil
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INPUT_SHAPE = [1, 3, 640, 640]
OUTPUT_SHAPE = [1, 84, 8400]


def shape(tensor) -> list:
    return [d.dim_value for d in tensor.type.tensor_type.shape.dim]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("weights", help="Ultralytics detect weights, e.g. yolo11n.pt")
    ap.add_argument("--out-model", type=Path, default=ROOT / "public" / "models" / "yolo11n.onnx")
    ap.add_argument("--out-classes", type=Path, default=ROOT / "src" / "utils" / "cocoClasses.ts")
    ap.add_argument("--opset", type=int, default=17)
    args = ap.parse_args()

    import onnx
    import torch
    from ultralytics import YOLO

    # torch >= 2.9 defaults torch.onnx.export to the dynamo exporter (needs
    # onnxscript); Ultralytics targets the classic exporter, so ask for it.
    torch.onnx.export = functools.partial(torch.onnx.export, dynamo=False)

    model = YOLO(args.weights)
    if model.task != "detect":
        print(f"error: {args.weights} is a '{model.task}' model; the demo decodes plain detection output only.", file=sys.stderr)
        return 1

    with tempfile.TemporaryDirectory() as tmp:
        # Export next to a copy of the weights so nothing lands beside the original.
        work = Path(tmp) / Path(args.weights).name
        shutil.copy(args.weights, work)
        exported = Path(YOLO(str(work)).export(format="onnx", imgsz=640, opset=args.opset, simplify=False, dynamic=False, half=False, nms=False, batch=1))

        graph = onnx.load(str(exported))
        got_in, got_out = shape(graph.graph.input[0]), shape(graph.graph.output[0])
        if got_in != INPUT_SHAPE or got_out != OUTPUT_SHAPE:
            print(f"error: exported tensors are {got_in} -> {got_out}; expected {INPUT_SHAPE} -> {OUTPUT_SHAPE}.", file=sys.stderr)
            return 1

        names = ast.literal_eval({p.key: p.value for p in graph.metadata_props}["names"])
        if list(names) != list(range(len(names))) or len(names) != 80:
            print(f"error: expected 80 classes numbered 0-79, got {len(names)}.", file=sys.stderr)
            return 1

        args.out_model.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(exported, args.out_model)

    ts = (
        "// COCO class names in the order the YOLO11 ONNX model outputs them (index = class id).\n"
        "// Generated from the exported model's own metadata (`names`), not typed by hand.\n"
        "export const COCO_CLASSES: readonly string[] = [\n"
        + "".join(f"  {json.dumps(names[i])},\n" for i in range(len(names)))
        + "];\n"
    )
    args.out_classes.write_text(ts)

    print(f"model:   {args.out_model} ({args.out_model.stat().st_size / 1e6:.1f} MB)  {got_in} -> {got_out}  opset {args.opset}")
    print(f"classes: {args.out_classes} ({len(names)} names)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
