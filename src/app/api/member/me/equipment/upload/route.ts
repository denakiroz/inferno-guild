// app/api/member/me/equipment/upload/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

async function requireSession() {
  const cookieStore = await cookies();
  const sid = cookieStore.get(env.AUTH_COOKIE_NAME)?.value;
  if (!sid) return null;

  const session = await getSession(sid);
  return session ?? null;
}

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    if (!session) return NextResponse.json({ ok: false }, { status: 401 });

    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ ok: false, error: "missing_file" }, { status: 400 });

    // basic validation
    const mime = String(file.type || "");
    if (!mime.startsWith("image/")) {
      return NextResponse.json({ ok: false, error: "invalid_mime" }, { status: 400 });
    }

    const size = Number((file as any).size ?? 0);
    // 10MB limit (adjust as needed)
    if (size > 10 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: "file_too_large" }, { status: 400 });
    }

    const originalName = String(file.name || "image");
    const extRaw = originalName.includes(".") ? originalName.split(".").pop() : "jpg";
    const ext = String(extRaw || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const safeExt = ext || "jpg";

    const discord_user_id = BigInt(session.discordUserId).toString();
    const path = `me/${discord_user_id}/${crypto.randomUUID()}.${safeExt}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const bucket = "member-equipment";

    const { error } = await supabaseAdmin.storage.from(bucket).upload(path, buffer, {
      upsert: true,
      contentType: mime || "application/octet-stream",
      cacheControl: "3600",
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
    const url = data?.publicUrl;

    if (!url) {
      return NextResponse.json({ ok: false, error: "public_url_failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, url, path });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e.message ?? e) }, { status: 500 });
  }
}
