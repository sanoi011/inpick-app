/**
 * construction_knowledge 테이블의 기존 데이터에 벡터 임베딩 생성
 *
 * 실행: npx tsx scripts/embed-knowledge.ts
 *
 * 사전 조건:
 * 1. .env.local에 GOOGLE_GEMINI_API_KEY 설정
 * 2. Supabase에 20260215000000_vector_embeddings.sql 마이그레이션 적용
 */

import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";
import * as dotenv from "dotenv";
import * as path from "path";

// .env.local 로드
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const GEMINI_KEY = process.env.GOOGLE_GEMINI_API_KEY!;

const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMENSIONS = 768;
const BATCH_SIZE = 10;
const DELAY_MS = 500; // API rate limit 대응

async function main() {
  if (!GEMINI_KEY) {
    console.error("❌ GOOGLE_GEMINI_API_KEY가 설정되지 않았습니다.");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const genai = new GoogleGenAI({ apiKey: GEMINI_KEY });

  // 임베딩 없는 행 조회
  const { data: rows, error } = await supabase
    .from("construction_knowledge")
    .select("id, title, content")
    .is("embedding", null)
    .order("chunk_index", { ascending: true });

  if (error) {
    console.error("❌ DB 조회 실패:", error.message);
    process.exit(1);
  }

  if (!rows || rows.length === 0) {
    console.log("✅ 모든 행에 임베딩이 이미 존재합니다.");
    return;
  }

  console.log(`\n── ${rows.length}개 행에 임베딩 생성 시작 ──\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    for (const row of batch) {
      const text = `${row.title || ""}\n${row.content}`.trim();

      try {
        const result = await genai.models.embedContent({
          model: EMBEDDING_MODEL,
          contents: text.slice(0, 4000), // 모델 입력 제한
          config: { outputDimensionality: EMBEDDING_DIMENSIONS },
        });

        const embedding = result.embeddings?.[0]?.values;
        if (!embedding) {
          console.log(`  ⚠ ${row.id}: 임베딩 없음, 스킵`);
          failed++;
          continue;
        }

        // Supabase에 저장
        const { error: updateError } = await supabase
          .from("construction_knowledge")
          .update({ embedding: JSON.stringify(embedding) })
          .eq("id", row.id);

        if (updateError) {
          console.log(`  ✗ ${row.id}: DB 저장 실패 - ${updateError.message}`);
          failed++;
        } else {
          success++;
        }
      } catch (err: unknown) {
        const error = err as { message?: string };
        console.log(`  ✗ ${row.id}: ${error.message || "알 수 없는 오류"}`);
        failed++;
      }
    }

    // 진행률 출력
    const processed = Math.min(i + BATCH_SIZE, rows.length);
    console.log(
      `  [${processed}/${rows.length}] 성공: ${success}, 실패: ${failed}`
    );

    // Rate limit 대응 딜레이
    if (i + BATCH_SIZE < rows.length) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  console.log(`\n✅ 완료! 성공: ${success}, 실패: ${failed}, 전체: ${rows.length}`);
}

main().catch(console.error);
