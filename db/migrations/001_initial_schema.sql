-- Migration: 001_initial_schema
-- Description: Initial database schema for Digital Wallet MVP

BEGIN;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 1. users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    google_sub VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    bank_account_number VARCHAR(100),
    bank_code VARCHAR(50),
    bank_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT valid_user_role CHECK (role IN ('user', 'admin', 'ops', 'finance'))
);

-- 2. coverage_tiers (Created early for foreign key dependency)
CREATE TABLE IF NOT EXISTS coverage_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label VARCHAR(100) UNIQUE NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'VND',
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES users(id),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- 3. cases
CREATE TABLE IF NOT EXISTS cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    hospital_name VARCHAR(255) NOT NULL,
    planned_visit_at TIMESTAMP WITH TIME ZONE NOT NULL,
    reason_category VARCHAR(100) NOT NULL,
    contact_phone VARCHAR(50),
    contact_email VARCHAR(255),
    notes TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',

    -- Pre-approval fields
    approved_by UUID REFERENCES users(id),
    approved_amount DECIMAL(12, 2),
    approved_currency VARCHAR(3) DEFAULT 'VND',
    coverage_tier_id UUID REFERENCES coverage_tiers(id),
    buffer_amount DECIMAL(12, 2) DEFAULT 0,
    rejection_reason TEXT,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES users(id),
    submitted_at TIMESTAMP WITH TIME ZONE,
    approved_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT valid_case_status CHECK (status IN (
        'DRAFT', 'SUBMITTED', 'PREAPPROVED', 'REJECTED',
        'CARD_ISSUED', 'CLAIM_SUBMITTED', 'IN_REVIEW', 'SETTLED', 'CLOSED'
    ))
);

COMMENT ON TABLE cases IS 'Stores medical case information';
COMMENT ON COLUMN cases.status IS 'Current status of the case';

-- 4. cardholders
CREATE TABLE IF NOT EXISTS cardholders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    airwallex_cardholder_id VARCHAR(100) UNIQUE NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'INDIVIDUAL',
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT valid_cardholder_type CHECK (type IN ('INDIVIDUAL', 'DELEGATE')),
    CONSTRAINT valid_cardholder_status CHECK (status IN ('PENDING', 'INCOMPLETE', 'READY', 'DISABLED'))
);

COMMENT ON TABLE cardholders IS 'Stores Airwallex cardholder information linked to users';
COMMENT ON COLUMN cardholders.airwallex_cardholder_id IS 'External Airwallex cardholder ID';
COMMENT ON COLUMN cardholders.type IS 'Type of cardholder (INDIVIDUAL or DELEGATE)';
COMMENT ON COLUMN cardholders.status IS 'Current status of the cardholder in Airwallex';

-- 5. cards
CREATE TABLE IF NOT EXISTS cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    cardholder_id UUID NOT NULL REFERENCES cardholders(id) ON DELETE CASCADE,
    airwallex_card_id VARCHAR(100) UNIQUE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',

    -- Limits
    limit_amount DECIMAL(12, 2) NOT NULL,
    limit_currency VARCHAR(3) NOT NULL DEFAULT 'VND',
    used_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,

    -- Time window
    active_from TIMESTAMP WITH TIME ZONE NOT NULL,
    active_to TIMESTAMP WITH TIME ZONE NOT NULL,

    -- Controls (JSON for flexibility)
    authorization_controls JSONB NOT NULL DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT valid_card_status CHECK (status IN ('PENDING', 'ACTIVE', 'INACTIVE', 'BLOCKED', 'CLOSED', 'FAILED'))
);

COMMENT ON TABLE cards IS 'Stores Airwallex virtual card information linked to cases and cardholders';
COMMENT ON COLUMN cards.airwallex_card_id IS 'External Airwallex card ID';
COMMENT ON COLUMN cards.limit_amount IS 'Maximum spending limit for the card';
COMMENT ON COLUMN cards.used_amount IS 'Amount already spent on the card';
COMMENT ON COLUMN cards.authorization_controls IS 'JSON object containing card controls (MCC codes, transaction limits, etc.)';

