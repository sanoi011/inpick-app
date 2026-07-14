-- 네이버 원본 및 고화질 정형화 도면 영구 저장 버킷.
-- 런타임에서도 자동 생성하지만, 신규 환경은 마이그레이션 단계에서 먼저 준비한다.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('floorplans', 'floorplans', true, 20971520)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public read floorplans'
  ) THEN
    CREATE POLICY "Public read floorplans"
      ON storage.objects
      FOR SELECT
      USING (bucket_id = 'floorplans');
  END IF;
END $$;
