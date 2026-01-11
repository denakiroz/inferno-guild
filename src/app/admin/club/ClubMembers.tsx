"use client";

import React, { useEffect, useMemo, useState } from "react";
import { RefreshCw, Pencil, X } from "lucide-react";

import type { DbClass, DbLeave, DbMember } from "@/type/db";
import { classService } from "@/services/classService";
import { memberService } from "@/services/memberService";
import { leaveService } from "@/services/leaveService";
import { Badge, Button, Card, Input, Modal, Select } from "@/app/components/UI";
import LeaveRequestButton, { type LeaveCreateRow } from "@/app/components/LeaveRequestButton";

type SpecialFilter = "all" | "special" | "normal";
type LeaveTypeFilter = "all" | "ready" | "errand" | "war";


// ✅ สีแถบด้านบนตามอาชีพ (ตามที่ระบุ)
// id1 สีเหลือง, id2 สีม่วง, id3 สีแดง, id4 สีน้ำเงิน, id5 สีชมพู, id6 สีฟ้าอมเขียว
const TOPBAR_BY_CLASS_ID: Record<number, string> = {
  1: "#EAB308", // yellow
  2: "#A855F7", // purple
  3: "#EF4444", // red
  4: "#3B82F6", // blue
  5: "#EC4899", // pink
  6: "#22D3EE", // cyan-ish
};

function topbarColor(classId: number | null | undefined) {
  if (!classId) return "#A1A1AA"; // default (ยังไม่เลือกอาชีพ)
  return TOPBAR_BY_CLASS_ID[classId] ?? "#A1A1AA";
}
type Props = {
  members: DbMember[];
  leaves: DbLeave[];
  isLoading: boolean;
  onReload: () => Promise<void>;
};

const BKK_TZ = "Asia/Bangkok";

const bkkDateFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: BKK_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
function bkkDateOf(date: Date) {
  return bkkDateFmt.format(date); // YYYY-MM-DD (BKK)
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

const bkkWeekdayFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: BKK_TZ,
  weekday: "short",
});
function isSaturday(dateStr: string) {
  // ใช้ Intl + timezone เพื่อไม่ผูกกับ timezone ของเครื่องผู้ใช้
  return bkkWeekdayFmt.format(new Date(`${dateStr}T12:00:00+07:00`)) === "Sat";
}

function nextSaturdayFrom(dateStr: string) {
  // dateStr เป็น YYYY-MM-DD (BKK)
  let d = new Date(`${dateStr}T12:00:00+07:00`);
  for (let i = 0; i < 7; i++) {
    const cur = bkkDateOf(d);
    if (isSaturday(cur)) return cur;
    d = new Date(d.getTime() + 24 * 60 * 60 * 1000);
  }
  return dateStr;
}

type TodayLeaveMeta = {
  hasErrandToday: boolean; // วันนี้ (ไม่ใช่เสาร์) มีลา => ลากิจ
  war20Today: boolean; // วันนี้เป็นเสาร์ และลา 20:00
  war2030Today: boolean; // วันนี้เป็นเสาร์ และลา 20:30
  warLabelToday: string | null; // "ลาวอ 20.00 น." | "ลาวอ 20.30 น." | "ลาทั้งหมด" | "ลาวอ" | null
};

type TodayStatus = "special" | "errand" | "war" | "ready";

function computeWarLabel(war20: boolean, war2030: boolean) {
  if (war20 && war2030) return "ลาทั้งหมด";
  if (war20) return "ลาวอ 20.00 น.";
  if (war2030) return "ลาวอ 20.30 น.";
  return "ลาวอ";
}

