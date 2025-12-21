import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function parseGuild(raw: string | null) {
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 3) return null;
  return n;
}

async function requireAdminOrHead() {
  const cookieStore = await cookies();
  const sid = cookieStore.get(env.AUTH_COOKIE_NAME)?.value;
  if (!sid) return null;
  const session = await getSession(sid);
  if (!session) return null;
  if (!session.isAdmin && !session.isHead) return null;
  return session;
}

export async function GET(req: Request) {
  const session = await requireAdminOrHead();
  if (!session) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const qGuild = parseGuild(url.searchParams.get("guild"));

  // admin: เลือก guild ได้ / head: ล็อกตาม guild ตัวเอง
  const guild = session.isAdmin ? (qGuild ?? session.guild) : session.guild;

  const { data, error } = await supabaseAdmin
    .from("note")
    .select("guild,note")
    .eq("guild", guild)
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  if (!data) {
    // กันหน้า UI พัง: สร้างแถวให้เลย
    const created = await supabaseAdmin
      .from("note")
      .upsert({ guild, note: "" }, { onConflict: "guild" })
      .select("guild,note")
      .single();

    if (created.error) return NextResponse.json({ ok: false, error: created.error.message }, { status: 500 });

    return NextResponse.json({ ok: true, data: created.data }, { status: 200 });
  }

  return NextResponse.json({ ok: true, data }, { status: 200 });
}

export async function POST(req: Request) {
  const session = await requireAdminOrHead();
  if (!session) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { guild?: number; note?: string } | null;

  // admin: รับ guild จาก body ได้ / head: ล็อกตาม guild ตัวเอง
  const guild =
    session.isAdmin
      ? (Number.isInteger(body?.guild) ? (body!.guild as number) : session.guild)
      : session.guild;

  if (!Number.isInteger(guild) || guild < 1 || guild > 3) {
    return NextResponse.json({ ok: false, error: "invalid_guild" }, { status: 400 });
  }

  const note = (body?.note ?? "").toString();

  const { data, error } = await supabaseAdmin
    .from("note")
    .upsert({ guild, note }, { onConflict: "guild" })
    .select("guild,note")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, data }, { status: 200 });
}
