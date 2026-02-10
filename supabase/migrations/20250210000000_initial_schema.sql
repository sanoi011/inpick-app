-- ============================================================
-- INPICK Database Schema
-- Complete PostgreSQL schema for Supabase
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- 1. SPACE TYPES & SPACE AREAS
-- ============================================================

CREATE TABLE space_types (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            VARCHAR(20) NOT NULL UNIQUE,
    name            VARCHAR(100) NOT NULL,
    category        VARCHAR(50) NOT NULL CHECK (category IN ('residential', 'commercial', 'industrial')),
    description     TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE space_areas (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    space_type_id   UUID NOT NULL REFERENCES space_types(id) ON DELETE CASCADE,
    label           VARCHAR(50) NOT NULL,
    min_area_m2     NUMERIC(10,2) NOT NULL,
    max_area_m2     NUMERIC(10,2) NOT NULL,
    default_area_m2 NUMERIC(10,2) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (space_type_id, label)
);

-- ============================================================
-- 2. FINISH CATEGORIES & FINISH ITEMS
-- ============================================================

CREATE TABLE finish_categories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            VARCHAR(20) NOT NULL UNIQUE,
    name            VARCHAR(100) NOT NULL,
    description     TEXT,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE finish_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id     UUID NOT NULL REFERENCES finish_categories(id) ON DELETE CASCADE,
    code            VARCHAR(30) NOT NULL UNIQUE,
    name            VARCHAR(200) NOT NULL,
    unit            VARCHAR(20) NOT NULL,
    material_cost   NUMERIC(12,2) NOT NULL DEFAULT 0,
    labor_cost      NUMERIC(12,2) NOT NULL DEFAULT 0,
    description     TEXT,
    specs           JSONB DEFAULT '{}',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. SUB-MATERIALS & PREREQUISITE PROCESSES
-- ============================================================

CREATE TABLE sub_materials (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            VARCHAR(30) NOT NULL UNIQUE,
    name            VARCHAR(200) NOT NULL,
    unit            VARCHAR(20) NOT NULL,
    unit_price      NUMERIC(12,2) NOT NULL DEFAULT 0,
    description     TEXT,
    supplier        VARCHAR(200),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE prerequisite_processes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            VARCHAR(30) NOT NULL UNIQUE,
    name            VARCHAR(200) NOT NULL,
    unit            VARCHAR(20) NOT NULL,
    unit_cost       NUMERIC(12,2) NOT NULL DEFAULT 0,
    description     TEXT,
    typical_duration_hours NUMERIC(6,2),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4. MAPPING TABLES (Finish <-> Prerequisites / Sub-materials)
-- ============================================================

CREATE TABLE finish_prereq_mapping (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    finish_item_id  UUID NOT NULL REFERENCES finish_items(id) ON DELETE CASCADE,
    prereq_id       UUID NOT NULL REFERENCES prerequisite_processes(id) ON DELETE CASCADE,
    is_required     BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (finish_item_id, prereq_id)
);

CREATE TABLE finish_submaterial_mapping (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    finish_item_id  UUID NOT NULL REFERENCES finish_items(id) ON DELETE CASCADE,
    sub_material_id UUID NOT NULL REFERENCES sub_materials(id) ON DELETE CASCADE,
    quantity_per_unit NUMERIC(10,4) NOT NULL DEFAULT 1.0,
    is_required     BOOLEAN NOT NULL DEFAULT TRUE,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (finish_item_id, sub_material_id)
);

-- ============================================================
-- 5. LABOR COSTS, MATERIAL PRICES & OVERHEAD RATES
-- ============================================================

CREATE TABLE labor_costs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            VARCHAR(20) NOT NULL UNIQUE,
    trade           VARCHAR(100) NOT NULL,
    skill_level     VARCHAR(30) NOT NULL CHECK (skill_level IN ('helper', 'journeyman', 'master', 'specialist')),
    daily_rate      NUMERIC(12,2) NOT NULL,
    hourly_rate     NUMERIC(10,2) NOT NULL,
    unit            VARCHAR(20) NOT NULL DEFAULT 'day',
    region          VARCHAR(50) NOT NULL DEFAULT 'seoul',
    effective_from  DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to    DATE,
    source          VARCHAR(200),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE material_prices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            VARCHAR(30) NOT NULL,
    name            VARCHAR(200) NOT NULL,
    category        VARCHAR(100),
    unit            VARCHAR(20) NOT NULL,
    unit_price      NUMERIC(12,2) NOT NULL,
    supplier        VARCHAR(200),
    brand           VARCHAR(100),
    region          VARCHAR(50) NOT NULL DEFAULT 'seoul',
    effective_from  DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to    DATE,
    source          VARCHAR(200),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (code, region, effective_from)
);

CREATE TABLE overhead_rates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            VARCHAR(20) NOT NULL UNIQUE,
    name            VARCHAR(100) NOT NULL,
    rate_type       VARCHAR(20) NOT NULL CHECK (rate_type IN ('percentage', 'fixed', 'per_unit')),
    rate_value      NUMERIC(10,4) NOT NULL,
    base            VARCHAR(50) NOT NULL,
    description     TEXT,
    effective_from  DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to    DATE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 6. PRICE HISTORY & CRAWL LOGS
-- ============================================================

CREATE TABLE price_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type     VARCHAR(30) NOT NULL CHECK (entity_type IN ('labor', 'material', 'overhead')),
    entity_id       UUID NOT NULL,
    old_value       NUMERIC(12,2),
    new_value       NUMERIC(12,2) NOT NULL,
    change_pct      NUMERIC(8,4),
    changed_by      VARCHAR(100),
    change_reason   TEXT,
    recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE crawl_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_name     VARCHAR(100) NOT NULL,
    source_url      TEXT,
    crawl_type      VARCHAR(30) NOT NULL CHECK (crawl_type IN ('labor', 'material', 'overhead', 'mixed')),
    status          VARCHAR(20) NOT NULL CHECK (status IN ('started', 'in_progress', 'completed', 'failed', 'partial')),
    records_found   INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    records_created INTEGER DEFAULT 0,
    error_message   TEXT,
    metadata        JSONB DEFAULT '{}',
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

-- ============================================================
-- 7. ESTIMATES & ESTIMATE ITEMS
-- ============================================================

CREATE TABLE estimates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID,
    title           VARCHAR(200) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed', 'archived')),
    project_type    VARCHAR(50) NOT NULL CHECK (project_type IN ('residential', 'commercial', 'industrial')),
    total_area_m2   NUMERIC(10,2),
    total_material  NUMERIC(14,2) DEFAULT 0,
    total_labor     NUMERIC(14,2) DEFAULT 0,
    total_overhead  NUMERIC(14,2) DEFAULT 0,
    grand_total     NUMERIC(14,2) DEFAULT 0,
    notes           TEXT,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE estimate_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    estimate_id     UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
    space_type_id   UUID REFERENCES space_types(id),
    finish_item_id  UUID REFERENCES finish_items(id),
    space_name      VARCHAR(100),
    item_name       VARCHAR(200) NOT NULL,
    unit            VARCHAR(20) NOT NULL,
    quantity        NUMERIC(10,2) NOT NULL DEFAULT 1,
    material_cost   NUMERIC(12,2) NOT NULL DEFAULT 0,
    labor_cost      NUMERIC(12,2) NOT NULL DEFAULT 0,
    overhead_cost   NUMERIC(12,2) NOT NULL DEFAULT 0,
    subtotal        NUMERIC(14,2) NOT NULL DEFAULT 0,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE estimate_space_summary (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    estimate_id     UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
    space_type_id   UUID REFERENCES space_types(id),
    space_name      VARCHAR(100) NOT NULL,
    area_m2         NUMERIC(10,2) NOT NULL,
    material_total  NUMERIC(14,2) DEFAULT 0,
    labor_total     NUMERIC(14,2) DEFAULT 0,
    overhead_total  NUMERIC(14,2) DEFAULT 0,
    space_total     NUMERIC(14,2) DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (estimate_id, space_name)
);

CREATE TABLE estimate_versions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    estimate_id     UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
    version_number  INTEGER NOT NULL,
    snapshot        JSONB NOT NULL,
    change_summary  TEXT,
    created_by      UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (estimate_id, version_number)
);

