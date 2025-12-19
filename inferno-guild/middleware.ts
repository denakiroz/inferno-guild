import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isMe = pathname.startsWith("/me");
  const isAdmin = pathname.startsWith("/admin");

  if (!isMe && !isAdmin) return NextResponse.next();

  const sid = req.cookies.get("sid")?.value;
  if (!sid) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // เรียก API ตรวจ session + isAdmin (ส่ง cookie ไปด้วย)
  const meUrl = new URL("/api/me", req.url);
  const res = await fetch(meUrl, {
    headers: { cookie: req.headers.get("cookie") ?? "" },
    cache: "no-store",
  });

  if (!res.ok) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "unauthorized");
    return NextResponse.redirect(url);
  }

  const data = (await res.json().catch(() => null)) as any;
  if (!data?.ok) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "unauthorized");
    return NextResponse.redirect(url);
  }

  if (isAdmin && !data?.user?.isAdmin) {
    const url = req.nextUrl.clone();
    url.pathname = "/me"; // หรือจะให้ไป /403 ก็ได้
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/me/:path*", "/admin/:path*"],
};
