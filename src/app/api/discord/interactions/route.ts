import { NextResponse } from "next/server";
import crypto from "crypto";
import { env } from "@/lib/env";
import { avatarUrlOf } from "@/lib/discord";
import { isHeadByRoles, isSuperAdminByRoles, resolveGuildFromRoles } from "@/lib/discordRoles";
import { createLoginTicket, LOGIN_TICKET_TTL_SECONDS } from "@/lib/loginTicket";
import { createLeaveFromCommand, leaveDateSuggestions } from "@/lib/leaveCommand";

export const runtime = "nodejs";

/**
 * Discord Interactions Endpoint (HTTP) — คำสั่ง /weblogin
 * ตั้งค่าที่ Developer Portal -> General Information -> Interactions Endpoint URL
 *   = {BASE_URL}/api/discord/interactions
 */

// Ed25519 public key (hex) -> SPKI DER prefix
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

function verifySignature(rawBody: string, signature: string, timestamp: string): boolean {
  const pub = env.DISCORD_PUBLIC_KEY;
  if (!pub || !signature || !timestamp) return false;
  try {
    const key = crypto.createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(pub, "hex")]),
      format: "der",
      type: "spki",
    });
    return crypto.verify(null, Buffer.from(timestamp + rawBody), key, Buffer.from(signature, "hex"));
  } catch {
    return false;
  }
}

const EPHEMERAL = 64; // เห็นเฉพาะผู้ใช้คำสั่ง

function reply(content: string, components?: unknown[]) {
  return NextResponse.json({
    type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
    data: { content, flags: EPHEMERAL, ...(components ? { components } : {}) },
  });
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const ok = verifySignature(
    rawBody,
    req.headers.get("x-signature-ed25519") ?? "",
    req.headers.get("x-signature-timestamp") ?? ""
  );
  if (!ok) return new NextResponse("invalid request signature", { status: 401 });

  const it = JSON.parse(rawBody) as any;

  // PING (Discord ใช้ตรวจสอบ endpoint)
  if (it.type === 1) return NextResponse.json({ type: 1 });

  // Autocomplete (type 4): ช่อง date ของ /leave -> แนะนำเสาร์ที่จะถึง + วันนี้/พรุ่งนี้ (ไม่ต้อง verify สิทธิ์ เพราะแค่แสดงรายการวัน)
  if (it.type === 4 && it.data?.name === "leave") {
    const focused = (Array.isArray(it.data.options) ? it.data.options : []).find((o: any) => o?.focused);
    const choices = focused?.name === "date" ? leaveDateSuggestions(String(focused.value ?? "")) : [];
    return NextResponse.json({ type: 8, data: { choices } }); // APPLICATION_COMMAND_AUTOCOMPLETE_RESULT
  }

  // Slash command /weblogin
  if (it.type === 2 && it.data?.name === "weblogin") {
    // ต้องใช้ในเซิร์ฟเวอร์ของกิลด์เท่านั้น (ต้องมี member/roles)
    if (!it.guild_id || it.guild_id !== env.DISCORD_GUILD_ID || !it.member?.user) {
      return reply("❌ ใช้คำสั่งนี้ในเซิร์ฟเวอร์ของกิลด์เท่านั้น");
    }

    const user = it.member.user;
    const roles: string[] = Array.isArray(it.member.roles) ? it.member.roles : [];

    const guild = resolveGuildFromRoles(roles);
    if (!guild) return reply("❌ บัญชีนี้ไม่มีสิทธิ์เข้าใช้งาน (ไม่พบยศสมาชิกกิลด์)");

    const token = await createLoginTicket({
      discordUserId: String(user.id),
      displayName: it.member.nick || user.global_name || user.username,
      avatarUrl: avatarUrlOf(String(user.id), user.avatar),
      guild,
      isAdmin: isSuperAdminByRoles(roles),
      isHead: isHeadByRoles(roles),
      roles,
    });

    const url = `${env.BASE_URL}/api/auth/ticket?t=${token}`;
    const minutes = Math.round(LOGIN_TICKET_TTL_SECONDS / 60);

    return reply(
      `✅ กดปุ่มด้านล่างเพื่อเข้าสู่เว็บ (ลิงก์ใช้ได้ครั้งเดียว ภายใน ${minutes} นาที — อย่าส่งต่อให้คนอื่น)`,
      [
        {
          type: 1, // action row
          components: [{ type: 2, style: 5, label: "เข้าสู่เว็บ", url }], // style 5 = link button
        },
      ]
    );
  }

  // Slash command /leave — ลาวอ/ลากิจ
  if (it.type === 2 && it.data?.name === "leave") {
    if (!it.guild_id || it.guild_id !== env.DISCORD_GUILD_ID || !it.member?.user) {
      return reply("❌ ใช้คำสั่งนี้ในเซิร์ฟเวอร์ของกิลด์เท่านั้น");
    }

    const roles: string[] = Array.isArray(it.member.roles) ? it.member.roles : [];
    if (!resolveGuildFromRoles(roles)) {
      return reply("❌ บัญชีนี้ไม่มีสิทธิ์เข้าใช้งาน (ไม่พบยศสมาชิกกิลด์)");
    }

    const opts: Record<string, string> = {};
    for (const o of Array.isArray(it.data.options) ? it.data.options : []) {
      if (o?.name) opts[String(o.name)] = String(o.value ?? "");
    }

    const round = opts.round === "20:00" || opts.round === "20:30" ? opts.round : "both";

    const r = await createLeaveFromCommand({
      discordUserId: String(it.member.user.id),
      dateInput: opts.date,
      round,
      reason: opts.reason,
    });

    if (!r.ok) {
      const msg: Record<string, string> = {
        member_not_found: "❌ ยังไม่พบข้อมูลสมาชิกของคุณในระบบ กรุณาเข้าเว็บ Guild Portal ก่อน 1 ครั้ง (/weblogin)",
        invalid_date: "❌ รูปแบบวันที่ไม่ถูกต้อง ใช้ได้ เช่น `2026-10-03`, `3/10` หรือ `03/10/2026` (เว้นว่าง = เสาร์ที่จะถึง)",
        past_date: "❌ ลาย้อนหลังไม่ได้ กรุณาเลือกวันนี้หรือวันถัดไป",
        too_far: "❌ ลาล่วงหน้าได้ไม่เกิน 180 วัน",
        db_error: "❌ บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
      };
      return reply(msg[r.error] ?? "❌ บันทึกไม่สำเร็จ");
    }

    const detail = r.saturday ? `วันเสาร์ รอบ ${r.times.join(" และ ")}` : "ลากิจ (ทั้งวัน)";
    return reply(`✅ บันทึกการลาแล้ว\n📅 ${r.date} • ${detail}\nแก้ไข/ยกเลิกได้ที่เว็บ Guild Portal → การลาของฉัน`);
  }

  return reply("ไม่รู้จักคำสั่งนี้");
}