-- ============================================================
-- 8. SPECIALTY CONTRACTORS
-- ============================================================

CREATE TABLE specialty_contractors (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name    VARCHAR(200) NOT NULL,
    contact_name    VARCHAR(100),
    phone           VARCHAR(30),
    email           VARCHAR(200),
    address         TEXT,
    region          VARCHAR(50) NOT NULL DEFAULT 'seoul',
    license_number  VARCHAR(50),
    license_expiry  DATE,
    rating          NUMERIC(3,2) DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
    total_reviews   INTEGER DEFAULT 0,
    is_verified     BOOLEAN NOT NULL DEFAULT FALSE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE contractor_trades (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contractor_id   UUID NOT NULL REFERENCES specialty_contractors(id) ON DELETE CASCADE,
    trade_code      VARCHAR(10) NOT NULL,
    trade_name      VARCHAR(100) NOT NULL,
    experience_years INTEGER DEFAULT 0,
    is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (contractor_id, trade_code)
);

CREATE TABLE contractor_schedules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contractor_id   UUID NOT NULL REFERENCES specialty_contractors(id) ON DELETE CASCADE,
    date            DATE NOT NULL,
    status          VARCHAR(20) NOT NULL CHECK (status IN ('available', 'booked', 'tentative', 'unavailable')),
    estimate_id     UUID REFERENCES estimates(id) ON DELETE SET NULL,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (contractor_id, date)
);

