"use client";

// src/app/leaves/LeavesClient.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Leaves from "./Leaves";
import { memberService } from "@/services/memberService";
import { leaveService } from "@/services/leaveService";
import { supabase } from "@/lib/supabase";
import type { DbMember, DbLeave, GuildNo } from "@/type/db";

type MeResp =
  | {
      ok: true;
      user: {
        discordUserId: string;
        displayName: string;
        avatarUrl: string | null;
        guild: number;
        isAdmin: boolean;
      };
    }
  | { ok: false };

export default function LeavesClient() {
  const [me, setMe] = useState<MeResp | null>(null);

  const [members, setMembers] = useState<DbMember[]>([]);
  const [leaves, setLeaves] = useState<DbLeave[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // admin เห็นทุกกิลด์, head เห็นกิลด์ตัวเอง
  // ✅ แปลงเป็น admin ให้รองรับกรณี guild = 0 (admin) จากฝั่ง /api/me
  const effectiveIsAdmin = useMemo(() => {
    if (!me || !me.ok) return false;
    return !!me.user.isAdmin || Number(me.user.guild) === 0;
  }, [me]);

  const lockedGuild = useMemo<GuildNo | null>(() => {
    if (!me || !me.ok) return null;
    if (effectiveIsAdmin) return null;
    return Number(me.user.guild) as GuildNo;
  }, [me, effectiveIsAdmin]);

  const canViewAllGuilds = useMemo(() => {
    return !!(me && me.ok && effectiveIsAdmin);
  }, [me, effectiveIsAdmin]);

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

  const load = useCallback(async (guild?: GuildNo) => {
    setIsLoading(true);
    try {
      const rows = await memberService.list({ guild, orderByPowerDesc: true });
      setMembers(rows);

      const ids = rows.map((m) => m.id);
      const leaveRows = ids.length ? await leaveService.list({ memberIds: ids }) : [];
      setLeaves(leaveRows);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const onReload = useCallback(async () => {
    if (!me || !me.ok) return;
    if (effectiveIsAdmin) return load(undefined);
    return load(Number(me.user.guild) as GuildNo);
  }, [load, me, effectiveIsAdmin]);

  useEffect(() => {
    if (me == null) return;

    if (!me.ok) {
      setMembers([]);
      setLeaves([]);
      setIsLoading(false);
      return;
    }

    if (effectiveIsAdmin) load(undefined);
    else load(Number(me.user.guild) as GuildNo);
  }, [me, load, effectiveIsAdmin]);

  // ✅ Realtime: member/leave เปลี่ยน → reload
  useEffect(() => {
    if (!me || !me.ok) return;

    const ch = supabase
      .channel("leaves-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "member" }, () => void onReload())
      .on("postgres_changes", { event: "*", schema: "public", table: "leave" }, () => void onReload())
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [me, onReload]);

  return (
    <Leaves
      members={members}
      leaves={leaves}
      isLoading={isLoading}
      onReload={onReload}
      lockedGuild={lockedGuild}
      canViewAllGuilds={canViewAllGuilds}
    />
  );
}
