// src/app/leaves/AdminLeavesClient.tsx
"use client";

import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import Leaves from "./Leaves";
import { qk } from "@/lib/queryClient";
import { useMembers } from "@/hooks/api/members";
import type { DbLeave, DbMember } from "@/type/db";

type Props = {
  members: DbMember[];
  leaves: DbLeave[];
};

export default function AdminLeavesClient(initial: Props) {
  const qc = useQueryClient();
  const membersQuery = useMembers(null);

  const members: DbMember[] =
    (membersQuery.data?.members as DbMember[] | undefined) ?? initial.members;
  const leaves: DbLeave[] =
    (membersQuery.data?.leaves as DbLeave[] | undefined) ?? initial.leaves;
  const isLoading = membersQuery.isFetching;

  const onReload = async () => {
    await qc.invalidateQueries({ queryKey: qk.members(null) });
  };

  return (
    <Leaves
      members={members}
      leaves={leaves}
      isLoading={isLoading}
      onReload={onReload}
      lockedGuild={null}
      canViewAllGuilds={true}
    />
  );
}
