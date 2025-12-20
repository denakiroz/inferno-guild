import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const BKK_TZ = "Asia/Bangkok";

const bkkDateFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: BKK_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
function bkkDateOf(date: Date) {
  return bkkDateFmt.format(date); // YYYY-MM-DD (Bangkok)
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

  // int8 อาจกลับมาเป็น string => บังคับเป็น number
  const idNum = Number(data.id);
  return Number.isFinite(idNum) ? idNum : null;
}

/**
 * GET: list my leaves
 */
export async function GET() {
  try {
    const session = await requireSession();
    if (!session) return NextResponse.json({ ok: false }, { status: 401 });

    const memberId = await getMyMemberId(session.discordUserId);
    if (!memberId) return NextResponse.json({ ok: true, leaves: [] });

    const { data, error } = await supabaseAdmin
      .from("leave") // ✅ ตารางจริงคือ leave
      .select("id, member_id, date_time, reason")
      .eq("member_id", memberId)
      .order("date_time", { ascending: true });

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, leaves: data ?? [] });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e.message ?? e) },
      { status: 500 }
    );
  }
}

type LeaveCreateRow = { date_time: string; reason: string | null };

/**
 * POST: create my leaves (de-dupe member_id + date_time)
 * body: { rows: [{date_time, reason}, ...] }
 */
export async function POST(req: Request) {
  try {
    const session = await requireSession();
    if (!session) return NextResponse.json({ ok: false }, { status: 401 });

    const memberId = await getMyMemberId(session.discordUserId);
    if (!memberId)
      return NextResponse.json(
        { ok: false, error: "member_not_found" },
        { status: 400 }
      );

    const body = (await req.json().catch(() => null)) as
      | { rows?: LeaveCreateRow[] }
      | null;

    const rows = body?.rows ?? [];
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "rows_required" },
        { status: 400 }
      );
    }

    const want = rows
      .map((r) => ({
        date_time: String(r.date_time ?? "").trim(),
        reason: r.reason ?? null,
      }))
      .filter((r) => !!r.date_time);

    if (want.length === 0) {
      return NextResponse.json(
        { ok: false, error: "invalid_rows" },
        { status: 400 }
      );
    }

    // ✅ De-dupe (member_id + date_time)
    const wantDateTimes = Array.from(new Set(want.map((r) => r.date_time)));

    const { data: existing, error: existingErr } = await supabaseAdmin
      .from("leave") // ✅ ต้องเป็น leave
      .select("id, date_time")
      .eq("member_id", memberId)
      .in("date_time", wantDateTimes);

    if (existingErr) throw new Error(existingErr.message);

    const existingSet = new Set(
      (existing ?? []).map((x: any) => String(x.date_time))
    );

    const toInsert = want
      .filter((r) => !existingSet.has(r.date_time))
      .map((r) => ({
        member_id: memberId,
        date_time: r.date_time,
        reason: r.reason,
      }));

    if (toInsert.length === 0) {
      return NextResponse.json({ ok: true, inserted: 0 });
    }

    const { error: insErr } = await supabaseAdmin.from("leave").insert(toInsert);
    if (insErr) throw new Error(insErr.message);

    return NextResponse.json({ ok: true, inserted: toInsert.length });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e.message ?? e) },
      { status: 500 }
    );
  }
}

/**
 * DELETE: cancel my leaves by ids
 * เงื่อนไข: ยกเลิกได้เฉพาะ "วันนี้-อนาคต" (ตามวัน Bangkok)
 * body: { leaveIds: number[] }
 */
export async function DELETE(req: Request) {
  try {
    const session = await requireSession();
    if (!session) return NextResponse.json({ ok: false }, { status: 401 });

    const memberId = await getMyMemberId(session.discordUserId);
    if (!memberId)
      return NextResponse.json(
        { ok: false, error: "member_not_found" },
        { status: 400 }
      );

    const body = (await req.json().catch(() => null)) as
      | { leaveIds?: number[] }
      | null;

    const leaveIds = body?.leaveIds ?? [];
    if (!Array.isArray(leaveIds) || leaveIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: "leaveIds_required" },
        { status: 400 }
      );
    }

    const { data: leaves, error: selErr } = await supabaseAdmin
      .from("leave") // ✅ ต้องเป็น leave
      .select("id, date_time")
      .eq("member_id", memberId)
      .in("id", leaveIds);

    if (selErr) throw new Error(selErr.message);

    const todayBkk = bkkDateOf(new Date());

    const allowedIds = (leaves ?? [])
      .filter((l: any) => {
        const d = bkkDateOf(new Date(String(l.date_time)));
        return d >= todayBkk; // ✅ วันนี้-อนาคตเท่านั้น
      })
      .map((l: any) => Number(l.id))
      .filter((x) => Number.isFinite(x));

    if (allowedIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: "cannot_cancel_past_leave" },
        { status: 400 }
      );
    }

    const { error: delErr } = await supabaseAdmin
      .from("leave") // ✅ ต้องเป็น leave
      .delete()
      .eq("member_id", memberId)
      .in("id", allowedIds);

    if (delErr) throw new Error(delErr.message);

    return NextResponse.json({
      ok: true,
      deleted: allowedIds.length,
      ids: allowedIds,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e.message ?? e) },
      { status: 500 }
    );
  }
}
