"use client";

import React, { useCallback, useEffect, useState } from "react";
import ClubMembers from "./ClubMembers";
import { supabase } from "@/lib/supabase";
import type { DbLeave, DbMember } from "@/type/db";

type Props = {
  members: DbMember[];
  leaves: DbLeave[];
};

export default function ClubClient(initial: Props) {
  const [members, setMembers] = useState<DbMember[]>(initial.members ?? []);
  const [leaves, setLeaves] = useState<DbLeave[]>(initial.leaves ?? []);
  const [isLoading, setIsLoading] = useState(false);

  const onReload = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/club/members", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("Reload club members failed:", json);
        return;
      }
      setMembers((json.members ?? []) as DbMember[]);
      setLeaves((json.leaves ?? []) as DbLeave[]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const ch = supabase
      .channel("club-members-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "member" }, () => void onReload())
      .on("postgres_changes", { event: "*", schema: "public", table: "leave" }, () => void onReload())
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [onReload]);

  return <ClubMembers members={members} leaves={leaves} isLoading={isLoading} onReload={onReload} />;
}
