import { getOpenAIClient } from "./openai-client";

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 768;

/**
 * 단일 텍스트의 벡터 임베딩 생성
 * OpenAI 미설정 시 null 반환
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  const client = getOpenAIClient();
  if (!client) return null;

  try {
    const result = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
      dimensions: EMBEDDING_DIMENSIONS,
    });
    return result.data[0]?.embedding || null;
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
  const client = getOpenAIClient();
  if (!client) return texts.map(() => null);

  try {
    // OpenAI는 배치 입력을 지원
    const result = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: texts,
      dimensions: EMBEDDING_DIMENSIONS,
    });
    return texts.map((_, i) => result.data[i]?.embedding || null);
  } catch {
    // 배치 실패 시 개별 처리
    const results: (number[] | null)[] = [];
    for (const text of texts) {
      try {
        const result = await client.embeddings.create({
          model: EMBEDDING_MODEL,
          input: text,
          dimensions: EMBEDDING_DIMENSIONS,
        });
        results.push(result.data[0]?.embedding || null);
      } catch {
        results.push(null);
      }
    }
    return results;
  }
}
