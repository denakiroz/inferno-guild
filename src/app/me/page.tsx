"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Moon, Sun, LogOut } from "lucide-react";

import { Button, Card, Modal } from "@/app/components/UI";
import { useTheme } from "@/app/theme/ThemeProvider";

import LeaveRequestButton, { type LeaveCreateRow } from "@/app/components/LeaveRequestButton";
import type { DbLeave } from "@/type/db";

import type {
  MeRes,
  ClassRow,
  MemberRow,
  LeaveMeRes,
  ClassListRes,
  UltimateSkillRow,
  UltimateSkillListRes,
  MyUltimateRes,
} from "./_lib/types";

import { bkkDateOf, bkkNowHHMM, bkkDateTimeParts, canCancelLeave } from "./_lib/bkkDate";

import { ProfileTab } from "./_components/ProfileTab";
import { LeavesTab } from "./_components/LeavesTab";
import { InternalPowerTab } from "./_components/InternalPowerTab";

type TabKey = "profile" | "leaves" | "internalPower";

const tabBase =
  "px-4 py-2 text-sm rounded-lg transition whitespace-nowrap";
const tabIdle =
  "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100";
const tabActive =
  "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow";

export default function MePage() {
  const { theme, toggleTheme } = useTheme();

  const [tab, setTab] = useState<TabKey>("profile");

  const [me, setMe] = useState<MeRes | null>(null);
  const [member, setMember] = useState<MemberRow | null>(null);

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classId, setClassId] = useState<string>("0");

  const [myLeaves, setMyLeaves] = useState<DbLeave[]>([]);

  // ✅ ultimate
  const [ultimateSkills, setUltimateSkills] = useState<UltimateSkillRow[]>([]);
  const [selectedUltimateIds, setSelectedUltimateIds] = useState<number[]>([]);

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

  const canAdmin = !!me?.user?.isAdmin;
  const canAccessAdmin = !!(me?.user?.isAdmin || me?.user?.isHead);

  // ✅ ใช้เฉพาะใบลาที่ "ยัง Active"
  const activeLeaves = useMemo(
    () => (myLeaves ?? []).filter((l) => String(l.status ?? "Active") !== "Cancel"),
    [myLeaves]
  );

  useEffect(() => {
    if (!saveOk) return;
    const t = setTimeout(() => setSaveOk(false), 2000);
    return () => clearTimeout(t);
  }, [saveOk]);

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

  async function loadUltimateMaster() {
    const r = await fetch("/api/ultimate-skill", { cache: "no-store" });
    const j = (await r.json()) as UltimateSkillListRes;
    if (!j.ok) throw new Error(j.error ?? "load_ultimate_failed");
    setUltimateSkills(Array.isArray(j.skills) ? j.skills : []);
  }

  async function loadMyUltimate() {
    const r = await fetch("/api/member/me/ultimate", { cache: "no-store" });
    const j = (await r.json()) as MyUltimateRes;
    if (!j.ok) throw new Error(j.error ?? "load_my_ultimate_failed");
    setSelectedUltimateIds(Array.isArray(j.ultimate_skill_ids) ? j.ultimate_skill_ids : []);
  }

  async function saveMyUltimate(ids: number[]) {
    const res = await fetch("/api/member/me/ultimate", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ultimate_skill_ids: ids }),
    });
    const j = await res.json();
    if (!j.ok) throw new Error(j.error ?? "save_my_ultimate_failed");
  }

  function getAuthDisplayName(): string {
    return String(me?.user?.displayName ?? "").trim();
  }

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
        loadUltimateMaster(),
        loadMyUltimate(),
      ]);
    })().catch(() => setErr("โหลดข้อมูลไม่สำเร็จ"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // sync classId with member
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

      // ✅ save ultimate after member save success
      await saveMyUltimate(selectedUltimateIds);
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
        if (x.date === todayBkk) return nowHHMM < "20:00";
        return false;
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
            className="fixed top-4 right-4 z-[60] rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 shadow-lg
                      dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200"
          >
            บันทึกสำเร็จ
          </div>
        )}

        {/* ✅ STICKY HEADER */}
        <div className="sticky top-3 z-50">
          <div className="space-y-3">
            {/* Header card */}
            <Card>
              <div className="flex items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={me.user?.avatarUrl}
                  alt="avatar"
                  className="h-14 w-14 rounded-2xl border border-zinc-200 dark:border-zinc-800"
                />

                <div className="flex-1 min-w-0">
                  <div className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                    {me.user?.displayName}
                  </div>
                  <div className="text-sm text-zinc-500 dark:text-zinc-400">
                    Guild: {me.user?.guild} • {canAdmin ? "Admin" : "Member"}
                  </div>
                </div>

                {canAccessAdmin && (
                  <a href="/admin" className="text-sm underline text-red-600 whitespace-nowrap">
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

            {/* Tabs + Actions (responsive) */}
            <Card>
              {/* ✅ Mobile: stack, Desktop: row */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                {/* Tabs group */}
                <div className="inline-flex max-w-full overflow-x-auto rounded-xl bg-zinc-100 dark:bg-zinc-900 p-1">
                  <button
                    type="button"
                    onClick={() => setTab("profile")}
                    className={`${tabBase} ${tab === "profile" ? tabActive : tabIdle}`}
                  >
                    โปรไฟล์
                  </button>

                  <button
                    type="button"
                    onClick={() => setTab("leaves")}
                    className={`${tabBase} ${tab === "leaves" ? tabActive : tabIdle}`}
                  >
                    การลาของฉัน
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab("internalPower")}
                    className={`${tabBase} ${tab === "internalPower" ? tabActive : tabIdle}`}
                  >
                    กำลังภายใน
                  </button>

                </div>

                {/* ✅ Actions right */}
                <div className="flex items-center justify-end">
                  {!member?.is_special ? (
                    <LeaveRequestButton
                      memberName={member?.name ?? "ฉัน"}
                      existingLeaves={activeLeaves}
                      onCreate={createMyLeave}
                    />
                  ) : null}
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Content */}
        {tab === "profile" ? (
          <ProfileTab
            member={member}
            setMember={setMember}
            classes={classes}
            classId={classId}
            setClassId={setClassId}
            saving={saving}
            err={err}
            onSaveProfile={onSaveProfile}
            ultimateSkills={ultimateSkills}
            selectedUltimateIds={selectedUltimateIds}
            setSelectedUltimateIds={setSelectedUltimateIds}
          />
        ) : tab === "leaves" ? (
          <LeavesTab
            leaveErr={leaveErr}
            upcomingGrouped={upcomingGrouped}
            canceling={canceling}
            onAskCancel={(payload) => {
              setConfirmTarget(payload);
              setConfirmOpen(true);
            }}
          />
        ) : (
          <InternalPowerTab />
        )}

        {/* Confirm Cancel */}
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