CREATE TABLE contractor_reviews (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contractor_id   UUID NOT NULL REFERENCES specialty_contractors(id) ON DELETE CASCADE,
    reviewer_id     UUID,
    estimate_id     UUID REFERENCES estimates(id) ON DELETE SET NULL,
    rating          NUMERIC(3,2) NOT NULL CHECK (rating >= 0 AND rating <= 5),
    title           VARCHAR(200),
    content         TEXT,
    is_verified     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE contractor_portfolio (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contractor_id   UUID NOT NULL REFERENCES specialty_contractors(id) ON DELETE CASCADE,
    title           VARCHAR(200) NOT NULL,
    description     TEXT,
    project_type    VARCHAR(50),
    completion_date DATE,
    image_urls      JSONB DEFAULT '[]',
    tags            JSONB DEFAULT '[]',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 9. COLLABORATION REQUESTS & MESSAGES
-- ============================================================

CREATE TABLE collaboration_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    estimate_id     UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
    contractor_id   UUID NOT NULL REFERENCES specialty_contractors(id) ON DELETE CASCADE,
    requester_id    UUID,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled', 'completed')),
    trade_code      VARCHAR(10),
    message         TEXT,
    proposed_start  DATE,
    proposed_end    DATE,
    budget_min      NUMERIC(14,2),
    budget_max      NUMERIC(14,2),
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE collaboration_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id      UUID NOT NULL REFERENCES collaboration_requests(id) ON DELETE CASCADE,
    sender_type     VARCHAR(20) NOT NULL CHECK (sender_type IN ('client', 'contractor', 'system')),
    sender_id       UUID,
    content         TEXT NOT NULL,
    attachments     JSONB DEFAULT '[]',
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE matching_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    estimate_id     UUID REFERENCES estimates(id) ON DELETE SET NULL,
    trade_code      VARCHAR(10),
    criteria        JSONB NOT NULL DEFAULT '{}',
    results         JSONB NOT NULL DEFAULT '[]',
    total_matched   INTEGER DEFAULT 0,
    algorithm       VARCHAR(50),
    execution_ms    INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 10. CONSULT SESSIONS & FLOOR PLANS
-- ============================================================

CREATE TABLE consult_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID,
    estimate_id     UUID REFERENCES estimates(id) ON DELETE SET NULL,
    session_type    VARCHAR(30) NOT NULL CHECK (session_type IN ('chat', 'voice', 'video', 'in_person')),
    status          VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'abandoned')),
    messages        JSONB DEFAULT '[]',
    context         JSONB DEFAULT '{}',
    summary         TEXT,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at        TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE floor_plans (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID,
    estimate_id     UUID REFERENCES estimates(id) ON DELETE SET NULL,
    title           VARCHAR(200) NOT NULL,
    file_url        TEXT,
    file_type       VARCHAR(20) CHECK (file_type IN ('image', 'pdf', 'cad', 'svg')),
    file_size_bytes BIGINT,
    analysis        JSONB DEFAULT '{}',
    rooms_detected  JSONB DEFAULT '[]',
    total_area_m2   NUMERIC(10,2),
    status          VARCHAR(20) NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'analyzed', 'failed')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 11. LEARNING QUEUE & LEARNING LOG
-- ============================================================

