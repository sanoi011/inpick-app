// src/lib/floor-plan/drawing/gemini-enhancer.ts
// Gemini AI 도면 시각 보강 — 가구 일러스트 + 3D 렌더

import { getGeminiClient, isGeminiConfigured } from '@/lib/gemini-client';
import type { WallElevation } from '@/types/construction-drawing';

const MODEL = 'gemini-2.0-flash';
const MAX_RETRIES = 2;
const RATE_LIMIT_WAIT = 15000;

/** 재시도 유틸 */
async function callGeminiWithRetry(
  prompt: string,
  imageBuffer?: Buffer,
  mimeType?: string
): Promise<string | null> {
  const client = getGeminiClient();
  if (!client) return null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [];

      if (imageBuffer && mimeType) {
        parts.push({
          inlineData: {
            data: imageBuffer.toString('base64'),
            mimeType,
          },
        });
      }
      parts.push({ text: prompt });

      const response = await client.models.generateContent({
        model: MODEL,
        contents: [{ role: 'user', parts }],
        config: {
          maxOutputTokens: 2048,
          temperature: 0.7,
        },
      });

      const text = response.text ?? '';
      return text || null;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes('429') || errMsg.includes('RATE_LIMIT')) {
        console.log(`[gemini-enhancer] Rate limit, retry ${attempt + 1}/${MAX_RETRIES}`);
        await new Promise(r => setTimeout(r, RATE_LIMIT_WAIT));
        continue;
      }
      console.error('[gemini-enhancer] Gemini error:', errMsg);
      return null;
    }
  }
  return null;
}

// ─── 가구배치도 가구 심볼 보강 프롬프트 ───

function buildFurnitureEnhancementPrompt(): string {
  return `You are an interior design documentation specialist.

I'm providing a technical furniture layout plan (SVG rendered as PNG) on a dark background.

Please analyze the furniture placement and provide a brief JSON description of the layout quality:
{
  "roomCount": number,
  "furnitureCount": number,
  "layoutScore": 0-10,
  "suggestions": ["string"],
  "trafficFlowGood": boolean
}

Focus on:
- Proper clearance between furniture (minimum 600mm walking path)
- Logical furniture grouping (dining set together, living set together)
- Door/window clearance (no furniture blocking openings)
- Traffic flow patterns

Return only the JSON, no markdown.`;
}

// ─── 입면도 3D 렌더 묘사 프롬프트 ───

function buildElevation3DPrompt(
  elevation: WallElevation,
  roomName: string,
  materialNames: string[]
): string {
  const openingDesc = elevation.openings.map(o =>
    `${o.type === 'window' ? '창문' : '문'} (${o.widthMm}×${o.heightMm}mm, 좌측에서 ${o.positionFromLeftMm}mm)`
  ).join(', ');

  const fixtureDesc = elevation.fixtures.map(f =>
    `${f.label || f.type} (높이 ${f.heightFromFloorMm}mm)`
  ).join(', ');

  return `당신은 한국 아파트 인테리어 3D 렌더링 전문가입니다.

다음 벽면의 3D 인테리어 이미지를 상상으로 묘사해주세요 (JSON):

방: ${roomName}
벽면: ${elevation.wallLabel}면 (${elevation.wallLengthMm}mm × ${elevation.wallHeightMm}mm)
개구부: ${openingDesc || '없음'}
설비: ${fixtureDesc || '없음'}
자재: ${materialNames.join(', ') || '미정'}

{
  "description": "3D 렌더링 이미지 설명 (2-3문장, 한국어)",
  "ambiance": "조명/분위기 (1문장)",
  "colorPalette": ["hex color 3-5개"],
  "style": "모던/미니멀/북유럽/클래식 중 하나"
}

Return only JSON.`;
}

// ─── 공개 함수 ───

/**
 * 가구배치도 SVG 이미지를 분석하고 레이아웃 품질 평가
 * (실제 AI 이미지 변환은 Gemini Pro Image가 필요하므로,
 *  현재는 분석 피드백만 반환)
 */
