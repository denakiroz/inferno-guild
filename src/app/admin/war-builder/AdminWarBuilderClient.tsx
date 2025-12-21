"use client";

import React, { useEffect, useMemo, useState } from "react";
import WarBuilderClient from "./WarBuilderClient";

type MeRes = {
  ok: boolean;
  user?: { guild: number; isAdmin: boolean; isHead: boolean };
};

export default function AdminWarBuilderClient() {
  const [me, setMe] = useState<MeRes | null>(null);
  const [selectedGuild, setSelectedGuild] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        const res = j as MeRes;
        setMe(res);
        if (res.ok && res.user?.guild) setSelectedGuild(res.user.guild);
      })
      .catch(() => setMe({ ok: false }));
  }, []);

  const canEdit = !!(me?.ok && (me.user?.isAdmin || me.user?.isHead));
  const canPickGuild = !!(me?.ok && me.user?.isAdmin);

  const guild = useMemo(() => {
    if (!me?.ok) return null;
    if (me.user?.isAdmin) return selectedGuild ?? me.user.guild;
    return me.user?.guild ?? null;
  }, [me, selectedGuild]);

  if (!me) return null;

  return (
    <div className="space-y-3">
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
