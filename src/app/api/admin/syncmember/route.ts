import { NextResponse } from "next/server";
import { syncDiscordMembers } from "@/lib/discordMemberSync";
import { invalidateMembers, invalidateMemberPotential } from "@/lib/redisCache";

export async function POST(req: Request) {
  try {
    const secret = req.headers.get("x-admin-secret");
    const result = await syncDiscordMembers({ adminSecretHeaderValue: secret });
    // sync อาจ insert/update/inactivate member → ล้าง cache ทุกตัวที่เกี่ยวข้อง
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
