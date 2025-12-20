import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

export const runtime = "nodejs";

export async function POST() {
  const cookieStore = cookies();

  (await  cookieStore).set(env.AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return NextResponse.json({ ok: true });
}
