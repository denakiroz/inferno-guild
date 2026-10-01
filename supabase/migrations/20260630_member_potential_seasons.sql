-- ═══════════════════════════════════════════════════════════════════════════
-- Member Potential Seasons
--
-- ตาราง member_potential_seasons เก็บช่วงวันที่ของแต่ละ season
-- Leaderboard จะ filter batch ตาม imported_at BETWEEN start_date AND end_date
--
-- get_leaderboard_aggregates() อัปเดตให้รับ p_from_date / p_to_date
-- ถ้าเป็น NULL จะคำนวณจากทุก batch (all-time)
-- ═══════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Seasons table
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.member_potential_seasons (
  id          serial      PRIMARY KEY,
  name        text        NOT NULL,
  start_date  date        NOT NULL,
  end_date    date        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seasons_date_order CHECK (end_date >= start_date)
);

-- RLS: admin/service_role เท่านั้นที่ write ได้, read เปิดสำหรับ authenticated
ALTER TABLE public.member_potential_seasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seasons_read" ON public.member_potential_seasons
  FOR SELECT USING (auth.role() IN ('authenticated', 'service_role', 'anon'));

CREATE POLICY "seasons_write" ON public.member_potential_seasons
  FOR ALL USING (auth.role() = 'service_role');

-- ────────────────────────────────────────────────────────────────────────────
-- 2. อัปเดต RPC ให้รับ date range (backward-compatible: default = NULL = all-time)
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_leaderboard_aggregates(
  p_from_date date DEFAULT NULL,
  p_to_date   date DEFAULT NULL
)
RETURNS TABLE (
  userdiscordid    text,
  class_id         int,
  batch_count      bigint,
  avg_kill         numeric,
  avg_assist       numeric,
  avg_supply       numeric,
  avg_damage_player numeric,
  avg_damage_fort  numeric,
  avg_heal         numeric,
  avg_damage_taken numeric,
  avg_death        numeric,
  avg_revive       numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH filtered_batches AS (
    -- กรอง batch ตาม date range ถ้ามี param มาให้
    SELECT id
    FROM public.member_potential_batches
    WHERE (p_from_date IS NULL OR imported_at::date >= p_from_date)
      AND (p_to_date   IS NULL OR imported_at::date <= p_to_date)
  ),
  batch_avgs AS (
    -- Step 1: avg per (user, batch)
    SELECT
      r.userdiscordid,
      r.batch_id,
      AVG(r.kill)          AS kill_avg,
      AVG(r.assist)        AS assist_avg,
      AVG(r.supply)        AS supply_avg,
      AVG(r.damage_player) AS damage_player_avg,
      AVG(r.damage_fort)   AS damage_fort_avg,
      AVG(r.heal)          AS heal_avg,
      AVG(r.damage_taken)  AS damage_taken_avg,
      AVG(r.death)         AS death_avg,
      AVG(r.revive)        AS revive_avg
    FROM public.member_potential_records r
    INNER JOIN filtered_batches fb ON fb.id = r.batch_id
    WHERE r.userdiscordid IS NOT NULL
    GROUP BY r.userdiscordid, r.batch_id
  ),
  user_avgs AS (
    -- Step 2: avg of batch-avgs per user
    SELECT
      userdiscordid,
      COUNT(*)::bigint          AS batch_count,
      AVG(kill_avg)             AS avg_kill,
      AVG(assist_avg)           AS avg_assist,
      AVG(supply_avg)           AS avg_supply,
      AVG(damage_player_avg)    AS avg_damage_player,
      AVG(damage_fort_avg)      AS avg_damage_fort,
      AVG(heal_avg)             AS avg_heal,
      AVG(damage_taken_avg)     AS avg_damage_taken,
      AVG(death_avg)            AS avg_death,
      AVG(revive_avg)           AS avg_revive
    FROM batch_avgs
    GROUP BY userdiscordid
  ),
  class_counts AS (
    -- Step 3a: นับ vote ของ class_id ภายใน filtered batches เท่านั้น
    SELECT
      r.userdiscordid,
      r.class_id,
      COUNT(*) AS cnt
    FROM public.member_potential_records r
    INNER JOIN filtered_batches fb ON fb.id = r.batch_id
    WHERE r.userdiscordid IS NOT NULL
    GROUP BY r.userdiscordid, r.class_id
  ),
  class_mode AS (
    -- Step 3b: pick top vote per user (tie-break: smaller class_id, NULL last)
    SELECT DISTINCT ON (userdiscordid)
      userdiscordid,
      class_id
    FROM class_counts
    ORDER BY userdiscordid, cnt DESC, class_id NULLS LAST
  )
  SELECT
    u.userdiscordid,
    cm.class_id::int   AS class_id,
    u.batch_count,
    u.avg_kill,
    u.avg_assist,
    u.avg_supply,
    u.avg_damage_player,
    u.avg_damage_fort,
    u.avg_heal,
    u.avg_damage_taken,
    u.avg_death,
    u.avg_revive
  FROM user_avgs u
  LEFT JOIN class_mode cm ON cm.userdiscordid = u.userdiscordid;
$$;

-- Grant
GRANT EXECUTE ON FUNCTION public.get_leaderboard_aggregates(date, date)
  TO authenticated, service_role, anon;

-- ═══════════════════════════════════════════════════════════════════════════
-- Verify หลังรัน:
--
--   SELECT * FROM get_leaderboard_aggregates() LIMIT 5;                    -- all-time
--   SELECT * FROM get_leaderboard_aggregates('2026-01-01', '2026-02-20');  -- season filter
--   SELECT * FROM member_potential_seasons;
-- ═══════════════════════════════════════════════════════════════════════════
