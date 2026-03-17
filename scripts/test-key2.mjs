import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: 'AIzaSyB6t6lpQBYp_V9tSZ49YnYPbJo5Hzddcs0' });

console.log('Testing gemini-3-pro-image-preview with key2...');
try {
  const r = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: [{role:'user', parts:[{text:'Say hello'}]}],
    config: { responseModalities: ['TEXT'] },
  });
  console.log('OK:', r.candidates?.[0]?.content?.parts?.[0]?.text?.slice(0,100));
} catch(e) {
  const msg = e.message || '';
  const limitMatch = msg.match(/limit: (\d+)/);
  console.log('ERROR:', limitMatch ? `limit: ${limitMatch[1]}` : msg.slice(0,200));
}