CREATE TABLE learning_queue (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type     VARCHAR(30) NOT NULL CHECK (source_type IN ('crawl', 'user_feedback', 'market_data', 'manual')),
    source_id       UUID,
    data_type       VARCHAR(30) NOT NULL CHECK (data_type IN ('price_update', 'new_item', 'correction', 'trend')),
    payload         JSONB NOT NULL,
    priority        INTEGER NOT NULL DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
    status          VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'applied', 'rejected', 'failed')),
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at    TIMESTAMPTZ
);

CREATE TABLE learning_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    queue_id        UUID REFERENCES learning_queue(id) ON DELETE SET NULL,
    action          VARCHAR(50) NOT NULL,
    entity_type     VARCHAR(30) NOT NULL,
    entity_id       UUID,
    before_state    JSONB,
    after_state     JSONB,
    confidence      NUMERIC(5,4),
    applied_by      VARCHAR(50) NOT NULL DEFAULT 'system',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 12. INDEXES
-- ============================================================

-- Space types & areas
CREATE INDEX idx_space_types_category ON space_types(category);
CREATE INDEX idx_space_types_code ON space_types(code);
CREATE INDEX idx_space_areas_space_type ON space_areas(space_type_id);

-- Finish categories & items
CREATE INDEX idx_finish_categories_code ON finish_categories(code);
CREATE INDEX idx_finish_items_category ON finish_items(category_id);
CREATE INDEX idx_finish_items_code ON finish_items(code);

-- Sub-materials & prerequisite processes
CREATE INDEX idx_sub_materials_code ON sub_materials(code);
CREATE INDEX idx_prerequisite_processes_code ON prerequisite_processes(code);

-- Mapping tables
CREATE INDEX idx_finish_prereq_finish ON finish_prereq_mapping(finish_item_id);
CREATE INDEX idx_finish_prereq_prereq ON finish_prereq_mapping(prereq_id);
CREATE INDEX idx_finish_submat_finish ON finish_submaterial_mapping(finish_item_id);
CREATE INDEX idx_finish_submat_submat ON finish_submaterial_mapping(sub_material_id);

-- Labor costs
CREATE INDEX idx_labor_costs_code ON labor_costs(code);
CREATE INDEX idx_labor_costs_trade ON labor_costs(trade);
CREATE INDEX idx_labor_costs_region ON labor_costs(region);
CREATE INDEX idx_labor_costs_effective ON labor_costs(effective_from, effective_to);

-- Material prices
CREATE INDEX idx_material_prices_code ON material_prices(code);
CREATE INDEX idx_material_prices_category ON material_prices(category);
CREATE INDEX idx_material_prices_region ON material_prices(region);
CREATE INDEX idx_material_prices_effective ON material_prices(effective_from, effective_to);

-- Overhead rates
CREATE INDEX idx_overhead_rates_code ON overhead_rates(code);
CREATE INDEX idx_overhead_rates_type ON overhead_rates(rate_type);

-- Price history
CREATE INDEX idx_price_history_entity ON price_history(entity_type, entity_id);
CREATE INDEX idx_price_history_recorded ON price_history(recorded_at);

-- Crawl logs
CREATE INDEX idx_crawl_logs_source ON crawl_logs(source_name);
CREATE INDEX idx_crawl_logs_status ON crawl_logs(status);
CREATE INDEX idx_crawl_logs_started ON crawl_logs(started_at);

-- Estimates
CREATE INDEX idx_estimates_user ON estimates(user_id);
CREATE INDEX idx_estimates_status ON estimates(status);
CREATE INDEX idx_estimates_project_type ON estimates(project_type);
CREATE INDEX idx_estimates_created ON estimates(created_at);

-- Estimate items
CREATE INDEX idx_estimate_items_estimate ON estimate_items(estimate_id);
CREATE INDEX idx_estimate_items_space ON estimate_items(space_type_id);
CREATE INDEX idx_estimate_items_finish ON estimate_items(finish_item_id);

-- Estimate space summary
CREATE INDEX idx_estimate_space_summary_estimate ON estimate_space_summary(estimate_id);

-- Estimate versions
CREATE INDEX idx_estimate_versions_estimate ON estimate_versions(estimate_id);

