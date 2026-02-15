/**
 * floorplan-ai Python 파이프라인 클라이언트
 *
 * 호출 우선순위:
 * 1. FLOORPLAN_AI_URL 환경변수 → HTTP POST (FastAPI 서버)
 * 2. 폴백: child_process로 run_pipeline.py 실행
 * 3. 둘 다 실패 → null (graceful)
 */
import { spawn } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

// Python floorplan-ai 파이프라인 원시 출력 타입
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

const FLOORPLAN_AI_URL = process.env.FLOORPLAN_AI_URL;

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
): Promise<FloorplanAIResult | null> {
  if (!FLOORPLAN_AI_URL) return null;

  try {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(imageBuffer)]);
    formData.append('file', blob, filename);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);

    const response = await fetch(`${FLOORPLAN_AI_URL}/api/v1/recognize`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(`[floorplan-ai] HTTP ${response.status}: ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    return data as FloorplanAIResult;
  } catch (err) {
    console.warn('[floorplan-ai] HTTP call failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * child_process로 Python 직접 실행 (폴백)
 */
async function callViaChildProcess(
  imageBuffer: Buffer,
  filename: string,
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
        timeout: 60000,
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
 * floorplan-ai 파이프라인 호출 (HTTP 우선, child_process 폴백)
 * 실패 시 null 반환 (graceful degradation)
 */
export async function callFloorplanAI(
  imageBuffer: Buffer,
  filename: string,
): Promise<FloorplanAIResult | null> {
  // 1. HTTP 서버 시도
  const httpResult = await callViaHttp(imageBuffer, filename);
  if (httpResult) {
    console.log('[floorplan-ai] HTTP call succeeded');
    return httpResult;
  }

  // 2. child_process 폴백
  console.log('[floorplan-ai] Trying child_process fallback...');
  return callViaChildProcess(imageBuffer, filename);
}
