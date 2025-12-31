// src/app/dashboard/page.tsx
import DashboardClient from "./DashboardClient";
import AdminDashboardClient from "./AdminDashboardClient";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const SELECT_MEMBER_WITH_CLASS = `
  id,
  name,
  class_id,
  power,
  is_special,
  guild,
  discord_user_id,
  status,
  update_date,
  class:class!member_class_id_fkey(
    id,
    name,
    icon_url
  )
`;

const SELECT_LEAVE = `
  id,
  date_time,
  member_id,
  reason,
  status,
  update_date
`;

export default async function DashboardPage() {
  const sid = (await cookies()).get(env.AUTH_COOKIE_NAME)?.value;
  if (!sid) redirect("/login?next=/dashboard");

  const session = await getSession(sid);
  if (!session) redirect("/login?error=unauthorized&next=/dashboard");

  // ✅ admin: SSR เห็นทั้งหมด
  if (session.isAdmin) {
    const { data: members, error: memErr } = await supabaseAdmin
      .from("member")
      .select(SELECT_MEMBER_WITH_CLASS)
      .order("id", { ascending: true });

    if (memErr) return <div className="p-6 text-sm">Failed to load members: {memErr.message}</div>;

    const { data: leaves, error: leaveErr } = await supabaseAdmin
      .from("leave")
      .select(SELECT_LEAVE)
      .order("date_time", { ascending: false });

    const safeLeaves = leaveErr ? [] : (leaves ?? []);
    return <AdminDashboardClient members={(members ?? []) as any} leaves={safeLeaves as any} />;
  }

  // ✅ head/member: client-side เห็นเฉพาะกิลด์ตัวเอง (ตาม /api/me)
  return <DashboardClient />;
}
