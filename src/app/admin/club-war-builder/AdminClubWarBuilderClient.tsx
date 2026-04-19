"use client";

import React from "react";
import dynamic from "next/dynamic";
import { useMe } from "@/hooks/api/members";

// ⚡ ClubWarBuilderClient ไฟล์ใหญ่ (~1.8k บรรทัด) — แยก chunk + skeleton
const ClubWarBuilderClient = dynamic(() => import("./ClubWarBuilderClient"), {
  ssr: false,
  loading: () => (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
      กำลังโหลด Club Builder…
    </div>
  ),
});

type MeRes = {
  ok: boolean;
  user?: { guild: number; isAdmin: boolean; isHead: boolean };
};

export default function AdminClubWarBuilderClient() {
  const meQuery = useMe();
  const me = (meQuery.data as MeRes | undefined) ?? null;

  const canEdit = !!me?.user?.isAdmin || !!me?.user?.isHead;

  return (
    <div className="mx-auto w-full max-w-[1700px] px-4 md:px-6 py-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="text-lg font-semibold">Club War Builder</div>
        <div className="text-xs text-zinc-500">60v60</div>
        <div className="ml-auto text-xs text-zinc-500">
          {canEdit ? "Edit enabled" : "View only"}
        </div>
      </div>

      <ClubWarBuilderClient canEdit={canEdit} />
    </div>
  );
}
