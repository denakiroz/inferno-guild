// src/app/admin/members/page.tsx
import AdminMembersClient from "./AdminMembersClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { DbLeave, DbMember } from "@/type/db";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import MembersClient from "./MembersClient";

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
  discord_user_id,
  status,
  class:class!member_class_id_fkey(
    id,
    name,
    icon_url
  )
`;

export default async function AdminMembersPage() {
  const sid = (await cookies()).get(env.AUTH_COOKIE_NAME)?.value;
  if (!sid) redirect("/login?next=/admin/members");

  const session = await getSession(sid);
  if (!session) redirect("/login?error=unauthorized&next=/admin/members");

  // ✅ head เข้าได้ แต่เห็นเฉพาะกิลด์ตัวเองผ่าน MembersClient
  if (!session.isAdmin) return <MembersClient />;

  // ✅ admin: SSR เห็นทั้งหมดเหมือนเดิม
  const { data: members, error: memErr } = await supabaseAdmin
    .from("member")
    .select(/* SELECT_MEMBER_WITH_CLASS */)
    .order("id", { ascending: true });

  if (memErr) return <div className="p-6 text-sm">Failed to load members: {memErr.message}</div>;

  const { data: leaves } = await supabaseAdmin.from("leave").select("id,date_time,member_id,reason");
  return <AdminMembersClient members={(members ?? []) as any} leaves={(leaves ?? []) as any} />;
}