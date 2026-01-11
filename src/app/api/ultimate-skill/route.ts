// app/api/ultimate-skill/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type UltimateSkillRow = {
  id: number;
  name: string;
  ultimate_skill_url: string | null;
  created_at: string;
};

async function requireSession() {
  const cookieStore = await cookies();
  const sid = cookieStore.get(env.AUTH_COOKIE_NAME)?.value;
  if (!sid) return null;

  const session = await getSession(sid);
  return session ?? null;
}

export async function GET() {
  try {
    const session = await requireSession();
    if (!session) return NextResponse.json({ ok: false }, { status: 401 });

    const { data, error } = await supabaseAdmin
      .from("ultimate_skill")
      .select("id, name, ultimate_skill_url, created_at")
      .order("id", { ascending: true });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    const rows = (Array.isArray(data) ? data : []) as UltimateSkillRow[];
    return NextResponse.json({ ok: true, skills: rows });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e.message ?? e) }, { status: 500 });
  }
}