-- 6. card_transactions
CREATE TABLE IF NOT EXISTS card_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id UUID NOT NULL REFERENCES cards(id),
    airwallex_txn_id VARCHAR(100) UNIQUE NOT NULL,

    amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    merchant_name VARCHAR(255),
    merchant_category VARCHAR(10),
    status VARCHAR(50) NOT NULL,

    authorization_code VARCHAR(50),
    transaction_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_transaction_status CHECK (status IN ('PENDING', 'SUCCEEDED', 'FAILED', 'REVERSED'))
);

-- 7. claims
CREATE TABLE IF NOT EXISTS claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id),

    -- User submitted
    bill_amount DECIMAL(12, 2) NOT NULL,
    bill_currency VARCHAR(3) NOT NULL DEFAULT 'VND',
    bill_date DATE NOT NULL,
    out_of_pocket_amount DECIMAL(12, 2) DEFAULT 0,
    declaration_accepted BOOLEAN NOT NULL DEFAULT FALSE,

    -- Ops review
    reviewed_bill_amount DECIMAL(12, 2),
    is_valid BOOLEAN,
    reviewed_by UUID REFERENCES users(id),
    review_notes TEXT,

    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    submitted_at TIMESTAMP WITH TIME ZONE,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES users(id),
    deleted_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT valid_claim_status CHECK (status IN ('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'SETTLED'))
);

-- 8. claim_documents
CREATE TABLE IF NOT EXISTS claim_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id UUID NOT NULL REFERENCES claims(id),

    file_url VARCHAR(1024) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size INTEGER NOT NULL,
    document_type VARCHAR(50) NOT NULL,

    uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT valid_document_type CHECK (document_type IN ('BILL', 'RECEIPT', 'ITEMIZED_STATEMENT', 'OUT_OF_POCKET_PROOF', 'OTHER'))
);

-- 9. settlements
CREATE TABLE IF NOT EXISTS settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id),

    type VARCHAR(50) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'VND',
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',

    -- Airwallex references
    airwallex_payment_link_id VARCHAR(100),
    airwallex_payment_link_url VARCHAR(1024),
    airwallex_transfer_id VARCHAR(100),

    -- Calculation breakdown
    calculation_details JSONB NOT NULL,

    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT valid_settlement_type CHECK (type IN ('COLLECT', 'PAYOUT', 'NONE')),
    CONSTRAINT valid_settlement_status CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'))
);

-- 10. coverage_limits
CREATE TABLE IF NOT EXISTS coverage_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    limit_type VARCHAR(50) UNIQUE NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'VND',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES users(id),
    deleted_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT valid_limit_type CHECK (limit_type IN ('PER_CASE', 'PER_DAY', 'PER_YEAR'))
);

-- 11. cost_share_rules
CREATE TABLE IF NOT EXISTS cost_share_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL DEFAULT 'default',
    deductible_amount DECIMAL(12, 2) NOT NULL DEFAULT 200,
    copay_percentage DECIMAL(5, 2) NOT NULL DEFAULT 10.00,
    copay_cap DECIMAL(12, 2),
    apply_at_settlement BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES users(id),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- 12. card_control_templates
CREATE TABLE IF NOT EXISTS card_control_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,

    -- Airwallex control fields
    allowed_currencies JSONB NOT NULL DEFAULT '["VND"]',
    allowed_merchant_categories JSONB NOT NULL DEFAULT '["8011", "8021", "8031", "8041", "8042", "8043", "8049", "8050", "8062", "8071", "8099"]',

    allowed_transaction_count VARCHAR(20) NOT NULL DEFAULT 'MULTIPLE',

    transaction_limits JSONB NOT NULL DEFAULT '{"max_amount": 50000, "currency": "VND"}',

    default_active_days INTEGER NOT NULL DEFAULT 30,
    default_buffer_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES users(id),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- 13. audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES users(id),
    actor_type VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,

    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,

    before_state JSONB,
    after_state JSONB,

    ip_address INET,
    user_agent TEXT,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 14. webhook_events
CREATE TABLE IF NOT EXISTS webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source VARCHAR(50) NOT NULL,
    event_id VARCHAR(100) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'RECEIVED',
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_webhook_status CHECK (status IN ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);

CREATE INDEX IF NOT EXISTS idx_coverage_tiers_is_active ON coverage_tiers(is_active);
CREATE INDEX IF NOT EXISTS idx_coverage_tiers_deleted_at ON coverage_tiers(deleted_at);

