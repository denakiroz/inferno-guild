import { NextResponse } from "next/server";
import { syncDiscordMembers } from "@/lib/discordMemberSync";

export async function POST(req: Request) {
  try {
    const secret = req.headers.get("x-admin-secret");
    const result = await syncDiscordMembers({ adminSecretHeaderValue: secret });
    return NextResponse.json(result.body, { status: result.status });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
