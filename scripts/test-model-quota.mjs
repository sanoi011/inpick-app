import fs from 'fs';
import { GoogleGenAI } from '@google/genai';

const envContent = fs.readFileSync('.env.local', 'utf-8');
for (const line of envContent.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const eq = t.indexOf('=');
  if (eq > 0) process.env[t.substring(0, eq).trim()] = t.substring(eq + 1).trim();
}

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY });

const modelsToTest = [
  'gemini-3-pro-image-preview',
  'gemini-2.5-pro-preview-06-05',
  'gemini-2.5-pro-exp-03-25',
  'gemini-2.5-flash-preview-image-generation',
  'gemini-2.0-flash-exp-image-generation',
  'imagen-3.0-generate-002',
];

for (const model of modelsToTest) {
  try {
    const r = await ai.models.generateContent({
      model,
      contents: [{role:'user', parts:[{text:'Say hello in one word'}]}],
      config: { responseModalities: ['TEXT'] },
    });
    const text = r.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log(`${model} -> OK: ${text.trim().slice(0,30)}`);
  } catch(e) {
    const msg = e.message || '';
    if (msg.includes('limit: 0')) {
      console.log(`${model} -> DAILY QUOTA EXHAUSTED`);
    } else if (msg.includes('429')) {
      // Extract limit info
      const limitMatch = msg.match(/limit: (\d+)/);
      console.log(`${model} -> RATE LIMITED (limit: ${limitMatch?.[1] || '?'})`);
    } else if (msg.includes('not found') || msg.includes('NOT_FOUND')) {
      console.log(`${model} -> NOT FOUND`);
    } else {
      console.log(`${model} -> ERROR: ${msg.slice(0,100)}`);
    }
  }
}
