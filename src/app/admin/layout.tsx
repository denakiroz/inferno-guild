// src/app/admin/layout.tsx
import React from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import AdminShell from "@/app/admin/AdminShell";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const sid = cookieStore.get(env.AUTH_COOKIE_NAME)?.value;

  // ✅ ไม่ login → เด้งไป /login
  if (!sid) redirect("/login?next=/admin");

  const session = await getSession(sid);

  // ✅ session หาย/หมดอายุ → เด้งไป /login
  if (!session) redirect("/login?error=unauthorized&next=/admin");

  // ✅ ไม่ใช่ admin → เด้งไป /me (หรือทำ /403 ก็ได้)
  if (!session.isAdmin && !session.isHead) redirect("/me");

  return <AdminShell>{children}</AdminShell>;
}
