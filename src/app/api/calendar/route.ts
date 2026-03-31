// src/app/api/calendar/route.ts
// Public (read-only) calendar endpoint — any authenticated member can read
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET() {
  const cookieStore = await cookies();
  const sid = cookieStore.get(env.AUTH_COOKIE_NAME)?.value;
  if (!sid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const session = await getSession(sid);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Return upcoming events (today + 30 days ahead)
  const now = new Date();
  const todayISO = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  // Fetch 90 days ahead so the calendar widget can navigate months
  const futureDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const futureISO = `${futureDate.getFullYear()}-${String(futureDate.getMonth()+1).padStart(2,"0")}-${String(futureDate.getDate()).padStart(2,"0")}`;

  const { data, error } = await supabaseAdmin
    .from("calendar_event")
    .select("id, title, event_date, event_time, color, description")
    .gte("event_date", todayISO)
    .lte("event_date", futureISO)
    .order("event_date", { ascending: true })
    .order("event_time", { ascending: true, nullsFirst: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
