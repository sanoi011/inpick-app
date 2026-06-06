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
  'gemini-2.5-flash-image',
  'gemini-2.0-flash-exp-image-generation',
  'gemini-2.0-flash',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-3-pro-image-preview',
  'gemini-3-pro-preview',
];

const img = fs.readFileSync('scripts/floorplan-pipeline/saved_plans/대전유성구/반석2단지계룡리슈빌/130_97.36m2/clean.png');

for (const model of modelsToTest) {
  try {
    const r = await ai.models.generateContent({
      model,
      contents: [{role:'user', parts:[
        {inlineData:{mimeType:'image/png', data:img.toString('base64')}},
        {text:'Add a red dot to the center of this image'}
      ]}],
      config: { responseModalities: ['IMAGE', 'TEXT'] },
    });
    if (r.candidates?.[0]) {
      let hasImage = false;
      for (const part of r.candidates[0].content.parts) {
        if (part.inlineData) {
          const buf = Buffer.from(part.inlineData.data, 'base64');
          console.log(`${model} -> IMAGE OK (${(buf.length/1024).toFixed(0)}KB)`);
          hasImage = true;
        }
      }
      if (!hasImage) console.log(`${model} -> TEXT ONLY (no image output)`);
    }
  } catch(e) {
    const msg = e.message || '';
    if (msg.includes('limit: 0')) {
      console.log(`${model} -> DAILY QUOTA EXHAUSTED`);
    } else if (msg.includes('429')) {
      console.log(`${model} -> RATE LIMITED`);
    } else if (msg.includes('not found') || msg.includes('NOT_FOUND')) {
      console.log(`${model} -> NOT FOUND`);
    } else if (msg.includes('does not support')) {
      console.log(`${model} -> NO IMAGE SUPPORT`);
    } else {
      console.log(`${model} -> ERROR: ${msg.slice(0,150)}`);
    }
  }
}
