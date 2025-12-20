import { Redis } from "@upstash/redis";
import crypto from "crypto";
import { env } from "./env";

export type SessionUser = {
  discordUserId: string;
  displayName: string;
  avatarUrl: string | null;
  guild: number;

  /** Super admin: can view all guilds, run admin actions */
  isAdmin: boolean;

  /** Head: can access /admin but locked to own guild */
  isHead: boolean;

  roles?: string[];
};

const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL!,
  token: env.UPSTASH_REDIS_REST_TOKEN!,
});

const keyOf = (sid: string) => `session:${sid}`;

export function newSessionId(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function createSession(user: SessionUser): Promise<string> {
  const sid = newSessionId();
  await redis.set(keyOf(sid), user, { ex: env.SESSION_TTL_SECONDS });
  return sid;
}

export async function getSession(sid?: string | null): Promise<SessionUser | null> {
  if (!sid) return null;
  const user = await redis.get<SessionUser>(keyOf(sid));
  return user ?? null;
}

export async function deleteSession(sid?: string | null): Promise<void> {
  if (!sid) return;
  await redis.del(keyOf(sid));
}
