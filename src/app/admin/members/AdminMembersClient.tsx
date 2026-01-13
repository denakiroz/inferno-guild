// src/app/admin/members/AdminMembersClient.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Members from "./Members";
import { supabase } from "@/lib/supabase";
import type { DbLeave, DbMember } from "@/type/db";

type ViewTab = "members" | "club";

type Props = {
  members: DbMember[];
  leaves: DbLeave[];
  clubMembers: DbMember[];
  clubLeaves: DbLeave[];
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

  const isLoading = useMemo(
    () => (viewTab === "members" ? isLoadingMembers : isLoadingClub),
    [viewTab, isLoadingMembers, isLoadingClub]
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

  // ✅ Realtime: member/leave เปลี่ยน → reload เฉพาะแท็บที่กำลังดู (ลดภาระ)
  useEffect(() => {
    const ch = supabase
      .channel("admin-members-tabbed-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "member" }, () => {
        if (viewTab === "members") void onReloadMembers();
        if (viewTab === "club") void onReloadClub();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "leave" }, () => {
        if (viewTab === "members") void onReloadMembers();
        if (viewTab === "club") void onReloadClub();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(ch);
    };
  }, [viewTab, onReloadMembers, onReloadClub]);

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
      ) : (
        <Members
          members={clubMembers}
          leaves={clubLeaves}
          isLoading={isLoadingClub}
          onReload={onReloadClub}
          lockedGuild={null}
          canViewAllGuilds={true}
          tabMode="club"
        />
      )}
    </div>
  );
}
