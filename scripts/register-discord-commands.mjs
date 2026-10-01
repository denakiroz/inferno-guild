// scripts/register-discord-commands.mjs
// ลงทะเบียนคำสั่ง /weblogin และ /leave ในเซิร์ฟเวอร์ของกิลด์
// (ใช้ POST สร้างทีละคำสั่ง — ไม่แตะคำสั่งอื่นของบอท, รันซ้ำเพื่ออัปเดตได้)
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

const STRING = 3;

const commands = [
  {
    name: "weblogin",
    description: "รับลิงก์เข้าสู่เว็บ Celestier Guild Portal (เห็นเฉพาะคุณ)",
    type: 1,
  },
  {
    name: "leave",
    description: "แจ้งลา (ไม่ใส่วันที่ = เสาร์ที่จะถึง ทั้ง 2 รอบ)",
    type: 1,
    options: [
      {
        type: STRING,
        name: "round",
        description: "รอบวอ (เฉพาะวันเสาร์) — ไม่เลือก = ทั้ง 2 รอบ",
        required: false,
        choices: [
          { name: "ทั้ง 2 รอบ (20:00 + 20:30)", value: "both" },
          { name: "รอบ 20:00", value: "20:00" },
          { name: "รอบ 20:30", value: "20:30" },
        ],
      },
      {
        type: STRING,
        name: "date",
        description: "เลือกวันจากรายการ หรือพิมพ์เอง เช่น 3/10 (เว้นว่าง = เสาร์ที่จะถึง)",
        required: false,
        autocomplete: true,
      },
      {
        type: STRING,
        name: "reason",
        description: "เหตุผล (ไม่บังคับ)",
        required: false,
      },
    ],
  },
];

for (const cmd of commands) {
  const res = await fetch(
    `https://discord.com/api/v10/applications/${DISCORD_CLIENT_ID}/guilds/${DISCORD_GUILD_ID}/commands`,
    {
      method: "POST",
      headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(cmd),
    }
  );
  console.log(`/${cmd.name}`, res.status, res.ok ? "ok" : await res.text());
}
