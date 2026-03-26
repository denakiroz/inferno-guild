// src/app/api/admin/club-party-plans-2/[id]/route.ts
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

function extractId(req: Request, ctx: any): string {
  const fromParams = String(ctx?.params?.id ?? "").trim();
  if (fromParams) return fromParams;

  try {
    const url = new URL(req.url);
    const segs = url.pathname.split("/").filter(Boolean);
    const last = segs[segs.length - 1] ?? "";
    if (last && last !== "club-party-plans-2") return last;
  } catch {
    // ignore
  }

  return "";
}

export async function DELETE(req: Request, ctx: any) {
  try {
    const session = await requireEditor();
    if (!session) return NextResponse.json({ ok: false }, { status: 403 });

    let id = extractId(req, ctx);

    if (!id) {
      const body = await req.json().catch(() => null);
      id = String(body?.id ?? "").trim();
    }

    if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from("club_party_plan_2")
      .delete()
      .eq("id", id)
      .select("id");

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    const deletedCount = Array.isArray(data) ? data.length : 0;
    if (deletedCount === 0) {
      return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, id, deletedCount });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
  }
}
