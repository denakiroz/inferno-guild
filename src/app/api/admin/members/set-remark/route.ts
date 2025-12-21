// src/app/api/admin/members/set-remark/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type BodyV2 = {
  guild: number;
  remarks: Array<{ memberId: number | string; remark: string | null }>;
};

type BodyV1 = {
  guild: number;
  memberIds: Array<number | string>;
  remark: string | null;
};

function toInt(x: unknown): number | null {
  const n = typeof x === "string" ? Number(x) : (x as number);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  return i > 0 ? i : null;
}

function normalizeRemark(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null; // "" => null (ล้าง)
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const sid = cookieStore.get(env.AUTH_COOKIE_NAME)?.value;
  if (!sid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const session = await getSession(sid);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ให้ตรงกับ canEdit ของหน้า: Admin หรือ Head ถึงแก้ได้
  if (!session.isAdmin && !session.isHead) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad Request" }, { status: 400 });
  }

  const guild = toInt(body?.guild);
  if (!guild) return NextResponse.json({ error: "Bad Request" }, { status: 400 });

  // -------- V2 (batch) --------
  if (Array.isArray(body?.remarks)) {
    const rows = (body.remarks as BodyV2["remarks"])
      .map((r) => ({ memberId: toInt(r?.memberId), remark: normalizeRemark(r?.remark) }))
      .filter((r) => !!r.memberId);

    if (rows.length === 0) return NextResponse.json({ ok: true });

    // group by remark เพื่อลดจำนวน update
    const byRemark = new Map<string, number[]>();
    for (const r of rows) {
      const key = r.remark ?? "__NULL__";
      const arr = byRemark.get(key) ?? [];
      arr.push(r.memberId as number);
      byRemark.set(key, arr);
    }

    for (const [key, ids] of byRemark.entries()) {
      const remark = key === "__NULL__" ? null : key;
      const { error } = await supabaseAdmin
        .from("member")
        .update({ remark })
        .in("id", ids)
        .eq("guild", guild);

      if (error) {
        return NextResponse.json({ error: "Update failed", detail: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true });
  }

  // -------- V1 (legacy) --------
  const memberIdsRaw = Array.isArray(body?.memberIds) ? (body.memberIds as BodyV1["memberIds"]) : null;
  if (!memberIdsRaw) return NextResponse.json({ error: "Bad Request" }, { status: 400 });

  const ids = memberIdsRaw.map(toInt).filter((x): x is number => !!x);
  const remark = normalizeRemark(body?.remark);

  if (ids.length === 0) return NextResponse.json({ ok: true });

  const { error } = await supabaseAdmin
    .from("member")
    .update({ remark })
    .in("id", ids)
    .eq("guild", guild);

  if (error) {
    return NextResponse.json({ error: "Update failed", detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
