"use client";

import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useMe } from "@/hooks/api/members";

// ⚡ WarBuilderClient ไฟล์ใหญ่มาก (~3.5k บรรทัด) — แยก chunk + show skeleton
const WarBuilderClient = dynamic(() => import("./WarBuilderClient"), {
  ssr: false,
  loading: () => (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
      กำลังโหลด War Builder…
    </div>
  ),
});

type MeRes = {
  ok: boolean;
  user?: { guild: number; isAdmin: boolean; isHead: boolean };
};

export default function AdminWarBuilderClient() {
  const meQuery = useMe();
  const me = (meQuery.data as MeRes | undefined) ?? null;
  const [selectedGuild, setSelectedGuild] = useState<number | null>(null);

  // Sync default selectedGuild from "me" once data arrives
  useEffect(() => {
    if (me?.ok && me.user?.guild && selectedGuild === null) {
      setSelectedGuild(me.user.guild);
    }
  }, [me, selectedGuild]);

  const canEdit = !!(me?.ok && (me.user?.isAdmin || me.user?.isHead));
  const canPickGuild = !!(me?.ok && me.user?.isAdmin);

  const guild = useMemo(() => {
    if (!me?.ok) return null;
    if (me.user?.isAdmin) return selectedGuild ?? me.user.guild;
    return me.user?.guild ?? null;
  }, [me, selectedGuild]);

  if (!me) return null;

  return (
    <div className="mx-auto w-full max-w-[1700px] space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">War Builder</div>

        {canPickGuild ? (
          <select
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
            value={guild ?? 1}
            onChange={(e) => setSelectedGuild(Number(e.target.value))}
          >
            <option value={1}>Inferno-1</option>
            <option value={2}>Inferno-2</option>
            <option value={3}>Inferno-3</option>
          </select>
        ) : null}
      </div>

      <WarBuilderClient forcedGuild={guild} canEdit={canEdit} />
    </div>
  );
}
