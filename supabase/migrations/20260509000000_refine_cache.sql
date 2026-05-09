-- 가이드 v2 §5-4 — refine 결과 캐싱
-- 인용: Spacely AI ("renders 80% cache hit") + Finout SaaS Cost Guide ("caching 10% saves $4K/month")
--
-- 핵심: (image, mask, material) 결정론적 키로 hit 시 토큰 0 + gpt-image-2 호출 skip.
-- 결과 URL은 Supabase Storage 'renders/refined/' 그대로 재사용.

CREATE TABLE IF NOT EXISTS refine_cache (
  cache_key TEXT PRIMARY KEY,        -- MD5(image_hash | mask_hash | material_sku) hex
  result_url TEXT NOT NULL,          -- Supabase Storage public URL (기존 'renders/refined/')
  metadata JSONB DEFAULT '{}'::jsonb, -- room_name, material_name, region_category 등
  hit_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ DEFAULT NOW()
);

-- LRU 정리용 인덱스
CREATE INDEX IF NOT EXISTS idx_refine_cache_lru ON refine_cache(last_accessed_at);
-- hit_count 분석용
CREATE INDEX IF NOT EXISTS idx_refine_cache_hits ON refine_cache(hit_count DESC);

-- hit count atomic 증가 RPC
CREATE OR REPLACE FUNCTION increment_refine_cache_hit(p_cache_key TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE refine_cache
  SET hit_count = hit_count + 1,
      last_accessed_at = NOW()
  WHERE cache_key = p_cache_key;
END;
$$ LANGUAGE plpgsql;

-- RLS — service_role만 접근 (사용자 직접 접근 금지)
ALTER TABLE refine_cache ENABLE ROW LEVEL SECURITY;
-- 정책 없음 → service_role 전용 (admin client만 read/write)

COMMENT ON TABLE refine_cache IS '가이드 v2 §5-4 자재 교체 결과 캐싱 — 결정론적 (image, mask, material) 조합';
