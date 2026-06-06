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

const iter = await ai.models.list();
for await (const m of iter) {
  const name = m.name || '';
  const methods = m.supportedGenerationMethods || [];
  // Show models that likely support image output
  if ((name.includes('image') || name.includes('pro') || name.includes('imagen')) && methods.includes('generateContent')) {
    console.log(`${name}  [${methods.join(', ')}]`);
  }
}