-- Specialty contractors
CREATE INDEX idx_contractors_region ON specialty_contractors(region);
CREATE INDEX idx_contractors_rating ON specialty_contractors(rating);
CREATE INDEX idx_contractors_active ON specialty_contractors(is_active);
CREATE INDEX idx_contractor_trades_contractor ON contractor_trades(contractor_id);
CREATE INDEX idx_contractor_trades_code ON contractor_trades(trade_code);
CREATE INDEX idx_contractor_schedules_contractor ON contractor_schedules(contractor_id);
CREATE INDEX idx_contractor_schedules_date ON contractor_schedules(date);
CREATE INDEX idx_contractor_schedules_status ON contractor_schedules(status);
CREATE INDEX idx_contractor_reviews_contractor ON contractor_reviews(contractor_id);
CREATE INDEX idx_contractor_reviews_rating ON contractor_reviews(rating);
CREATE INDEX idx_contractor_portfolio_contractor ON contractor_portfolio(contractor_id);

-- Collaboration
CREATE INDEX idx_collab_requests_estimate ON collaboration_requests(estimate_id);
CREATE INDEX idx_collab_requests_contractor ON collaboration_requests(contractor_id);
CREATE INDEX idx_collab_requests_status ON collaboration_requests(status);
CREATE INDEX idx_collab_messages_request ON collaboration_messages(request_id);
CREATE INDEX idx_collab_messages_read ON collaboration_messages(is_read);
CREATE INDEX idx_matching_logs_estimate ON matching_logs(estimate_id);
CREATE INDEX idx_matching_logs_trade ON matching_logs(trade_code);

-- Consult sessions
CREATE INDEX idx_consult_sessions_user ON consult_sessions(user_id);
CREATE INDEX idx_consult_sessions_estimate ON consult_sessions(estimate_id);
CREATE INDEX idx_consult_sessions_status ON consult_sessions(status);

-- Floor plans
CREATE INDEX idx_floor_plans_user ON floor_plans(user_id);
CREATE INDEX idx_floor_plans_estimate ON floor_plans(estimate_id);
CREATE INDEX idx_floor_plans_status ON floor_plans(status);

-- Learning
CREATE INDEX idx_learning_queue_status ON learning_queue(status);
CREATE INDEX idx_learning_queue_priority ON learning_queue(priority);
CREATE INDEX idx_learning_queue_source ON learning_queue(source_type);
CREATE INDEX idx_learning_log_queue ON learning_log(queue_id);
CREATE INDEX idx_learning_log_entity ON learning_log(entity_type, entity_id);
CREATE INDEX idx_learning_log_action ON learning_log(action);

-- Full-text search indexes (trigram)
CREATE INDEX idx_finish_items_name_trgm ON finish_items USING gin (name gin_trgm_ops);
CREATE INDEX idx_sub_materials_name_trgm ON sub_materials USING gin (name gin_trgm_ops);
CREATE INDEX idx_contractors_name_trgm ON specialty_contractors USING gin (company_name gin_trgm_ops);

-- ============================================================
-- 13. UPDATED_AT TRIGGER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to all tables with updated_at column
CREATE TRIGGER trg_space_types_updated_at BEFORE UPDATE ON space_types FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_space_areas_updated_at BEFORE UPDATE ON space_areas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_finish_categories_updated_at BEFORE UPDATE ON finish_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_finish_items_updated_at BEFORE UPDATE ON finish_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_sub_materials_updated_at BEFORE UPDATE ON sub_materials FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_prerequisite_processes_updated_at BEFORE UPDATE ON prerequisite_processes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_labor_costs_updated_at BEFORE UPDATE ON labor_costs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_material_prices_updated_at BEFORE UPDATE ON material_prices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_overhead_rates_updated_at BEFORE UPDATE ON overhead_rates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_estimates_updated_at BEFORE UPDATE ON estimates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_estimate_items_updated_at BEFORE UPDATE ON estimate_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_estimate_space_summary_updated_at BEFORE UPDATE ON estimate_space_summary FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_contractors_updated_at BEFORE UPDATE ON specialty_contractors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_contractor_schedules_updated_at BEFORE UPDATE ON contractor_schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_contractor_reviews_updated_at BEFORE UPDATE ON contractor_reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_contractor_portfolio_updated_at BEFORE UPDATE ON contractor_portfolio FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_collab_requests_updated_at BEFORE UPDATE ON collaboration_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_consult_sessions_updated_at BEFORE UPDATE ON consult_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_floor_plans_updated_at BEFORE UPDATE ON floor_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- SEED DATA
-- ============================================================

