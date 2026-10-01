
-- Add guild column to track which guild's war data this batch belongs to
ALTER TABLE member_potential_batches
  ADD COLUMN IF NOT EXISTS guild integer;
