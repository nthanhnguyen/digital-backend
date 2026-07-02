-- Migration: 002_add_paid_to_case_status
-- Description: Add PAID status to valid_case_status constraint

BEGIN;

-- 1. Drop old constraint
ALTER TABLE cases
DROP CONSTRAINT IF EXISTS valid_case_status;

-- 2. Re-create constraint with PAID included
ALTER TABLE cases
ADD CONSTRAINT valid_case_status CHECK (status IN (
    'DRAFT',
    'SUBMITTED',
    'PREAPPROVED',
    'REJECTED',
    'CARD_ISSUED',
    'PAID',
    'CLAIM_SUBMITTED',
    'IN_REVIEW',
    'SETTLED',
    'CLOSED'
));

COMMIT;
