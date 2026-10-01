// scripts/register-discord-commands.mjs
// ลงทะเบียนคำสั่ง /login ในเซิร์ฟเวอร์ของกิลด์ (ใช้ POST สร้างเฉพาะคำสั่งนี้ — ไม่แตะคำสั่งอื่นของบอท)
// รัน: node scripts/register-discord-commands.mjs

import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env.local") });

const { DISCORD_CLIENT_ID, DISCORD_GUILD_ID, DISCORD_BOT_TOKEN } = process.env;
if (!DISCORD_CLIENT_ID || !DISCORD_GUILD_ID || !DISCORD_BOT_TOKEN) {
  console.error("Missing DISCORD_CLIENT_ID / DISCORD_GUILD_ID / DISCORD_BOT_TOKEN in .env.local");
  process.exit(1);
}

const res = await fetch(
  `https://discord.com/api/v10/applications/${DISCORD_CLIENT_ID}/guilds/${DISCORD_GUILD_ID}/commands`,
  {
    method: "POST",
    headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "login",
      description: "รับลิงก์เข้าสู่เว็บ Celestier Guild Portal (เห็นเฉพาะคุณ)",
      type: 1,
    }),
  }
);

console.log(res.status, await res.text());
