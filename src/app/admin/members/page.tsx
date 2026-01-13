// src/app/admin/members/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AdminMembersClient from "./AdminMembersClient";
import MembersClient from "./MembersClient";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const SELECT_MEMBER_WITH_CLASS = `
  id,
  name,
  class_id,
  power,
  party,
  party_2,
  pos_party,
  pos_party_2,
  color,
  is_special,
  guild,
  club,
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

export default async function AdminMembersPage() {
  const sid = (await cookies()).get(env.AUTH_COOKIE_NAME)?.value;
  if (!sid) redirect("/login?next=/admin/members");

  const session = await getSession(sid);
  if (!session) redirect("/login?error=unauthorized&next=/admin/members");

  // ไม่ใช่ admin ให้ไปใช้ client ที่ lock guild ตามเดิม
  if (!session.isAdmin) return <MembersClient />;

  // ====== All members ======
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

  // ====== Club members (member.club = true) ======
  const { data: clubMembers, error: clubErr } = await supabaseAdmin
    .from("member")
    .select(SELECT_MEMBER_WITH_CLASS)
    .eq("club", true)
    .order("power", { ascending: false })
    .order("id", { ascending: true });

  // กันหน้าแตก ถ้า query club ผิดพลาด
  const safeClubMembers = clubErr ? [] : (clubMembers ?? []);
  const clubIds = safeClubMembers.map((m: any) => m.id).filter(Boolean);

  const { data: clubLeaves, error: clubLeaveErr } = await supabaseAdmin
    .from("leave")
    .select(SELECT_LEAVE)
    .in("member_id", clubIds.length ? clubIds : [0])
    .order("date_time", { ascending: false });

  const safeClubLeaves = clubLeaveErr ? [] : (clubLeaves ?? []);

  return (
    <AdminMembersClient
      members={(members ?? []) as any}
      leaves={safeLeaves as any}
      clubMembers={safeClubMembers as any}
      clubLeaves={safeClubLeaves as any}
    />
  );
}
