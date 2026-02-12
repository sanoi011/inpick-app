import { getGeminiClient } from "./gemini-client";

const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMENSIONS = 768;

/**
 * 단일 텍스트의 벡터 임베딩 생성
 * Gemini 미설정 시 null 반환
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  const client = getGeminiClient();
  if (!client) return null;

  try {
    const result = await client.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: text,
      config: { outputDimensionality: EMBEDDING_DIMENSIONS },
    });
    return result.embeddings?.[0]?.values || null;
  } catch (err) {
    console.error("Embedding generation error:", err);
    return null;
  }
}

/**
 * 여러 텍스트의 벡터 임베딩 배치 생성
 * 개별 실패 시 해당 항목만 null
 */
export async function generateEmbeddings(
  texts: string[]
): Promise<(number[] | null)[]> {
  const client = getGeminiClient();
  if (!client) return texts.map(() => null);

  const results: (number[] | null)[] = [];
  for (const text of texts) {
    try {
      const result = await client.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: text,
        config: { outputDimensionality: EMBEDDING_DIMENSIONS },
      });
      results.push(result.embeddings?.[0]?.values || null);
    } catch {
      results.push(null);
    }
  }
  return results;
}
