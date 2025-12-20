import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Protect /me/* and /admin/*
 * - ต้องมี session (sid cookie) ถึงเข้าได้
 * - /admin/* ต้องเป็น (isAdmin || isHead)
 *
 * NOTE:
 * - ใช้ cookie name จาก ENV ถ้ามี ไม่งั้น default = "sid"
 * - เรียก /api/me เพื่อดึง role จาก session (server-side)
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isMePath = pathname.startsWith("/me");
  const isAdminPath = pathname.startsWith("/admin");

  if (!isMePath && !isAdminPath) return NextResponse.next();

  const cookieName = process.env.AUTH_COOKIE_NAME || "sid";
  const sid = req.cookies.get(cookieName)?.value;

  // ไม่ login -> ส่งไปหน้า login
  if (!sid) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // ดึงข้อมูล user จาก API (อาศัย sid cookie)
  let me: any = null;
  try {
    const meRes = await fetch(new URL("/api/me", req.url), {
      headers: {
        // ส่ง cookie ทั้งหมดไปด้วย เพื่อให้ /api/me อ่าน sid ได้
        cookie: req.headers.get("cookie") || `${cookieName}=${sid}`,
      },
    });

    if (!meRes.ok) {
      // session invalid หรือ api error
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }

    me = await meRes.json();
  } catch {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // ถ้า /api/me บอกว่าไม่ ok -> ถือว่า session ใช้ไม่ได้
  if (!me?.ok) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // /admin ต้องเป็น admin หรือ head
  if (isAdminPath && !(me?.user?.isAdmin || me?.user?.isHead)) {
    const url = req.nextUrl.clone();
    url.pathname = "/me";
    url.searchParams.set("error", "forbidden");
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/me/:path*", "/admin/:path*"],
};
