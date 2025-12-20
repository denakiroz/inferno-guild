"use client";

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anon) {
  // ช่วย debug ให้เห็นชัดว่า client เห็นอะไร
  // eslint-disable-next-line no-console
  console.log("[client env]", { url, anon: anon?.slice?.(0, 8) });
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export const supabase = createClient(url, anon);
