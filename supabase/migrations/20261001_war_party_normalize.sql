-- Normalize war party assignments out of the `member` table.
--
-- Before: member.party / member.pos_party        (round 1, 20:00)
--         member.party_2 / member.pos_party_2    (round 2, 20:30)
-- After : war_party_member(member_id, round, party, position)
--         one row per (member, round)  -> 2 rounds, 10 parties, 6 slots per party
--
-- Step 1 (this file): create the new table and backfill it from the old columns.
-- The old columns are left untouched so the migration is safe to run before the
-- new code is deployed. Run 20261001_war_party_drop_member_columns.sql afterwards.

CREATE TABLE IF NOT EXISTS war_party_member (
  member_id  bigint      NOT NULL REFERENCES member(id) ON DELETE CASCADE,
  round      smallint    NOT NULL CHECK (round IN (1, 2)),         -- 1 = 20:00, 2 = 20:30
  party      smallint    NOT NULL CHECK (party BETWEEN 1 AND 10),
  position   smallint             CHECK (position BETWEEN 1 AND 6), -- slot inside the party
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (member_id, round)
);

-- lookup by round + party (+ ordering inside a party)
CREATE INDEX IF NOT EXISTS idx_war_party_member_round_party_pos
  ON war_party_member (round, party, position);

-- ── Backfill ────────────────────────────────────────────────────────────────
INSERT INTO war_party_member (member_id, round, party, position)
SELECT id,
       1,
       party,
       CASE WHEN pos_party BETWEEN 1 AND 6 THEN pos_party END
FROM member
WHERE party BETWEEN 1 AND 10
ON CONFLICT (member_id, round) DO NOTHING;

INSERT INTO war_party_member (member_id, round, party, position)
SELECT id,
       2,
       party_2,
       CASE WHEN pos_party_2 BETWEEN 1 AND 6 THEN pos_party_2 END
FROM member
WHERE party_2 BETWEEN 1 AND 10
ON CONFLICT (member_id, round) DO NOTHING;

-- ── Sanity check (should return 0 rows) ─────────────────────────────────────
-- SELECT m.id FROM member m
--  WHERE (m.party BETWEEN 1 AND 10 AND NOT EXISTS
--           (SELECT 1 FROM war_party_member w WHERE w.member_id = m.id AND w.round = 1 AND w.party = m.party))
--     OR (m.party_2 BETWEEN 1 AND 10 AND NOT EXISTS
--           (SELECT 1 FROM war_party_member w WHERE w.member_id = m.id AND w.round = 2 AND w.party = m.party_2));
