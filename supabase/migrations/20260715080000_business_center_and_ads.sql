-- INPICK 비즈니스 문의·협업사·광고 배너 운영 센터

CREATE TABLE IF NOT EXISTS business_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_type TEXT NOT NULL CHECK (inquiry_type IN ('material_supplier', 'material_manufacturer', 'regional_contractor')),
  company_name VARCHAR(200) NOT NULL,
  business_registration_no VARCHAR(20) NOT NULL,
  business_address VARCHAR(500) NOT NULL,
  contact_email VARCHAR(200),
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'contacted', 'approved', 'rejected', 'closed')),
  admin_note TEXT,
  source TEXT NOT NULL DEFAULT 'business_page',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_inquiries_status_created
  ON business_inquiries(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_business_inquiries_registration_no
  ON business_inquiries(business_registration_no);

CREATE TABLE IF NOT EXISTS advertising_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name VARCHAR(200) NOT NULL,
  business_registration_no VARCHAR(20),
  contact_name VARCHAR(100),
  contact_email VARCHAR(200),
  contact_phone VARCHAR(30),
  website TEXT,
  status TEXT NOT NULL DEFAULT 'lead' CHECK (status IN ('lead', 'active', 'paused', 'ended')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_advertising_partners_status
  ON advertising_partners(status, created_at DESC);

CREATE TABLE IF NOT EXISTS advertising_banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES advertising_partners(id) ON DELETE SET NULL,
  title VARCHAR(200) NOT NULL,
  subtitle VARCHAR(500),
  image_url TEXT,
  mobile_image_url TEXT,
  target_url TEXT NOT NULL,
  alt_text VARCHAR(300),
  placement TEXT NOT NULL CHECK (placement IN (
    'home_mid',
    'business_home_hero',
    'partial_ai_materials',
    'partial_install_results',
    'contractor_bids_top',
    'contractor_dashboard_top'
  )),
  priority INTEGER NOT NULL DEFAULT 0 CHECK (priority BETWEEN -9999 AND 9999),
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_advertising_banners_placement_order
  ON advertising_banners(placement, is_active, is_featured DESC, priority DESC, created_at DESC);

CREATE OR REPLACE FUNCTION set_business_center_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_business_inquiries_updated_at ON business_inquiries;
CREATE TRIGGER trg_business_inquiries_updated_at
  BEFORE UPDATE ON business_inquiries
  FOR EACH ROW EXECUTE FUNCTION set_business_center_updated_at();

DROP TRIGGER IF EXISTS trg_advertising_partners_updated_at ON advertising_partners;
CREATE TRIGGER trg_advertising_partners_updated_at
  BEFORE UPDATE ON advertising_partners
  FOR EACH ROW EXECUTE FUNCTION set_business_center_updated_at();

DROP TRIGGER IF EXISTS trg_advertising_banners_updated_at ON advertising_banners;
CREATE TRIGGER trg_advertising_banners_updated_at
  BEFORE UPDATE ON advertising_banners
  FOR EACH ROW EXECUTE FUNCTION set_business_center_updated_at();

ALTER TABLE business_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE advertising_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE advertising_banners ENABLE ROW LEVEL SECURITY;

-- 문의는 공개 API가 서비스 롤로 저장하며, 공개 조회는 허용하지 않는다.
-- 배너은 활성·게재 기간에 들어온 항목만 공개 조회한다.
DROP POLICY IF EXISTS "public_read_active_advertising_banners" ON advertising_banners;
CREATE POLICY "public_read_active_advertising_banners"
  ON advertising_banners FOR SELECT
  USING (
    is_active = TRUE
    AND (starts_at IS NULL OR starts_at <= NOW())
    AND (ends_at IS NULL OR ends_at > NOW())
  );
