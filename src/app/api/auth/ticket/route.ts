import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { createSession } from "@/lib/session";
import { consumeLoginTicket } from "@/lib/loginTicket";

export const runtime = "nodejs";

function redirectLogin(params: Record<string, string>) {
  const u = new URL("/login", env.BASE_URL);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return NextResponse.redirect(u.toString());
}

/** เข้าสู่ระบบด้วยลิงก์ที่บอทส่งให้ (/login ใน Discord) */
export async function GET(req: Request) {
  const t = new URL(req.url).searchParams.get("t") ?? "";

  const user = await consumeLoginTicket(t);
  if (!user) return redirectLogin({ error: "auth_failed", msg: "login_link_expired" });

  const sid = await createSession(user);

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
}
