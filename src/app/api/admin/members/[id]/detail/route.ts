// app/api/admin/members/[id]/detail/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

async function requireAdminSession() {
  const cookieStore = await cookies();
  const sid = cookieStore.get(env.AUTH_COOKIE_NAME)?.value;
  if (!sid) return null;

  const session = await getSession(sid);
  if (!session) return null;

  // รองรับ admin จริง หรือ guild=0 (ตามแนวทางใน MembersClient)
  const isAdmin = !!(session as any).isAdmin || Number((session as any).guild) === 0;
  if (!isAdmin) return null;

  return session;
}

type UltimateSkillRow = {
  id: number;
  name: string;
  ultimate_skill_url: string | null;
};

type MemberUltimateRow = {
  ultimate_skill_id: number;
  ultimate_skill: UltimateSkillRow | UltimateSkillRow[] | null;
};

type EquipmentCreateRow = {
  id: number;
  name: string;
  image_url: string | null;
  type: number; // 1..4
};

type MemberSkillStoneRow = {
  id: number;
  member_id: number;
  equipment_create_id: number;
  color: string | null;
  created_at: string | null;

  // IMPORTANT: Supabase can return relationship as array if FK is not detected/inferred as 1-1.
  equipment_create: EquipmentCreateRow | EquipmentCreateRow[] | null;
};

type MemberEquipmentSetRow = {
  id: number;
  member_id: number;
  element: any; // jsonb
  image: string | null;
  image_2: string | null;
  created_at: string | null;
  update_date: string | null;
};

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdminSession();
    if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

    const { id } = await ctx.params;
    const memberId = Number(id);
    if (!Number.isFinite(memberId) || memberId <= 0) {
      return NextResponse.json({ ok: false, error: "invalid_member_id" }, { status: 400 });
    }

    // member basic
    const memQ = supabaseAdmin
      .from("member")
      .select("id, name, guild, class_id, power, discord_user_id, status, update_date")
      .eq("id", memberId)
      .maybeSingle();

    // ultimate
    const ultQ = supabaseAdmin
      .from("member_ultimate_skill")
      .select(
        `
        ultimate_skill_id,
        ultimate_skill:ultimate_skill(
          id,
          name,
          ultimate_skill_url
        )
      `
      )
      .eq("member_id", memberId)
      .order("ultimate_skill_id", { ascending: true });

    // internal power sets (member_equipment)
    const equipSetQ = supabaseAdmin
      .from("member_equipment")
      .select("id, member_id, element, image, image_2, created_at, update_date")
      .eq("member_id", memberId)
      .order("created_at", { ascending: true });

    // skill stones (member_equipment_create -> equipment_create)
    const stonesQ = supabaseAdmin
      .from("member_equipment_create")
      .select(
        `
        id,
        member_id,
        equipment_create_id,
        color,
        created_at,
        equipment_create:equipment_create(
          id,
          name,
          image_url,
          type
        )
      `
      )
      .eq("member_id", memberId)
      .order("created_at", { ascending: true });

    const [memR, ultR, setR, stoneR] = await Promise.all([memQ, ultQ, equipSetQ, stonesQ]);

    if (memR.error) return NextResponse.json({ ok: false, error: memR.error.message }, { status: 500 });
    if (!memR.data) return NextResponse.json({ ok: false, error: "member_not_found" }, { status: 404 });

    if (ultR.error) return NextResponse.json({ ok: false, error: ultR.error.message }, { status: 500 });
    if (setR.error) return NextResponse.json({ ok: false, error: setR.error.message }, { status: 500 });
    if (stoneR.error) return NextResponse.json({ ok: false, error: stoneR.error.message }, { status: 500 });

    const ultimateRows = (Array.isArray(ultR.data) ? ultR.data : []) as MemberUltimateRow[];

    // Normalize ultimate_skill to a single object per row (or null)
    const ultimateSkills: UltimateSkillRow[] = ultimateRows
      .map((r) => {
        const u = (r as any)?.ultimate_skill as UltimateSkillRow | UltimateSkillRow[] | null | undefined;
        if (Array.isArray(u)) return u[0] ?? null;
        return u ?? null;
      })
      .filter((u): u is UltimateSkillRow => !!u && typeof (u as any).id === "number");

    const equipmentSets = ((setR.data ?? []) as MemberEquipmentSetRow[]).map((x) => ({
      id: Number(x.id),
      member_id: Number(x.member_id),
      element: x.element ?? {},
      image: x.image ?? null,
      image_2: (x as any).image_2 ?? null,
      created_at: x.created_at ?? null,
      update_date: (x as any).update_date ?? null,
    }));

    // Normalize equipment_create to single object (or null)
    const stoneRows = (Array.isArray(stoneR.data) ? stoneR.data : []) as MemberSkillStoneRow[];

    const skillStones = stoneRows.map((x) => {
      const ecRaw = (x as any).equipment_create as EquipmentCreateRow | EquipmentCreateRow[] | null | undefined;
      const ec = Array.isArray(ecRaw) ? ecRaw[0] ?? null : ecRaw ?? null;

      return {
        id: Number(x.id),
        member_id: Number(x.member_id),
        equipment_create_id: Number(x.equipment_create_id),
        color: x.color ?? null,
        created_at: x.created_at ?? null,
        equipment_create: ec
          ? {
              id: Number(ec.id),
              name: String((ec as any).name ?? ""),
              image_url: (ec as any).image_url ?? null,
              type: Number((ec as any).type ?? 0),
            }
          : null,
      };
    });

    return NextResponse.json({
      ok: true,
      member: memR.data,
      ultimate_skills: ultimateSkills,
      equipment_sets: equipmentSets,
      skill_stones: skillStones,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
