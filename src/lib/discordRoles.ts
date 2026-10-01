import { env } from "@/lib/env";

// -------------------- role utils (ใช้ร่วมกันระหว่าง OAuth callback และ /weblogin ผ่านบอท) --------------------
export function resolveGuildFromRoles(roles: string[]): number | null {
  // Priority: HEAD > MEMBER
  if (env.DISCORD_HEAD_1_ROLE_ID && roles.includes(env.DISCORD_HEAD_1_ROLE_ID)) return 1;
  if (env.DISCORD_HEAD_2_ROLE_ID && roles.includes(env.DISCORD_HEAD_2_ROLE_ID)) return 2;
  if (env.DISCORD_HEAD_3_ROLE_ID && roles.includes(env.DISCORD_HEAD_3_ROLE_ID)) return 3;

  if (env.DISCORD_MEMBER_1_ROLE_ID && roles.includes(env.DISCORD_MEMBER_1_ROLE_ID)) return 1;
  if (env.DISCORD_MEMBER_2_ROLE_ID && roles.includes(env.DISCORD_MEMBER_2_ROLE_ID)) return 2;
  if (env.DISCORD_MEMBER_3_ROLE_ID && roles.includes(env.DISCORD_MEMBER_3_ROLE_ID)) return 3;

  return null;
}

export function isSuperAdminByRoles(roles: string[]): boolean {
  return !!env.DISCORD_ADMIN_ROLE_ID && roles.includes(env.DISCORD_ADMIN_ROLE_ID);
}

export function isHeadByRoles(roles: string[]): boolean {
  return !!(
    (env.DISCORD_HEAD_1_ROLE_ID && roles.includes(env.DISCORD_HEAD_1_ROLE_ID)) ||
    (env.DISCORD_HEAD_2_ROLE_ID && roles.includes(env.DISCORD_HEAD_2_ROLE_ID)) ||
    (env.DISCORD_HEAD_3_ROLE_ID && roles.includes(env.DISCORD_HEAD_3_ROLE_ID))
  );
}
