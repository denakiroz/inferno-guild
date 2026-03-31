// src/app/api/cron/calendar-reminder/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { env } from "@/lib/env";

export const runtime = "nodejs";

/**
 * Called daily (e.g. 07:00 local time) by Vercel Cron.
 * Sends a Discord reminder for every calendar_event where:
 *   - event_date = today  AND
 *   - reminder_sent = false
 *
 * Protected by CRON_SECRET (same as other cron routes).
 */

function todayISO(): string {
  const now = new Date();
  // Use Asia/Bangkok offset (+7) so "today" matches the guild's timezone
  const bkk = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const y = bkk.getUTCFullYear();
  const m = String(bkk.getUTCMonth() + 1).padStart(2, "0");
  const d = String(bkk.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

async function sendDiscordMessage(content: string): Promise<void> {
  const token = env.DISCORD_BOT_TOKEN;
  const channelId = env.DISCORD_CALENDAR_CHANNEL_ID;
  if (!token || !channelId) return;

  await fetch(`https://discord.com/api/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content }),
  });
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const querySecret = url.searchParams.get("secret");
    const headerSecret = req.headers.get("x-cron-secret");
    const expected = process.env.CRON_SECRET;

    if (!expected || (querySecret !== expected && headerSecret !== expected)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const today = todayISO();

    // Fetch all today's events that haven't been reminded yet
    const { data: events, error } = await supabaseAdmin
      .from("calendar_event")
      .select("*")
      .eq("event_date", today)
      .eq("reminder_sent", false)
      .order("event_time", { ascending: true, nullsFirst: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!events || events.length === 0) {
      return NextResponse.json({ ok: true, reminded: 0, date: today });
    }

    const reminded: number[] = [];

    for (const ev of events) {
      const timeStr = ev.event_time ? ` เวลา ${String(ev.event_time).slice(0, 5)} น.` : "";
      const desc = ev.description ? `\n\n${ev.description}` : "";
      const mentions: string[] = ev.mention_roles ? (() => { try { return JSON.parse(ev.mention_roles); } catch { return []; } })() : [];
      const mentionFooter = mentions.length ? `\n${mentions.join(" ")}` : "";
      const msg =
        `# 🔔 **แจ้งเตือนกิจกรรมวันนี้: ${ev.title}**` +
        `\n📅 ${fmtDate(ev.event_date)}${timeStr}` +
        desc +
        mentionFooter;

      try {
        await sendDiscordMessage(msg);
        reminded.push(Number(ev.id));
      } catch {
        // continue for other events even if one fails
      }
    }

    if (reminded.length > 0) {
      await supabaseAdmin
        .from("calendar_event")
        .update({ reminder_sent: true })
        .in("id", reminded);
    }

    return NextResponse.json({ ok: true, reminded: reminded.length, date: today });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
