/**
 * Node.js wrapper for Python PyMuPDF vector extraction script.
 * Calls scripts/parse-pdf-vector.py via child_process and returns parsed JSON.
 */
import { spawn } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

/** Vector hint data from PyMuPDF extraction */
export interface VectorHints {
  wallLines: {
    start: [number, number];
    end: [number, number];
    width: number;
    category: string;
    lengthM: number;
  }[];
  dimensionTexts: {
    text: string;
    value_mm: number;
    x: number;
    y: number;
  }[];
  allTexts: {
    text: string;
    x: number;
    y: number;
    fontSize: number;
  }[];
  pageSize: { width: number; height: number };
  scale: number;
  offset: { x: number; y: number };
}

export interface PyMuPDFResult {
  floorPlan: {
    totalArea: number;
    rooms: unknown[];
    walls: unknown[];
    doors: unknown[];
    windows: unknown[];
    fixtures: unknown[];
  };
  method: string;
  confidence: number;
  warnings: string[];
  stats: {
    total_lines: number;
    total_rects: number;
    total_texts: number;
    walls_merged: number;
    rooms_detected: number;
    scale_m_per_pt: number;
    width_distribution: Record<string, number>;
  };
  vectorHints: VectorHints;
}

// Python path candidates
const PYTHON_PATHS = [
  'C:\\Users\\User\\AppData\\Local\\Programs\\Python\\Python312\\python.exe',
  'python3',
  'python',
];

async function findPython(): Promise<string | null> {
  for (const py of PYTHON_PATHS) {
    try {
      const result = await new Promise<boolean>((resolve) => {
        const proc = spawn(py, ['--version'], { timeout: 5000 });
        proc.on('close', (code) => resolve(code === 0));
        proc.on('error', () => resolve(false));
      });
      if (result) return py;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Extract vector data from a PDF using PyMuPDF.
 * @param pdfBuffer - Raw PDF file buffer
 * @param knownArea - Known floor area in m² (optional, improves scale estimation)
 * @param pageNum - PDF page number (0-indexed)
 * @param timeoutMs - Timeout in ms (default 30s)
 * @returns PyMuPDFResult or null if extraction fails
 */
export async function extractPdfVectors(
  pdfBuffer: Buffer,
  knownArea?: number,
  pageNum: number = 0,
  timeoutMs: number = 30000
): Promise<PyMuPDFResult | null> {
  const pythonPath = await findPython();
  if (!pythonPath) {
    console.warn('[pymupdf] Python not found, skipping vector extraction');
    return null;
  }

  // Write PDF to temp file
  const tempPath = join(tmpdir(), `inpick-pdf-${Date.now()}.pdf`);
  try {
    await writeFile(tempPath, pdfBuffer);
  } catch (err) {
    console.warn('[pymupdf] Failed to write temp file:', err);
    return null;
  }

  // Resolve script path relative to project root
  const scriptPath = join(process.cwd(), 'scripts', 'parse-pdf-vector.py');

  const args = [scriptPath, tempPath, '--page', String(pageNum)];
  if (knownArea) {
    args.push('--known-area', String(knownArea));
  }

  try {
    const result = await new Promise<string>((resolve, reject) => {
      let stdout = '';
      let stderr = '';

      const proc = spawn(pythonPath, args, {
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
          console.log('[pymupdf]', stderr.trim());
        }
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Python exited with code ${code}: ${stderr}`));
        }
      });

      proc.on('error', (err) => {
        reject(err);
      });
    });

    const parsed = JSON.parse(result) as PyMuPDFResult;
    return parsed;
  } catch (err) {
    console.warn('[pymupdf] Extraction failed:', err instanceof Error ? err.message : err);
    return null;
  } finally {
    // Clean up temp file
    try {
      await unlink(tempPath);
    } catch {
      // ignore cleanup errors
    }
  }
}
