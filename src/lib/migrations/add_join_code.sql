-- Migration: Add join code support to households + join requests table
-- Run this in the Supabase SQL Editor

-- 1. Add join code columns to households
ALTER TABLE households ADD COLUMN join_code VARCHAR(8);
ALTER TABLE households ADD COLUMN join_code_enabled BOOLEAN DEFAULT true NOT NULL;
ALTER TABLE households ADD COLUMN join_code_updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Generate codes for existing households (6 chars from uuid, uppercased)
UPDATE households SET join_code = UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FROM 1 FOR 6));

-- 3. Make join_code NOT NULL and unique after backfill
ALTER TABLE households ALTER COLUMN join_code SET NOT NULL;
CREATE UNIQUE INDEX idx_households_join_code ON households(join_code);

-- 4. Create join requests table
CREATE TABLE household_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  requester_user_id UUID NOT NULL,
  code_used VARCHAR(8) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  reviewed_at TIMESTAMPTZ,
  reviewed_by_user_id UUID
);

-- 5. One pending request max per user per household
CREATE UNIQUE INDEX idx_one_pending_per_user_household
  ON household_join_requests(household_id, requester_user_id)
  WHERE status = 'pending';

-- 6. Index for fast lookups
CREATE INDEX idx_join_requests_household ON household_join_requests(household_id);
CREATE INDEX idx_join_requests_requester ON household_join_requests(requester_user_id);

-- 7. Disable RLS on the new table (matching existing pattern — no RLS on core tables)
ALTER TABLE household_join_requests DISABLE ROW LEVEL SECURITY;
