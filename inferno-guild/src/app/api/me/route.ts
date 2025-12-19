import { NextResponse } from "next/server";
import { getSession } from "../../../lib/session";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const cookie = req.headers.get("cookie") ?? "";
  const sid = cookie.match(/(?:^|;\s*)sid=([^;]+)/)?.[1];
  if (!sid) return NextResponse.json({ ok: false }, { status: 401 });

  const session = await getSession(sid);
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  return NextResponse.json({
    ok: true,
    user: {
      discordUserId: session.discordUserId,
      displayName: session.displayName,
      avatarUrl: session.avatarUrl,
      guild: session.guild,
      isAdmin: !!session.isAdmin,
    },
  });
}
