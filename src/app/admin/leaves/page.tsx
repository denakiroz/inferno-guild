// src/app/leaves/page.tsx
import LeavesClient from "./LeavesClient";
import AdminLeavesClient from "./AdminLeavesClient";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const SELECT_MEMBER_MIN = `
  id,
  name,
  guild,
  status,
  update_date
`;

const SELECT_LEAVE = `
  id,
  date_time,
  member_id,
  reason,
  status,
  update_date
`;

export default async function LeavesPage() {
  const sid = (await cookies()).get(env.AUTH_COOKIE_NAME)?.value;
  if (!sid) redirect("/login?next=/leaves");

  const session = await getSession(sid);
  if (!session) redirect("/login?error=unauthorized&next=/leaves");

  // head เห็นเฉพาะกิลด์ตัวเอง (ผ่าน LeavesClient)
  if (!session.isAdmin) return <LeavesClient />;

  // admin: SSR เห็นทั้งหมด
  const { data: members, error: memErr } = await supabaseAdmin
    .from("member")
    .select(SELECT_MEMBER_MIN)
    .order("id", { ascending: true });

  if (memErr) return <div className="p-6 text-sm">Failed to load members: {memErr.message}</div>;

  const { data: leaves, error: leaveErr } = await supabaseAdmin
    .from("leave")
    .select(SELECT_LEAVE)
    .order("date_time", { ascending: false });

  const safeLeaves = leaveErr ? [] : leaves ?? [];

  return <AdminLeavesClient members={(members ?? []) as any} leaves={safeLeaves as any} />;
}
