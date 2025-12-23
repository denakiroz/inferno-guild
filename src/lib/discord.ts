import { env } from "./env";

type DiscordTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
};

type DiscordUser = {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
};

export function discordAuthorizeUrl(state: string) {
  // ✅ ใช้ UI endpoint (ไม่ใช่ /api)
  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
  url.searchParams.set("redirect_uri", env.DISCORD_REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "identify");
  url.searchParams.set("state", state);

  // แนะนำเพิ่มเพื่อให้เด้ง consent ชัด ๆ (โดยเฉพาะถ้าเคย authorize แล้วมันอาจ redirect เงียบ)
  url.searchParams.set("prompt", "consent");

  return url.toString();
}


export async function exchangeCodeForToken(code: string): Promise<DiscordTokenResponse> {
  const body = new URLSearchParams();
  body.set("client_id", env.DISCORD_CLIENT_ID);
  body.set("client_secret", env.DISCORD_CLIENT_SECRET);
  body.set("grant_type", "authorization_code");
  body.set("code", code);
  body.set("redirect_uri", env.DISCORD_REDIRECT_URI);

  const res = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`Discord token exchange failed: ${res.status}`);
  return res.json();
}

export async function fetchDiscordUser(accessToken: string): Promise<DiscordUser> {
  const res = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Discord /users/@me failed: ${res.status}`);
  return res.json();
}

export async function fetchGuildMember(discordUserId: string) {
  if (!env.DISCORD_BOT_TOKEN || !env.DISCORD_GUILD_ID) return null;

  const res = await fetch(
    `https://discord.com/api/guilds/${env.DISCORD_GUILD_ID}/members/${discordUserId}`,
    { headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` }, cache: "no-store" }
  );

  if (res.status === 404) return { inGuild: false, roles: [] as string[], nick: null as string | null };
  if (!res.ok) throw new Error(`Discord guild member check failed: ${res.status}`);

  const data = await res.json();
  return {
    inGuild: true,
    roles: (data.roles ?? []) as string[],
    nick: (data.nick ?? null) as string | null,
  };
}

export function avatarUrlOf(userId: string, avatarHash?: string | null): string | null {
  if (!avatarHash) return null;
  return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.png`;
}
