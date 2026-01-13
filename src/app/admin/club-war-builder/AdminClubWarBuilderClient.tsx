"use client";

import React, { useEffect, useState } from "react";
import ClubWarBuilderClient from "./ClubWarBuilderClient";

type MeRes = {
  ok: boolean;
  user?: { guild: number; isAdmin: boolean; isHead: boolean };
};

export default function AdminClubWarBuilderClient() {
  const [me, setMe] = useState<MeRes | null>(null);

  useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setMe(j))
      .catch(() => setMe({ ok: false }));
  }, []);

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
