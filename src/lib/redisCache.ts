// Generic Redis cache layer (Upstash REST).

import { Redis } from "@upstash/redis";
import { env } from "./env";

let _redis: Redis | null = null;
function getClient(): Redis | null {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) return null;
  if (!_redis) {
    _redis = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return _redis;
}

const CACHE_PREFIX = "cache:";
const keyOf = (key: string) => (key.startsWith(CACHE_PREFIX) ? key : `${CACHE_PREFIX}${key}`);

export async function cacheGet<T>(key: string): Promise<T | null> {
  const client = getClient();
  if (!client) return null;
  try {
    const v = await client.get<T>(keyOf(key));
    return (v as T) ?? null;
  } catch (err) {
    console.warn("[redisCache] get failed", key, err);
    return null;
  }
}

export async function cacheSet<T>(key: string, value: T, ttlSec: number): Promise<void> {
  const client = getClient();
  if (!client) return;
  try {
    await client.set(keyOf(key), value, { ex: Math.max(1, Math.floor(ttlSec)) });
  } catch (err) {
    console.warn("[redisCache] set failed", key, err);
  }
}

export async function cacheDel(keys: string | string[]): Promise<void> {
  const client = getClient();
  if (!client) return;
  const arr = Array.isArray(keys) ? keys : [keys];
  if (arr.length === 0) return;
  try {
    await client.del(...arr.map(keyOf));
  } catch (err) {
    console.warn("[redisCache] del failed", keys, err);
  }
}

export async function cacheGetOrSet<T>(
  key: string,
  ttlSec: number,
  loader: () => Promise<T>
): Promise<T> {
  const hit = await cacheGet<T>(key);
  if (hit !== null && hit !== undefined) return hit;
  const value = await loader();
  void cacheSet(key, value, ttlSec);
  return value;
}

// Cache keys
export const CK = {
  leaderboard: () => "cache:leaderboard:v1",
  members: (guild?: number | null) =>
    `cache:members:v1:${guild == null ? "all" : String(guild)}`,
  membersAllVariants: () => [
    "cache:members:v1:all",
    "cache:members:v1:1",
    "cache:members:v1:2",
    "cache:members:v1:3",
  ],
} as const;

export async function invalidateMemberPotential(): Promise<void> {
  const client = getClient();
  if (!client) return;
  try {
    await cacheDel([CK.leaderboard()]);
    // Also delete season-specific keys (pattern cache:leaderboard:v1:s<id>)
    const pattern = `${CK.leaderboard()}:s*`;
    const keys = await (client as any).keys(pattern).catch(() => [] as string[]);
    if (Array.isArray(keys) && keys.length > 0) {
      await cacheDel(keys as string[]);
    }
  } catch (err) {
    console.warn("[redisCache] invalidateMemberPotential failed", err);
  }
}

export async function invalidateMembers(): Promise<void> {
  await cacheDel(CK.membersAllVariants());
}
