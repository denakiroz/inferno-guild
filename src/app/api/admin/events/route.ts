// GET  /api/admin/events  — list all events
// POST /api/admin/events  — create event
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

async function requireEditor() {
  const cookieStore = await cookies();
  const sid = cookieStore.get(env.AUTH_COOKIE_NAME)?.value;
  if (!sid) return null;
  const session = await getSession(sid);
  if (!session) return null;
  if (!(session.isAdmin || session.isHead)) return null;
  return session;
}

export async function GET() {
  try {
    const session = await requireEditor();
    if (!session) return NextResponse.json({ ok: false }, { status: 403 });

    const { data, error } = await supabaseAdmin
      .from("events")
      .select("id,name,description,status,created_at")
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    // Count registrations per event
    const ids = (data ?? []).map((e) => e.id);
    let regCount: Record<string, number> = {};
    if (ids.length > 0) {
      const { data: regs } = await supabaseAdmin
        .from("event_registrations")
        .select("event_id")
        .in("event_id", ids);
      for (const r of regs ?? []) {
        regCount[r.event_id] = (regCount[r.event_id] ?? 0) + 1;
      }
    }

    const items = (data ?? []).map((e) => ({ ...e, registration_count: regCount[e.id] ?? 0 }));
    return NextResponse.json({ ok: true, items });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireEditor();
    if (!session) return NextResponse.json({ ok: false }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const name = String(body?.name ?? "").trim();
    const description = String(body?.description ?? "").trim() || null;

    if (!name) return NextResponse.json({ ok: false, error: "name required" }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from("events")
      .insert({ name, description, status: "open" })
      .select("id")
      .single();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id: data.id });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
  }
}
