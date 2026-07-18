/**
 * floorplan-ai Python 파이프라인 클라이언트
 *
 * 호출 우선순위:
 * 1. FLOORPLAN_AI_URL 환경변수 → HTTP POST (FastAPI 서버)
 * 2. PDF_PARSER_V47_URL → v4.7 services/pdf_parser 서버
 * 3. 폴백: child_process로 run_pipeline.py 실행
 * 4. 둘 다 실패 → null (graceful)
 */
import { spawn } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

// Python floorplan-ai 파이프라인 원시 출력 타입 (v4.6 legacy)
export interface FloorplanAIResult {
  vector_data: {
    version: string;
    unit: string;
    scale_factor: number;
    canvas: { width: number; height: number };
    walls: {
      type: string;
      start: { x: number; y: number };
      end: { x: number; y: number };
      thickness: number;
      orientation: string;
      length_mm: number;
    }[];
    rooms: {
      type: string;
      name: string | null;
      vertices: { x: number; y: number }[];
      center: { x: number; y: number };
      area_mm2: number;
      area_m2: number;
    }[];
    symbols: {
      type: string;
      type_ko: string;
      confidence: number;
      bbox: { x1: number; y1: number; x2: number; y2: number };
      center: { x: number; y: number };
    }[];
    texts: {
      text: string;
      confidence: number;
      bbox: { x1: number; y1: number; x2: number; y2: number };
      category: string;
    }[];
  };
  timing: Record<string, number>;
  summary: {
    symbols: number;
    texts: number;
    walls: number;
    rooms: number;
  };
}

// v4.7 services/pdf_parser 출력 타입
export interface PdfParserV47Result {
  success: boolean;
  project: {
    meta: {
      version: string;
      input_type: string;
      dpi: number;
      page_size: [number, number];
      mm_per_px: number | null;
      scale_method: string;
      scale_status: string;
      degraded?: boolean;
    };
    walls: {
      id: string;
      x0_mm: number;
      y0_mm: number;
      x1_mm: number;
      y1_mm: number;
      thickness_mm: number;
      lenMm: number;
    }[];
    rooms: {
      id: string;
      name: string;
      type: string;
      center_px: [number, number];
      area_m2: number;
    }[];
    openings: {
      id: string;
      type: string;
      x0: number;
      y0: number;
      x1: number;
      y1: number;
      widthMm: number;
    }[];
    opening_subtypes: {
      id: string;
      base_type: string;
      subtype: string;
      confidence: number;
      reasoning: string;
    }[];
    ocr_words: {
      text: string;
      conf: number;
      bbox: [number, number, number, number];
    }[];
  };
  scale: {
    mm_per_px: number | null;
    method: string;
    status: string;
  };
  opening_subtypes: {
    id: string;
    base_type: string;
    subtype: string;
    confidence: number;
  }[];
  timing: Record<string, number>;
  warnings: string[];
  processingTimeMs: number;
  error?: string;
}

// Union type for either response format
export type FloorplanAIResponse =
  | { format: 'legacy'; data: FloorplanAIResult }
  | { format: 'v47'; data: PdfParserV47Result };

const FLOORPLAN_AI_URL = process.env.FLOORPLAN_AI_URL;
const PDF_PARSER_V47_URL = process.env.PDF_PARSER_V47_URL;

const PYTHON_PATHS = [
  'C:\\Users\\User\\AppData\\Local\\Programs\\Python\\Python312\\python.exe',
  'python3',
  'python',
];

