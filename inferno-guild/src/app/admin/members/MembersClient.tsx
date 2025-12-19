"use client";

// src/app/admin/members/MembersClient.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Members } from "./Members";
import { memberService } from "@/services/memberService";
import { leaveService } from "@/services/leaveService";
import type { DbMember, DbLeave, GuildNo } from "@/type/db";

type MeResp =
  | {
      ok: true;
      user: {
        discordUserId: string;
        displayName: string;
        avatarUrl: string;
        guild: number;
        isAdmin: boolean;
      };
    }
  | { ok: false };

export default function MembersClient() {
  const [me, setMe] = useState<MeResp | null>(null);

  const [members, setMembers] = useState<DbMember[]>([]);
  const [leaves, setLeaves] = useState<DbLeave[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // admin เห็นทุกกิลด์, head เห็นกิลด์ตัวเอง
  const lockedGuild = useMemo<GuildNo | null>(() => {
    if (!me || !me.ok) return null;
    if (me.user.isAdmin) return null;
    return Number(me.user.guild) as GuildNo;
  }, [me]);

  const canViewAllGuilds = useMemo(() => {
    return !!(me && me.ok && me.user.isAdmin);
  }, [me]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/me", { cache: "no-store" });
        const j = (await r.json()) as MeResp;
        setMe(j);
      } catch {
        setMe({ ok: false });
      }
    })();
  }, []);

  const load = async (guild?: GuildNo) => {
    setIsLoading(true);
    try {
      // ✅ ใช้ชื่อเมธอดใหม่
      const rows = await memberService.list({ guild, orderByPowerDesc: true });
      setMembers(rows);

      // ✅ leaves ต้องไปใช้ leaveService
      const ids = rows.map((m) => m.id);
      const leaveRows = await leaveService.list({ memberIds: ids });
      setLeaves(leaveRows);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (me == null) return;

    if (!me.ok) {
      setMembers([]);
      setLeaves([]);
      setIsLoading(false);
      return;
    }

    if (me.user.isAdmin) load(undefined);
    else load(Number(me.user.guild) as GuildNo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me]);

  // CRUD handlers
  const onAddMember = async (payload: Omit<DbMember, "id">) => {
    const created = await memberService.create(payload);
    setMembers((prev) => [created, ...prev].sort((a, b) => b.power - a.power));

    // refresh leaves for current list (optional แต่ทำให้ state consistent)
    const ids = [created.id, ...members.map((m) => m.id)];
    const leaveRows = await leaveService.list({ memberIds: ids });
    setLeaves(leaveRows);
  };

  const onUpdateMember = async (payload: DbMember) => {
    const updated = await memberService.update(payload);
    setMembers((prev) =>
      prev
        .map((m) => (m.id === updated.id ? updated : m))
        .sort((a, b) => b.power - a.power)
    );
  };

  const onDeleteMember = async (id: number) => {
    // ลบ leave ก่อน (กัน FK/ข้อมูลค้าง)
    await leaveService.deleteByMember(id).catch(() => undefined);
    await memberService.delete(id);

    setMembers((prev) => prev.filter((m) => m.id !== id));
    setLeaves((prev) => prev.filter((l) => l.member_id !== id));
  };

  const onReportLeave = async (payload: Omit<DbLeave, "id">) => {
    const created = await leaveService.create(payload);
    setLeaves((prev) => [created, ...prev]);
  };

  const onImportMembers = async (payload: Array<Omit<DbMember, "id">>) => {
    const created = await memberService.createMany(payload);

    // merge + sort
    setMembers((prev) => [...created, ...prev].sort((a, b) => b.power - a.power));

    // reload leaves for all visible members
    const allIds = [...created.map((m) => m.id), ...members.map((m) => m.id)];
    const leaveRows = await leaveService.list({ memberIds: allIds });
    setLeaves(leaveRows);
  };

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
