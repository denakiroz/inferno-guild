// src/app/admin/AdminClient.tsx
"use client";

import React, { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { Badge, Button, Card } from "@/app/components/UI";

type Props = {
  displayName?: string | null;
};

function tryParseJson(text: string) {
  try {
    return JSON.parse(text) as any;
  } catch {
    return null;
  }
}

export default function AdminClient({ displayName }: Props) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<{ ok: boolean; message: string } | null>(null);

  // หมายเหตุ: อย่า hardcode secret ใน production
  // แนะนำให้ทำ proxy API ฝั่ง server แล้วดึง secret จาก env
  const cronUrl = useMemo(() => {
    const secret = "abc123";
    const u = new URL("/api/cron/sync-discord-members", window.location.origin);
    u.searchParams.set("secret", secret);
    return u.toString();
  }, []);

  const onSync = useCallback(async () => {
    setIsSyncing(true);
    setLastResult(null);
    try {
      const res = await fetch(cronUrl, { method: "GET", cache: "no-store" });
      const text = await res.text();
      const json = tryParseJson(text);

      const message =
        json?.message ??
        json?.error ??
        (typeof json === "string" ? json : null) ??
        (text?.slice(0, 500) || (res.ok ? "OK" : "Request failed"));

      setLastResult({ ok: res.ok, message });
    } catch (e: any) {
      setLastResult({ ok: false, message: e?.message ?? "Network error" });
    } finally {
      setIsSyncing(false);
    }
  }, [cronUrl]);

  return (
    <div className="p-6">
      <div className="mx-auto w-full max-w-[1200px] space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Admin</div>
          <div className="text-sm text-zinc-500 dark:text-zinc-400">
            {displayName ? `Signed in as ${displayName}` : "Signed in"}
          </div>
        </div>

        <Link href="/admin/members" className="text-sm underline text-zinc-700 dark:text-zinc-200">
          ไปหน้า Members
        </Link>
      </div>

      <Card className="p-4 space-y-3">
        <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Tools</div>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={onSync} disabled={isSyncing}>
            <RefreshCw className={["w-4 h-4", isSyncing ? "animate-spin" : ""].join(" ")} />
            Sync Discord Members
          </Button>

          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Calls: <code className="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-900">{"/api/cron/sync-discord-members?secret=***"}</code>
          </span>
        </div>

        {lastResult ? (
          <div className="flex items-start gap-2">
            <Badge variant={lastResult.ok ? "success" : "danger"}>
              {lastResult.ok ? "Success" : "Failed"}
            </Badge>
            <div className="text-sm text-zinc-700 dark:text-zinc-200 whitespace-pre-wrap break-words">
              {lastResult.message}
            </div>
          </div>
        ) : null}
      </Card>
      </div>
    </div>
  );
}
