import fs from 'fs';
import { GoogleGenAI } from '@google/genai';

const envContent = fs.readFileSync('.env.local', 'utf-8');
for (const line of envContent.split('\n')) {
  const t = line.trim();
  if (t.length === 0 || t.startsWith('#')) continue;
  const eq = t.indexOf('=');
  if (eq > 0) process.env[t.substring(0, eq).trim()] = t.substring(eq + 1).trim();
}

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY });

const testModels = [
  'gemini-3-pro-image-preview',
  'gemini-3-pro',
  'gemini-3-pro-preview',
  'gemini-2.5-pro-exp-03-25',
  'imagen-3.0-generate-002',
  'imagen-3.0-generate-001',
  'gemini-2.5-flash-preview-image-generation',
  'gemini-2.5-flash-image',
  'gemini-2.0-flash-exp-image-generation',
];

for (const name of testModels) {
  try {
    const m = await ai.models.get({ model: name });
    console.log(`${name} -> OK (${m.displayName || 'no display name'})`);
  } catch (e) {
    console.log(`${name} -> NOT FOUND (${e.message?.slice(0, 60) || ''})`);
  }
}
