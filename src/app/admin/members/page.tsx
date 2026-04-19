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
  club_2,
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

  // ⚡ Stage 1 — 4 query อิสระ ยิงพร้อมกัน (members, leaves, club, club2)
  const [memRes, leaveRes, clubRes, club2Res] = await Promise.all([
    supabaseAdmin
      .from("member")
      .select(SELECT_MEMBER_WITH_CLASS)
      .order("id", { ascending: true }),
    supabaseAdmin
      .from("leave")
      .select(SELECT_LEAVE)
      .order("date_time", { ascending: false }),
    supabaseAdmin
      .from("member")
      .select(SELECT_MEMBER_WITH_CLASS)
      .eq("club", true)
      .order("power", { ascending: false })
      .order("id", { ascending: true }),
    supabaseAdmin
      .from("member")
      .select(SELECT_MEMBER_WITH_CLASS)
      .eq("club_2", true)
      .order("power", { ascending: false })
      .order("id", { ascending: true }),
  ]);

  const { data: members, error: memErr } = memRes;
  if (memErr) return <div className="p-6 text-sm">Failed to load members: {memErr.message}</div>;

  const safeLeaves = leaveRes.error ? [] : (leaveRes.data ?? []);
  const safeClubMembers = clubRes.error ? [] : (clubRes.data ?? []);
  const safeClub2Members = club2Res.error ? [] : (club2Res.data ?? []);

  const clubIds = safeClubMembers.map((m: any) => m.id).filter(Boolean);
  const club2Ids = safeClub2Members.map((m: any) => m.id).filter(Boolean);

  // ⚡ Stage 2 — leaves ของ club/club2 ยิงพร้อมกัน (ขึ้นต่อ ids จาก stage 1)
  const [clubLeavesRes, club2LeavesRes] = await Promise.all([
    supabaseAdmin
      .from("leave")
      .select(SELECT_LEAVE)
      .in("member_id", clubIds.length ? clubIds : [0])
      .order("date_time", { ascending: false }),
    supabaseAdmin
      .from("leave")
      .select(SELECT_LEAVE)
      .in("member_id", club2Ids.length ? club2Ids : [0])
      .order("date_time", { ascending: false }),
  ]);

  const safeClubLeaves = clubLeavesRes.error ? [] : (clubLeavesRes.data ?? []);
  const safeClub2Leaves = club2LeavesRes.error ? [] : (club2LeavesRes.data ?? []);

  return (
    <AdminMembersClient
      members={(members ?? []) as any}
      leaves={safeLeaves as any}
      clubMembers={safeClubMembers as any}
      clubLeaves={safeClubLeaves as any}
      club2Members={safeClub2Members as any}
      club2Leaves={safeClub2Leaves as any}
    />
  );
}
