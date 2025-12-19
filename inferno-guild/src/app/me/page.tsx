"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Card, Input, Select } from "@/app/components/UI";

type MeRes = {
  ok: boolean;
  user?: { discordUserId: string; displayName: string; avatarUrl: string; guild: number; isAdmin: boolean };
};

type MemberRow = {
  discord_user_id: string;
  name: string;
  class: string;
  power: number;
  color: string;
  is_special: boolean;
  guild: number;
};

export default function MePage() {
  const [me, setMe] = useState<MeRes | null>(null);
  const [member, setMember] = useState<MemberRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const r1 = await fetch("/api/me", { cache: "no-store" });
      const j1 = (await r1.json()) as MeRes;
      setMe(j1);

      if (!j1.ok) return;

      const r2 = await fetch("/api/member/me", { cache: "no-store" });
      const j2 = await r2.json();
      if (j2.ok) setMember(j2.member as MemberRow);
    })().catch(() => setErr("โหลดข้อมูลไม่สำเร็จ"));
  }, []);

  const canAdmin = !!me?.user?.isAdmin;

  async function onSave() {
    if (!member) return;
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/member/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: member.name,
          class: member.class,
          power: member.power,
          color: member.color,
          is_special: member.is_special,
        }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? "save_failed");
      setMember(j.member);
    } catch (e: any) {
      setErr(String(e.message ?? e));
    } finally {
      setSaving(false);
    }
  }

  if (!me) {
    return <main className="p-6">Loading...</main>;
  }

  if (!me.ok) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <div className="text-lg font-semibold">Unauthorized</div>
          <div className="mt-2 text-sm text-zinc-400">กรุณาเข้าสู่ระบบใหม่</div>
          <div className="mt-4">
            <a className="underline" href="/login">ไปหน้า Login</a>
          </div>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <Card>
          <div className="flex items-center gap-4">
            <img
              src={me.user?.avatarUrl}
              alt="avatar"
              className="h-14 w-14 rounded-2xl border border-zinc-200 dark:border-zinc-800"
            />
            <div className="flex-1">
              <div className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                {me.user?.displayName}
              </div>
              <div className="text-sm text-zinc-500 dark:text-zinc-400">
                Guild: {me.user?.guild} • {canAdmin ? "Admin" : "Member"}
              </div>
            </div>
            {canAdmin && (
              <a href="/admin" className="text-sm underline text-red-600">ไป Admin</a>
            )}
          </div>
        </Card>

        <Card>
          <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">โปรไฟล์ในเกม</div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-zinc-500 mb-1">ชื่อในเกม</div>
              <Input value={member?.name ?? ""} onChange={(e) => setMember(m => m ? ({ ...m, name: e.target.value }) : m)} />
            </div>
            <div>
              <div className="text-xs text-zinc-500 mb-1">อาชีพ</div>
              <Input value={member?.class ?? ""} onChange={(e) => setMember(m => m ? ({ ...m, class: e.target.value }) : m)} />
            </div>
            <div>
              <div className="text-xs text-zinc-500 mb-1">Power</div>
              <Input
                type="number"
                value={member?.power ?? 0}
                onChange={(e) => setMember(m => m ? ({ ...m, power: Number(e.target.value) }) : m)}
              />
            </div>
            <div>
              <div className="text-xs text-zinc-500 mb-1">Color</div>
              <Input value={member?.color ?? ""} onChange={(e) => setMember(m => m ? ({ ...m, color: e.target.value }) : m)} />
            </div>
            <div className="md:col-span-2 flex items-center gap-2">
              <input
                id="special"
                type="checkbox"
                checked={!!member?.is_special}
                onChange={(e) => setMember(m => m ? ({ ...m, is_special: e.target.checked }) : m)}
              />
              <label htmlFor="special" className="text-sm text-zinc-700 dark:text-zinc-200">
                เป็นสมาชิกพิเศษ (Special)
              </label>
            </div>
          </div>

          {err && <div className="mt-3 text-sm text-rose-600">Error: {err}</div>}

          <div className="mt-5 flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => location.reload()} disabled={saving}>รีโหลด</Button>
            <Button onClick={onSave} disabled={saving}>
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          </div>
        </Card>
      </div>
    </main>
  );
}
