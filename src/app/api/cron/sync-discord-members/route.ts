import { NextResponse } from "next/server";
import { syncDiscordMembers } from "@/lib/discordMemberSync";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const querySecret = url.searchParams.get("secret");
    const headerSecret = req.headers.get("x-cron-secret");

    const expected = process.env.CRON_SECRET || process.env.ADMIN_SYNC_SECRET;

    if (!expected || (querySecret !== expected && headerSecret !== expected)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ส่งค่าที่ผ่านการตรวจแล้ว เข้าไปให้ syncDiscordMembers ใช้ตรวจของมันเอง
    const provided = headerSecret ?? querySecret;

    const result = await syncDiscordMembers({
      adminSecretHeaderValue: provided,
      requiredSecret: expected,
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
