import { createClient } from "@supabase/supabase-js";

type GuildNo = 1 | 2 | 3;
type MemberStatus = "active" | "inactive";

const DISCORD_API = "https://discord.com/api/v10";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function resolveGuildFromRoles(roles: string[]): GuildNo | null {
  const h1 = process.env.DISCORD_HEAD_1_ROLE_ID;
  const h2 = process.env.DISCORD_HEAD_2_ROLE_ID;
  const h3 = process.env.DISCORD_HEAD_3_ROLE_ID;

  const r1 = process.env.DISCORD_MEMBER_1_ROLE_ID;
  const r2 = process.env.DISCORD_MEMBER_2_ROLE_ID;
  const r3 = process.env.DISCORD_MEMBER_3_ROLE_ID;

  if (h1 && roles.includes(h1)) return 1;
  if (h2 && roles.includes(h2)) return 2;
  if (h3 && roles.includes(h3)) return 3;

  if (r1 && roles.includes(r1)) return 1;
  if (r2 && roles.includes(r2)) return 2;
  if (r3 && roles.includes(r3)) return 3;

  return null;
}

function hasClubRole(roles: string[]): boolean {
  const clubRole = process.env.DISCORD_CLUB_ROLE_ID;
  if (!clubRole) return false; // ✅ default false
  return roles.includes(clubRole);
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
  const out: any[] = [];
  let after = "0";

  for (;;) {
    const page = (await discordFetch(`/guilds/${guildId}/members?limit=1000&after=${after}`)) as any[];

    out.push(...page);
    if (page.length < 1000) break;

    after = page[page.length - 1]?.user?.id;
    if (!after) break;
  }

  return out;
}

export async function syncDiscordMembers(opts?: {
  adminSecretHeaderValue?: string | null;
  requiredSecret?: string;
}): Promise<{ status: number; body: any }> {
  // 0) Optional secret validation (route ตรวจแล้ว แต่กันหลุด)
  if (opts?.requiredSecret) {
    if (!opts.adminSecretHeaderValue || opts.adminSecretHeaderValue !== opts.requiredSecret) {
      return { status: 401, body: { error: "Unauthorized" } };
    }
  }

  const guildId = mustEnv("DISCORD_GUILD_ID");

  const supabase = createClient(mustEnv("SUPABASE_URL"), mustEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });

  // 1) Pull members from Discord
  const guildMembers = await listGuildMembersAll(guildId);

  // 2) Build eligible list
  const eligible = guildMembers
    .map((m) => {
      const roles: string[] = Array.isArray(m.roles) ? m.roles : [];

      const resolvedGuild = resolveGuildFromRoles(roles);
      if (!resolvedGuild) return null;

      const u = m.user || {};
      const discord_user_id = String(u.id);
      const displayName = m.nick || u.global_name || u.username || "Unknown";

      return {
        discord_user_id,
        name: String(displayName),
        guild: resolvedGuild,
        club: hasClubRole(roles), // ✅ role -> member.club
      };
    })
    .filter(Boolean) as Array<{ discord_user_id: string; name: string; guild: GuildNo; club: boolean }>;

  const eligibleIds = eligible.map((x) => x.discord_user_id);
  const eligibleIdSet = new Set(eligibleIds);

  // 3) Load existing rows for eligible (เพื่อ “ไม่ทับ” class_id/power/is_special/color ของเดิม)
  const { data: existingRows, error: existErr } = await supabase
    .from("member")
    .select("discord_user_id,class_id,power,is_special,color")
    .in("discord_user_id", eligibleIds);

  if (existErr) throw new Error(`Supabase select existing error: ${existErr.message}`);

  const existingMap = new Map<string, any>();
  (existingRows || []).forEach((r) => {
    if (r.discord_user_id) existingMap.set(String(r.discord_user_id), r);
  });

  // 4) Upsert payload
  // - default class_id = 0 (เฉพาะคนใหม่ หรือคนเดิมที่ยังไม่มีค่า)
  const upsertPayload = eligible.map((x) => {
    const ex = existingMap.get(x.discord_user_id);

    const class_id = ex?.class_id != null ? ex.class_id : 0;
    const power = ex?.power != null ? ex.power : 0;
    const is_special = ex?.is_special != null ? ex.is_special : false;
    const color = ex?.color != null ? ex.color : null;

    return {
      discord_user_id: x.discord_user_id,
      name: x.name,
      guild: x.guild,

      // ✅ club: default false, true only if has DISCORD_CLUB_ROLE_ID
      club: !!x.club,

      class_id,
      power,
      is_special,
      color,

      status: "active" as MemberStatus,
    };
  });

  const { error: upsertErr } = await supabase.from("member").upsert(upsertPayload, { onConflict: "discord_user_id" });

  if (upsertErr) throw new Error(`Supabase upsert error: ${upsertErr.message}`);

  // 5) Inactivate members who are currently active but no longer eligible
  const { data: activeRows, error: activeErr } = await supabase
    .from("member")
    .select("id, discord_user_id")
    .not("discord_user_id", "is", null)
    .eq("status", "active");

  if (activeErr) throw new Error(`Supabase select active error: ${activeErr.message}`);

  const toInactivate = (activeRows || [])
    .filter((r) => r.discord_user_id && !eligibleIdSet.has(String(r.discord_user_id)))
    .map((r) => r.id);

  if (toInactivate.length > 0) {
    const { error: inactErr } = await supabase.from("member").update({ status: "inactive" }).in("id", toInactivate);

    if (inactErr) throw new Error(`Supabase inactive update error: ${inactErr.message}`);
  }

  return {
    status: 200,
    body: {
      ok: true,
      eligible: eligible.length,
      inactivated: toInactivate.length,
      default_class_id: 0,
      club_role_env: "DISCORD_CLUB_ROLE_ID",
    },
  };
}
