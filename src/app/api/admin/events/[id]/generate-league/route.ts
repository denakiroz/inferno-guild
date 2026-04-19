// POST /api/admin/events/[id]/generate-league
// Generates round-robin schedule from existing parties
// Clears old matches first, then creates new schedule
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
  if (!session || !(session.isAdmin || session.isHead)) return null;
  return session;
}

/** Fisher–Yates shuffle (in-place) */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Round-robin scheduling using Circle Method (input is assumed pre-shuffled) */
function roundRobin(ids: string[]): { round: number; p1: string; p2: string }[] {
  const n = ids.length;
  const list = n % 2 === 0 ? [...ids] : [...ids, "BYE"];
  const half = list.length / 2;
  const rounds: { round: number; p1: string; p2: string }[] = [];

  for (let r = 0; r < list.length - 1; r++) {
    const roundMatches: { round: number; p1: string; p2: string }[] = [];
    for (let i = 0; i < half; i++) {
      const p1 = list[i];
      const p2 = list[list.length - 1 - i];
      if (p1 !== "BYE" && p2 !== "BYE") {
        // สุ่มสลับซ้าย/ขวาของคู่ เพื่อไม่ให้ทีมเดิมเป็น party1 ทุกรอบ
        if (Math.random() < 0.5) {
          roundMatches.push({ round: r + 1, p1: p2, p2: p1 });
        } else {
          roundMatches.push({ round: r + 1, p1, p2 });
        }
      }
    }
    // สลับลำดับคู่แข่งในรอบเดียวกัน ให้ไม่ใช่ (1 vs 10), (2 vs 9), ... เรียงตลอด
    shuffle(roundMatches);
    rounds.push(...roundMatches);
    // Rotate: keep first element fixed, rotate the rest
    const last = list.pop()!;
    list.splice(1, 0, last);
  }
  return rounds;
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireEditor();
    if (!session) return NextResponse.json({ ok: false }, { status: 403 });

    const { id: eventId } = await params;

    // Get parties
    const { data: parties, error: pErr } = await supabaseAdmin
      .from("event_parties")
      .select("id")
      .eq("event_id", eventId);

    if (pErr) return NextResponse.json({ ok: false, error: pErr.message }, { status: 500 });
    if (!parties || parties.length < 2)
      return NextResponse.json({ ok: false, error: "ต้องมีอย่างน้อย 2 ปาร์ตี้" }, { status: 400 });

    // Delete existing matches
    await supabaseAdmin.from("event_matches").delete().eq("event_id", eventId);

    // Generate schedule — สุ่มลำดับทีมก่อน เพื่อไม่ให้ pair-up ซ้ำซาก (1v10, 1v9, ...)
    const partyIds = shuffle(parties.map((p) => p.id));
    const schedule = roundRobin(partyIds);

    const rows = schedule.map((m, idx) => ({
      event_id:   eventId,
      party1_id:  m.p1,
      party2_id:  m.p2,
      round:      m.round,
      match_order: idx + 1,
      status:     "pending",
    }));

    const { error: insErr } = await supabaseAdmin.from("event_matches").insert(rows);
    if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, match_count: rows.length });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
  }
}
