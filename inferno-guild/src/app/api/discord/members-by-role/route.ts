import { NextResponse } from "next/server";
import { env } from "@/lib/env"; // ถ้าคุณใช้ path อื่น ปรับตามจริง

type GuildNo = 1 | 2 | 3;

function roleIdOf(guildNo: GuildNo): string {
  if (guildNo === 1) return env.DISCORD_MEMBER_1_ROLE_ID!;
  if (guildNo === 2) return env.DISCORD_MEMBER_2_ROLE_ID!;
  return env.DISCORD_MEMBER_3_ROLE_ID!;
}

async function discordFetch(path: string) {
  const token = env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error("Missing DISCORD_BOT_TOKEN");

  const res = await fetch(`https://discord.com/api/v10${path}`, {
    headers: { Authorization: `Bot ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Discord API ${res.status}: ${text}`);
  }

  return res.json();
}

async function listGuildMembersAll(guildId: string) {
  // Discord limit=1000 ต่อหน้า ใช้ after เป็น user_id ตัวสุดท้าย
  const out: any[] = [];
  let after = "0";

  for (;;) {
    const page = (await discordFetch(
      `/guilds/${guildId}/members?limit=1000&after=${after}`
    )) as any[];

    out.push(...page);
    if (page.length < 1000) break;

    after = page[page.length - 1]?.user?.id;
    if (!after) break;
  }

  return out;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const guildNoRaw = url.searchParams.get("guildNo") || url.searchParams.get("guild") || "1";
    const guildNo = Number(guildNoRaw) as GuildNo;

    if (![1, 2, 3].includes(guildNo)) {
      return NextResponse.json({ error: "guildNo must be 1|2|3" }, { status: 400 });
    }

    const guildId = env.DISCORD_GUILD_ID;
    if (!guildId) {
      return NextResponse.json({ error: "Missing DISCORD_GUILD_ID" }, { status: 500 });
    }

    const roleId = roleIdOf(guildNo);
    if (!roleId) {
      return NextResponse.json({ error: `Missing DISCORD_MEMBER_${guildNo}_ROLE_ID` }, { status: 500 });
    }

    const members = await listGuildMembersAll(guildId);

    const filtered = members
      .filter((m) => Array.isArray(m.roles) && m.roles.includes(roleId))
      .map((m) => {
        const u = m.user || {};
        const displayName =
          m.nick ||
          u.global_name ||
          u.username ||
          `${u.username ?? "unknown"}#${u.discriminator ?? "0000"}`;

        return {
          user_id: u.id,
          username: u.username ?? null,
          global_name: u.global_name ?? null,
          nick: m.nick ?? null,
          display_name: displayName,
        };
      })
      // กันซ้ำ (บางเคสไม่ควรซ้ำ แต่เผื่อไว้)
      .filter((v, i, arr) => arr.findIndex((x) => x.user_id === v.user_id) === i)
      // เรียงตามชื่อให้ใช้ง่าย
      .sort((a, b) => (a.display_name || "").localeCompare(b.display_name || "", "th"));

    return NextResponse.json({
      guildNo,
      roleId,
      count: filtered.length,
      members: filtered,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
