-- Migration: Track sent monthly reports (prevents duplicate emails on cron retries)
-- Run this in the Supabase SQL Editor

CREATE TABLE monthly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  month VARCHAR(7) NOT NULL, -- YYYY-MM
  sent_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (household_id, month)
);

-- Only accessed server-side with the service role key
ALTER TABLE monthly_reports ENABLE ROW LEVEL SECURITY;
