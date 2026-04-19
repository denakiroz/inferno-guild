// Generic Redis cache layer (Upstash REST).
// - Graceful fallback: ถ้า UPSTASH env ไม่ตั้ง → skip cache (แค่เรียก loader ปกติ)
// - Error-tolerant: ถ้า Redis ล่ม → log + fall-through ให้ loader ทำงาน ไม่ block request
// - Namespaced keys: prefix "cache:" ทั้งหมด เพื่อแยกกับ session:* และ future namespace อื่น

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

/**
 * Get-or-set pattern — ถ้ามี cache hit คืน cached value ทันที
 * ถ้าไม่มี เรียก loader() แล้ว set cache ก่อนคืน
 *
 * loader จะถูกเรียกแน่ ๆ เมื่อ Redis ไม่มีคีย์ หรือ Redis ล่ม (graceful fallback)
 */
export async function cacheGetOrSet<T>(
  key: string,
  ttlSec: number,
  loader: () => Promise<T>
): Promise<T> {
  const hit = await cacheGet<T>(key);
  if (hit !== null && hit !== undefined) return hit;
  const value = await loader();
  // fire-and-forget set (don't await — ให้ response ไปก่อน)
  void cacheSet(key, value, ttlSec);
  return value;
}

// --- Cache keys (รวมศูนย์ไว้ที่เดียว ป้องกัน typo กับลืม invalidate) ---
export const CK = {
  leaderboard: () => "cache:leaderboard:v1",
  /** members list with skills + equipment, partitioned by guild ("all" = ทุก guild) */
  members: (guild?: number | null) =>
    `cache:members:v1:${guild == null ? "all" : String(guild)}`,
  /** สำหรับลบทุก guild partition ด้วย delByPattern (Upstash ไม่รองรับ → ใช้ registry) */
  membersAllVariants: () => ["cache:members:v1:all", "cache:members:v1:1", "cache:members:v1:2", "cache:members:v1:3"],
} as const;

/**
 * Convenience: invalidate member-potential related caches
 * เรียกจาก POST/PATCH/DELETE ของ batches, records, weights
 */
export async function invalidateMemberPotential(): Promise<void> {
  await cacheDel([CK.leaderboard()]);
}

/**
 * Convenience: invalidate member list cache (ทุก guild partition)
 * เรียกจาก CRUD ของ members, ultimate/special skills, equipment
 */
export async function invalidateMembers(): Promise<void> {
  await cacheDel(CK.membersAllVariants());
}
