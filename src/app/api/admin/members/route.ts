// src/app/api/admin/members/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/**
 * Keep shape compatible with old response.
 * - Return members with class join
 * - Do NOT return inactive members
 * - Allow optional guild filter via query param (?guild=1)
 */
const SELECT_MEMBER_WITH_CLASS = `
  id,
  name,
  class_id,
  power,
  party,
  party_2,
  pos_party,
  pos_party_2,
  color,
  is_special,
  guild,
  discord_user_id,
  status,
  special_text,
  remark,
  update_date,
  class:class!member_class_id_fkey(
    id,
    name,
    icon_url
  )
`;

function normalizeStatusForFilter(status: unknown): string {
  if (status === null || status === undefined) return "active";
  return String(status).toLowerCase();
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const guild = url.searchParams.get("guild"); // optional

  const cookieStore = await cookies();
  const sid = cookieStore.get(env.AUTH_COOKIE_NAME)?.value;

  if (!sid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const session = await getSession(sid);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.isAdmin && !session.isHead) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let q = supabaseAdmin.from("member").select(SELECT_MEMBER_WITH_CLASS).order("id", { ascending: true });

  if (guild) q = q.eq("guild", Number(guild));

  const { data: rawMembers, error: memErr } = await q;

  if (memErr) return NextResponse.json({ error: memErr.message }, { status: 500 });

  const baseMembers = (rawMembers ?? []).filter((m: any) => normalizeStatusForFilter(m?.status) !== "inactive");

  // ✅ Attach ultimate_skill_ids per member (source of truth: member_ultimate_skill)
  //    This enables WarBuilder Ultimate filter to count based on member_ultimate_skill mapping.
  let members = baseMembers as any[];

  try {
    const memberIds = (members ?? [])
      .map((m: any) => Number(m?.id))
      .filter((x: number) => Number.isFinite(x) && x > 0);

    if (memberIds.length > 0) {
      const { data: ultRows, error: ultErr } = await supabaseAdmin
        .from("member_ultimate_skill")
        .select("member_id, ultimate_skill_id")
        .in("member_id", memberIds);

      if (ultErr) return NextResponse.json({ error: ultErr.message }, { status: 500 });

      const map = new Map<number, number[]>();

      for (const r of (Array.isArray(ultRows) ? ultRows : []) as any[]) {
        const mid = Number(r?.member_id);
        const uid = Number(r?.ultimate_skill_id);
        if (!Number.isFinite(mid) || mid <= 0) continue;
        if (!Number.isFinite(uid) || uid <= 0) continue;

        const arr = map.get(mid);
        if (arr) arr.push(uid);
        else map.set(mid, [uid]);
      }

      members = (members ?? []).map((m: any) => {
        const ids = map.get(Number(m?.id)) ?? [];
        const uniq = Array.from(new Set(ids)).sort((a, b) => a - b);
        return { ...m, ultimate_skill_ids: uniq };
      });
    } else {
      // keep compatibility: still return ultimate_skill_ids as empty
      members = (members ?? []).map((m: any) => ({ ...m, ultimate_skill_ids: [] }));
    }
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }

  // ✅ Attach special_skill_ids per member (source of truth: member_special_skill)
  try {
    const memberIds = (members ?? [])
      .map((m: any) => Number(m?.id))
      .filter((x: number) => Number.isFinite(x) && x > 0);

    if (memberIds.length > 0) {
      const { data: ssRows } = await supabaseAdmin
        .from("member_special_skill")
        .select("member_id, special_skill_id")
        .in("member_id", memberIds);

      const ssMap = new Map<number, number[]>();
      for (const r of (Array.isArray(ssRows) ? ssRows : []) as any[]) {
        const mid = Number(r?.member_id);
        const sid = Number(r?.special_skill_id);
        if (!Number.isFinite(mid) || mid <= 0) continue;
        if (!Number.isFinite(sid) || sid <= 0) continue;
        const arr = ssMap.get(mid);
        if (arr) arr.push(sid);
        else ssMap.set(mid, [sid]);
      }

      members = (members ?? []).map((m: any) => {
        const ids = ssMap.get(Number(m?.id)) ?? [];
        return { ...m, special_skill_ids: Array.from(new Set(ids)).sort((a, b) => a - b) };
      });
    } else {
      members = (members ?? []).map((m: any) => ({ ...m, special_skill_ids: [] }));
    }
  } catch {
    members = (members ?? []).map((m: any) => ({ ...m, special_skill_ids: [] }));
  }

  // ✅ Attach equipment_create_ids + weapon_gold_ids per member
  try {
    const memberIds = (members ?? [])
      .map((m: any) => Number(m?.id))
      .filter((x: number) => Number.isFinite(x) && x > 0);

    if (memberIds.length > 0) {
      // Fetch with color + join type from equipment_create
      const { data: ecRows } = await supabaseAdmin
        .from("member_equipment_create")
        .select("member_id, equipment_create_id, color, equipment_create(type)")
        .in("member_id", memberIds);

      const ecMap     = new Map<number, number[]>();
      const goldMap   = new Map<number, number[]>();
      const weaponMap = new Map<number, { id: number; color: string }[]>();

      for (const r of (Array.isArray(ecRows) ? ecRows : []) as any[]) {
        const mid   = Number(r?.member_id);
        const eid   = Number(r?.equipment_create_id);
        const color = String(r?.color ?? "").toLowerCase();
        const ec    = r?.equipment_create;
        const type  = Number(Array.isArray(ec) ? ec[0]?.type : ec?.type);

        if (!Number.isFinite(mid) || mid <= 0) continue;
        if (!Number.isFinite(eid) || eid <= 0) continue;

        const allArr = ecMap.get(mid) ?? [];
        allArr.push(eid);
        ecMap.set(mid, allArr);

        if (type === 1) {
          if (color === "gold") {
            const goldArr = goldMap.get(mid) ?? [];
            goldArr.push(eid);
            goldMap.set(mid, goldArr);
          }
          const wArr = weaponMap.get(mid) ?? [];
          wArr.push({ id: eid, color });
          weaponMap.set(mid, wArr);
        }
      }

      members = (members ?? []).map((m: any) => {
        const ids          = ecMap.get(Number(m?.id))     ?? [];
        const goldIds      = goldMap.get(Number(m?.id))   ?? [];
        const weaponStones = weaponMap.get(Number(m?.id)) ?? [];
        return {
          ...m,
          equipment_create_ids: Array.from(new Set(ids)).sort((a, b) => a - b),
          weapon_gold_ids:      Array.from(new Set(goldIds)).sort((a, b) => a - b),
          weapon_stones:        weaponStones,
        };
      });
    } else {
      members = (members ?? []).map((m: any) => ({ ...m, equipment_create_ids: [], weapon_gold_ids: [], weapon_stones: [] }));
    }
  } catch {
    members = (members ?? []).map((m: any) => ({ ...m, equipment_create_ids: [], weapon_gold_ids: [], weapon_stones: [] }));
  }

  const { data: leaves, error: leaveErr } = await supabaseAdmin
    .from("leave")
    // ✅ ดึง status + update_date มาด้วย (สำคัญ)
    .select("id,date_time,member_id,reason,status,update_date")
    .order("date_time", { ascending: false });

  if (leaveErr) {
    return NextResponse.json({ members, leaves: [] }, { status: 200 });
  }

  return NextResponse.json({ members, leaves: leaves ?? [] }, { status: 200 });
}
