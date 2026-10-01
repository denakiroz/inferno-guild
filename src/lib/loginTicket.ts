import { Redis } from "@upstash/redis";
import crypto from "crypto";
import { env } from "@/lib/env";
import type { SessionUser } from "@/lib/session";

/**
 * Login ticket (magic link) — ออกให้ผ่านคำสั่ง /login ของบอท Discord
 * - เก็บใน Redis 5 นาที, ใช้ได้ครั้งเดียว (getdel)
 */
const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL!,
  token: env.UPSTASH_REDIS_REST_TOKEN!,
});

export const LOGIN_TICKET_TTL_SECONDS = 5 * 60;
const keyOf = (t: string) => `login_ticket:${t}`;

export async function createLoginTicket(user: SessionUser): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  await redis.set(keyOf(token), user, { ex: LOGIN_TICKET_TTL_SECONDS });
  return token;
}

/** อ่านแล้วลบทิ้งทันที (ใช้ซ้ำไม่ได้) */
export async function consumeLoginTicket(token: string): Promise<SessionUser | null> {
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const user = await redis.getdel<SessionUser>(keyOf(token));
  return user ?? null;
}
