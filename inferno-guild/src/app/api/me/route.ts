import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const cookieStore = await cookies();
  const sid = cookieStore.get(env.AUTH_COOKIE_NAME)?.value;

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
      isHead: !!session.isHead,
    },
  });
}
