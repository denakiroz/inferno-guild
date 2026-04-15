// POST   /api/events/[id]/register  — register current user
// DELETE /api/events/[id]/register  — unregister current user
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

async function requireSession() {
  const cookieStore = await cookies();
  const sid = cookieStore.get(env.AUTH_COOKIE_NAME)?.value;
  if (!sid) return null;
  return getSession(sid);
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

    const { id: eventId } = await params;

    // Check event is open
    const { data: event } = await supabaseAdmin
      .from("events")
      .select("id,status")
      .eq("id", eventId)
      .maybeSingle();

    if (!event) return NextResponse.json({ ok: false, error: "event not found" }, { status: 404 });
    if (event.status !== "open")
      return NextResponse.json({ ok: false, error: "event is not open" }, { status: 400 });

    // Get member name
    const { data: member } = await supabaseAdmin
      .from("member")
      .select("name")
      .eq("discord_user_id", session.discordUserId)
      .maybeSingle();

    const { error } = await supabaseAdmin
      .from("event_registrations")
      .upsert({
        event_id: eventId,
        discord_user_id: session.discordUserId,
        member_name: member?.name ?? session.displayName ?? null,
      }, { onConflict: "event_id,discord_user_id" });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

    const { id: eventId } = await params;

    const { error } = await supabaseAdmin
      .from("event_registrations")
      .delete()
      .eq("event_id", eventId)
      .eq("discord_user_id", session.discordUserId);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
  }
}