-- ============================================================
-- S1. SPACE TYPES (7 residential space types)
-- ============================================================

INSERT INTO space_types (code, name, category, description) VALUES
    ('RES-LIV', '거실', 'residential', '거실 (Living Room) - 주거용 거실 공간'),
    ('RES-KIT', '주방', 'residential', '주방 (Kitchen) - 주거용 주방 공간'),
    ('RES-MBR', '안방', 'residential', '안방 (Master Bedroom) - 주거용 안방'),
    ('RES-BR',  '침실', 'residential', '침실 (Bedroom) - 주거용 일반 침실'),
    ('RES-BTH', '욕실', 'residential', '욕실 (Bathroom) - 주거용 욕실'),
    ('RES-ENT', '현관', 'residential', '현관 (Entryway) - 주거용 현관'),
    ('RES-BAL', '발코니', 'residential', '발코니 (Balcony) - 주거용 발코니');

-- ============================================================
-- S2. SPACE AREAS (default area ranges per space type)
-- ============================================================

INSERT INTO space_areas (space_type_id, label, min_area_m2, max_area_m2, default_area_m2)
SELECT st.id, 'small', 10.00, 15.00, 12.50
FROM space_types st WHERE st.code = 'RES-LIV';

INSERT INTO space_areas (space_type_id, label, min_area_m2, max_area_m2, default_area_m2)
SELECT st.id, 'medium', 15.00, 25.00, 20.00
FROM space_types st WHERE st.code = 'RES-LIV';

INSERT INTO space_areas (space_type_id, label, min_area_m2, max_area_m2, default_area_m2)
SELECT st.id, 'large', 25.00, 40.00, 33.00
FROM space_types st WHERE st.code = 'RES-LIV';

INSERT INTO space_areas (space_type_id, label, min_area_m2, max_area_m2, default_area_m2)
SELECT st.id, 'small', 5.00, 8.00, 6.50
FROM space_types st WHERE st.code = 'RES-KIT';

INSERT INTO space_areas (space_type_id, label, min_area_m2, max_area_m2, default_area_m2)
SELECT st.id, 'medium', 8.00, 13.00, 10.00
FROM space_types st WHERE st.code = 'RES-KIT';

INSERT INTO space_areas (space_type_id, label, min_area_m2, max_area_m2, default_area_m2)
SELECT st.id, 'large', 13.00, 20.00, 16.00
FROM space_types st WHERE st.code = 'RES-KIT';

INSERT INTO space_areas (space_type_id, label, min_area_m2, max_area_m2, default_area_m2)
SELECT st.id, 'small', 10.00, 14.00, 12.00
FROM space_types st WHERE st.code = 'RES-MBR';

INSERT INTO space_areas (space_type_id, label, min_area_m2, max_area_m2, default_area_m2)
SELECT st.id, 'medium', 14.00, 20.00, 17.00
FROM space_types st WHERE st.code = 'RES-MBR';

INSERT INTO space_areas (space_type_id, label, min_area_m2, max_area_m2, default_area_m2)
SELECT st.id, 'large', 20.00, 33.00, 26.00
FROM space_types st WHERE st.code = 'RES-MBR';

INSERT INTO space_areas (space_type_id, label, min_area_m2, max_area_m2, default_area_m2)
SELECT st.id, 'small', 7.00, 10.00, 8.50
FROM space_types st WHERE st.code = 'RES-BR';

INSERT INTO space_areas (space_type_id, label, min_area_m2, max_area_m2, default_area_m2)
SELECT st.id, 'medium', 10.00, 15.00, 12.50
FROM space_types st WHERE st.code = 'RES-BR';

INSERT INTO space_areas (space_type_id, label, min_area_m2, max_area_m2, default_area_m2)
SELECT st.id, 'large', 15.00, 23.00, 18.00
FROM space_types st WHERE st.code = 'RES-BR';

INSERT INTO space_areas (space_type_id, label, min_area_m2, max_area_m2, default_area_m2)
SELECT st.id, 'small', 2.50, 4.00, 3.30
FROM space_types st WHERE st.code = 'RES-BTH';

INSERT INTO space_areas (space_type_id, label, min_area_m2, max_area_m2, default_area_m2)
SELECT st.id, 'medium', 4.00, 6.50, 5.00
FROM space_types st WHERE st.code = 'RES-BTH';

