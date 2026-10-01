// src/app/api/admin/members/assign-party/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { invalidateMembers } from "@/lib/redisCache";
import { saveWarPartyRound, warTimeToRound, type WarPartyAssignment, type WarTime } from "@/lib/warParty";

export const runtime = "nodejs";

type AssignRow = {
  id?: number;
  memberId?: number;
  party?: number | null;
  pos?: number | null;
  name?: string | null;
};

type Body = {
  guild: number;
  warTime?: string;
  rows?: AssignRow[];
  assignments?: AssignRow[];
};

function normalizeWarTime(raw: unknown): WarTime {
  const s = String(raw ?? "").trim();
  const t = s.replace(".", ":");
  if (t === "20:00" || t === "20:30") return t;
  // Default fallback (safe): treat unknown as first round.
  return "20:00";
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const sid = cookieStore.get(env.AUTH_COOKIE_NAME)?.value;
  if (!sid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const session = await getSession(sid);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as Body;
  if (!body?.guild) return NextResponse.json({ error: "Bad Request" }, { status: 400 });

  const warTime = normalizeWarTime(body.warTime);
  const round = warTimeToRound(warTime);

  const rawRows = Array.isArray(body.rows)
    ? body.rows
    : Array.isArray(body.assignments)
      ? body.assignments
      : [];

  // Only rows that explicitly carry `party` change the party of this round.
  const partyRows: WarPartyAssignment[] = [];
  const nameUpdates: Array<{ id: number; name: string }> = [];

  for (const r of rawRows) {
    const memberId = Number(r.memberId ?? r.id);
    if (!Number.isFinite(memberId) || memberId <= 0) continue;

    if (Object.prototype.hasOwnProperty.call(r, "party")) {
      partyRows.push({ memberId, party: r.party ?? null, pos: r.pos ?? null });
    }

    if (typeof r.name === "string") {
      const trimmed = r.name.trim();
      if (trimmed) nameUpdates.push({ id: memberId, name: trimmed });
    }
  }

  if (partyRows.length === 0 && nameUpdates.length === 0) {
    return NextResponse.json({ ok: true, updated: 0, warTime });
  }

  try {
    // ปาร์ตี้ของรอบนี้ -> war_party_member
    if (partyRows.length > 0) await saveWarPartyRound(round, partyRows);

    // ชื่อสมาชิก (ถ้ามี) -> member
    if (nameUpdates.length > 0) {
      const { error } = await supabaseAdmin.from("member").upsert(nameUpdates, { onConflict: "id" });
      if (error) throw new Error(error.message);
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed to update members" }, { status: 500 });
  }

  await invalidateMembers();
  return NextResponse.json({ ok: true, updated: Math.max(partyRows.length, nameUpdates.length), warTime });
}