export default function ClubMembers({
  members,
  leaves,
  isLoading,
  onReload,
}: Props) {
  const [query, setQuery] = useState("");
  const [classId, setClassId] = useState<string>("All");
  const [specialFilter, setSpecialFilter] = useState<SpecialFilter>("all");
  const [leaveTypeFilter, setLeaveTypeFilter] = useState<LeaveTypeFilter>("all");

  const [classList, setClassList] = useState<DbClass[]>([]);

  // Edit modal
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editing, setEditing] = useState<DbMember | null>(null);
  const [form, setForm] = useState<{ class_id: string; power: string; is_special: boolean }>({
    class_id: "0",
    power: "0",
    is_special: false,
  });

  // ✅ วันนี้ (เวลาไทย) — อัปเดตทุกนาทีให้ไม่ค้างข้ามวัน
  const [todayBkk, setTodayBkk] = useState(() => bkkDateOf(new Date()));
  useEffect(() => {
    const t = setInterval(() => setTodayBkk(bkkDateOf(new Date())), 60_000);
    return () => clearInterval(t);
  }, []);

  const nextSaturdayBkk = useMemo(() => nextSaturdayFrom(todayBkk), [todayBkk]);

  useEffect(() => {
    classService
      .list()
      .then((rows) => {
        const hasZero = rows.some((r) => r.id === 0);
        const normalized: DbClass[] = hasZero ? rows : [{ id: 0, name: "ยังไม่เลือกอาชีพ", icon_url: null }, ...rows];

        normalized.sort((a, b) => {
          if (a.id === 0) return -1;
          if (b.id === 0) return 1;
          return a.id - b.id;
        });

        setClassList(normalized);
      })
      .catch(() => setClassList([{ id: 0, name: "ยังไม่เลือกอาชีพ", icon_url: null }]));
  }, []);


  const classById = useMemo(() => {
    const m = new Map<number, DbClass>();
    classList.forEach((c) => m.set(c.id, c));
    return m;
  }, [classList]);

  const leaveByMemberId = useMemo(() => {
    const map = new Map<number, DbLeave[]>();
    for (const l of leaves) {
      // ✅ ไม่เอา Cancel
      if (isCancelLeaveStatus(l.status)) continue;

      const arr = map.get(l.member_id) ?? [];
      arr.push(l);
      map.set(l.member_id, arr);
    }
    return map;
  }, [leaves]);

  // ✅ สถานะการลา “เฉพาะวันนี้” (เวลาไทย)
  const todayMetaByMemberId = useMemo(() => {
    const map = new Map<number, TodayLeaveMeta>();

    for (const l of leaves) {
      // ✅ ไม่เอา Cancel
      if (isCancelLeaveStatus(l.status)) continue;

      const dt = String(l.date_time ?? "");
      if (!dt) continue;

      const { date, time } = bkkDateTimeParts(dt);
      if (!date) continue;

      const isToday = date === todayBkk;
      const isNextSaturday = date === nextSaturdayBkk;
      if (!isToday && !isNextSaturday) continue;

      const cur =
        map.get(l.member_id) ?? {
          hasErrandToday: false,
          war20Today: false,
          war2030Today: false,
          warLabelToday: null,
        };

      if (isSaturday(date)) {
        // เสาร์ (วอ) — นับทั้งวันนี้ (ถ้าวันนี้เป็นเสาร์) และเสาร์ที่จะถึง
        if (time === "20:00") cur.war20Today = true;
        if (time === "20:30") cur.war2030Today = true;

        // ถ้าเป็นเสาร์ แต่เวลาไม่ใช่ 20:00/20:30 ก็ยังถือว่าเป็น “ลาวอ”
        cur.warLabelToday = computeWarLabel(cur.war20Today, cur.war2030Today);
      } else if (isToday && time === "00:00") {
        // ลากิจ — จะถูกบันทึกเป็นเวลา 00:00 ของ “วันนี้” (เวลาไทย)
        cur.hasErrandToday = true;
      }

      map.set(l.member_id, cur);
    }

    return map;
  }, [leaves, todayBkk, nextSaturdayBkk]);

  const visibleMembers = useMemo(() => {
    const q = query.trim().toLowerCase();

    return members
      .filter((m) => (m.status ?? "active") === "active")
      .filter((m) => Boolean((m as any)?.club))
      .filter((m) => {
        if (!q) return true;
        const c = (m.class_id != null ? classById.get(m.class_id) : undefined) || null;
        const className = c?.name ?? "";
        return `${m.name} ${className}`.toLowerCase().includes(q);
      })
      .filter((m) => (classId === "All" ? true : String(m.class_id ?? 0) === classId))
      .filter((m) => {
        if (specialFilter === "all") return true;
        if (specialFilter === "special") return !!m.is_special;
        return !m.is_special;
      })
      .filter((m) => {
        if (leaveTypeFilter === "all") return true;

        const meta = todayMetaByMemberId.get(m.id);
        const hasWarToday = !!(meta?.war20Today || meta?.war2030Today) || (!!meta?.warLabelToday && meta.warLabelToday !== null);
        const hasErrandToday = !!meta?.hasErrandToday;

        const isReady = !m.is_special && !hasWarToday && !hasErrandToday;

        if (leaveTypeFilter === "ready") return isReady;
        if (leaveTypeFilter === "war") return hasWarToday;
        if (leaveTypeFilter === "errand") return hasErrandToday;
        return true;
      });
  }, [
    members,
    query,
    classId,
    classById,
    specialFilter,
    leaveTypeFilter,
    todayMetaByMemberId,
  ]);

  function isCancelLeaveStatus(status?: string | null) {
    const s = String(status ?? "").trim().toLowerCase();
    return s === "cancel";
  }

  function formatBkkDateTime(dt?: string | null) {
    if (!dt) return "-";
    const { date, time } = bkkDateTimeParts(dt);
    if (!date) return "-";
    return `${date} ${time}`;
  }

  const openEdit = (m: DbMember) => {
    const cid = m.class_id == null ? "0" : String(m.class_id);
    setEditing(m);
    setForm({
      class_id: cid,
      power: String(m.power ?? 0),
      is_special: !!m.is_special,
    });
    setIsEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editing) return;

    const payload: Partial<DbMember> = {
      power: Number(form.power) || 0,
      class_id: Number(form.class_id) || 0,
      is_special: !!form.is_special,
    };

    await memberService.update(editing.id, payload);
    setIsEditOpen(false);
    setEditing(null);
    await onReload();
  };


  const getTodayBadges = (m: DbMember): { key: string; label: string; variant: "outline" | "warning" | "success" }[] => {
    // ✅ กติกา: ถ้าเป็น “ศิษย์เอก” ให้ขึ้นแค่ “ศิษย์เอก” อย่างเดียว
    if (m.is_special) return [{ key: "special", label: "ศิษย์เอก", variant: "outline" }];

    const badges: { key: string; label: string; variant: "outline" | "warning" | "success" }[] = [];

    const meta = todayMetaByMemberId.get(m.id);
    const hasErrandToday = !!meta?.hasErrandToday; // ลากิจ (วันนี้ 00:00)
    const hasWar20 = !!meta?.war20Today;
    const hasWar2030 = !!meta?.war2030Today;
    const hasWarAny = hasWar20 || hasWar2030 || !!meta?.warLabelToday;

    // ✅ ลาวอ — แยกตามเวลา (ถ้าลาทั้ง 2 เวลาให้ขึ้นทั้งหมด)
    if (hasWar20) badges.push({ key: "war20", label: "ลาวอ 20.00 น.", variant: "warning" });
    if (hasWar2030) badges.push({ key: "war2030", label: "ลาวอ 20.30 น.", variant: "warning" });
    if (!hasWar20 && !hasWar2030 && meta?.warLabelToday) {
      badges.push({ key: "war", label: meta.warLabelToday, variant: "warning" });
    }

    // ✅ ลากิจ — แสดงร่วมกับลาวอได้
    if (hasErrandToday) badges.push({ key: "errand", label: "ลากิจ", variant: "warning" });

    // ✅ ไม่ลาเลย => พร้อม
    if (!hasWarAny && !hasErrandToday) badges.push({ key: "ready", label: "พร้อม", variant: "success" });

    return badges;
  };


  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 md:px-6 space-y-6">
      <Card noPadding className="sticky top-4 z-10">
        <div className="p-4 bg-white/70 dark:bg-zinc-950/50 backdrop-blur rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-sm font-semibold">Club</div>
              <Badge variant="outline">{visibleMembers.length} คน</Badge>
            </div>

            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <Button variant="secondary" className="flex-1 md:flex-none" onClick={onReload}>
                <RefreshCw className="w-4 h-4" />
                รีเฟรช
              </Button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-3">
            <div className="lg:col-span-5">
              <Input
                placeholder="ค้นหา: ชื่อ "
                value={query}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
              />
            </div>

            <div className="lg:col-span-3">
              <Select value={classId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setClassId(e.target.value)}>
                <option value="All">ทุกอาชีพ</option>
                {classList.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="lg:col-span-2">
              <Select
                value={specialFilter}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSpecialFilter(e.target.value as SpecialFilter)}
              >
                <option value="all">ศิษย์เอก: ทั้งหมด</option>
                <option value="special">เฉพาะศิษย์เอก</option>
                <option value="normal">ไม่ใช่ศิษย์เอก</option>
              </Select>
            </div>

            <div className="lg:col-span-2">
              <Select
                value={leaveTypeFilter}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setLeaveTypeFilter(e.target.value as LeaveTypeFilter)
                }
              >
                <option value="all">สถานะ (วันนี้/วอ): ทั้งหมด</option>
                <option value="ready">พร้อม</option>
                <option value="errand">ลากิจ (วันนี้)</option>
                <option value="war">ลาวอ (เสาร์ที่จะถึง)</option>
              </Select>
            </div>
          </div>

          <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
            สถานะคำนวณจาก “วันนี้ (ลากิจ 00:00)” และ “เสาร์ที่จะถึง (วอ 20:00/20:30)” (เวลาไทย) • วันนี้: {todayBkk} • เสาร์ที่จะถึง: {nextSaturdayBkk}
          </div>
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <div className="text-sm text-zinc-500 dark:text-zinc-400">
          {isLoading ? "กำลังโหลด..." : `แสดง ${visibleMembers.length} สมาชิก`}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {visibleMembers.map((m) => {
          const c = (m.class_id != null ? classById.get(m.class_id) : undefined) || null;
          const className = c?.name ?? (m.class_id == null || m.class_id === 0 ? "ยังไม่เลือกอาชีพ" : "-");
          const iconUrl = c?.icon_url ?? null;

          // ✅ วันนี้เท่านั้น: แสดง badge อย่างเดียว
          const todayBadges = getTodayBadges(m);

          const memberLeaves = leaveByMemberId.get(m.id) ?? [];

          return (
            <Card key={m.id} className="overflow-hidden" noPadding>
              <div className="h-2 w-full" style={{ backgroundColor: topbarColor(m.class_id) }} />
              <div className="p-4">
<div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center overflow-hidden">
                    {iconUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={iconUrl} alt={className} className="w-full h-full object-contain" />
                    ) : (
                      <span className="text-xs text-zinc-500">{className.slice(0, 2)}</span>
                    )}
                  </div>

                  <div>
                    <div className="font-semibold text-zinc-900 dark:text-zinc-100">{m.name}</div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      {className}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      Update: {formatBkkDateTime((m as any).update_date)}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  {todayBadges.map((b) => (
                    <Badge key={b.key} variant={b.variant}>
                      {b.label}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3">
                <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">POWER</div>
                  <div className="text-lg font-semibold">{(m.power ?? 0).toLocaleString()}</div>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={() => openEdit(m)}>
                  <Pencil className="w-4 h-4" />
                  แก้ไข
                </Button>

                {!m.is_special ? (
                  <LeaveRequestButton
                    className="flex-1"
                    memberName={m.name}
                    existingLeaves={memberLeaves}
                    onCreate={async (rows: LeaveCreateRow[]) => {
                      const payload = rows.map((r) => ({
                        member_id: m.id,
                        date_time: r.date_time,
                        reason: r.reason,
                        status: "Active",
                        update_date: new Date().toISOString(),
                      }));
                      await leaveService.createMany(payload as any);
                    }}
                    onAfterSave={onReload}
                  />
                ) : null}
              </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Edit modal */}
      <Modal open={isEditOpen} onClose={() => setIsEditOpen(false)} title="แก้ไขข้อมูลสมาชิก">
        <div className="space-y-3">
          <Input placeholder="ชื่อสมาชิก" value={editing?.name ?? ""} disabled />

          <Select
            value={form.class_id}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm((s) => ({ ...s, class_id: e.target.value }))}
          >
            <option value="0">ยังไม่เลือกอาชีพ</option>
            {classList
              .filter((c) => c.id !== 0)
              .map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
          </Select>

          <Input
            type="number"
            placeholder="Power"
            value={form.power}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((s) => ({ ...s, power: e.target.value }))}
          />

          <div className="flex items-center gap-2">
            <input
              id="is_special"
              type="checkbox"
              className="h-4 w-4"
              checked={form.is_special}
              onChange={(e) => setForm((s) => ({ ...s, is_special: e.target.checked }))}
            />
            <label htmlFor="is_special" className="text-sm text-zinc-700 dark:text-zinc-200">
              ศิษย์เอก
            </label>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setIsEditOpen(false)}>
              <X className="w-4 h-4" />
              ยกเลิก
            </Button>
            <Button className="flex-1" onClick={saveEdit}>
              บันทึก
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}