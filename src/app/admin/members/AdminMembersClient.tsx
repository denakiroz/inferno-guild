// src/app/admin/members/AdminMembersClient.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Members from "./Members";
import { supabase } from "@/lib/supabase";
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
  const [viewTab, setViewTab] = useState<ViewTab>("members");

  // Members tab state
  const [members, setMembers] = useState<DbMember[]>(initial.members ?? []);
  const [leaves, setLeaves] = useState<DbLeave[]>(initial.leaves ?? []);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  // Club tab state
  const [clubMembers, setClubMembers] = useState<DbMember[]>(initial.clubMembers ?? []);
  const [clubLeaves, setClubLeaves] = useState<DbLeave[]>(initial.clubLeaves ?? []);
  const [isLoadingClub, setIsLoadingClub] = useState(false);

  // Club 2 tab state
  const [club2Members, setClub2Members] = useState<DbMember[]>(initial.club2Members ?? []);
  const [club2Leaves, setClub2Leaves] = useState<DbLeave[]>(initial.club2Leaves ?? []);
  const [isLoadingClub2, setIsLoadingClub2] = useState(false);

  const isLoading = useMemo(
    () =>
      viewTab === "members"
        ? isLoadingMembers
        : viewTab === "club"
        ? isLoadingClub
        : isLoadingClub2,
    [viewTab, isLoadingMembers, isLoadingClub, isLoadingClub2]
  );

  const onReloadMembers = useCallback(async () => {
    setIsLoadingMembers(true);
    try {
      const res = await fetch("/api/admin/members", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Failed to reload members");

      setMembers((json.members ?? []) as DbMember[]);
      setLeaves((json.leaves ?? []) as DbLeave[]);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingMembers(false);
    }
  }, []);

  const onReloadClub = useCallback(async () => {
    setIsLoadingClub(true);
    try {
      const res = await fetch("/api/admin/club-members", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Failed to reload club members");

      setClubMembers((json.members ?? []) as DbMember[]);
      setClubLeaves((json.leaves ?? []) as DbLeave[]);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingClub(false);
    }
  }, []);

  const onReloadClub2 = useCallback(async () => {
    setIsLoadingClub2(true);
    try {
      const res = await fetch("/api/admin/club-members-2", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Failed to reload club 2 members");

      setClub2Members((json.members ?? []) as DbMember[]);
      setClub2Leaves((json.leaves ?? []) as DbLeave[]);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingClub2(false);
    }
  }, []);

  // ✅ On mount: reload from API to get skill mapping fields
  //    (initial SSR data from page.tsx doesn't include ultimate_skill_ids / special_skill_ids / weapon_stones)
  useEffect(() => {
    void onReloadMembers();
    void onReloadClub();
    void onReloadClub2();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ Realtime: member/leave เปลี่ยน → reload เฉพาะแท็บที่กำลังดู (ลดภาระ)
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
  }, [viewTab, onReloadMembers, onReloadClub, onReloadClub2]);

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
