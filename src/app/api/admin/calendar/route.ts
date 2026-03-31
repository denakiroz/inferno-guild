// src/app/api/admin/calendar/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/**
 * calendar_event table schema (run once in Supabase SQL editor):
 *
 * create table if not exists calendar_event (
 *   id          bigserial primary key,
 *   title       text not null,
 *   description text,
 *   event_date  date not null,
 *   event_time  time,
 *   color       text not null default 'indigo',
 *   created_by_discord_id text,
 *   created_by_name       text,
 *   discord_notified      boolean not null default false,
 *   reminder_sent         boolean not null default false,
 *   mention_roles         text,   -- JSON array e.g. '["@everyone","<@&123456>"]'
 *   created_at  timestamptz not null default now(),
 *   updated_at  timestamptz not null default now()
 * );
 *
 * -- Migration (if table already exists):
 * -- ALTER TABLE calendar_event ADD COLUMN IF NOT EXISTS mention_roles text;
 */

async function requireAdminOrHead() {
  const cookieStore = await cookies();
  const sid = cookieStore.get(env.AUTH_COOKIE_NAME)?.value;
  if (!sid) return null;
  const session = await getSession(sid);
  if (!session) return null;
  if (!session.isAdmin && !session.isHead) return null;
  return session;
}

/** Send Discord message to calendar channel via Bot Token */
async function sendDiscordCalendarMessage(content: string): Promise<void> {
  const token = env.DISCORD_BOT_TOKEN;
  const channelId = env.DISCORD_CALENDAR_CHANNEL_ID;
  if (!token || !channelId) return;

  try {
    await fetch(`https://discord.com/api/channels/${channelId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content }),
    });
  } catch {
    // non-fatal: log but don't fail the request
    console.error("[calendar] Discord notify failed");
  }
}

/** Format date string (YYYY-MM-DD) -> DD/MM/YYYY for display */
function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

// ─────────────────────────────────────────────
// GET  /api/admin/calendar              → list all events
// GET  /api/admin/calendar?id=X         → single event
// ─────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await requireAdminOrHead();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");

  if (id) {
    const { data, error } = await supabaseAdmin
      .from("calendar_event")
      .select("*")
      .eq("id", Number(id))
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  const { data, error } = await supabaseAdmin
    .from("calendar_event")
    .select("*")
    .order("event_date", { ascending: true })
    .order("event_time", { ascending: true, nullsFirst: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// ─────────────────────────────────────────────
// POST /api/admin/calendar              → create event
// ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await requireAdminOrHead();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { title, description, event_date, event_time, color, mention_roles } = body ?? {};

  if (!title || typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }
  if (!event_date || typeof event_date !== "string") {
    return NextResponse.json({ error: "event_date required (YYYY-MM-DD)" }, { status: 400 });
  }

  // mention_roles: string[] of Discord mention strings e.g. ["@everyone", "<@&123456>"]
  const mentionArr: string[] = Array.isArray(mention_roles)
    ? mention_roles.filter((r: any) => typeof r === "string" && r.trim())
    : [];

  const row = {
    title: title.trim(),
    description: description ? String(description).trim() || null : null,
    event_date,
    event_time: event_time || null,
    color: color || "indigo",
    created_by_discord_id: session.discordUserId ?? null,
    created_by_name: session.displayName ?? null,
    discord_notified: false,
    reminder_sent: false,
    mention_roles: mentionArr.length ? JSON.stringify(mentionArr) : null,
  };

  const { data, error } = await supabaseAdmin
    .from("calendar_event")
    .insert(row)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ── Immediate Discord notification ──
  const mentionFooter = mentionArr.length ? `\n${mentionArr.join(" ")}` : "";
  const timeStr = event_time ? ` เวลา ${event_time.slice(0, 5)} น.` : "";
  const desc = description?.trim() ? `\n\n${description.trim()}` : "";
  const msg =
    `# 📣 **ประกาศด่วน : ${title.trim()}**` +
    `\n📅 วันที่ ${fmtDate(event_date)}${timeStr}` +
    desc +
    mentionFooter;

  await sendDiscordCalendarMessage(msg);

  // mark as notified
  await supabaseAdmin
    .from("calendar_event")
    .update({ discord_notified: true })
    .eq("id", data.id);

  return NextResponse.json({ ...data, discord_notified: true }, { status: 201 });
}

// ─────────────────────────────────────────────
// PATCH /api/admin/calendar?id=X        → update event
// ─────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const session = await requireAdminOrHead();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const allowed = ["title", "description", "event_date", "event_time", "color", "mention_roles"];
  const patch: Record<string, any> = { updated_at: new Date().toISOString() };
  for (const k of allowed) {
    if (k in body) {
      if (k === "mention_roles") {
        const arr = Array.isArray(body[k]) ? body[k].filter((r: any) => typeof r === "string") : [];
        patch[k] = arr.length ? JSON.stringify(arr) : null;
      } else {
        patch[k] = body[k] ?? null;
      }
    }
  }
  if (patch.title !== undefined && (!patch.title || !String(patch.title).trim())) {
    return NextResponse.json({ error: "title cannot be empty" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("calendar_event")
    .update(patch)
    .eq("id", Number(id))
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// ─────────────────────────────────────────────
// DELETE /api/admin/calendar?id=X       → delete event
// ─────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const session = await requireAdminOrHead();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("calendar_event")
    .delete()
    .eq("id", Number(id));

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
