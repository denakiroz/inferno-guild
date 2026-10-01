-- ============================================================
-- Events / Guild Tournament System
-- ============================================================

-- Main event table
CREATE TABLE IF NOT EXISTS events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  status      text NOT NULL DEFAULT 'open', -- open | closed | finished
  created_at  timestamptz DEFAULT now()
);

-- Member registrations
CREATE TABLE IF NOT EXISTS event_registrations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  discord_user_id text NOT NULL,
  member_name     text,
  registered_at   timestamptz DEFAULT now(),
  UNIQUE (event_id, discord_user_id)
);

-- Parties (teams) for each event
CREATE TABLE IF NOT EXISTS event_parties (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name     text NOT NULL,
  color    text DEFAULT '#6366f1',
  created_at timestamptz DEFAULT now()
);

-- Party members
CREATE TABLE IF NOT EXISTS event_party_members (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id        uuid NOT NULL REFERENCES event_parties(id) ON DELETE CASCADE,
  discord_user_id text NOT NULL,
  member_name     text,
  position        integer NOT NULL DEFAULT 999999,
  UNIQUE (party_id, discord_user_id)
);

-- League matches (round-robin)
CREATE TABLE IF NOT EXISTS event_matches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  party1_id       uuid NOT NULL REFERENCES event_parties(id),
  party2_id       uuid NOT NULL REFERENCES event_parties(id),
  round           integer,
  match_order     integer,
  status          text NOT NULL DEFAULT 'pending', -- pending | done
  winner_party_id uuid REFERENCES event_parties(id),
  played_at       timestamptz,
  created_at      timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_event_registrations_event   ON event_registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_discord ON event_registrations(discord_user_id);
CREATE INDEX IF NOT EXISTS idx_event_parties_event         ON event_parties(event_id);
CREATE INDEX IF NOT EXISTS idx_event_party_members_party   ON event_party_members(party_id);
CREATE INDEX IF NOT EXISTS idx_event_party_members_party_pos ON event_party_members(party_id, position);
CREATE INDEX IF NOT EXISTS idx_event_matches_event         ON event_matches(event_id);