CREATE INDEX IF NOT EXISTS idx_cases_user_id ON cases(user_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_created_at ON cases(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cases_submitted_at ON cases(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_cases_deleted_at ON cases(deleted_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cardholders_user_id ON cardholders(user_id);
CREATE INDEX IF NOT EXISTS idx_cardholders_airwallex_id ON cardholders(airwallex_cardholder_id);
CREATE INDEX IF NOT EXISTS idx_cardholders_status ON cardholders(status);
CREATE INDEX IF NOT EXISTS idx_cardholders_deleted_at ON cardholders(deleted_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cards_case_id ON cards(case_id);
CREATE INDEX IF NOT EXISTS idx_cards_cardholder_id ON cards(cardholder_id);
CREATE INDEX IF NOT EXISTS idx_cards_airwallex_id ON cards(airwallex_card_id);
CREATE INDEX IF NOT EXISTS idx_cards_status ON cards(status);
CREATE INDEX IF NOT EXISTS idx_cards_active_period ON cards(active_from, active_to);
CREATE INDEX IF NOT EXISTS idx_cards_deleted_at ON cards(deleted_at);

CREATE INDEX IF NOT EXISTS idx_card_transactions_card_id ON card_transactions(card_id);
CREATE INDEX IF NOT EXISTS idx_card_transactions_status ON card_transactions(status);
CREATE INDEX IF NOT EXISTS idx_card_transactions_transaction_at ON card_transactions(transaction_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_claims_case_id ON claims(case_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);
CREATE INDEX IF NOT EXISTS idx_claims_deleted_at ON claims(deleted_at);

CREATE INDEX IF NOT EXISTS idx_claim_documents_claim_id ON claim_documents(claim_id);
CREATE INDEX IF NOT EXISTS idx_claim_documents_deleted_at ON claim_documents(deleted_at);

CREATE INDEX IF NOT EXISTS idx_settlements_case_id ON settlements(case_id);
CREATE INDEX IF NOT EXISTS idx_settlements_status ON settlements(status);
CREATE INDEX IF NOT EXISTS idx_settlements_type ON settlements(type);
CREATE INDEX IF NOT EXISTS idx_settlements_deleted_at ON settlements(deleted_at);

CREATE INDEX IF NOT EXISTS idx_coverage_limits_is_active ON coverage_limits(is_active);
CREATE INDEX IF NOT EXISTS idx_coverage_limits_deleted_at ON coverage_limits(deleted_at);

CREATE INDEX IF NOT EXISTS idx_cost_share_rules_is_active ON cost_share_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_cost_share_rules_deleted_at ON cost_share_rules(deleted_at);

CREATE INDEX IF NOT EXISTS idx_card_control_templates_is_active ON card_control_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_card_control_templates_deleted_at ON card_control_templates(deleted_at);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_source_event_id ON webhook_events(source, event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON webhook_events(created_at DESC);

-- TRIGGERS FOR AUTO-UPDATING updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_coverage_tiers_updated_at
    BEFORE UPDATE ON coverage_tiers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cases_updated_at
    BEFORE UPDATE ON cases
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_claims_updated_at
    BEFORE UPDATE ON claims
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_coverage_limits_updated_at
    BEFORE UPDATE ON coverage_limits
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cost_share_rules_updated_at
    BEFORE UPDATE ON cost_share_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_card_control_templates_updated_at
    BEFORE UPDATE ON card_control_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- SEED DATA
INSERT INTO coverage_tiers (label, amount, currency, sort_order) VALUES
('Basic', 5000.00, 'VND', 1),
('Standard', 10000.00, 'VND', 2),
('Premium', 20000.00, 'VND', 3),
('Elite', 50000.00, 'VND', 4)
ON CONFLICT (label) DO NOTHING;

INSERT INTO coverage_limits (limit_type, amount, currency) VALUES
('PER_CASE', 50000.00, 'VND'),
('PER_DAY', 100000.00, 'VND'),
('PER_YEAR', 500000.00, 'VND')
ON CONFLICT (limit_type) DO NOTHING;

INSERT INTO cost_share_rules (name, deductible_amount, copay_percentage, copay_cap) VALUES
('default', 200.00, 10.00, 1000.00);

INSERT INTO card_control_templates (name, allowed_transaction_count, default_active_days) VALUES
('Standard Healthcare', 'MULTIPLE', 30)
ON CONFLICT (name) DO NOTHING;

COMMIT;
