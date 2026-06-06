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

// Test 1: Simple text (Pro)
console.log('=== Test 1: Pro text-only ===');
try {
  const r = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: [{role:'user', parts:[{text:'Say hello'}]}],
    config: { responseModalities: ['TEXT'] },
  });
  console.log('OK:', r.candidates?.[0]?.content?.parts?.[0]?.text?.slice(0,100));
} catch(e) {
  console.log('ERROR:', e.message?.slice(0,400));
}

// Test 2: Pro image generation
console.log('\n=== Test 2: Pro image generation ===');
try {
  const r = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: [{role:'user', parts:[{text:'Draw a simple blue circle on white background'}]}],
    config: { responseModalities: ['IMAGE', 'TEXT'] },
  });
  if (r.candidates?.[0]) {
    for (const part of r.candidates[0].content.parts) {
      if (part.inlineData) {
        console.log('IMAGE OK:', (Buffer.from(part.inlineData.data, 'base64').length/1024).toFixed(0), 'KB');
      } else if (part.text) {
        console.log('TEXT:', part.text.slice(0,100));
      }
    }
  }
} catch(e) {
  console.log('ERROR:', e.message?.slice(0,400));
}
