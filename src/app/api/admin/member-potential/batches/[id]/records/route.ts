// PATCH → bulk update stat fields of records in a batch
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { invalidateMemberPotential } from "@/lib/redisCache";

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

const STAT_FIELDS = [
  "kill",
  "assist",
  "supply",
  "damage_player",
  "damage_fort",
  "heal",
  "damage_taken",
  "death",
  "revive",
] as const;

type StatField = (typeof STAT_FIELDS)[number];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireEditor();
    if (!session) return NextResponse.json({ ok: false }, { status: 403 });

    const { id: batchId } = await params;
    const body = await req.json().catch(() => ({}));

    const updates: Array<Record<string, unknown>> = Array.isArray(body?.updates) ? body.updates : [];
    if (updates.length === 0)
      return NextResponse.json({ ok: false, error: "updates is empty" }, { status: 400 });

    // Validate batch exists first
    const { data: batch, error: bErr } = await supabaseAdmin
      .from("member_potential_batches")
      .select("id")
      .eq("id", batchId)
      .single();
    if (bErr || !batch)
      return NextResponse.json({ ok: false, error: "batch not found" }, { status: 404 });

    // ⚡ รัน updates แบบ parallel — Supabase JS client ไม่มี bulk update by composite key
    //    แต่ละ update คนละ row จึงไม่ conflict
    const jobs = updates
      .map((u) => {
        const uid = String(u.userdiscordid ?? "").trim();
        if (!uid) return null;
        const patch: Record<string, number> = {};
        for (const field of STAT_FIELDS) {
          if (field in u) {
            const n = Number(u[field]);
            if (Number.isFinite(n) && n >= 0) patch[field] = Math.floor(n);
          }
        }
        if (Object.keys(patch).length === 0) return null;
        return { uid, patch };
      })
      .filter((x): x is { uid: string; patch: Record<string, number> } => x !== null);

    const results = await Promise.all(
      jobs.map(({ uid, patch }) =>
        supabaseAdmin
          .from("member_potential_records")
          .update(patch, { count: "exact" })
          .eq("batch_id", batchId)
          .eq("userdiscordid", uid)
          .then((res) => ({ uid, res })),
      ),
    );

    const errors: Array<{ userdiscordid: string; error: string }> = [];
    let updatedCount = 0;
    for (const { uid, res } of results) {
      if (res.error) {
        errors.push({ userdiscordid: uid, error: res.error.message });
      } else {
        updatedCount += res.count ?? 0;
      }
    }

    if (errors.length > 0 && updatedCount === 0) {
      return NextResponse.json({ ok: false, error: "all updates failed", details: errors }, { status: 500 });
    }

    // stat เปลี่ยน → leaderboard ต้องคำนวณใหม่
    await invalidateMemberPotential();

    return NextResponse.json({ ok: true, updated: updatedCount, errors });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
  }
}
