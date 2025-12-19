import { supabaseAdmin } from "@/lib/supabaseAdmin";

type DiscordMember = {
  user: { id: string; username: string; global_name?: string | null };
  nick?: string | null;
  roles: string[];
};

function resolveGuildFromMemberRoles(roles: string[]): 1 | 2 | 3 | null {
  const r1 = process.env.DISCORD_MEMBER_1_ROLE_ID;
  const r2 = process.env.DISCORD_MEMBER_2_ROLE_ID;
  const r3 = process.env.DISCORD_MEMBER_3_ROLE_ID;

  // ถ้ามีหลาย role พร้อมกัน ให้กำหนด priority เอง (ตัวอย่าง: 1 > 2 > 3)
  if (r1 && roles.includes(r1)) return 1;
  if (r2 && roles.includes(r2)) return 2;
  if (r3 && roles.includes(r3)) return 3;
  return null;
}

async function fetchAllGuildMembers(): Promise<DiscordMember[]> {
  const token = process.env.DISCORD_BOT_TOKEN!;
  const guildId = process.env.DISCORD_GUILD_ID!;
  const out: DiscordMember[] = [];

  let after = "0";
  while (true) {
    const url =
      `https://discord.com/api/v10/guilds/${guildId}/members?limit=1000&after=${after}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bot ${token}` },
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Discord API error ${res.status}: ${text}`);
    }

    const batch = (await res.json()) as DiscordMember[];
    if (!batch.length) break;

    out.push(...batch);
    after = batch[batch.length - 1].user.id;

    if (batch.length < 1000) break;
  }

  return out;
}

export async function syncDiscordMembersToSupabase() {
  const members = await fetchAllGuildMembers();

  // 1) คัดเฉพาะคนที่มี role member แล้ว map เป็น guild
  const activeRows = members
    .map((m) => {
      const guild = resolveGuildFromMemberRoles(m.roles);
      if (!guild) return null;

      const name =
        m.nick?.trim() ||
        m.user.global_name?.trim() ||
        m.user.username;

      return {
        discord_user_id: m.user.id,
        name,
        guild,
        status: "active" as const,
      };
    })
    .filter(Boolean) as Array<{
      discord_user_id: string;
      name: string;
      guild: 1 | 2 | 3;
      status: "active";
    }>;

  // 2) upsert แบบ “ไม่ทับค่าเดิม” -> ส่งเฉพาะ 4 คอลัมน์นี้
  // ต้องมี unique index ที่ member.discord_user_id
  if (activeRows.length) {
    const { error } = await supabaseAdmin
      .from("member")
      .upsert(activeRows, { onConflict: "discord_user_id" });

    if (error) throw error;
  }

  // 3) set inactive สำหรับคนที่เคย active แต่ตอนนี้ไม่อยู่ใน activeRows แล้ว
  // หมายเหตุ: ถ้ากิลด์ใหญ่มาก รายชื่อจะยาว อาจต้องทำเป็น RPC ฝั่ง SQL เพื่อรองรับ array ใหญ่
  const activeIds = new Set(activeRows.map((r) => r.discord_user_id));
  const activeIdList = Array.from(activeIds);

  // ดึงเฉพาะคนที่ status=active ใน DB มาเทียบ แล้วค่อย update เฉพาะที่ต้อง inactive
  const { data: dbActive, error: readErr } = await supabaseAdmin
    .from("member")
    .select("discord_user_id,guild,status")
    .eq("status", "active");

  if (readErr) throw readErr;

  const toInactive = (dbActive || [])
    .filter((r) => r.discord_user_id && !activeIds.has(r.discord_user_id))
    .map((r) => r.discord_user_id);

  if (toInactive.length) {
    const { error: updErr } = await supabaseAdmin
      .from("member")
      .update({ status: "inactive" })
      .in("discord_user_id", toInactive);

    if (updErr) throw updErr;
  }

  return {
    scanned: members.length,
    activeUpserted: activeRows.length,
    inactivated: toInactive.length,
  };
}