INSERT INTO space_areas (space_type_id, label, min_area_m2, max_area_m2, default_area_m2)
SELECT st.id, 'large', 6.50, 10.00, 8.00
FROM space_types st WHERE st.code = 'RES-BTH';

INSERT INTO space_areas (space_type_id, label, min_area_m2, max_area_m2, default_area_m2)
SELECT st.id, 'small', 2.00, 3.50, 2.80
FROM space_types st WHERE st.code = 'RES-ENT';

INSERT INTO space_areas (space_type_id, label, min_area_m2, max_area_m2, default_area_m2)
SELECT st.id, 'medium', 3.50, 6.00, 4.50
FROM space_types st WHERE st.code = 'RES-ENT';

INSERT INTO space_areas (space_type_id, label, min_area_m2, max_area_m2, default_area_m2)
SELECT st.id, 'large', 6.00, 10.00, 8.00
FROM space_types st WHERE st.code = 'RES-ENT';

INSERT INTO space_areas (space_type_id, label, min_area_m2, max_area_m2, default_area_m2)
SELECT st.id, 'small', 3.00, 5.00, 4.00
FROM space_types st WHERE st.code = 'RES-BAL';

INSERT INTO space_areas (space_type_id, label, min_area_m2, max_area_m2, default_area_m2)
SELECT st.id, 'medium', 5.00, 8.00, 6.50
FROM space_types st WHERE st.code = 'RES-BAL';

INSERT INTO space_areas (space_type_id, label, min_area_m2, max_area_m2, default_area_m2)
SELECT st.id, 'large', 8.00, 15.00, 11.00
FROM space_types st WHERE st.code = 'RES-BAL';

-- ============================================================
-- S3. LABOR COSTS (13 records: L001 - L701)
-- ============================================================

INSERT INTO labor_costs (code, trade, skill_level, daily_rate, hourly_rate, unit, region, source) VALUES
    ('L001', '도배공', 'journeyman', 250000, 31250, 'day', 'seoul', '대한건설협회 2024 노임단가'),
    ('L002', '타일공', 'journeyman', 280000, 35000, 'day', 'seoul', '대한건설협회 2024 노임단가'),
    ('L003', '목공', 'journeyman', 270000, 33750, 'day', 'seoul', '대한건설협회 2024 노임단가'),
    ('L004', '전기공', 'journeyman', 290000, 36250, 'day', 'seoul', '대한건설협회 2024 노임단가'),
    ('L005', '설비공', 'journeyman', 280000, 35000, 'day', 'seoul', '대한건설협회 2024 노임단가'),
    ('L006', '도장공', 'journeyman', 240000, 30000, 'day', 'seoul', '대한건설협회 2024 노임단가'),
    ('L007', '철거공', 'journeyman', 220000, 27500, 'day', 'seoul', '대한건설협회 2024 노임단가'),
    ('L101', '보조공 (도배)', 'helper', 150000, 18750, 'day', 'seoul', '대한건설협회 2024 노임단가'),
    ('L102', '보조공 (타일)', 'helper', 160000, 20000, 'day', 'seoul', '대한건설협회 2024 노임단가'),
    ('L103', '보조공 (목공)', 'helper', 155000, 19375, 'day', 'seoul', '대한건설협회 2024 노임단가'),
    ('L301', '숙련 타일공', 'master', 350000, 43750, 'day', 'seoul', '대한건설협회 2024 노임단가'),
    ('L302', '숙련 목공', 'master', 340000, 42500, 'day', 'seoul', '대한건설협회 2024 노임단가'),
    ('L701', '특수 방수공', 'specialist', 380000, 47500, 'day', 'seoul', '대한건설협회 2024 노임단가');

-- ============================================================
-- S4. OVERHEAD RATES
-- ============================================================

