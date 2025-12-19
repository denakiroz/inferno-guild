// src/app/admin/members/page.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Members} from "./Members";
import { memberService } from "@/services/memberService";
import { leaveService } from "@/services/leaveService";
import type { DbMember, DbLeave, GuildNo } from "@/type/db";

type MeResponse =
  | {
      ok: true;
      user: {
        discordUserId: string;
        displayName: string;
        avatarUrl: string;
        guild: number;     // 1|2|3
        isAdmin: boolean;  // DISCORD_ADMIN_ROLE_ID => true
      };
    }
  | { ok: false };

export default function AdminMembersPage() {
  const router = useRouter();

  const [members, setMembers] = useState<DbMember[]>([]);
  const [leaves, setLeaves] = useState<DbLeave[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [lockedGuild, setLockedGuild] = useState<GuildNo | null>(null);
  const [canViewAllGuilds, setCanViewAllGuilds] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/me", { cache: "no-store" });
      const me = (await res.json()) as MeResponse;

      if (!res.ok || !("ok" in me) || !me.ok) {
        router.replace("/login");
        return;
      }

      const isAdmin = !!me.user.isAdmin;
      const guild = (Number(me.user.guild || 1) as GuildNo) || 1;

      setCanViewAllGuilds(isAdmin);
      setLockedGuild(isAdmin ? null : guild);

      const ms = await memberService.list({ guild: isAdmin ? undefined : guild });
      const ls = await leaveService.list({ memberIds: ms.map((m) => m.id) });

      setMembers(ms);
      setLeaves(ls);
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]); 

  const onAddMember = useCallback(async (payload: Omit<DbMember, "id">) => {
    const created = await memberService.create(payload);
    setMembers((prev) => [created, ...prev]);
  }, []);

  const onUpdateMember = useCallback(async (payload: DbMember) => {
    const updated = await memberService.update(payload);
    setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
  }, []);

  const onDeleteMember = useCallback(async (id: number) => {
    // ลบ leave ก่อน (กัน FK/ข้อมูลค้าง)
    await leaveService.deleteByMember(id).catch(() => undefined);
    await memberService.delete(id);

    setLeaves((prev) => prev.filter((l) => l.member_id !== id));
    setMembers((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const onReportLeave = useCallback(async (payload: Omit<DbLeave, "id">) => {
    const created = await leaveService.create(payload);
    setLeaves((prev) => [created, ...prev]);
  }, []);

  const onImportMembers = useCallback(async (payloads: Omit<DbMember, "id">[]) => {
    if (!payloads.length) return;
    const created = await memberService.createMany(payloads);
    setMembers((prev) => [...created, ...prev]);
  }, []);

  return (
    <Members
      members={members}
      leaves={leaves}
      isLoading={isLoading}
      onAddMember={onAddMember}
      onUpdateMember={onUpdateMember}
      onDeleteMember={onDeleteMember}
      onReportLeave={onReportLeave}
      onImportMembers={onImportMembers}
      lockedGuild={lockedGuild}
      canViewAllGuilds={canViewAllGuilds}
    />
  );
}
