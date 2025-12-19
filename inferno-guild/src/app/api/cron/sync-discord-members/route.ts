import { NextResponse } from "next/server";
import { syncDiscordMembersToSupabase } from "@/lib/discordMemberSync";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncDiscordMembersToSupabase();
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "sync failed" },
      { status: 500 }
    );
  }
}
