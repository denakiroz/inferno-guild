-- ═══════════════════════════════════════════════════════════════════════════
-- Add battle_date to member_potential_batches
--
-- imported_at = วันที่อัปโหลดข้อมูลเข้าระบบ
-- battle_date = วันที่รบจริง (ใช้สำหรับ filter season)
--
-- Season filter เปลี่ยนจาก imported_at::date -> battle_date
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Add battle_date column (backfill from imported_at)
ALTER TABLE public.member_potential_batches
  ADD COLUMN IF NOT EXISTS battle_date date;

UPDATE public.member_potential_batches
  SET battle_date = imported_at::date
  WHERE battle_date IS NULL;

ALTER TABLE public.member_potential_batches
  ALTER COLUMN battle_date SET DEFAULT CURRENT_DATE;

-- 2. Index for range queries
CREATE INDEX IF NOT EXISTS idx_mp_batches_battle_date
  ON public.member_potential_batches (battle_date);

-- 3. Update RPC to filter by battle_date instead of imported_at
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
    SELECT id
    FROM public.member_potential_batches
    WHERE (p_from_date IS NULL OR battle_date >= p_from_date)
      AND (p_to_date   IS NULL OR battle_date <= p_to_date)
  ),
  batch_avgs AS (
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
    SELECT
      userdiscordid,
      COUNT(*)::bigint       AS batch_count,
      AVG(kill_avg)          AS avg_kill,
      AVG(assist_avg)        AS avg_assist,
      AVG(supply_avg)        AS avg_supply,
      AVG(damage_player_avg) AS avg_damage_player,
      AVG(damage_fort_avg)   AS avg_damage_fort,
      AVG(heal_avg)          AS avg_heal,
      AVG(damage_taken_avg)  AS avg_damage_taken,
      AVG(death_avg)         AS avg_death,
      AVG(revive_avg)        AS avg_revive
    FROM batch_avgs
    GROUP BY userdiscordid
  ),
  class_counts AS (
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
    SELECT DISTINCT ON (userdiscordid)
      userdiscordid,
      class_id
    FROM class_counts
    ORDER BY userdiscordid, cnt DESC, class_id NULLS LAST
  )
  SELECT
    u.userdiscordid,
    cm.class_id::int AS class_id,
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

GRANT EXECUTE ON FUNCTION public.get_leaderboard_aggregates(date, date)
  TO authenticated, service_role, anon;

-- ═══════════════════════════════════════════════════════════════════════════
-- Verify:
--   SELECT id, label, battle_date, imported_at FROM member_potential_batches LIMIT 10;
--   SELECT * FROM get_leaderboard_aggregates('2026-06-28', '2026-06-30');  -- should be empty
-- ═══════════════════════════════════════════════════════════════════════════
