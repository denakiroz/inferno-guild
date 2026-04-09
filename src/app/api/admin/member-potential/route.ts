// GET  → leaderboard (averages + scores per player)
// POST → import batch (create batch + insert records)
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildLeaderboard } from "@/lib/memberPotential";

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

    const result = await buildLeaderboard();
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 500 });

    return NextResponse.json({ ok: true, items: result.items });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireEditor();
    if (!session) return NextResponse.json({ ok: false }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const label = String(body?.label ?? "").trim() || new Date().toLocaleDateString("th-TH");
    const rows: any[] = Array.isArray(body?.rows) ? body.rows : [];

    if (rows.length === 0)
      return NextResponse.json({ ok: false, error: "rows is empty" }, { status: 400 });

    const imported_by = (session as any)?.userId ?? (session as any)?.user?.id ?? null;

    // Create batch
    const { data: batch, error: bErr } = await supabaseAdmin
      .from("member_potential_batches")
      .insert({ label, imported_by })
      .select("id")
      .single();
    if (bErr) return NextResponse.json({ ok: false, error: bErr.message }, { status: 500 });

    // Insert records
    const records = rows
      .filter((r) => String(r.userdiscordid ?? "").trim())
      .map((r) => ({
        batch_id: batch.id,
        userdiscordid: String(r.userdiscordid ?? "").trim(),
        discordname: String(r.discordname ?? "").trim(),
        kill: Number(r.kill) || 0,
        assist: Number(r.assist) || 0,
        supply: Number(r.supply) || 0,
        damage_player: Number(r.damage_player) || 0,
        damage_fort: Number(r.damage_fort) || 0,
        heal: Number(r.heal) || 0,
        damage_taken: Number(r.damage_taken) || 0,
        death: Number(r.death) || 0,
        revive: Number(r.revive) || 0,
      }));

    const { error: rErr } = await supabaseAdmin
      .from("member_potential_records")
      .insert(records);
    if (rErr) {
      // rollback batch
      await supabaseAdmin.from("member_potential_batches").delete().eq("id", batch.id);
      return NextResponse.json({ ok: false, error: rErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, batch_id: batch.id, count: records.length });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
  }
}
