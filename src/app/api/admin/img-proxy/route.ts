import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Same-origin image proxy for CANVAS export (war map).
 *
 * Why:
 * - Cross-origin images without proper CORS headers can fail to draw on canvas
 *   or taint the canvas (breaking export).
 * - Some hosts also return HTML placeholders when hotlinking / bot-like requests.
 *
 * This route:
 * - Restricts outbound fetch to an allowlist of hosts.
 * - Adds browser-like headers (UA/Accept/Referer) to reduce hotlink blocks.
 * - Verifies upstream content-type is image/*.
 */

const ALLOWED_HOSTS = new Set([
  // Discord
  "cdn.discordapp.com",
  "media.discordapp.net",

  // ImgBB
  "i.ibb.co",
  "ibb.co",
]);

function isAllowedHost(hostname: string) {
  const h = hostname.toLowerCase();
  if (ALLOWED_HOSTS.has(h)) return true;

  // pic.in.th — all subdomains (img1, img2, img3, img4, img5, ...)
  if (h === "pic.in.th" || h.endsWith(".pic.in.th")) return true;

  // Supabase project domains: <project>.supabase.co
  if (h.endsWith(".supabase.co")) return true;

  return false;
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) return NextResponse.json({ ok: false, error: "missing url" }, { status: 400 });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid url" }, { status: 400 });
  }

  if (!(target.protocol === "http:" || target.protocol === "https:")) {
    return NextResponse.json({ ok: false, error: "invalid protocol" }, { status: 400 });
  }

  if (!isAllowedHost(target.hostname)) {
    return NextResponse.json(
      { ok: false, error: "host not allowed", host: target.hostname },
      { status: 403 }
    );
  }

  const ua =
    req.headers.get("user-agent") ??
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari";

  let upstream: Response;
  try {
    upstream = await fetch(target.toString(), {
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
      headers: {
        "User-Agent": ua,
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "Accept-Language": req.headers.get("accept-language") ?? "th-TH,th;q=0.9,en;q=0.8",
        Referer: `https://${target.hostname}/`,
      },
    });
  } catch (err: unknown) {
    const isTimeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    return NextResponse.json(
      { ok: false, error: isTimeout ? "upstream timeout" : "fetch failed" },
      { status: 504 }
    );
  }

  if (!upstream.ok) {
    return NextResponse.json(
      { ok: false, error: "upstream failed", status: upstream.status },
      { status: 502 }
    );
  }

  const ct = upstream.headers.get("content-type") ?? "";
  if (!ct.toLowerCase().startsWith("image/")) {
    return NextResponse.json(
      { ok: false, error: "upstream is not image", contentType: ct },
      { status: 502 }
    );
  }

  let buf: ArrayBuffer;
  try {
    buf = await upstream.arrayBuffer();
  } catch {
    return NextResponse.json({ ok: false, error: "failed to read body" }, { status: 502 });
  }

  const res = new NextResponse(buf, { status: 200 });
  res.headers.set("Content-Type", ct);
  res.headers.set("Cache-Control", "public, max-age=86400, immutable");
  return res;
}
