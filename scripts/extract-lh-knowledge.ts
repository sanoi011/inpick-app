/**
 * LH 표준시방 + 설비 도면 PDF → construction_knowledge 테이블 추출 스크립트
 *
 * 실행: npx tsx scripts/extract-lh-knowledge.ts
 *
 * - pdf-parse로 텍스트 추출
 * - 페이지별 청크 분할 → Supabase construction_knowledge INSERT
 * - 스캔 PDF는 텍스트 추출 불가 (빈 텍스트 → 스킵)
 */

import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

// .env.local에서 환경변수 로드
function loadEnv() {
  const envPath = path.resolve(__dirname, "../.env.local");
  if (!fs.existsSync(envPath)) {
    console.error(".env.local 파일이 없습니다.");
    process.exit(1);
  }
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// PDF 파일 목록
interface PdfSource {
  filePath: string;
  sourceType: string;
  category: string;
}

const PDF_SOURCES: PdfSource[] = [
  {
    filePath: "reference/LH 표준시방/2022 경기도 공동주택 품질점검 사례집.pdf",
    sourceType: "lh_standard",
    category: "품질",
  },
  {
    filePath: "reference/LH 표준시방/2022 공동주택 공종별 핸드북(건축).pdf",
    sourceType: "lh_standard",
    category: "건축",
  },
  {
    filePath: "reference/LH 표준시방/시공한계 지침서 Rev2.pdf",
    sourceType: "lh_standard",
    category: "건축",
  },
  {
    filePath: "reference/LH 표준시방/표준상세도(건축)_2022.06(완료).pdf",
    sourceType: "lh_standard",
    category: "건축",
  },
  {
    filePath: "drawings/설비 참고 도면/250425_아산탕정_기계-준공도면 PDF.pdf",
    sourceType: "equipment_drawing",
    category: "기계",
  },
];

// PostgreSQL 호환되지 않는 유니코드 제거 (null bytes 등)
function sanitizeText(text: string): string {
  return text
    .replace(/\x00/g, "")
    .replace(/\\u0000/g, "")
    .replace(/[\uFFFE\uFFFF]/g, "")
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F]/g, " ");
}

// 텍스트 청크 분할 (최대 2000자)
const MAX_CHUNK_SIZE = 2000;

function splitIntoChunks(text: string): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n{2,}/);
  let current = "";

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    if (current.length + trimmed.length + 2 > MAX_CHUNK_SIZE) {
      if (current) chunks.push(current.trim());
      current = trimmed;
    } else {
      current += (current ? "\n\n" : "") + trimmed;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  return chunks;
}

// 키워드 추출 (간단한 한글/영문 명사 추출)
function extractKeywords(text: string): string[] {
  const words = text.match(/[가-힣]{2,}|[A-Z][a-zA-Z]{2,}/g) || [];
  const freq = new Map<string, number>();
  for (const w of words) {
    freq.set(w, (freq.get(w) || 0) + 1);
  }
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

// 제목 추출 (첫 줄에서)
function extractTitle(chunk: string): string {
  const firstLine = chunk.split("\n")[0].trim();
  return firstLine.length > 100 ? firstLine.slice(0, 100) + "..." : firstLine;
}

async function processPdf(source: PdfSource) {
  const fullPath = path.resolve(__dirname, "..", source.filePath);
  const fileName = path.basename(source.filePath);

  console.log(`\n📄 Processing: ${fileName}`);

  if (!fs.existsSync(fullPath)) {
    console.log(`  ❌ 파일 없음: ${fullPath}`);
    return { inserted: 0, skipped: true };
  }

  // pdf-parse는 CommonJS 모듈 - 직접 lib 경로 사용 (index.js의 테스트 코드 회피)
  const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;

  try {
    const buffer = fs.readFileSync(fullPath);
    const data = await pdfParse(buffer);

    console.log(`  📊 페이지 수: ${data.numpages}, 텍스트 길이: ${data.text.length}자`);

    if (data.text.length < 100) {
      console.log(`  ⚠️  텍스트 부족 (스캔 PDF일 수 있음) → 스킵`);
      return { inserted: 0, skipped: true };
    }

    // 텍스트 정제 → 청크 분할
    const cleanText = sanitizeText(data.text);
    const chunks = splitIntoChunks(cleanText);
    console.log(`  📝 청크 수: ${chunks.length}`);

    let inserted = 0;

    // 배치 INSERT (50개씩)
    for (let i = 0; i < chunks.length; i += 50) {
      const batch = chunks.slice(i, i + 50).map((chunk, idx) => ({
        source_type: source.sourceType,
        source_file: fileName,
        source_page: null,
        title: extractTitle(chunk),
        content: chunk,
        category: source.category,
        subcategory: null,
        keywords: extractKeywords(chunk),
        chunk_index: i + idx,
        total_chunks: chunks.length,
      }));

      const { error } = await supabase
        .from("construction_knowledge")
        .insert(batch);

      if (error) {
        console.error(`  ❌ INSERT 에러 (batch ${i}):`, error.message);
      } else {
        inserted += batch.length;
      }
    }

    console.log(`  ✅ ${inserted}개 청크 저장 완료`);
    return { inserted, skipped: false };
  } catch (err) {
    console.error(`  ❌ PDF 파싱 에러:`, err instanceof Error ? err.message : err);
    return { inserted: 0, skipped: true };
  }
}

async function main() {
  console.log("🚀 LH 표준시방 + 설비 도면 PDF 학습 시작");
  console.log(`   Supabase: ${supabaseUrl}`);
  console.log(`   PDF 수: ${PDF_SOURCES.length}개\n`);

  let totalInserted = 0;
  let totalSkipped = 0;

  for (const source of PDF_SOURCES) {
    const result = await processPdf(source);
    totalInserted += result.inserted;
    if (result.skipped) totalSkipped++;
  }

  console.log(`\n📊 최종 결과:`);
  console.log(`   삽입: ${totalInserted}개 청크`);
  console.log(`   스킵: ${totalSkipped}개 파일`);
  console.log(`\n✅ 완료`);
}

main().catch(console.error);
