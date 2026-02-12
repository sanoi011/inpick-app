// src/lib/services/yolo-floorplan-detector.ts
// 브라우저에서 ONNX Runtime Web으로 도면 심볼 감지

export interface Detection {
  class: string;
  classId: number;
  confidence: number;
  bbox: { x: number; y: number; w: number; h: number }; // normalized 0-1
}

const CLASS_NAMES = [
  "door_swing",
  "door_sliding",
  "window",
  "toilet",
  "sink",
  "kitchen_sink",
  "bathtub",
  "stove",
] as const;

const MODEL_URL = "/models/floorplan-yolo.onnx";
const INPUT_SIZE = 640;
const CONF_THRESHOLD = 0.25;
const IOU_THRESHOLD = 0.45;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let session: any = null;
let loading = false;

/**
 * ONNX 모델 로드 (최초 1회, IndexedDB 캐시)
 */
export async function loadModel(): Promise<boolean> {
  if (session) return true;
  if (loading) {
    // 다른 호출이 로딩 중이면 대기
    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (!loading) { clearInterval(check); resolve(); }
      }, 100);
    });
    return !!session;
  }

  loading = true;
  try {
    const ort = await import("onnxruntime-web");

    // WebGPU 우선, WASM 폴백
    ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options: any = {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "all",
    };

    // 모델 파일 존재 확인
    const res = await fetch(MODEL_URL, { method: "HEAD" });
    if (!res.ok) {
      console.warn("[yolo-detector] Model not found at", MODEL_URL);
      loading = false;
      return false;
    }

    session = await ort.InferenceSession.create(MODEL_URL, options);
    console.log("[yolo-detector] Model loaded successfully");
    loading = false;
    return true;
  } catch (err) {
    console.error("[yolo-detector] Failed to load model:", err);
    loading = false;
    return false;
  }
}

/**
 * 모델이 로드되어 있는지 확인
 */
export function isModelLoaded(): boolean {
  return !!session;
}

/**
 * 이미지에서 심볼 감지 실행
 */
export async function detect(imageData: ImageData | HTMLCanvasElement | HTMLImageElement): Promise<Detection[]> {
  if (!session) {
    const loaded = await loadModel();
    if (!loaded) return [];
  }

  const ort = await import("onnxruntime-web");

  // 이미지 → canvas → tensor
  const canvas = document.createElement("canvas");
  canvas.width = INPUT_SIZE;
  canvas.height = INPUT_SIZE;
  const ctx = canvas.getContext("2d")!;

  if (imageData instanceof ImageData) {
    const tmpCanvas = document.createElement("canvas");
    tmpCanvas.width = imageData.width;
    tmpCanvas.height = imageData.height;
    tmpCanvas.getContext("2d")!.putImageData(imageData, 0, 0);
    ctx.drawImage(tmpCanvas, 0, 0, INPUT_SIZE, INPUT_SIZE);
  } else {
    ctx.drawImage(imageData, 0, 0, INPUT_SIZE, INPUT_SIZE);
  }

  const imgData = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);

  // HWC → CHW, normalize 0-1
  const inputData = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE);
  for (let i = 0; i < INPUT_SIZE * INPUT_SIZE; i++) {
    inputData[i] = imgData.data[i * 4] / 255.0;                    // R
    inputData[INPUT_SIZE * INPUT_SIZE + i] = imgData.data[i * 4 + 1] / 255.0; // G
    inputData[2 * INPUT_SIZE * INPUT_SIZE + i] = imgData.data[i * 4 + 2] / 255.0; // B
  }

  const inputTensor = new ort.Tensor("float32", inputData, [1, 3, INPUT_SIZE, INPUT_SIZE]);

  // 추론
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const feeds: Record<string, any> = {};
  const inputName = session.inputNames[0] || "images";
  feeds[inputName] = inputTensor;

  const results = await session.run(feeds);
  const outputName = session.outputNames[0] || "output0";
  const output = results[outputName];

  // YOLOv8 output: [1, 8+4, num_detections] → transpose → [num_detections, 12]
  // 4 = cx, cy, w, h (normalized)
  // 8 = class confidences
  const detections = parseYOLOv8Output(output.data as Float32Array, output.dims as number[]);

  // NMS
  const nmsResults = nonMaxSuppression(detections, IOU_THRESHOLD);

  return nmsResults;
}

function parseYOLOv8Output(data: Float32Array, dims: number[]): Detection[] {
  const detections: Detection[] = [];

  // YOLOv8 output shape: [1, num_classes+4, num_boxes]
  // dims = [1, 12, 8400] for 8 classes
  if (dims.length !== 3) return detections;

  const numFeatures = dims[1]; // 4 + num_classes
  const numBoxes = dims[2];
  const numClasses = numFeatures - 4;

  for (let i = 0; i < numBoxes; i++) {
    const cx = data[0 * numBoxes + i];
    const cy = data[1 * numBoxes + i];
    const w = data[2 * numBoxes + i];
    const h = data[3 * numBoxes + i];

    // 최대 클래스 confidence 찾기
    let maxConf = 0;
    let maxCls = 0;
    for (let c = 0; c < numClasses; c++) {
      const conf = data[(4 + c) * numBoxes + i];
      if (conf > maxConf) {
        maxConf = conf;
        maxCls = c;
      }
    }

    if (maxConf < CONF_THRESHOLD) continue;

    detections.push({
      class: CLASS_NAMES[maxCls] || `class_${maxCls}`,
      classId: maxCls,
      confidence: maxConf,
      bbox: {
        x: (cx - w / 2) / INPUT_SIZE,
        y: (cy - h / 2) / INPUT_SIZE,
        w: w / INPUT_SIZE,
        h: h / INPUT_SIZE,
      },
    });
  }

  return detections;
}

function nonMaxSuppression(detections: Detection[], iouThreshold: number): Detection[] {
  // Sort by confidence descending
  const sorted = [...detections].sort((a, b) => b.confidence - a.confidence);
  const kept: Detection[] = [];

  const suppressed = new Set<number>();

  for (let i = 0; i < sorted.length; i++) {
    if (suppressed.has(i)) continue;
    kept.push(sorted[i]);

    for (let j = i + 1; j < sorted.length; j++) {
      if (suppressed.has(j)) continue;
      if (sorted[i].classId !== sorted[j].classId) continue;

      const iou = computeIoU(sorted[i].bbox, sorted[j].bbox);
      if (iou > iouThreshold) {
        suppressed.add(j);
      }
    }
  }

  return kept;
}

function computeIoU(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number }
): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);

  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const areaA = a.w * a.h;
  const areaB = b.w * b.h;
  const union = areaA + areaB - intersection;

  return union > 0 ? intersection / union : 0;
}
