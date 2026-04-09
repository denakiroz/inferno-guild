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
      .from("member_potential_weights")
      .select("id,class_id,category,label,weight,enabled,sort_order")
      .order("sort_order");

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, items: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await requireEditor();
    if (!session) return NextResponse.json({ ok: false }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    // body: { class_id: null|number, category: string, weight: number, enabled: boolean }
    const { class_id, category, weight, enabled } = body;

    if (!category) return NextResponse.json({ ok: false, error: "category required" }, { status: 400 });

    const { error } = await supabaseAdmin
      .from("member_potential_weights")
      .upsert(
        {
          class_id: class_id ?? null,
          category: String(category),
          label: String(body.label ?? category),
          weight: Number(weight ?? 0),
          enabled: enabled !== false,
          sort_order: Number(body.sort_order ?? 0),
        },
        { onConflict: "class_id,category" }
      );

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
  }
}
