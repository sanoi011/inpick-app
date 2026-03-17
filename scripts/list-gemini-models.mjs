import { GoogleGenAI } from '@google/genai';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env.local', 'utf8');
const match = envContent.match(/GOOGLE_GEMINI_API_KEY=(.+)/);
if (!match) { console.log('No API key found'); process.exit(1); }
const apiKey = match[1].trim();
const client = new GoogleGenAI({ apiKey });

const result = await client.models.list();
const models = [];
const page = result.page || result;
if (Array.isArray(page)) {
  for (const m of page) {
    if (m.name && (m.name.includes('pro') || m.name.includes('3.1') || m.name.includes('gemini-3'))) {
      models.push(`${m.name}  |  ${m.displayName || ''}`);
    }
  }
} else {
  // Try iterating over the result object properties
  console.log('Result type:', typeof result);
  console.log('Result keys:', Object.keys(result));
  console.log('Result:', JSON.stringify(result).slice(0, 500));
}
console.log('Pro / 3.x models available:');
models.sort().forEach(m => console.log(' ', m));