async function findPython(): Promise<string | null> {
  for (const py of PYTHON_PATHS) {
    try {
      const ok = await new Promise<boolean>((resolve) => {
        const proc = spawn(py, ['--version'], { timeout: 5000 });
        proc.on('close', (code) => resolve(code === 0));
        proc.on('error', () => resolve(false));
      });
      if (ok) return py;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * FastAPI 서버로 HTTP 호출
 */
async function callViaHttp(
  imageBuffer: Buffer,
  filename: string,
  timeoutMs = 45000,
): Promise<FloorplanAIResult | null> {
  if (!FLOORPLAN_AI_URL) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(imageBuffer)]);
    formData.append('file', blob, filename);

    const response = await fetch(`${FLOORPLAN_AI_URL}/api/v1/recognize`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn(`[floorplan-ai] HTTP ${response.status}: ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    return data as FloorplanAIResult;
  } catch (err) {
    console.warn('[floorplan-ai] HTTP call failed:', err instanceof Error ? err.message : err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * child_process로 Python 직접 실행 (폴백)
 */
async function callViaChildProcess(
  imageBuffer: Buffer,
  filename: string,
  timeoutMs = 60000,
): Promise<FloorplanAIResult | null> {
  const pythonPath = await findPython();
  if (!pythonPath) {
    console.warn('[floorplan-ai] Python not found, skipping');
    return null;
  }

  // 임시 파일에 이미지 저장
  const ext = filename.split('.').pop() || 'png';
  const tempPath = join(tmpdir(), `inpick-ai-${Date.now()}.${ext}`);

  try {
    await writeFile(tempPath, imageBuffer);
  } catch (err) {
    console.warn('[floorplan-ai] Failed to write temp file:', err);
    return null;
  }

  const scriptPath = join(process.cwd(), 'python', 'floorplan-ai', 'run_pipeline.py');

  try {
    const result = await new Promise<string>((resolve, reject) => {
      let stdout = '';
      let stderr = '';

      const proc = spawn(pythonPath, [scriptPath, tempPath], {
        timeout: timeoutMs,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      });

      proc.stdout.on('data', (data: Buffer) => {
        stdout += data.toString('utf-8');
      });

      proc.stderr.on('data', (data: Buffer) => {
        stderr += data.toString('utf-8');
      });

      proc.on('close', (code) => {
        if (stderr) {
          console.log('[floorplan-ai]', stderr.trim().slice(0, 500));
        }
        if (code === 0 && stdout.trim()) {
          resolve(stdout);
        } else {
          reject(new Error(`Python exited with code ${code}`));
        }
      });

      proc.on('error', (err) => reject(err));
    });

    return JSON.parse(result) as FloorplanAIResult;
  } catch (err) {
    console.warn('[floorplan-ai] child_process failed:', err instanceof Error ? err.message : err);
    return null;
  } finally {
    try { await unlink(tempPath); } catch { /* ignore */ }
  }
}

/**
 * v4.7 services/pdf_parser HTTP 호출
 */
async function callViaV47Http(
  imageBuffer: Buffer,
  filename: string,
  timeoutMs = 45000,
): Promise<PdfParserV47Result | null> {
  if (!PDF_PARSER_V47_URL) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(imageBuffer)]);
    formData.append('file', blob, filename);

    const response = await fetch(`${PDF_PARSER_V47_URL}/api/v1/recognize`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn(`[pdf-parser-v47] HTTP ${response.status}: ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    // v4.7 응답에는 "project" 필드가 있음
    if (data.project && data.success !== undefined) {
      return data as PdfParserV47Result;
    }
    return null;
  } catch (err) {
    console.warn('[pdf-parser-v47] HTTP call failed:', err instanceof Error ? err.message : err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * floorplan-ai 파이프라인 호출 (HTTP 우선, child_process 폴백)
 * 실패 시 null 반환 (graceful degradation)
 */
export async function callFloorplanAI(
  imageBuffer: Buffer,
  filename: string,
  timeoutMs = 45000,
): Promise<FloorplanAIResult | null> {
  // 1. HTTP 서버 시도
  const httpResult = await callViaHttp(imageBuffer, filename, timeoutMs);
  if (httpResult) {
    console.log('[floorplan-ai] HTTP call succeeded');
    return httpResult;
  }

  // 2. child_process 폴백
  console.log('[floorplan-ai] Trying child_process fallback...');
  return callViaChildProcess(imageBuffer, filename, timeoutMs);
}

/**
 * v4.7 PDF Parser 호출
 * PDF_PARSER_V47_URL 환경변수 설정 필요 (예: http://localhost:8101)
 */
export async function callPdfParserV47(
  imageBuffer: Buffer,
  filename: string,
  timeoutMs = 45000,
): Promise<PdfParserV47Result | null> {
  const result = await callViaV47Http(imageBuffer, filename, timeoutMs);
  if (result) {
    console.log(`[pdf-parser-v47] Success: ${result.project.rooms.length} rooms, ${result.project.walls.length} walls`);
  }
  return result;
}

/**
 * 두 서비스 모두 호출 (가용한 서비스만)
 * 반환: legacy FloorplanAIResult 또는 v4.7 PdfParserV47Result
 */
export async function callFloorplanAIAny(
  imageBuffer: Buffer,
  filename: string,
  timeoutMs = 45000,
): Promise<FloorplanAIResponse | null> {
  // v4.7 우선 시도 (더 완전한 파이프라인)
  if (PDF_PARSER_V47_URL) {
    const v47 = await callViaV47Http(imageBuffer, filename, timeoutMs);
    if (v47 && v47.success) {
      console.log('[floorplan-ai] v4.7 call succeeded');
      return { format: 'v47', data: v47 };
    }
  }

  // 기존 서비스 폴백
  const legacy = await callFloorplanAI(imageBuffer, filename, timeoutMs);
  if (legacy) {
    return { format: 'legacy', data: legacy };
  }

  return null;
}
