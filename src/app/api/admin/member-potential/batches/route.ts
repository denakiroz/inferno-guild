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
      .from("member_potential_batches")
      .select("id,label,imported_at,imported_by,opponent_guild,guild")
      .order("imported_at", { ascending: false });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    // count records per batch
    const batchIds = (data ?? []).map((b) => b.id);
    let countMap: Record<string, number> = {};
    if (batchIds.length > 0) {
      const { data: counts } = await supabaseAdmin
        .from("member_potential_records")
        .select("batch_id")
        .in("batch_id", batchIds);
      for (const r of counts ?? []) {
        countMap[r.batch_id] = (countMap[r.batch_id] ?? 0) + 1;
      }
    }

    const items = (data ?? []).map((b) => ({ ...b, record_count: countMap[b.id] ?? 0 }));
    return NextResponse.json({ ok: true, items });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
  }
}
