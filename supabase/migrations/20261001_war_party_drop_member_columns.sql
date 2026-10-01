-- Step 2: run ONLY after step 1 (20261001_war_party_normalize.sql) has been applied,
-- the new code is deployed, and the war builder has been verified.
-- This permanently removes the old denormalized columns from `member`.

ALTER TABLE member
  DROP COLUMN IF EXISTS party,
  DROP COLUMN IF EXISTS party_2,
  DROP COLUMN IF EXISTS pos_party,
  DROP COLUMN IF EXISTS pos_party_2;
