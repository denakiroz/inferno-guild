// src/app/api/admin/members/assign-party/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type WarTime = "20:00" | "20:30";

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

function colsForWarTime(warTime: WarTime) {
  if (warTime === "20:00") {
    return { partyCol: "party" as const, posCol: "pos_party" as const };
  }
  return { partyCol: "party_2" as const, posCol: "pos_party_2" as const };
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
  const { partyCol, posCol } = colsForWarTime(warTime);

  const rawRows = Array.isArray(body.rows)
    ? body.rows
    : Array.isArray(body.assignments)
      ? body.assignments
      : [];

  const updates = rawRows
    .map((r) => {
      const memberId = r.memberId ?? r.id;
      if (!memberId) return null;

      const u: Record<string, unknown> = {
        id: memberId,
        guild: body.guild,
      };

      // Force-update ONLY the round-specific columns derived from warTime.
      if (Object.prototype.hasOwnProperty.call(r, "party")) u[partyCol] = r.party ?? null;
      if (Object.prototype.hasOwnProperty.call(r, "pos")) u[posCol] = r.pos ?? null;

      if (typeof r.name === "string") {
        const trimmed = r.name.trim();
        if (trimmed) u["name"] = trimmed;
      }

      return u;
    })
    .filter(Boolean) as Record<string, unknown>[];

  if (updates.length === 0) {
    return NextResponse.json({ ok: true, updated: 0, warTime });
  }

  const { error } = await supabaseAdmin
    .from("member")
    .upsert(updates, { onConflict: "id" });

  if (error) {
    return NextResponse.json(
      { error: error.message ?? "Failed to update members" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, updated: updates.length, warTime });
}
