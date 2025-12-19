import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { deleteSession } from "@/lib/session";

export const runtime = "nodejs";

export async function POST() {
  const sid = (await cookies()).get(env.AUTH_COOKIE_NAME)?.value;
  await deleteSession(sid);

  const res = NextResponse.redirect(`${env.BASE_URL}/login`);
  res.cookies.set(env.AUTH_COOKIE_NAME, "", { path: "/", maxAge: 0 });
  return res;
}
