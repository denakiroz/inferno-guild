// src/app/admin/members/AdminMembersClient.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Members from "./Members";
import { supabase } from "@/lib/supabase";
import { qk } from "@/lib/queryClient";
import {
  useMembers,
  useClubMembers,
  useClub2Members,
} from "@/hooks/api/members";
import type { DbLeave, DbMember } from "@/type/db";

type ViewTab = "members" | "club" | "club2";

type Props = {
  members: DbMember[];
  leaves: DbLeave[];
  clubMembers: DbMember[];
  clubLeaves: DbLeave[];
  club2Members: DbMember[];
  club2Leaves: DbLeave[];
};

export default function AdminMembersClient(initial: Props) {
  const qc = useQueryClient();
  const [viewTab, setViewTab] = useState<ViewTab>("members");

  // ทั้ง 3 endpoint ถูก fetch ทันทีตอน mount เพื่อ pre-populate cache
  // (เลียนแบบพฤติกรรมเดิมที่ component ทำ Promise.all เปิดมาทุกอัน)
  const membersQuery = useMembers(null);
  const clubMembersQuery = useClubMembers();
  const club2MembersQuery = useClub2Members();

  // initial SSR data — ใช้ก่อนที่ query จะกลับมา (avoid flash empty)
  const members: DbMember[] =
    (membersQuery.data?.members as DbMember[] | undefined) ?? initial.members ?? [];
  const leaves: DbLeave[] =
    (membersQuery.data?.leaves as DbLeave[] | undefined) ?? initial.leaves ?? [];

  const clubMembers: DbMember[] =
    (clubMembersQuery.data?.members as DbMember[] | undefined) ?? initial.clubMembers ?? [];
  const clubLeaves: DbLeave[] =
    (clubMembersQuery.data?.leaves as DbLeave[] | undefined) ?? initial.clubLeaves ?? [];

  const club2Members: DbMember[] =
    (club2MembersQuery.data?.members as DbMember[] | undefined) ?? initial.club2Members ?? [];
  const club2Leaves: DbLeave[] =
    (club2MembersQuery.data?.leaves as DbLeave[] | undefined) ?? initial.club2Leaves ?? [];

  const isLoadingMembers = membersQuery.isFetching;
  const isLoadingClub = clubMembersQuery.isFetching;
  const isLoadingClub2 = club2MembersQuery.isFetching;

  const isLoading = useMemo(
    () =>
      viewTab === "members"
        ? isLoadingMembers
        : viewTab === "club"
        ? isLoadingClub
        : isLoadingClub2,
    [viewTab, isLoadingMembers, isLoadingClub, isLoadingClub2]
  );

  const onReloadMembers = async () => {
    await qc.invalidateQueries({ queryKey: qk.members(null) });
  };
  const onReloadClub = async () => {
    await qc.invalidateQueries({ queryKey: qk.clubMembers() });
  };
  const onReloadClub2 = async () => {
    await qc.invalidateQueries({ queryKey: qk.club2Members() });
  };

  // Realtime: member/leave เปลี่ยน → invalidate เฉพาะแท็บที่กำลังดู (ลดภาระ)
  useEffect(() => {
    const ch = supabase
      .channel("admin-members-tabbed-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "member" }, () => {
        if (viewTab === "members") void onReloadMembers();
        if (viewTab === "club") void onReloadClub();
        if (viewTab === "club2") void onReloadClub2();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "leave" }, () => {
        if (viewTab === "members") void onReloadMembers();
        if (viewTab === "club") void onReloadClub();
        if (viewTab === "club2") void onReloadClub2();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewTab]);

  const TabBtn = ({ value, label }: { value: ViewTab; label: string }) => {
    const active = viewTab === value;
    return (
      <button
        type="button"
        onClick={() => setViewTab(value)}
        className={[
          "px-4 py-2 rounded-xl text-sm font-semibold border transition",
          active
            ? "bg-red-600 text-white border-red-600"
            : "bg-white/60 dark:bg-zinc-950/40 text-zinc-700 dark:text-zinc-200 border-zinc-200 dark:border-zinc-800",
        ].join(" ")}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="space-y-4">
      <div className="mx-auto w-full max-w-[1400px] px-4 md:px-6 pt-2">
        <div className="flex items-center gap-2 flex-wrap">
          <TabBtn value="members" label="Members" />
          <TabBtn value="club" label="Club" />
          <TabBtn value="club2" label="Club 2" />
          <div className="ml-auto text-xs text-zinc-500 dark:text-zinc-400">
            {isLoading ? "กำลังโหลด..." : null}
          </div>
        </div>
      </div>

      {viewTab === "members" ? (
        <Members
          members={members}
          leaves={leaves}
          isLoading={isLoadingMembers}
          onReload={onReloadMembers}
          lockedGuild={null}
          canViewAllGuilds={true}
          tabMode="guild"
        />
      ) : viewTab === "club" ? (
        <Members
          members={clubMembers}
          leaves={clubLeaves}
          isLoading={isLoadingClub}
          onReload={onReloadClub}
          lockedGuild={null}
          canViewAllGuilds={true}
          tabMode="club"
        />
      ) : (
        <Members
          members={club2Members}
          leaves={club2Leaves}
          isLoading={isLoadingClub2}
          onReload={onReloadClub2}
          lockedGuild={null}
          canViewAllGuilds={true}
          tabMode="club2"
        />
      )}
    </div>
  );
}
