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
const img = fs.readFileSync('scripts/floorplan-pipeline/saved_plans/대전유성구/반석2단지계룡리슈빌/130_97.36m2/clean.png');

// Test 1: Text-only response (lighter load)
console.log('Test 1: Text-only response...');
try {
  const r = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: [{role:'user', parts:[
      {inlineData:{mimeType:'image/png', data:img.toString('base64')}},
      {text:'Describe this floor plan in one sentence'}
    ]}],
    config: { responseModalities: ['TEXT'] },
  });
  console.log('TEXT OK:', r.candidates?.[0]?.content?.parts?.[0]?.text?.slice(0,200));
} catch(e) {
  console.log('TEXT ERR:', e.message?.slice(0,500));
  console.log('Status:', e.status);
  console.log('Code:', e.code);
}

// Test 2: Image response
console.log('\nTest 2: Image response...');
try {
  const r = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: [{role:'user', parts:[
      {inlineData:{mimeType:'image/png', data:img.toString('base64')}},
      {text:'Add dimension lines to this floor plan'}
    ]}],
    config: { responseModalities: ['IMAGE', 'TEXT'] },
  });
  if (r.candidates?.[0]) {
    for (const part of r.candidates[0].content.parts) {
      if (part.inlineData) {
        const buf = Buffer.from(part.inlineData.data, 'base64');
        console.log('IMAGE OK:', (buf.length/1024).toFixed(0), 'KB');
      } else if (part.text) {
        console.log('TEXT:', part.text.slice(0,100));
      }
    }
  }
} catch(e) {
  console.log('IMAGE ERR:', e.message?.slice(0,500));
  console.log('Status:', e.status);
  console.log('Headers:', JSON.stringify(e.headers || {}).slice(0,300));
}
