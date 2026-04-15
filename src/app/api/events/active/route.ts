// GET /api/events/active
// Returns the most recent open event + registration status for the current user
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get(env.AUTH_COOKIE_NAME)?.value;
    const session = sid ? await getSession(sid) : null;

    // Get latest open event
    const { data: event, error } = await supabaseAdmin
      .from("events")
      .select("id,name,description,status,created_at")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (!event) return NextResponse.json({ ok: true, event: null });

    // Registration count
    const { count } = await supabaseAdmin
      .from("event_registrations")
      .select("id", { count: "exact", head: true })
      .eq("event_id", event.id);

    // Current user's registration status
    let registered = false;
    if (session?.discordUserId) {
      const { data: reg } = await supabaseAdmin
        .from("event_registrations")
        .select("id")
        .eq("event_id", event.id)
        .eq("discord_user_id", session.discordUserId)
        .maybeSingle();
      registered = !!reg;
    }

    return NextResponse.json({
      ok: true,
      event: { ...event, registration_count: count ?? 0 },
      registered,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
  }
}
