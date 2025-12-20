import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import {
  avatarUrlOf,
  exchangeCodeForToken,
  fetchDiscordUser,
  fetchGuildMember,
} from "@/lib/discord";
import { createSession } from "@/lib/session";

// -------------------- role utils --------------------
function resolveGuildFromRoles(roles: string[]): number | null {
  // Priority: HEAD > MEMBER
  if (env.DISCORD_HEAD_1_ROLE_ID && roles.includes(env.DISCORD_HEAD_1_ROLE_ID)) return 1;
  if (env.DISCORD_HEAD_2_ROLE_ID && roles.includes(env.DISCORD_HEAD_2_ROLE_ID)) return 2;
  if (env.DISCORD_HEAD_3_ROLE_ID && roles.includes(env.DISCORD_HEAD_3_ROLE_ID)) return 3;

  if (env.DISCORD_MEMBER_1_ROLE_ID && roles.includes(env.DISCORD_MEMBER_1_ROLE_ID)) return 1;
  if (env.DISCORD_MEMBER_2_ROLE_ID && roles.includes(env.DISCORD_MEMBER_2_ROLE_ID)) return 2;
  if (env.DISCORD_MEMBER_3_ROLE_ID && roles.includes(env.DISCORD_MEMBER_3_ROLE_ID)) return 3;

  return null;
}

function isSuperAdminByRoles(roles: string[]): boolean {
  return !!env.DISCORD_ADMIN_ROLE_ID && roles.includes(env.DISCORD_ADMIN_ROLE_ID);
}

function isHeadByRoles(roles: string[]): boolean {
  return !!(
    (env.DISCORD_HEAD_1_ROLE_ID && roles.includes(env.DISCORD_HEAD_1_ROLE_ID)) ||
    (env.DISCORD_HEAD_2_ROLE_ID && roles.includes(env.DISCORD_HEAD_2_ROLE_ID)) ||
    (env.DISCORD_HEAD_3_ROLE_ID && roles.includes(env.DISCORD_HEAD_3_ROLE_ID))
  );
}

function redirectLogin(params: Record<string, string>) {
  const u = new URL("/login", env.BASE_URL);
  for (const [k, v] of Object.entries(params)) {
    u.searchParams.set(k, v);
  }
  return NextResponse.redirect(u.toString());
}

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  if (!code) return redirectLogin({ error: "missing_code" });

  try {
    const token = await exchangeCodeForToken(code);
    const user = await fetchDiscordUser(token.access_token);

    const member = await fetchGuildMember(user.id);
    if (!member || member.inGuild === false) {
      return redirectLogin({ error: "not_in_guild" });
    }

    const roles = Array.isArray(member.roles) ? member.roles : [];

    const guild = resolveGuildFromRoles(roles);
    if (!guild) return redirectLogin({ error: "not_in_guild" });

    const isAdmin = isSuperAdminByRoles(roles); // super admin
    const isHead = isHeadByRoles(roles);        // head

    // NOTE: access /admin is allowed for (isAdmin || isHead) via middleware.

    const displayName = member.nick || user.global_name || user.username;
    const avatarUrl = avatarUrlOf(user.id, user.avatar);

    const sid = await createSession({
      discordUserId: user.id,
      displayName,
      avatarUrl,
      guild,
      isAdmin,
      isHead,
      roles,
    });

    const isProd = process.env.NODE_ENV === "production";
    const res = NextResponse.redirect(`${env.BASE_URL}/me`);

    res.cookies.set({
      name: env.AUTH_COOKIE_NAME,
      value: sid,
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: env.SESSION_TTL_SECONDS,
    });

    return res;
  } catch (e: any) {
    console.error("DISCORD AUTH FAILED:", e);
    return redirectLogin({
      error: "auth_failed",
      msg: encodeURIComponent(e?.message || "unknown"),
    });
  }
}
