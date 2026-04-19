import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CATEGORIES, type Category } from "@/lib/memberPotential";
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

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireEditor();
    if (!session) return NextResponse.json({ ok: false }, { status: 403 });

    const { id } = await params;

    // ⚡ 3 query อิสระ — ยิงพร้อมกัน (batch / records / weights)
    const [batchRes, recordsRes, weightsRes] = await Promise.all([
      supabaseAdmin
        .from("member_potential_batches")
        .select("id,label,imported_at,opponent_guild,guild,imported_by")
        .eq("id", id)
        .single(),
      supabaseAdmin
        .from("member_potential_records")
        .select(
          "userdiscordid,discordname,class_id,kill,assist,supply,damage_player,damage_fort,heal,damage_taken,death,revive"
        )
        .eq("batch_id", id),
      supabaseAdmin
        .from("member_potential_weights")
        .select("class_id,category,weight,enabled"),
    ]);

    // 1) batch meta
    const { data: batch, error: bErr } = batchRes;
    if (bErr || !batch)
      return NextResponse.json({ ok: false, error: bErr?.message ?? "batch not found" }, { status: 404 });

    // 2) records in this batch
    const { data: records, error: rErr } = recordsRes;
    if (rErr) return NextResponse.json({ ok: false, error: rErr.message }, { status: 500 });

    // 3) class info (name, icon) — bulk fetch (depends on records)
    const classIds = Array.from(
      new Set((records ?? []).map((r) => r.class_id).filter((v): v is number => v != null))
    );
    const classMap = new Map<number, { name: string; icon_url: string | null }>();
    if (classIds.length > 0) {
      const { data: classes } = await supabaseAdmin
        .from("class")
        .select("id,name,icon_url")
        .in("id", classIds);
      for (const c of classes ?? []) {
        classMap.set(Number(c.id), { name: c.name ?? "", icon_url: c.icon_url ?? null });
      }
    }

    // 4) Weights — มาจาก Promise.all ด้านบนแล้ว
    const { data: weightRows } = weightsRes;

    const defaultWeights = new Map<Category, number>();
    const classWeights = new Map<number, Map<Category, number>>();
    for (const w of weightRows ?? []) {
      if (!w.enabled) continue;
      const cat = w.category as Category;
      const val = Number(w.weight);
      if (w.class_id == null) {
        defaultWeights.set(cat, val);
      } else {
        const cid = Number(w.class_id);
        if (!classWeights.has(cid)) classWeights.set(cid, new Map());
        classWeights.get(cid)!.set(cat, val);
      }
    }
    const getWeight = (classId: number | null, cat: Category): number => {
      if (classId != null) {
        const override = classWeights.get(classId)?.get(cat);
        if (override !== undefined) return override;
      }
      return defaultWeights.get(cat) ?? 0;
    };

    const items = (records ?? []).map((r) => {
      const cls = r.class_id != null ? classMap.get(Number(r.class_id)) : null;
      const cid = r.class_id != null ? Number(r.class_id) : null;
      const stats: Record<Category, number> = {
        kill: Number(r.kill) || 0,
        assist: Number(r.assist) || 0,
        supply: Number(r.supply) || 0,
        damage_player: Number(r.damage_player) || 0,
        damage_fort: Number(r.damage_fort) || 0,
        heal: Number(r.heal) || 0,
        damage_taken: Number(r.damage_taken) || 0,
        death: Number(r.death) || 0,
        revive: Number(r.revive) || 0,
      };
      const rawScore = CATEGORIES.reduce(
        (acc, c) => acc + stats[c] * getWeight(cid, c),
        0
      );
      return {
        userdiscordid: r.userdiscordid,
        discordname: r.discordname ?? "",
        class_id: cid,
        class_name: cls?.name ?? "",
        class_icon: cls?.icon_url ?? "",
        ...stats,
        score: Math.round(rawScore * 10) / 10,
      };
    });

    return NextResponse.json({ ok: true, batch, items });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireEditor();
    if (!session) return NextResponse.json({ ok: false }, { status: 403 });

    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const updates: Record<string, unknown> = {};
    if ("label" in body)          updates.label          = String(body.label ?? "").trim() || null;
    if ("opponent_guild" in body) updates.opponent_guild = String(body.opponent_guild ?? "").trim() || null;
    if ("guild" in body)          updates.guild          = body.guild != null ? Number(body.guild) : null;

    if (Object.keys(updates).length === 0)
      return NextResponse.json({ ok: false, error: "nothing to update" }, { status: 400 });

    const { error } = await supabaseAdmin
      .from("member_potential_batches")
      .update(updates)
      .eq("id", id);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    // batch meta เปลี่ยน — โดย label/guild อาจไม่กระทบ score แต่ invalidate ไว้ก่อนเพื่อความปลอดภัย
    await invalidateMemberPotential();

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireEditor();
    if (!session) return NextResponse.json({ ok: false }, { status: 403 });

    const { id } = await params;
    const { error } = await supabaseAdmin
      .from("member_potential_batches")
      .delete()
      .eq("id", id);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    await invalidateMemberPotential();

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
  }
}
