// src/app/admin/calendar/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import CalendarClient from "./CalendarClient";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const sid = (await cookies()).get(env.AUTH_COOKIE_NAME)?.value;
  if (!sid) redirect("/login?next=/admin/calendar");

  const session = await getSession(sid);
  if (!session) redirect("/login?error=unauthorized&next=/admin/calendar");
  if (!session.isAdmin && !session.isHead) redirect("/admin/dashboard");

  return <CalendarClient />;
}
