-- CIVIS AI — Schemes Table Migration
-- Run this in Supabase SQL Editor to enable scraper features
-- (source tracking, state-specific flag, scrape timestamp)
--
-- Dashboard → SQL Editor → paste and click Run

ALTER TABLE schemes ADD COLUMN IF NOT EXISTS source         text DEFAULT 'builtin';
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS state_specific boolean NOT NULL DEFAULT false;
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS scraped_at     timestamptz;

-- Update existing rows to have source = 'builtin'
UPDATE schemes SET source = 'builtin' WHERE source IS NULL;

-- Index for filtering by source
CREATE INDEX IF NOT EXISTS schemes_source_idx       ON schemes(source);
CREATE INDEX IF NOT EXISTS schemes_category_idx     ON schemes(category);
CREATE INDEX IF NOT EXISTS schemes_state_specific_idx ON schemes(state_specific);

-- Verify
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'schemes'
ORDER BY ordinal_position;
