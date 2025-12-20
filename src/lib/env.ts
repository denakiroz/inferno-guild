// src/lib/env.ts
import { z } from "zod";

const EnvSchema = z.object({
  BASE_URL: z.string().url().default("http://localhost:3000"),
  AUTH_COOKIE_NAME: z.string().default("sid"),
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24 * 7),

  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_CLIENT_SECRET: z.string().min(1),
  DISCORD_GUILD_ID: z.string().min(1),
  DISCORD_REDIRECT_URI: z.string().url(),

  DISCORD_ADMIN_ROLE_ID: z.string().optional().default(""),

  DISCORD_HEAD_1_ROLE_ID: z.string().optional().default(""),
  DISCORD_HEAD_2_ROLE_ID: z.string().optional().default(""),
  DISCORD_HEAD_3_ROLE_ID: z.string().optional().default(""),

  DISCORD_MEMBER_1_ROLE_ID: z.string().optional().default(""),
  DISCORD_MEMBER_2_ROLE_ID: z.string().optional().default(""),
  DISCORD_MEMBER_3_ROLE_ID: z.string().optional().default(""),

  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),

  DISCORD_BOT_TOKEN: z.string().min(1).optional(),
});

export const env = EnvSchema.parse(process.env);
export type Env = z.infer<typeof EnvSchema>;
