// VSMCS Multi-Modal Query Fusion + Off-Domain Emotion Extraction
// (Patent B Detail D7 + D8)

import { embedText } from "./vision-embeddings";

const GEMINI_KEY = process.env.GOOGLE_GEMINI_API_KEY!;
const VISION_MODEL = "gemini-2.5-flash";

export type DomainType = "INTERIOR" | "NATURE" | "ART" | "OTHER";

export interface ImageAnalysis {
  domain: DomainType;
  description: string;
  emotion_keywords: string[];
  dominant_colors: string[];
}

/** D8 Step 1+2: 이미지를 Gemini Vision 으로 분석 → 도메인·감성 추출 */
export async function analyzeImage(imageBase64: string, mimeType = "image/jpeg"): Promise<ImageAnalysis> {
  const prompt = `이 이미지를 분석해서 다음 JSON 으로만 응답하세요:
{
  "domain": "INTERIOR|NATURE|ART|OTHER",   // 인테리어 사진/자연 풍경/예술 작품/기타
  "description": "이미지의 시각적 특징과 감성을 한국어 2-3문장으로",
  "emotion_keywords": ["은은함","차분함","여백미"],  // 한국 미감 토큰 우선
  "dominant_colors": ["#RRGGBB","#RRGGBB","#RRGGBB"]
}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${VISION_MODEL}:generateContent?key=${GEMINI_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [
          { inline_data: { mime_type: mimeType, data: imageBase64 } },
          { text: prompt },
        ],
      }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.0,
        maxOutputTokens: 800,
      },
    }),
  });
  if (!res.ok) throw new Error(`analyzeImage failed: ${res.status}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  return JSON.parse(text);
}

/** D8 Step 3: 도메인-감성 번역 (자연/예술 → 인테리어 감성) */
function translateDomainToInterior(analysis: ImageAnalysis): string {
  if (analysis.domain === "INTERIOR") {
    // 그대로 인테리어 검색 텍스트로
    return `${analysis.description} 감성: ${analysis.emotion_keywords.join(", ")} 색감: ${analysis.dominant_colors.join(", ")}`;
  }
  if (analysis.domain === "NATURE") {
    // 자연 → 인테리어 번역: "광활한 바다" → "modern minimal 차분 블루그레이 광활"
    return `자연에서 영감받은 인테리어 감성: ${analysis.emotion_keywords.join(", ")} 톤: ${analysis.dominant_colors.join(", ")} 분위기: ${analysis.description}`;
  }
  if (analysis.domain === "ART") {
    // 예술 → 인테리어 번역
    return `예술 작품에서 영감받은 인테리어: ${analysis.emotion_keywords.join(", ")} 색감: ${analysis.dominant_colors.join(", ")} 무드: ${analysis.description}`;
  }
  return `${analysis.description} 감성: ${analysis.emotion_keywords.join(", ")}`;
}

/** D7: Multi-Modal Query Fusion (Adaptive Gating)
 *  text 와 image 두 입력을 통합 임베딩 벡터로 융합
 *  alpha = 도메인에 따라 동적 결정 (인테리어 0.6, 자연/예술 0.3)
 */
export async function fusedQueryEmbedding(
  text?: string,
  imageBase64?: string,
  imageMime: string = "image/jpeg"
): Promise<{ embedding: number[]; meta: { mode: string; alpha?: number; domain?: DomainType } }> {
  // text only
  if (text && !imageBase64) {
    const emb = await embedText(text);
    return { embedding: emb, meta: { mode: "text_only" } };
  }

  // image only
  if (!text && imageBase64) {
    const analysis = await analyzeImage(imageBase64, imageMime);
    const translated = translateDomainToInterior(analysis);
    const emb = await embedText(translated);
    return { embedding: emb, meta: { mode: "image_only", domain: analysis.domain } };
  }

  // both — Adaptive Gating
  if (text && imageBase64) {
    const analysis = await analyzeImage(imageBase64, imageMime);
    // 도메인별 alpha 결정 (이미지 비중)
    const alpha = analysis.domain === "INTERIOR" ? 0.65 : 0.4;

    const imageText = translateDomainToInterior(analysis);
    const [textEmb, imageEmb] = await Promise.all([
      embedText(text),
      embedText(imageText),
    ]);

    // 가중 결합
    const fused = textEmb.map((v, i) => (1 - alpha) * v + alpha * imageEmb[i]);
    // 정규화 (코사인 검색 호환)
    const norm = Math.sqrt(fused.reduce((s, v) => s + v * v, 0));
    const normalized = fused.map((v) => v / norm);

    return { embedding: normalized, meta: { mode: "fused", alpha, domain: analysis.domain } };
  }

  throw new Error("text 또는 image 중 하나 이상 필요");
}
