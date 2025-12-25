// src/app/admin/page.tsx
import AdminClient from "./AdminClient";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const sid = (await cookies()).get(env.AUTH_COOKIE_NAME)?.value;
  if (!sid) redirect("/login?next=/admin");

  const session = await getSession(sid);
  if (!session) redirect("/login?error=unauthorized&next=/admin");

  // /admin ให้ใช้เป็นหน้า admin เท่านั้น
  if (!session.isAdmin) redirect("/admin/members");

  return <AdminClient displayName={session.displayName} />;
}
