import { NextResponse } from "next/server";
import { syncDiscordMembers } from "@/lib/discordMemberSync";
import { invalidateMembers, invalidateMemberPotential } from "@/lib/redisCache";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const querySecret = url.searchParams.get("secret");
    const headerSecret = req.headers.get("x-cron-secret");
    const authHeader = req.headers.get("authorization"); // Vercel Cron sends: "Bearer <CRON_SECRET>"
    const bearerSecret = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    const expected = process.env.CRON_SECRET || process.env.ADMIN_SYNC_SECRET;

    if (
      !expected ||
      (querySecret !== expected && headerSecret !== expected && bearerSecret !== expected)
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ส่งค่าที่ผ่านการตรวจแล้ว เข้าไปให้ syncDiscordMembers ใช้ตรวจของมันเอง
    const provided = bearerSecret ?? headerSecret ?? querySecret;

    const result = await syncDiscordMembers({
      adminSecretHeaderValue: provided,
      requiredSecret: expected,
    });

    // sync upsert/update/inactivate member → ล้าง Redis cache ทุกตัวที่เกี่ยวข้อง
    // (เดิม `/api/admin/syncmember` ทำขั้นตอนนี้ แต่ตัวนี้ลืม → user เห็น guild เก่าค้างจน TTL หมด)
    if (result.status >= 200 && result.status < 300) {
      await Promise.all([invalidateMembers(), invalidateMemberPotential()]);
    }

    return NextResponse.json(result.body, { status: result.status });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
