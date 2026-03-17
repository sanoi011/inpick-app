import { GoogleGenAI } from '@google/genai';

const keys = [
  { name: 'INPICK (phlw)', key: process.env.GOOGLE_GEMINI_API_KEY },
];

const models = [
  'gemini-3-pro-image-preview',
  'gemini-2.5-flash-image',
  'gemini-2.0-flash',
];

for (const k of keys) {
  console.log(`\n=== ${k.name} ===`);
  const ai = new GoogleGenAI({ apiKey: k.key });

  for (const model of models) {
    try {
      const r = await ai.models.generateContent({
        model,
        contents: [{role:'user', parts:[{text:'Say hi in one word'}]}],
        config: { responseModalities: ['TEXT'] },
      });
      const text = r.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      console.log(`  ${model} -> OK: "${text.slice(0,30)}"`);
    } catch(e) {
      const msg = e.message || '';
      const limitMatch = msg.match(/limit: (\d+)/);
      const metricMatch = msg.match(/metric: ([^,]+)/);
      if (limitMatch) {
        console.log(`  ${model} -> QUOTA (limit: ${limitMatch[1]}, metric: ${metricMatch?.[1]?.split('/').pop() || '?'})`);
      } else if (msg.includes('not found') || msg.includes('NOT_FOUND')) {
        console.log(`  ${model} -> NOT FOUND`);
      } else {
        console.log(`  ${model} -> ERROR: ${msg.slice(0,120)}`);
      }
    }
  }
}
