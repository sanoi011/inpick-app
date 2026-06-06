-- 로드맵 기능 카드 관리 테이블
CREATE TABLE IF NOT EXISTS roadmap_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  detail TEXT,
  icon_name TEXT NOT NULL DEFAULT 'Zap',
  tags TEXT[] DEFAULT '{}',
  status TEXT NOT NULL CHECK (status IN ('completed', 'in_progress', 'planned')) DEFAULT 'planned',
  sort_order INT DEFAULT 0,
  link TEXT,
  has_demo BOOLEAN DEFAULT FALSE,
  images JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 로드맵 마일스톤 테이블
CREATE TABLE IF NOT EXISTS roadmap_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase TEXT NOT NULL,
  title TEXT NOT NULL,
  period TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('completed', 'in_progress', 'planned')) DEFAULT 'planned',
  items TEXT[] DEFAULT '{}',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 로드맵 요약 통계 테이블
CREATE TABLE IF NOT EXISTS roadmap_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  value TEXT NOT NULL,
  sub TEXT,
  sort_order INT DEFAULT 0
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_roadmap_features_status ON roadmap_features(status);
CREATE INDEX IF NOT EXISTS idx_roadmap_features_sort ON roadmap_features(sort_order);
CREATE INDEX IF NOT EXISTS idx_roadmap_milestones_sort ON roadmap_milestones(sort_order);
