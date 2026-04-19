"use client";

// src/app/admin/members/MembersClient.tsx
import React, { useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Members from "./Members";
import { supabase } from "@/lib/supabase";
import { qk } from "@/lib/queryClient";
import { useMe, useMembers } from "@/hooks/api/members";
import type { DbMember, DbLeave, GuildNo } from "@/type/db";

export default function MembersClient() {
  const qc = useQueryClient();
  const meQuery = useMe();
  const me = meQuery.data ?? null;

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

  // Determine which guild to fetch:
  // - admin → all (guild = null)
  // - non-admin → their own guild
  // - me not loaded yet → don't fetch yet
  const fetchGuild: number | null = me?.ok
    ? effectiveIsAdmin
      ? null
      : Number(me.user.guild)
    : null;

  const membersEnabled = meQuery.isSuccess && me?.ok === true;

  const membersQuery = useMembers(fetchGuild, { enabled: membersEnabled });

  const members: DbMember[] = (membersQuery.data?.members as DbMember[] | undefined) ?? [];
  const leaves: DbLeave[] = (membersQuery.data?.leaves as DbLeave[] | undefined) ?? [];
  const isLoading = meQuery.isLoading || (membersEnabled && membersQuery.isLoading);

  // Realtime: member/leave เปลี่ยน → invalidate cached list
  useEffect(() => {
    if (!me || !me.ok) return;

    const invalidate = () => {
      qc.invalidateQueries({ queryKey: ["members"] });
    };

    const ch = supabase
      .channel("admin-members-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "member" },
        invalidate
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leave" },
        invalidate
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [me, qc]);

  const onReload = async () => {
    await qc.invalidateQueries({ queryKey: qk.members(fetchGuild) });
  };

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
