// src/app/api/admin/members/set-color/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type BodyV1 = {
  guild: number;
  memberIds: Array<string | number>;
  color: string | null;
};

type BodyV2 = {
  guild: number;
  colors: Array<{ memberId: number; color: string | null }>;
};

function isHexColor(v: unknown): v is string {
  return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const sid = cookieStore.get(env.AUTH_COOKIE_NAME)?.value;
  if (!sid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const session = await getSession(sid);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.isAdmin && !session.isHead) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const raw = (await req.json()) as Partial<BodyV1 & BodyV2> | null;

  const guild = Number((raw as any)?.guild);
  if (!guild || Number.isNaN(guild)) {
    return NextResponse.json({ error: "Bad Request: guild is required" }, { status: 400 });
  }

  // -------------------------
  // ✅ Format V2: { guild, colors: [{memberId,color}] }
  // -------------------------
  if (raw && Array.isArray((raw as any).colors)) {
    const colors = (raw as any).colors as BodyV2["colors"];

    // validate items
    for (const it of colors) {
      const memberId = Number((it as any)?.memberId);
      const color = (it as any)?.color;

      const colorOk = color === null || isHexColor(color);
      if (!memberId || Number.isNaN(memberId) || !colorOk) {
        return NextResponse.json(
          { error: "Bad Request: invalid colors[] payload", badItem: it },
          { status: 400 },
        );
      }
    }

    if (colors.length === 0) return NextResponse.json({ ok: true }, { status: 200 });

    // group by color to minimize queries
    const groups = new Map<string, number[]>();
    for (const it of colors) {
      const key = it.color === null ? "__NULL__" : it.color;
      const arr = groups.get(key) ?? [];
      arr.push(Number(it.memberId));
      groups.set(key, arr);
    }

    for (const [key, memberIds] of groups.entries()) {
      const color = key === "__NULL__" ? null : key;

      const { error } = await supabaseAdmin
        .from("member")
        .update({ color })
        .in("id", memberIds) // ✅ send as numbers
        .eq("guild", guild);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // -------------------------
  // ✅ Format V1: { guild, memberIds: [...], color }
  // -------------------------
  if (raw && Array.isArray((raw as any).memberIds)) {
    const memberIdsRaw = (raw as any).memberIds as Array<string | number>;
    const color = (raw as any).color as string | null;

    const colorOk = color === null || isHexColor(color);
    if (!colorOk) {
      return NextResponse.json({ error: "Bad Request: invalid color" }, { status: 400 });
    }

    const memberIds = memberIdsRaw
      .map((x) => Number(x))
      .filter((n) => !!n && !Number.isNaN(n));

    if (memberIds.length === 0) return NextResponse.json({ ok: true }, { status: 200 });

    const { error } = await supabaseAdmin
      .from("member")
      .update({ color })
      .in("id", memberIds)
      .eq("guild", guild);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true }, { status: 200 });
  }

  return NextResponse.json(
    { error: "Bad Request: expected {memberIds,color} or {colors:[...]}" },
    { status: 400 },
  );
}
