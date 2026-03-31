"use client";

// src/app/admin/members/MembersClient.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Members from "./Members";
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

export default function MembersClient() {
  const [me, setMe] = useState<MeResp | null>(null);

  const [members, setMembers] = useState<DbMember[]>([]);
  const [leaves, setLeaves] = useState<DbLeave[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  // ✅ ใช้ /api/admin/members เพื่อให้ได้ ultimate_skill_ids, special_skill_ids, weapon_stones
  const load = useCallback(async (guild?: GuildNo) => {
    setIsLoading(true);
    try {
      const url = guild ? `/api/admin/members?guild=${guild}` : "/api/admin/members";
      const r = await fetch(url, { cache: "no-store" });
      const j = await r.json();

      const rows: DbMember[] = Array.isArray(j.members) ? j.members : [];
      setMembers(rows);
      setLeaves(Array.isArray(j.leaves) ? j.leaves : []);
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
      .channel("admin-members-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "member" },
        () => void onReload()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leave" },
        () => void onReload()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [me, onReload]);

  return (
    <Members
      members={members}
      leaves={leaves}
      isLoading={isLoading}
      onReload={onReload}
      lockedGuild={lockedGuild}
      canViewAllGuilds={canViewAllGuilds}
    />
  );
}