INSERT INTO overhead_rates (code, name, rate_type, rate_value, base, description) VALUES
    ('OH-IND', '간접노무비', 'percentage', 14.5000, 'direct_labor', '직접노무비 대비 간접노무비 비율 (14.5%)'),
    ('OH-SAN', '산재보험료', 'percentage', 3.7000, 'total_labor', '총 노무비 대비 산재보험료 비율 (3.7%)'),
    ('OH-NHI', '국민건강보험료', 'percentage', 3.5450, 'total_labor', '총 노무비 대비 건강보험료 비율 (3.545%)'),
    ('OH-NPS', '국민연금', 'percentage', 4.5000, 'total_labor', '총 노무비 대비 국민연금 비율 (4.5%)'),
    ('OH-EMP', '고용보험료', 'percentage', 1.1500, 'total_labor', '총 노무비 대비 고용보험료 비율 (1.15%)'),
    ('OH-RET', '퇴직공제부금', 'percentage', 2.3000, 'direct_labor', '직접노무비 대비 퇴직공제부금 비율 (2.3%)'),
    ('OH-EXP', '경비', 'percentage', 7.0000, 'material_labor', '재료비+노무비 합계 대비 경비 비율 (7%)'),
    ('OH-GNA', '일반관리비', 'percentage', 6.0000, 'subtotal', '순공사비 합계 대비 일반관리비 비율 (6%)'),
    ('OH-PRF', '이윤', 'percentage', 15.0000, 'labor_overhead', '노무비+경비+일반관리비 합계 대비 이윤 비율 (15%)'),
    ('OH-VAT', '부가가치세', 'percentage', 10.0000, 'total_before_tax', '도급액 대비 부가가치세 비율 (10%)'),
    ('OH-WAS', '폐기물처리비', 'per_unit', 35000.0000, 'per_ton', '건설폐기물 처리비 (톤당)'),
    ('OH-SAF', '안전관리비', 'percentage', 2.9300, 'material_labor', '재료비+노무비 합계 대비 안전관리비 비율 (2.93%)'),
    ('OH-ENV', '환경보전비', 'percentage', 0.5000, 'material_labor', '재료비+노무비 합계 대비 환경보전비 비율 (0.5%)');

-- ============================================================
-- S5. TRADE CODES (22 trades: T01 - T22)
-- Inserted as reference data into a separate lookup;
-- also used by contractor_trades as trade_code values.
-- We store these in labor_costs-compatible references or
-- as a comment-based reference. For flexibility, we create
-- a lightweight reference table.
-- ============================================================

-- Trade reference (lightweight lookup for contractor_trades)
CREATE TABLE IF NOT EXISTS trade_codes (
    code            VARCHAR(10) PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    category        VARCHAR(50),
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO trade_codes (code, name, category, description) VALUES
    ('T01', '도배', 'finishing', '벽지/도배 시공 (Wallpapering)'),
    ('T02', '타일', 'finishing', '타일 시공 (Tiling)'),
    ('T03', '목공', 'structure', '목공 시공 (Carpentry)'),
    ('T04', '전기', 'MEP', '전기 시공 (Electrical)'),
    ('T05', '설비', 'MEP', '배관/설비 시공 (Plumbing & Mechanical)'),
    ('T06', '도장', 'finishing', '도장/페인트 시공 (Painting)'),
    ('T07', '철거', 'demolition', '철거 시공 (Demolition)'),
    ('T08', '방수', 'waterproofing', '방수 시공 (Waterproofing)'),
    ('T09', '금속', 'structure', '금속 시공 (Metalwork)'),
    ('T10', '유리', 'finishing', '유리/창호 시공 (Glazing)'),
    ('T11', '석재', 'finishing', '석재 시공 (Stonework)'),
    ('T12', '조적', 'structure', '조적/벽돌 시공 (Masonry)'),
    ('T13', '미장', 'finishing', '미장/플라스터 시공 (Plastering)'),
    ('T14', '단열', 'insulation', '단열 시공 (Insulation)'),
    ('T15', '주방가구', 'furniture', '주방 가구 시공 (Kitchen Furniture)'),
    ('T16', '붙박이장', 'furniture', '붙박이장 시공 (Built-in Closets)'),
    ('T17', '바닥재', 'finishing', '바닥재 시공 (Flooring)'),
    ('T18', '조명', 'MEP', '조명 시공 (Lighting)'),
    ('T19', '욕실', 'MEP', '욕실 시공 (Bathroom Fixtures)'),
    ('T20', 'HVAC', 'MEP', '냉난방/공조 시공 (HVAC)'),
    ('T21', '보양', 'protection', '보양 시공 (Surface Protection)'),
    ('T22', '청소', 'cleaning', '입주 청소 (Cleaning)');

-- Index for trade_codes
CREATE INDEX idx_trade_codes_category ON trade_codes(category);

-- ============================================================
-- End of INPICK Database Schema
-- ============================================================
