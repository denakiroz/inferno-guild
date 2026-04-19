// src/app/api/admin/members/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { cacheGetOrSet, CK } from "@/lib/redisCache";

export const runtime = "nodejs";

const MEMBERS_TTL = 600; // 10 นาที — members + skills + equipment เปลี่ยนไม่บ่อย

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

/**
 * ฟังก์ชัน heavy — ดึง members + ultimate/special skills + equipment แล้ว attach เข้าด้วยกัน
 * ผลลัพธ์ cache ได้ (ไม่รวม leaves ซึ่งเปลี่ยนบ่อยกว่า)
 */
async function loadMembersWithAttachments(guild: number | null): Promise<any[]> {
  let q = supabaseAdmin.from("member").select(SELECT_MEMBER_WITH_CLASS).order("id", { ascending: true });
  if (guild != null) q = q.eq("guild", guild);

  const { data: rawMembers, error: memErr } = await q;
  if (memErr) throw new Error(memErr.message);

  const baseMembers = (rawMembers ?? []).filter((m: any) => normalizeStatusForFilter(m?.status) !== "inactive");
  let members = baseMembers as any[];

  const memberIds = members.map((m: any) => Number(m?.id)).filter((x: number) => Number.isFinite(x) && x > 0);

  if (memberIds.length === 0) {
    return members.map((m: any) => ({
      ...m,
      ultimate_skill_ids: [],
      special_skill_ids: [],
      equipment_create_ids: [],
      weapon_gold_ids: [],
      weapon_stones: [],
    }));
  }

  // Parallel: ultimate + special + equipment (ไม่ขึ้นต่อกัน)
  const [ultRes, ssRes, ecRes] = await Promise.all([
    supabaseAdmin
      .from("member_ultimate_skill")
      .select("member_id, ultimate_skill_id")
      .in("member_id", memberIds),
    supabaseAdmin
      .from("member_special_skill")
      .select("member_id, special_skill_id")
      .in("member_id", memberIds),
    supabaseAdmin
      .from("member_equipment_create")
      .select("member_id, equipment_create_id, color, equipment_create(type)")
      .in("member_id", memberIds),
  ]);

  if (ultRes.error) throw new Error(ultRes.error.message);

  // ultimate
  const ultMap = new Map<number, number[]>();
  for (const r of (Array.isArray(ultRes.data) ? ultRes.data : []) as any[]) {
    const mid = Number(r?.member_id);
    const uid = Number(r?.ultimate_skill_id);
    if (!Number.isFinite(mid) || mid <= 0) continue;
    if (!Number.isFinite(uid) || uid <= 0) continue;
    const arr = ultMap.get(mid);
    if (arr) arr.push(uid);
    else ultMap.set(mid, [uid]);
  }

  // special (tolerate errors — degrade to empty)
  const ssMap = new Map<number, number[]>();
  if (!ssRes.error) {
    for (const r of (Array.isArray(ssRes.data) ? ssRes.data : []) as any[]) {
      const mid = Number(r?.member_id);
      const sid = Number(r?.special_skill_id);
      if (!Number.isFinite(mid) || mid <= 0) continue;
      if (!Number.isFinite(sid) || sid <= 0) continue;
      const arr = ssMap.get(mid);
      if (arr) arr.push(sid);
      else ssMap.set(mid, [sid]);
    }
  }

  // equipment (tolerate errors — degrade to empty)
  const ecMap = new Map<number, number[]>();
  const goldMap = new Map<number, number[]>();
  const weaponMap = new Map<number, { id: number; color: string }[]>();
  if (!ecRes.error) {
    for (const r of (Array.isArray(ecRes.data) ? ecRes.data : []) as any[]) {
      const mid = Number(r?.member_id);
      const eid = Number(r?.equipment_create_id);
      const color = String(r?.color ?? "").toLowerCase();
      const ec = r?.equipment_create;
      const type = Number(Array.isArray(ec) ? ec[0]?.type : ec?.type);

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
  }

  return members.map((m: any) => {
    const mid = Number(m?.id);
    return {
      ...m,
      ultimate_skill_ids: Array.from(new Set(ultMap.get(mid) ?? [])).sort((a, b) => a - b),
      special_skill_ids: Array.from(new Set(ssMap.get(mid) ?? [])).sort((a, b) => a - b),
      equipment_create_ids: Array.from(new Set(ecMap.get(mid) ?? [])).sort((a, b) => a - b),
      weapon_gold_ids: Array.from(new Set(goldMap.get(mid) ?? [])).sort((a, b) => a - b),
      weapon_stones: weaponMap.get(mid) ?? [],
    };
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const guildParam = url.searchParams.get("guild");
  const guild = guildParam ? Number(guildParam) : null;

  const cookieStore = await cookies();
  const sid = cookieStore.get(env.AUTH_COOKIE_NAME)?.value;

  if (!sid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const session = await getSession(sid);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.isAdmin && !session.isHead) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    // Heavy: members + skills + equipment (cached, TTL 10 นาที, invalidate on write)
    const members = await cacheGetOrSet<any[]>(
      CK.members(guild),
      MEMBERS_TTL,
      () => loadMembersWithAttachments(guild),
    );

    // ⚡ Filter leaves เฉพาะ member_id ที่อยู่ในผลลัพธ์ — ไม่ดึง leave ของกิลด์อื่น
    //    ลด payload + query time อย่างมีนัยสำคัญตอน guild filter
    const memberIds: number[] = (members ?? [])
      .map((m: any) => Number(m?.id))
      .filter((x: number) => Number.isFinite(x) && x > 0);

    if (memberIds.length === 0) {
      return NextResponse.json({ members, leaves: [] }, { status: 200 });
    }

    const leavesRes = await supabaseAdmin
      .from("leave")
      .select("id,date_time,member_id,reason,status,update_date")
      .in("member_id", memberIds)
      .order("date_time", { ascending: false });

    if (leavesRes.error) {
      return NextResponse.json({ members, leaves: [] }, { status: 200 });
    }

    return NextResponse.json({ members, leaves: leavesRes.data ?? [] }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "unknown" }, { status: 500 });
  }
}
