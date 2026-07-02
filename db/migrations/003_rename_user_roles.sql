-- Migration: Rename user roles to uppercase with OPS_ prefix
-- Description: Rename role values from admin/ops/user/finance to OPS_ADMIN/OPS_REVIEWER/USER/FINANCE

BEGIN;

-- Drop the old constraint first to allow updates
ALTER TABLE users DROP CONSTRAINT IF EXISTS valid_user_role;

-- Update existing role values in users table
UPDATE users SET role = 'USER' WHERE role = 'user';
UPDATE users SET role = 'OPS_ADMIN' WHERE role = 'admin';
UPDATE users SET role = 'OPS_REVIEWER' WHERE role = 'ops';
UPDATE users SET role = 'FINANCE' WHERE role = 'finance';

-- Update existing actorType values in audit_logs table
UPDATE audit_logs SET actor_type = 'USER' WHERE actor_type = 'user';
UPDATE audit_logs SET actor_type = 'OPS_ADMIN' WHERE actor_type = 'admin';
UPDATE audit_logs SET actor_type = 'OPS_REVIEWER' WHERE actor_type = 'ops';
UPDATE audit_logs SET actor_type = 'FINANCE' WHERE actor_type = 'finance';

-- Add the new constraint with updated role values
ALTER TABLE users ADD CONSTRAINT valid_user_role CHECK (role IN ('USER', 'OPS_ADMIN', 'OPS_REVIEWER', 'FINANCE'));

COMMIT;
