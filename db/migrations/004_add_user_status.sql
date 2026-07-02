-- Migration: 004_add_user_status
-- Description: Add status column to users table for account activation/suspension

BEGIN;

-- Add status column with default 'ACTIVE'
ALTER TABLE users
ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE';

-- Add check constraint for valid status values
ALTER TABLE users
ADD CONSTRAINT valid_user_status CHECK (status IN ('ACTIVE', 'SUSPENDED'));

-- Add comment for the column
COMMENT ON COLUMN users.status IS 'User account status: ACTIVE (normal), SUSPENDED (admin suspended)';

-- Create index for status lookups
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

COMMIT;
