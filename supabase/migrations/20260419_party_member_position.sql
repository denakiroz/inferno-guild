-- Add position column to event_party_members for in-party ordering
-- (ให้แอดมินจัดลำดับสมาชิกใน party ได้)

ALTER TABLE event_party_members
  ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 999999;

-- index for sort-within-party (party_id, position)
CREATE INDEX IF NOT EXISTS idx_event_party_members_party_pos
  ON event_party_members(party_id, position);
