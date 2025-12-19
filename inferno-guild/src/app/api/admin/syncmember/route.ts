import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GuildNo = 1 | 2 | 3;

const DISCORD_API = "https://discord.com/api/v10";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function resolveGuildFromMemberRoles(roles: string[]): GuildNo | null {
  // Priority: 1 > 2 > 3 (เผื่อคนมีหลาย role)
  const r1 = process.env.DISCORD_MEMBER_1_ROLE_ID;
  const r2 = process.env.DISCORD_MEMBER_2_ROLE_ID;
  const r3 = process.env.DISCORD_MEMBER_3_ROLE_ID;

  if (r1 && roles.includes(r1)) return 1;
  if (r2 && roles.includes(r2)) return 2;
  if (r3 && roles.includes(r3)) return 3;
  return null;
}

async function discordFetch(path: string) {
  const token = mustEnv("DISCORD_BOT_TOKEN");
  const res = await fetch(`${DISCORD_API}${path}`, {
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
  // ต้องเปิด Server Members Intent ใน Discord Developer Portal ด้วย
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

export async function POST(req: Request) {
  try {
    // --- protection ---
    const secret = req.headers.get("x-admin-secret");
    if (secret !== mustEnv("ADMIN_SYNC_SECRET")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const guildId = mustEnv("DISCORD_GUILD_ID");

    // --- Supabase (service role) ---
    const supabase = createClient(
      mustEnv("SUPABASE_URL"),
      mustEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false } }
    );

    // 1) Pull members from Discord
    const guildMembers = await listGuildMembersAll(guildId);

    // 2) eligible = คนที่มี role member 1/2/3
    const eligible = guildMembers
      .map((m) => {
        const roles: string[] = Array.isArray(m.roles) ? m.roles : [];
        const resolvedGuild = resolveGuildFromMemberRoles(roles);
        if (!resolvedGuild) return null;

        const u = m.user || {};
        const displayName = m.nick || u.global_name || u.username || "Unknown";

        return {
          discord_user_id: String(u.id),
          name: String(displayName),
          guild: resolvedGuild,
        };
      })
      .filter(Boolean) as Array<{ discord_user_id: string; name: string; guild: GuildNo }>;

    const eligibleIds = new Set(eligible.map((x) => x.discord_user_id));

    // 3) Upsert แบบ "ไม่ทับค่าเดิม"
    // ส่งเฉพาะ field ที่อนุญาตให้ sync ปรับ: name, guild, status
    // fields อื่น (class_id, power, party, color, is_special...) ไม่ส่ง → ไม่โดนทับ
    const upsertPayload = eligible.map((x) => ({
      discord_user_id: x.discord_user_id,
      name: x.name,
      guild: x.guild,
      status: "active",
    }));

    const { error: upsertErr } = await supabase
      .from("member")
      .upsert(upsertPayload, { onConflict: "discord_user_id" });

    if (upsertErr) throw new Error(`Supabase upsert error: ${upsertErr.message}`);

    // 4) Inactivate คนที่เคย active แต่ตอนนี้ไม่มี role member แล้ว
    const { data: activeRows, error: selectErr } = await supabase
      .from("member")
      .select("id, discord_user_id")
      .not("discord_user_id", "is", null)
      .eq("status", "active");

    if (selectErr) throw new Error(`Supabase select error: ${selectErr.message}`);

    const toInactivate = (activeRows || [])
      .filter((r) => r.discord_user_id && !eligibleIds.has(String(r.discord_user_id)))
      .map((r) => r.id);

    if (toInactivate.length > 0) {
      const { error: inactErr } = await supabase
        .from("member")
        .update({ status: "inactive" })
        .in("id", toInactivate);

      if (inactErr) throw new Error(`Supabase inactive update error: ${inactErr.message}`);
    }

    return NextResponse.json({
      ok: true,
      eligible: eligible.length,
      inactivated: toInactivate.length,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
