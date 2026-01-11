import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type EquipmentType = 1 | 2 | 3 | 4;
type StoneColor = "red" | "purple" | "gold";

type MemberIdRow = { id: number };

// master
type EquipmentCreateRow = {
  id: number;
  name: string;
  image_url: string | null;
  type: EquipmentType;
};

// link + join type (Supabase relation may be object or array)
type MemberEquipRow = {
  id: number;
  equipment_create_id: number;
  color: string | null;
  equipment_create: { type: number } | { type: number }[] | null;
};

type SelectedStone = {
  equipment_create_id: number;
  color: StoneColor;
};

type SelectedByType = Record<EquipmentType, SelectedStone[]>;

const EMPTY_SELECTED: SelectedByType = { 1: [], 2: [], 3: [], 4: [] };

async function requireSession() {
  const cookieStore = await cookies();
  const sid = cookieStore.get(env.AUTH_COOKIE_NAME)?.value;
  if (!sid) return null;

  const session = await getSession(sid);
  return session ?? null;
}

async function getMyMemberId(discordUserId: string, guild: number): Promise<number> {
  const discord_user_id = BigInt(discordUserId).toString();

  const { data, error } = await supabaseAdmin
    .from("member")
    .select("id")
    .eq("discord_user_id", discord_user_id)
    .eq("guild", guild)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const row = (data as MemberIdRow | null) ?? null;
  if (!row?.id) throw new Error("member_not_found");

  return Number(row.id);
}

function toEquipmentType(v: any): EquipmentType | null {
  const n = Number(v);
  if (n === 1 || n === 2 || n === 3 || n === 4) return n;
  return null;
}

function getJoinedType(row: { equipment_create: any }): number | null {
  const ec: any = row.equipment_create;
  if (!ec) return null;
  if (typeof ec === "object" && !Array.isArray(ec)) return Number(ec.type);
  if (Array.isArray(ec) && ec.length > 0) return Number(ec[0]?.type);
  return null;
}

function normalizeColor(input: unknown): StoneColor | null {
  const v = String(input ?? "").trim().toLowerCase();

  // accept english or thai (optional flexibility)
  if (v === "red" || v === "แดง") return "red";
  if (v === "purple" || v === "ม่วง") return "purple";
  if (v === "gold" || v === "ทอง") return "gold";

  return null;
}

function normalizeSelectedList(input: unknown): SelectedStone[] {
  const raw = Array.isArray(input) ? input : [];
  const list: SelectedStone[] = [];

  for (const r of raw) {
    const id = Number((r as any)?.equipment_create_id);
    const color = normalizeColor((r as any)?.color);
    if (!Number.isFinite(id) || id <= 0) continue;
    if (!color) continue;
    list.push({ equipment_create_id: id, color });
  }

  // dedupe by equipment_create_id (keep first)
  const seen = new Set<number>();
  const out: SelectedStone[] = [];
  for (const s of list) {
    if (seen.has(s.equipment_create_id)) continue;
    seen.add(s.equipment_create_id);
    out.push(s);
  }

  out.sort((a, b) => a.equipment_create_id - b.equipment_create_id);
  return out;
}

function normalizeSelectedByType(input: unknown): SelectedByType {
  const obj = input && typeof input === "object" ? (input as any) : {};
  return {
    1: normalizeSelectedList(obj[1]),
    2: normalizeSelectedList(obj[2]),
    3: normalizeSelectedList(obj[3]),
    4: normalizeSelectedList(obj[4]),
  };
}

