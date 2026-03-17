import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env.local', 'utf8');
const envMap = {};
envContent.split('\n').forEach(line => {
  const idx = line.indexOf('=');
  if (idx > 0) envMap[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
});

const url = envMap['NEXT_PUBLIC_SUPABASE_URL'];
const key = envMap['SUPABASE_SERVICE_ROLE_KEY'] || envMap['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

const sb = createClient(url, key);

const { data: buckets, error } = await sb.storage.listBuckets();
if (error) {
  console.log('error:', error.message);
} else {
  console.log('Buckets:');
  buckets.forEach(b => console.log(' ', b.name, '| public:', b.public));
}

// Try creating 'uploads' bucket if not exists
if (buckets && !buckets.find(b => b.name === 'uploads')) {
  console.log('\nCreating "uploads" bucket...');
  const { data, error: createErr } = await sb.storage.createBucket('uploads', {
    public: true,
    fileSizeLimit: 10485760, // 10MB
  });
  if (createErr) console.log('Create error:', createErr.message);
  else console.log('Created:', data);
} else {
  console.log('\n"uploads" bucket exists');
}
