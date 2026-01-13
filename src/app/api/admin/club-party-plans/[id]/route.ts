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

  // club war builder allow admin OR head
  if (!(session.isAdmin || session.isHead)) return null;
  return session;
}

function extractId(req: Request, ctx: any): string {
  // 1) Next.js dynamic route param
  const fromParams = String(ctx?.params?.id ?? "").trim();
  if (fromParams) return fromParams;

  // 2) Fallback: parse from URL path
  try {
    const url = new URL(req.url);
    const segs = url.pathname.split("/").filter(Boolean);
    const last = segs[segs.length - 1] ?? "";
    // if route was hit without /:id (shouldn't happen), last might be 'club-party-plans'
    if (last && last !== "club-party-plans") return last;
  } catch {
    // ignore
  }

  return "";
}

/**
 * DELETE /api/admin/club-party-plans/:id
 * - Only admin/head can delete
 * - Uses service-role (supabaseAdmin) so it bypasses RLS
 */
export async function DELETE(req: Request, ctx: any) {
  try {
    const session = await requireEditor();
    if (!session) return NextResponse.json({ ok: false }, { status: 403 });

    let id = extractId(req, ctx);

    // 3) Optional fallback: accept body { id } (helps if client calls /club-party-plans with DELETE)
    if (!id) {
      const body = await req.json().catch(() => null);
      id = String(body?.id ?? "").trim();
    }

    if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from("club_party_plan")
      .delete()
      .eq("id", id)
      // select() returns deleted rows so we can know whether it existed
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