export async function GET() {
  try {
    const session = await requireSession();
    if (!session) return NextResponse.json({ ok: false }, { status: 401 });

    const memberId = await getMyMemberId(session.discordUserId, session.guild);

    const { data: equipmentData, error: eqErr } = await supabaseAdmin
      .from("equipment_create")
      .select("id, name, image_url, type")
      .in("type", [1, 2, 3, 4])
      .order("type", { ascending: true })
      .order("id", { ascending: true });

    if (eqErr) return NextResponse.json({ ok: false, error: eqErr.message }, { status: 500 });

    const equipment = (Array.isArray(equipmentData) ? equipmentData : []) as EquipmentCreateRow[];

    const { data: linkData, error: linkErr } = await supabaseAdmin
      .from("member_equipment_create")
      .select("id, equipment_create_id, color, equipment_create(type)")
      .eq("member_id", memberId)
      .order("id", { ascending: true });

    if (linkErr) return NextResponse.json({ ok: false, error: linkErr.message }, { status: 500 });

    const rows = (Array.isArray(linkData) ? linkData : []) as unknown as MemberEquipRow[];

    const selected: SelectedByType = { 1: [], 2: [], 3: [], 4: [] };

    for (const r of rows) {
      const eqId = Number(r.equipment_create_id);
      const t = toEquipmentType(getJoinedType(r));
      const color = normalizeColor(r.color);

      if (!t) continue;
      if (!Number.isFinite(eqId) || eqId <= 0) continue;
      if (!color) continue;

      selected[t].push({ equipment_create_id: eqId, color });
    }

    // normalize per type
    (Object.keys(selected) as any as EquipmentType[]).forEach((t) => {
      selected[t] = normalizeSelectedList(selected[t]);
    });

    return NextResponse.json({ ok: true, equipment, selected_by_type: selected });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e.message ?? e) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await requireSession();
    if (!session) return NextResponse.json({ ok: false }, { status: 401 });

    const body = (await req.json().catch(() => null)) as unknown;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
    }

    const memberId = await getMyMemberId(session.discordUserId, session.guild);
    const desired = normalizeSelectedByType((body as any).selected_by_type);

    // Validate ids exist + type match
    const allDesiredIds = Array.from(
      new Set(
        [...desired[1], ...desired[2], ...desired[3], ...desired[4]].map((x) => x.equipment_create_id)
      )
    );

    if (allDesiredIds.length > 0) {
      const { data: eqCheck, error: eqErr } = await supabaseAdmin
        .from("equipment_create")
        .select("id, type")
        .in("id", allDesiredIds);

      if (eqErr) return NextResponse.json({ ok: false, error: eqErr.message }, { status: 500 });

      const typeById = new Map<number, EquipmentType>();
      for (const r of (Array.isArray(eqCheck) ? eqCheck : []) as Array<{ id: number; type: number }>) {
        const t = toEquipmentType((r as any).type);
        if (t) typeById.set(Number((r as any).id), t);
      }

      for (const t of [1, 2, 3, 4] as EquipmentType[]) {
        for (const item of desired[t]) {
          const realType = typeById.get(item.equipment_create_id);
          if (!realType) return NextResponse.json({ ok: false, error: "equipment_not_found" }, { status: 400 });
          if (realType !== t)
            return NextResponse.json({ ok: false, error: "equipment_type_mismatch" }, { status: 400 });
        }
      }
    }

    // Load existing rows (need row id to update/delete precisely)
    const { data: existingData, error: loadErr } = await supabaseAdmin
      .from("member_equipment_create")
      .select("id, equipment_create_id, color, equipment_create(type)")
      .eq("member_id", memberId);

    if (loadErr) return NextResponse.json({ ok: false, error: loadErr.message }, { status: 500 });

    const existingRows = (Array.isArray(existingData) ? existingData : []) as unknown as MemberEquipRow[];

    // Build existing map per type: eqId -> (rowId,color). If duplicates exist, keep first and mark others for deletion
    const existingMap: Record<EquipmentType, Map<number, { rowId: number; color: StoneColor }>> = {
      1: new Map(),
      2: new Map(),
      3: new Map(),
      4: new Map(),
    };
    const dupRowIdsToDelete: number[] = [];

    for (const r of existingRows) {
      const rowId = Number(r.id);
      const eqId = Number(r.equipment_create_id);
      const t = toEquipmentType(getJoinedType(r));
      const color = normalizeColor(r.color);

      if (!Number.isFinite(rowId) || rowId <= 0) continue;
      if (!Number.isFinite(eqId) || eqId <= 0) continue;
      if (!t || !color) continue;

      const m = existingMap[t];
      if (m.has(eqId)) {
        dupRowIdsToDelete.push(rowId);
      } else {
        m.set(eqId, { rowId, color });
      }
    }

    // Desired maps (per type)
    const desiredMap: Record<EquipmentType, Map<number, StoneColor>> = {
      1: new Map(desired[1].map((x) => [x.equipment_create_id, x.color])),
      2: new Map(desired[2].map((x) => [x.equipment_create_id, x.color])),
      3: new Map(desired[3].map((x) => [x.equipment_create_id, x.color])),
      4: new Map(desired[4].map((x) => [x.equipment_create_id, x.color])),
    };

    const rowIdsToDelete: number[] = [...dupRowIdsToDelete];
    const updates: Array<{ id: number; color: StoneColor }> = [];
    const inserts: Array<{ member_id: number; equipment_create_id: number; color: StoneColor }> = [];

    for (const t of [1, 2, 3, 4] as EquipmentType[]) {
      const exist = existingMap[t];
      const want = desiredMap[t];

      // delete: exist but not want
      for (const [eqId, ex] of exist.entries()) {
        if (!want.has(eqId)) rowIdsToDelete.push(ex.rowId);
      }

      // insert/update
      for (const [eqId, wantColor] of want.entries()) {
        const ex = exist.get(eqId);
        if (!ex) {
          inserts.push({ member_id: memberId, equipment_create_id: eqId, color: wantColor });
        } else if (ex.color !== wantColor) {
          updates.push({ id: ex.rowId, color: wantColor });
        }
      }
    }

    if (rowIdsToDelete.length > 0) {
      const { error: delErr } = await supabaseAdmin
        .from("member_equipment_create")
        .delete()
        .in("id", Array.from(new Set(rowIdsToDelete)));

      if (delErr) return NextResponse.json({ ok: false, error: delErr.message }, { status: 500 });
    }

    // Update color (ทีละ row เพื่อชัดเจนและปลอดภัย)
    for (const u of updates) {
      const { error: upErr } = await supabaseAdmin
        .from("member_equipment_create")
        .update({ color: u.color })
        .eq("id", u.id);

      if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
    }

    if (inserts.length > 0) {
      const { error: insErr } = await supabaseAdmin.from("member_equipment_create").insert(inserts);
      if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, selected_by_type: desired });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e.message ?? e) }, { status: 500 });
  }
}
