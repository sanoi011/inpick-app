-- 청구서 테이블
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES specialty_contractors(id) ON DELETE CASCADE,
  project_id UUID REFERENCES contractor_projects(id) ON DELETE SET NULL,
  contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
  invoice_number VARCHAR(50) NOT NULL,
  description TEXT,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','sent','paid','overdue','cancelled')),
  issued_at TIMESTAMPTZ,
  due_date DATE,
  paid_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 결제 기록 테이블
CREATE TABLE IF NOT EXISTS payment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES specialty_contractors(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  project_id UUID REFERENCES contractor_projects(id) ON DELETE SET NULL,
  amount NUMERIC(14,2) NOT NULL,
  payment_method VARCHAR(20) DEFAULT 'bank_transfer'
    CHECK (payment_method IN ('bank_transfer','cash','card','check','other')),
  payment_type VARCHAR(10) NOT NULL DEFAULT 'income'
    CHECK (payment_type IN ('income','expense')),
  description TEXT,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 지출 기록 테이블
CREATE TABLE IF NOT EXISTS expense_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES specialty_contractors(id) ON DELETE CASCADE,
  project_id UUID REFERENCES contractor_projects(id) ON DELETE SET NULL,
  category VARCHAR(20) NOT NULL DEFAULT 'other'
    CHECK (category IN ('material','labor','equipment','transport','office','insurance','other')),
  description TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  receipt_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_invoices_contractor ON invoices(contractor_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_project ON invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_payments_contractor ON payment_records(contractor_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payment_records(invoice_id);
CREATE INDEX IF NOT EXISTS idx_expenses_contractor ON expense_records(contractor_id);
CREATE INDEX IF NOT EXISTS idx_expenses_project ON expense_records(project_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expense_records(expense_date);
