export interface ContractorAIContext {
  contractorId: string;
  companyName: string;
  activeProjectCount: number;
  pendingBidCount: number;
  monthlyRevenue: number;
  receivableTotal: number;
  upcomingScheduleCount: number;
  avgRating: number;
}

export type AIResponseTagType = 'ALERT' | 'SUGGESTION' | 'DATA';

export interface AIResponseTag {
  type: AIResponseTagType;
  content: string;
}

export interface ParsedAIResponse {
  text: string;
  tags: AIResponseTag[];
}

export function parseAIResponseTags(message: string): ParsedAIResponse {
  const tags: AIResponseTag[] = [];
  let cleanText = message;

  const tagPatterns: { type: AIResponseTagType; regex: RegExp }[] = [
    { type: 'ALERT', regex: /\[ALERT\]([\s\S]*?)(?=\[(?:ALERT|SUGGESTION|DATA)\]|$)/g },
    { type: 'SUGGESTION', regex: /\[SUGGESTION\]([\s\S]*?)(?=\[(?:ALERT|SUGGESTION|DATA)\]|$)/g },
    { type: 'DATA', regex: /\[DATA\]([\s\S]*?)(?=\[(?:ALERT|SUGGESTION|DATA)\]|$)/g },
  ];

  for (const { type, regex } of tagPatterns) {
    let match;
    while ((match = regex.exec(message)) !== null) {
      tags.push({ type, content: match[1].trim() });
    }
  }

  // 태그 제거한 텍스트
  cleanText = cleanText
    .replace(/\[ALERT\][\s\S]*?(?=\[(?:ALERT|SUGGESTION|DATA)\]|$)/g, '')
    .replace(/\[SUGGESTION\][\s\S]*?(?=\[(?:ALERT|SUGGESTION|DATA)\]|$)/g, '')
    .replace(/\[DATA\][\s\S]*?(?=\[(?:ALERT|SUGGESTION|DATA)\]|$)/g, '')
    .trim();

  return { text: cleanText || message, tags };
}

export const AI_TAG_STYLES: Record<AIResponseTagType, { bg: string; text: string; icon: string }> = {
  ALERT: { bg: 'bg-red-50 border-red-200', text: 'text-red-700', icon: 'AlertTriangle' },
  SUGGESTION: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', icon: 'Lightbulb' },
  DATA: { bg: 'bg-gray-50 border-gray-200', text: 'text-gray-700', icon: 'BarChart3' },
};
