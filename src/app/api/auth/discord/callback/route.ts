import { NextResponse } from "next/server";
import { cookies } from "next/headers";
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
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return NextResponse.redirect(u.toString());
}

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code) return redirectLogin({ error: "missing_code" });

  // ✅ ตรวจ state (สำคัญมาก โดยเฉพาะมือถือ / in-app browser)
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("discord_oauth_state")?.value;

  if (!state || !expectedState || state !== expectedState) {
    // state ไม่ตรง/หาย = ป้องกัน flow หลุดหรือถูกยิงกลับผิด session
    const res = redirectLogin({ error: "auth_failed", msg: "state_mismatch" });
    // ล้าง state ทิ้งเพื่อไม่ให้ค้าง
    res.cookies.set({
      name: "discord_oauth_state",
      value: "",
      path: "/",
      maxAge: 0,
    });
    return res;
  }

  try {
    const token = await exchangeCodeForToken(code);
    const user = await fetchDiscordUser(token.access_token);

    const member = await fetchGuildMember(user.id);
    if (!member || member.inGuild === false) {
      const res = redirectLogin({ error: "not_in_guild" });
      res.cookies.set({ name: "discord_oauth_state", value: "", path: "/", maxAge: 0 });
      return res;
    }

    const roles = Array.isArray(member.roles) ? member.roles : [];

    const guild = resolveGuildFromRoles(roles);
    if (!guild) {
      const res = redirectLogin({ error: "not_in_guild" });
      res.cookies.set({ name: "discord_oauth_state", value: "", path: "/", maxAge: 0 });
      return res;
    }

    const isAdmin = isSuperAdminByRoles(roles);
    const isHead = isHeadByRoles(roles);

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

    // ✅ set session cookie
    res.cookies.set({
      name: env.AUTH_COOKIE_NAME,
      value: sid,
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: env.SESSION_TTL_SECONDS,
    });

    // ✅ ล้าง oauth state cookie ทิ้ง (กัน reuse)
    res.cookies.set({
      name: "discord_oauth_state",
      value: "",
      path: "/",
      maxAge: 0,
    });

    return res;
  } catch (e: any) {
    console.error("DISCORD AUTH FAILED:", e);
    const res = redirectLogin({
      error: "auth_failed",
      msg: encodeURIComponent(e?.message || "unknown"),
    });
    // ล้าง state ทิ้งด้วย
    res.cookies.set({ name: "discord_oauth_state", value: "", path: "/", maxAge: 0 });
    return res;
  }
}
