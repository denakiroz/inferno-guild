-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 1: push leaderboard aggregation from Node.js to Postgres
--
-- ใช้ในไฟล์ src/lib/memberPotential.ts → buildLeaderboard()
--
-- Logic สองชั้นตรงกับโค้ด JS เดิม:
--   1) avg per (user, batch)  — กันเคสที่มีหลาย record ใน batch เดียวกัน
--   2) avg of batch-avgs per user
--   3) class_id = mode() ใน records — ใช้ tie-break แบบ deterministic
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_leaderboard_aggregates()
RETURNS TABLE (
  userdiscordid text,
  class_id int,
  batch_count bigint,
  avg_kill numeric,
  avg_assist numeric,
  avg_supply numeric,
  avg_damage_player numeric,
  avg_damage_fort numeric,
  avg_heal numeric,
  avg_damage_taken numeric,
  avg_death numeric,
  avg_revive numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH batch_avgs AS (
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
    WHERE r.userdiscordid IS NOT NULL
      AND r.batch_id IS NOT NULL
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
    -- Step 3a: นับ vote ของ class_id (รวม null ตามโค้ด JS เดิม)
    SELECT
      userdiscordid,
      class_id,
      COUNT(*) AS cnt
    FROM public.member_potential_records
    WHERE userdiscordid IS NOT NULL
    GROUP BY userdiscordid, class_id
  ),
  class_mode AS (
    -- Step 3b: pick top vote per user
    -- tie-break: smaller class_id first, NULL last (deterministic)
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

-- Grant execute to all authenticated roles (service_role สามารถเรียกได้อยู่แล้ว)
GRANT EXECUTE ON FUNCTION public.get_leaderboard_aggregates() TO authenticated, service_role, anon;

-- ═══════════════════════════════════════════════════════════════════════════
-- Verify หลังรัน migration:
--
--   SELECT * FROM get_leaderboard_aggregates() LIMIT 5;
--
-- ควรเห็นผลลัพธ์ 1 row ต่อ user ที่มีข้อมูลใน member_potential_records
-- ═══════════════════════════════════════════════════════════════════════════
