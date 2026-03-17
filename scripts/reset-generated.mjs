import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env.local', 'utf8');
const envMap = {};
envContent.split('\n').forEach(line => {
  const idx = line.indexOf('=');
  if (idx > 0) envMap[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
});

const sb = createClient(
  envMap['NEXT_PUBLIC_SUPABASE_URL'],
  envMap['SUPABASE_SERVICE_ROLE_KEY']
);

// 이미지 없이 completed인 레코드 삭제 (업로드 실패했던 것들)
const { data, error } = await sb
  .from('generated_floorplans')
  .select('complex_no, pyeong_no, status, final_url')
  .order('created_at', { ascending: false });

if (error) {
  console.log('Error:', error.message);
  process.exit(1);
}

console.log(`Found ${data.length} records:`);
for (const r of data) {
  console.log(`  ${r.complex_no}/${r.pyeong_no} status=${r.status} url=${r.final_url?.slice(0, 60) || 'null'}`);
}

// 모두 삭제 (재생성 허용)
const { error: delErr } = await sb
  .from('generated_floorplans')
  .delete()
  .neq('complex_no', '___none___'); // delete all

if (delErr) console.log('Delete error:', delErr.message);
else console.log(`\nDeleted all ${data.length} records (will regenerate)`);