export async function analyzeFurnitureLayout(
  svgPngBuffer: Buffer
): Promise<{
  layoutScore: number;
  suggestions: string[];
  furnitureCount: number;
} | null> {
  if (!isGeminiConfigured()) return null;

  const result = await callGeminiWithRetry(
    buildFurnitureEnhancementPrompt(),
    svgPngBuffer,
    'image/png'
  );

  if (!result) return null;

  try {
    const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return {
      layoutScore: parsed.layoutScore || 5,
      suggestions: parsed.suggestions || [],
      furnitureCount: parsed.furnitureCount || 0,
    };
  } catch {
    console.error('[gemini-enhancer] Failed to parse furniture analysis');
    return null;
  }
}

/**
 * 입면도 벽면의 3D 렌더 묘사 생성
 * (실제 3D 이미지 생성은 gemini-3-pro-image-preview 모델이 필요)
 */
export async function generateElevation3DDescription(
  elevation: WallElevation,
  roomName: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  existingAiImageUrl?: string
): Promise<{
  description: string;
  ambiance: string;
  colorPalette: string[];
  style: string;
} | null> {
  if (!isGeminiConfigured()) return null;

  const materialNames = elevation.materials.map(m => m.name);
  const result = await callGeminiWithRetry(
    buildElevation3DPrompt(elevation, roomName, materialNames)
  );

  if (!result) return null;

  try {
    const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    console.error('[gemini-enhancer] Failed to parse elevation 3D description');
    return null;
  }
}

/**
 * Gemini Pro Image 모델로 실제 3D 렌더 이미지 생성 시도
 * (gemini-3-pro-image-preview 모델 사용)
 */
export async function generateElevation3DImage(
  elevation: WallElevation,
  roomName: string,
  svgPngBuffer: Buffer
): Promise<Buffer | null> {
  const client = getGeminiClient();
  if (!client) return null;

  const imageModel = 'gemini-2.0-flash-exp';

  const materialDesc = elevation.materials.map(m =>
    `${m.area === 'floor' ? '바닥' : m.area === 'wall' ? '벽' : '천장'}: ${m.name}`
  ).join(', ');

  const prompt = `이 시공도면 입면도를 참고하여 같은 벽면의 완성된 인테리어 3D 렌더링 이미지를 생성해주세요.

방: ${roomName}
벽면: ${elevation.wallLabel}면 (${elevation.wallLengthMm}mm × ${elevation.wallHeightMm}mm)
자재: ${materialDesc || '모던 인테리어'}

요구사항:
- 동일한 벽면 비율 유지
- 자연광이 들어오는 따뜻한 분위기
- 한국 아파트 인테리어 스타일
- 포토리얼리스틱 품질
- 16:9 가로 비율`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await client.models.generateContent({
        model: imageModel,
        contents: [{
          role: 'user',
          parts: [
            {
              inlineData: {
                data: svgPngBuffer.toString('base64'),
                mimeType: 'image/png',
              },
            },
            { text: prompt },
          ],
        }],
        config: {
          maxOutputTokens: 4096,
          temperature: 0.8,
        },
      });

      // 이미지 파트 추출
      const candidates = (response as { candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data: string; mimeType: string } }> } }> }).candidates;
      if (candidates && candidates[0]?.content?.parts) {
        for (const part of candidates[0].content.parts) {
          if (part.inlineData?.data) {
            return Buffer.from(part.inlineData.data, 'base64');
          }
        }
      }
      return null;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes('429') || errMsg.includes('RATE_LIMIT')) {
        console.log(`[gemini-enhancer] Image gen rate limit, retry ${attempt + 1}`);
        await new Promise(r => setTimeout(r, RATE_LIMIT_WAIT));
        continue;
      }
      console.error('[gemini-enhancer] Image generation error:', errMsg);
      return null;
    }
  }
  return null;
}
