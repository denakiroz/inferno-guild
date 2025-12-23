import { NextResponse } from "next/server";
import crypto from "crypto";
import { discordAuthorizeUrl } from "@/lib/discord";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode"); // "url" | null

  const state = crypto.randomBytes(16).toString("hex");
  const authorizeUrl = discordAuthorizeUrl(state);

  // แนะนำ: เก็บ state ไว้ใน cookie เพื่อให้ callback ตรวจสอบได้ (กัน CSRF / mismatch)
  const isProd = process.env.NODE_ENV === "production";

  if (mode === "url") {
    const res = NextResponse.json({ authorizeUrl });
    res.cookies.set({
      name: "discord_oauth_state",
      value: state,
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60, // 10 นาที
    });
    return res;
  }

  const res = NextResponse.redirect(authorizeUrl);
  res.cookies.set({
    name: "discord_oauth_state",
    value: state,
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });
  return res;
}
