// src/app/api/admin/calendar/roles/route.ts
// Returns available Discord roles for the calendar mention picker
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export type CalendarRole = { id: string; label: string; mention: string };

export async function GET() {
  const cookieStore = await cookies();
  const sid = cookieStore.get(env.AUTH_COOKIE_NAME)?.value;
  if (!sid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const session = await getSession(sid);
  if (!session || (!session.isAdmin && !session.isHead)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const roles: CalendarRole[] = [
    { id: "everyone", label: "@everyone", mention: "@everyone" },
    { id: "here",     label: "@here",     mention: "@here" },
  ];

  const mapping: [keyof typeof env, string][] = [
    ["DISCORD_ADMIN_ROLE_ID",    "Admin"],
    ["DISCORD_HEAD_1_ROLE_ID",   "Head 1"],
    ["DISCORD_HEAD_2_ROLE_ID",   "Head 2"],
    ["DISCORD_HEAD_3_ROLE_ID",   "Head 3"],
    ["DISCORD_MEMBER_1_ROLE_ID", "Member 1"],
    ["DISCORD_MEMBER_2_ROLE_ID", "Member 2"],
    ["DISCORD_MEMBER_3_ROLE_ID", "Member 3"],
  ];

  for (const [key, label] of mapping) {
    const roleId = env[key] as string | undefined;
    if (roleId && roleId.trim()) {
      roles.push({ id: roleId, label, mention: `<@&${roleId}>` });
    }
  }

  return NextResponse.json(roles);
}
