"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Moon, Sun, Trash2, LogOut } from "lucide-react";

import { Button, Card, Input, Select, Modal } from "@/app/components/UI";
import LeaveRequestButton, { type LeaveCreateRow } from "@/app/components/LeaveRequestButton";
import { useTheme } from "@/app/theme/ThemeProvider";
import type { DbLeave } from "@/type/db";

type MeRes = {
  ok: boolean;
  user?: {
    discordUserId: string;
    displayName: string;
    avatarUrl: string;
    guild: number;
    isAdmin: boolean;
    isHead: boolean;
  };
};

type ClassRow = {
  id: number;
  name: string;
  icon_url: string | null;
};

type MemberRow = {
  discord_user_id: string;
  name: string;
  power: number;
  is_special: boolean;
  guild: number;

  class?: string; // legacy
  class_id?: number; // preferred
};

const BKK_TZ = "Asia/Bangkok";

const bkkDateFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: BKK_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
function bkkDateOf(date: Date) {
  return bkkDateFmt.format(date); // YYYY-MM-DD
}

const bkkDateTimeFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: BKK_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
function bkkDateTimeParts(dt: string) {
  const parts = bkkDateTimeFmt.formatToParts(new Date(dt));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  const time = `${get("hour")}:${get("minute")}`;
  return { date, time };
}

