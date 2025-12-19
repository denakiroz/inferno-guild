import { NextResponse } from "next/server";
import crypto from "crypto";
import { discordAuthorizeUrl } from "@/lib/discord";

export const runtime = "nodejs";

export async function GET() {
  const state = crypto.randomBytes(16).toString("hex");
  return NextResponse.redirect(discordAuthorizeUrl(state));
}
