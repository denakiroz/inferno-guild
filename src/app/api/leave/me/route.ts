import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const BKK_TZ = "Asia/Bangkok";

// yyyy-mm-dd (Bangkok)
const bkkDateFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: BKK_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
function bkkDateOf(date: Date) {
  return bkkDateFmt.format(date);
}

// HH:MM (Bangkok)
const bkkTimeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: BKK_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
function bkkNowHHMM() {
  return bkkTimeFmt.format(new Date()); // "20:05"
}

async function requireSession() {
  const cookieStore = cookies();
  const sid = (await cookieStore).get(env.AUTH_COOKIE_NAME)?.value;
  if (!sid) return null;

  const session = await getSession(sid);
  return session ?? null;
}

async function getMyMemberId(discordUserId: string) {
  const { data, error } = await supabaseAdmin
    .from("member")
    .select("id")
    .eq("discord_user_id", discordUserId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.id) return null;

  const idNum = Number(data.id);
  return Number.isFinite(idNum) ? idNum : null;
}

/**
 * GET: list my leaves (เฉพาะ Active)
 */
export async function GET() {
  try {
    const session = await requireSession();
    if (!session) return NextResponse.json({ ok: false }, { status: 401 });

    const memberId = await getMyMemberId(session.discordUserId);
    if (!memberId) return NextResponse.json({ ok: true, leaves: [] });

    const { data, error } = await supabaseAdmin
      .from("leave")
      .select("id, member_id, date_time, reason, status, update_date")
      .eq("member_id", memberId)
      .eq("status", "Active")
      .order("date_time", { ascending: true });

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, leaves: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e.message ?? e) }, { status: 500 });
  }
}

type LeaveCreateRow = { date_time: string; reason: string | null };

/**
 * POST: create my leaves
 * ✅ ใช้ upsert (member_id,date_time) เพื่อไม่ชน unique constraint และ "ชุบ Cancel กลับเป็น Active"
 * body: { rows: [{date_time, reason}, ...] }
 */
export async function POST(req: Request) {
  try {
    const session = await requireSession();
    if (!session) return NextResponse.json({ ok: false }, { status: 401 });

    const memberId = await getMyMemberId(session.discordUserId);
    if (!memberId) {
      return NextResponse.json({ ok: false, error: "member_not_found" }, { status: 400 });
    }

    const body = (await req.json().catch(() => null)) as { rows?: LeaveCreateRow[] } | null;

    const rows = body?.rows ?? [];
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ ok: false, error: "rows_required" }, { status: 400 });
    }

    const want = rows
      .map((r) => ({
        date_time: String(r.date_time ?? "").trim(),
        reason: r.reason ?? null,
      }))
      .filter((r) => !!r.date_time);

    if (want.length === 0) {
      return NextResponse.json({ ok: false, error: "invalid_rows" }, { status: 400 });
    }

    const nowIso = new Date().toISOString();

    const upsertRows = want.map((r) => ({
      member_id: memberId,
      date_time: r.date_time,
      reason: r.reason,
      status: "Active",
      update_date: nowIso,
    }));

    const { error: upErr } = await supabaseAdmin
      .from("leave")
      .upsert(upsertRows, { onConflict: "member_id,date_time" });

    if (upErr) throw new Error(upErr.message);

    return NextResponse.json({ ok: true, upserted: upsertRows.length });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e.message ?? e) }, { status: 500 });
  }
}

/**
 * PATCH: cancel my leaves by ids (soft-cancel)
 * เงื่อนไข:
 * - อนุญาต: อนาคต (ทุกเวลา)
 * - อนุญาต: วันนี้ เฉพาะก่อน 20:00 (เวลาไทย)
 * - ไม่อนุญาต: อดีต
 * body: { leaveIds: number[] }
 */
export async function PATCH(req: Request) {
  try {
    const session = await requireSession();
    if (!session) return NextResponse.json({ ok: false }, { status: 401 });

    const memberId = await getMyMemberId(session.discordUserId);
    if (!memberId) {
      return NextResponse.json({ ok: false, error: "member_not_found" }, { status: 400 });
    }

    const body = (await req.json().catch(() => null)) as { leaveIds?: number[] } | null;

    const leaveIds = body?.leaveIds ?? [];
    if (!Array.isArray(leaveIds) || leaveIds.length === 0) {
      return NextResponse.json({ ok: false, error: "leaveIds_required" }, { status: 400 });
    }

    // เลือกเฉพาะของตัวเอง + เฉพาะ Active
    const { data: leaves, error: selErr } = await supabaseAdmin
      .from("leave")
      .select("id, date_time, status")
      .eq("member_id", memberId)
      .eq("status", "Active")
      .in("id", leaveIds);

    if (selErr) throw new Error(selErr.message);

    const todayBkk = bkkDateOf(new Date());
    const nowHHMM = bkkNowHHMM();
    const isAfterCutoff = nowHHMM >= "20:00";

    const allowedIds = (leaves ?? [])
      .filter((l: any) => {
        const leaveDateBkk = bkkDateOf(new Date(String(l.date_time)));

        if (leaveDateBkk < todayBkk) return false; // อดีต
        if (leaveDateBkk > todayBkk) return true; // อนาคต
        return !isAfterCutoff; // วันนี้ก่อน 20:00 เท่านั้น
      })
      .map((l: any) => Number(l.id))
      .filter((x) => Number.isFinite(x));

    if (allowedIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: isAfterCutoff ? "cannot_cancel_today_after_20" : "cannot_cancel_past_leave" },
        { status: 400 }
      );
    }

    const { error: updErr } = await supabaseAdmin
      .from("leave")
      .update({
        status: "Cancel",
        update_date: new Date().toISOString(),
      })
      .eq("member_id", memberId)
      .in("id", allowedIds);

    if (updErr) throw new Error(updErr.message);

    return NextResponse.json({ ok: true, canceled: allowedIds.length, ids: allowedIds });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e.message ?? e) }, { status: 500 });
  }
}

/**
 * DELETE: ไม่ใช้แล้ว
 */
export async function DELETE() {
  return NextResponse.json({ ok: false, error: "method_not_allowed" }, { status: 405 });
}