function isSaturday(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00+07:00`);
  return d.getDay() === 6;
}

function prettyDate(dateStr: string) {
  const dt = new Date(`${dateStr}T00:00:00+07:00`);
  return dt.toLocaleDateString("th-TH", {
    timeZone: BKK_TZ,
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// HH:MM (Bangkok)
const bkkTimeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: BKK_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
function bkkNowHHMM() {
  return bkkTimeFmt.format(new Date()); // "20:05"
}

// rule: อดีตห้าม, อนาคตได้, วันนี้ได้ก่อน 20:00
function canCancelLeave(dateYYYYMMDD: string) {
  const today = bkkDateOf(new Date());
  if (dateYYYYMMDD < today) return false;
  if (dateYYYYMMDD > today) return true;
  return bkkNowHHMM() < "20:00";
}

type LeaveMeRes = { ok: true; leaves: DbLeave[] } | { ok: false; error?: string };
type ClassListRes = { ok: true; classes: ClassRow[] } | { ok: false; error?: string };

export default function MePage() {
  const { theme, toggleTheme } = useTheme();

  const [me, setMe] = useState<MeRes | null>(null);
  const [member, setMember] = useState<MemberRow | null>(null);

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classId, setClassId] = useState<string>("0");

  const [myLeaves, setMyLeaves] = useState<DbLeave[]>([]);

  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [leaveErr, setLeaveErr] = useState<string | null>(null);
  const [canceling, setCanceling] = useState<number | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  // ✅ confirm cancel
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<{
    id: number;
    date: string;
    time: string;
    label: string;
  } | null>(null);

  const todayBkk = useMemo(() => bkkDateOf(new Date()), []);

  // ✅ ใช้เฉพาะใบลาที่ "ยัง Active" สำหรับ logic/disable/ตาราง
  const activeLeaves = useMemo(
    () => (myLeaves ?? []).filter((l) => String(l.status ?? "Active") !== "Cancel"),
    [myLeaves]
  );

  async function reloadLeaves() {
    const r = await fetch("/api/leave/me", { cache: "no-store" });
    const j = (await r.json()) as LeaveMeRes;
    if (!j.ok) throw new Error(j.error ?? "load_leave_failed");
    setMyLeaves(j.leaves ?? []);
  }

  async function loadClassMaster() {
    const r = await fetch("/api/class", { cache: "no-store" });
    const j = (await r.json()) as ClassListRes;
    if (!j.ok) throw new Error(j.error ?? "load_class_failed");

    const normalized = Array.isArray(j.classes) ? j.classes : [];
    const hasZero = normalized.some((c) => c.id === 0);
    const withZero = hasZero ? normalized : [{ id: 0, name: "ยังไม่เลือกอาชีพ", icon_url: null }, ...normalized];

    withZero.sort((a, b) => a.id - b.id);
    setClasses(withZero);
  }

  useEffect(() => {
    if (!saveOk) return;
    const t = setTimeout(() => setSaveOk(false), 2000);
    return () => clearTimeout(t);
  }, [saveOk]);

  useEffect(() => {
    (async () => {
      const r1 = await fetch("/api/me", { cache: "no-store" });
      const j1 = (await r1.json()) as MeRes;
      setMe(j1);

      if (!j1.ok) return;

      await Promise.all([
        (async () => {
          const r2 = await fetch("/api/member/me", { cache: "no-store" });
          const j2 = await r2.json();
          if (j2.ok) setMember(j2.member as MemberRow);
        })(),
        loadClassMaster(),
        reloadLeaves(),
      ]);
    })().catch(() => setErr("โหลดข้อมูลไม่สำเร็จ"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!member) return;

    const cid = Number(member.class_id);
    if (Number.isFinite(cid)) {
      setClassId(String(cid));
      return;
    }

    const name = String(member.class ?? "").trim();
    if (!name) {
      setClassId("0");
      return;
    }
    const hit = classes.find((c) => c.name === name);
    if (hit) setClassId(String(hit.id));
    else setClassId("0");
  }, [member, classes]);

  const selectedClassIconUrl = useMemo(() => {
    const cid = Number(classId) || 0;
    const row = classes.find((c) => c.id === cid);
    return row?.icon_url ?? null;
  }, [classes, classId]);

  const canAdmin = !!me?.user?.isAdmin;
  const canAccessAdmin = !!(me?.user?.isAdmin || me?.user?.isHead);

  function getAuthDisplayName(): string {
    return String(me?.user?.displayName ?? "").trim();
  }

  async function onSaveProfile() {
    if (!member) return;
    setSaving(true);
    setErr(null);

    try {
      const selectedClassId = Number(classId) || 0;
      const selectedClassName = classes.find((c) => c.id === selectedClassId)?.name ?? "";

      const authName = getAuthDisplayName();
      const finalName = authName || String(member.name ?? "").trim();

      const nextMember: MemberRow = {
        ...member,
        name: finalName,
        class_id: selectedClassId,
        class: selectedClassName,
      };
      setMember(nextMember);

      const res = await fetch("/api/member/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nextMember.name,
          power: nextMember.power,
          class_id: nextMember.class_id,
          class: nextMember.class,
        }),
      });

      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? "save_failed");
      setMember(j.member as MemberRow);
    } catch (e: any) {
      setErr(String(e.message ?? e));
    } finally {
      setSaveOk(true);
      setSaving(false);
    }
  }

  async function createMyLeave(rows: LeaveCreateRow[]) {
    setLeaveErr(null);
    const res = await fetch("/api/leave/me", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    });
    const j = await res.json();
    if (!j.ok) throw new Error(j.error ?? "leave_create_failed");
    await reloadLeaves();
  }

  // ✅ PATCH (soft-cancel)
  async function cancelMyLeave(id: number) {
    setLeaveErr(null);
    setCanceling(id);
    try {
      const res = await fetch("/api/leave/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leaveIds: [id] }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? "leave_cancel_failed");
      await reloadLeaves();
    } catch (e: any) {
      setLeaveErr(String(e.message ?? e));
    } finally {
      setCanceling(null);
    }
  }

  async function onLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/logout", { method: "POST" });
    } finally {
      location.href = "/login";
    }
  }

  const upcomingGrouped = useMemo(() => {
    const nowHHMM = bkkNowHHMM();

    const upcoming = activeLeaves
      .map((l) => ({ l, ...bkkDateTimeParts(String(l.date_time ?? "")) }))
      .filter((x) => {
        if (!x.date) return false;

        if (x.date > todayBkk) return true;
        if (x.date === todayBkk) return nowHHMM < "20:00"; // หลัง 20:00 ไม่เห็นของวันนี้
        return false; // อดีตไม่แสดง
      })
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.time.localeCompare(b.time);
      });

    const map = new Map<string, Array<{ leave: DbLeave; time: string }>>();
    for (const x of upcoming) {
      const arr = map.get(x.date) ?? [];
      arr.push({ leave: x.l, time: x.time });
      map.set(x.date, arr);
    }
    return map;
  }, [activeLeaves, todayBkk]);

  if (!me) return <main className="p-6">Loading...</main>;

  if (!me.ok) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <div className="text-lg font-semibold">Unauthorized</div>
          <div className="mt-2 text-sm text-zinc-400">กรุณาเข้าสู่ระบบใหม่</div>
          <div className="mt-4">
            <a className="underline" href="/login">
              ไปหน้า Login
            </a>
          </div>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        {saveOk && (
          <div
            role="status"
            aria-live="polite"
            className="fixed top-4 right-4 z-50 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 shadow-lg
                      dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200"
          >
            บันทึกสำเร็จ
          </div>
        )}

        <Card>
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={me.user?.avatarUrl}
              alt="avatar"
              className="h-14 w-14 rounded-2xl border border-zinc-200 dark:border-zinc-800"
            />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                  {me.user?.displayName}
                </div>

                {selectedClassIconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedClassIconUrl}
                    alt="class icon"
                    className="h-6 w-6 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-950/40 object-contain"
                  />
                ) : null}
              </div>

              <div className="text-sm text-zinc-500 dark:text-zinc-400">
                Guild: {me.user?.guild} • {canAdmin ? "Admin" : "Member"}
              </div>
            </div>

            {canAccessAdmin && (
              <a href="/admin" className="text-sm underline text-red-600">
                ไป Admin
              </a>
            )}

            <Button variant="outline" onClick={toggleTheme}>
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              สลับธีม
            </Button>

            <Button variant="outline" onClick={onLogout} disabled={loggingOut}>
              <LogOut className="w-4 h-4 text-rose-600" />
              {loggingOut ? "กำลังออก..." : "Logout"}
            </Button>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3">
            <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">โปรไฟล์</div>

            {!member?.is_special ? (
              <LeaveRequestButton
                memberName={member?.name ?? "ฉัน"}
                // ✅ สำคัญ: ส่งเฉพาะ Active ไม่งั้นวันเดิมจะถูก disable ทั้งที่เคย Cancel แล้ว
                existingLeaves={activeLeaves}
                onCreate={createMyLeave}
              />
            ) : null}
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-zinc-500 mb-1">Power</div>
              <Input
                type="number"
                value={member?.power ?? 0}
                onChange={(e) => setMember((m) => (m ? { ...m, power: Number(e.target.value) } : m))}
              />
            </div>

            <div>
              <div className="text-xs text-zinc-500 mb-1">อาชีพ</div>
              <Select value={classId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setClassId(e.target.value)}>
                {classes.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {err && <div className="mt-3 text-sm text-rose-600">Error: {err}</div>}

          <div className="mt-5 flex items-center justify-end gap-2">
            <Button onClick={onSaveProfile} disabled={saving}>
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5" />
            <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">การลาของฉัน</div>
          </div>
          <div className="mt-1 text-xs text-zinc-500">ยกเลิกได้เฉพาะ “วันนี้” ก่อน 20:00 และ “อนาคต” เท่านั้น (ตามเวลาไทย)</div>

          {leaveErr ? <div className="mt-3 text-sm text-rose-600">Error: {leaveErr}</div> : null}

          <div className="mt-4 space-y-3">
            {Array.from(upcomingGrouped.entries()).length === 0 ? (
              <div className="text-sm text-zinc-500">ยังไม่มีการลาในอนาคต</div>
            ) : (
              Array.from(upcomingGrouped.entries()).map(([date, items]) => {
                const saturday = isSaturday(date);

                return (
                  <div
                    key={date}
                    className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-950/40 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-zinc-900 dark:text-zinc-100">{prettyDate(date)}</div>
                        <div className="text-xs text-zinc-500">{saturday ? "วันวอ (เสาร์)" : "ลากิจ"}</div>
                      </div>
                      <div className="text-xs text-zinc-500">{date}</div>
                    </div>

                    <div className="mt-3 space-y-2">
                      {items.map(({ leave, time }) => {
                        const label = saturday
                          ? time === "20:00"
                            ? "ลาวอ 20:00"
                            : time === "20:30"
                            ? "ลาวอ 20:30"
                            : "ลาวอ"
                          : "ลากิจ";

                        const isCanceled = String(leave.status ?? "Active") === "Cancel";
                        const canCancel = canCancelLeave(date) && !isCanceled;

                        return (
                          <div
                            key={leave.id}
                            className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-950/50 px-3 py-2"
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{label}</div>
                              <div className="text-xs text-zinc-500 truncate">
                                {leave.reason ? `เหตุผล: ${leave.reason}` : "เหตุผล: -"}
                              </div>
                            </div>

                            <Button
                              variant="outline"
                              disabled={canceling === leave.id || !canCancel}
                              onClick={() => {
                                if (!canCancel) return;
                                setConfirmTarget({ id: leave.id, date, time, label });
                                setConfirmOpen(true);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                              {canCancel ? (canceling === leave.id ? "กำลังยกเลิก..." : "ยกเลิก") : "ยกเลิกไม่ได้แล้ว"}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* ✅ Confirm Cancel */}
        <Modal
          open={confirmOpen}
          onClose={() => {
            setConfirmOpen(false);
            setConfirmTarget(null);
          }}
          title="ยืนยันการยกเลิก"
        >
          <div className="space-y-3">
            <div className="text-sm text-zinc-600 dark:text-zinc-300">
              ต้องการยกเลิก <span className="font-semibold">{confirmTarget?.label}</span> ใช่หรือไม่
            </div>

            <div className="text-xs text-zinc-500">
              วันที่: <span className="font-semibold">{confirmTarget?.date}</span> เวลา:{" "}
              <span className="font-semibold">{confirmTarget?.time}</span>
            </div>

            {confirmTarget?.date === bkkDateOf(new Date()) && bkkNowHHMM() >= "20:00" ? (
              <div className="text-sm text-rose-600">ตอนนี้เกินเวลา 20:00 แล้ว ไม่สามารถยกเลิกของวันนี้ได้</div>
            ) : null}

            <div className="flex gap-2 pt-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setConfirmOpen(false);
                  setConfirmTarget(null);
                }}
              >
                กลับ
              </Button>

              <Button
                className="flex-1"
                disabled={!confirmTarget || !canCancelLeave(confirmTarget.date) || canceling === confirmTarget.id}
                onClick={async () => {
                  if (!confirmTarget) return;
                  if (!canCancelLeave(confirmTarget.date)) return;
                  await cancelMyLeave(confirmTarget.id);
                  setConfirmOpen(false);
                  setConfirmTarget(null);
                }}
              >
                {canceling === confirmTarget?.id ? "กำลังยกเลิก..." : "ยกเลิก"}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </main>
  );
}
