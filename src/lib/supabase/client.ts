import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Module-level singleton — 모든 client component가 동일 인스턴스 공유.
 * (매 렌더마다 새 instance 생성하면 onAuthStateChange listener 깨짐 + 세션 동기화 불안정)
 */
let _client: SupabaseClient | undefined;

export function createClient(): SupabaseClient {
  if (_client) return _client;
  _client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return _client;
}
