"use client";

import React, { useEffect, useMemo, useState } from "react";
import { RefreshCw, Pencil, X } from "lucide-react";

import type { DbClass, DbLeave, DbMember, GuildNo } from "@/type/db";
import { classService } from "@/services/classService";
import { memberService } from "@/services/memberService";
import { leaveService } from "@/services/leaveService";
import { Badge, Button, Card, Input, Modal, Select } from "@/app/components/UI";
import LeaveRequestButton, { type LeaveCreateRow } from "@/app/components/LeaveRequestButton";

type GuildTab = "all" | GuildNo;
type SpecialFilter = "all" | "special" | "normal";
type LeaveTypeFilter = "all" | "ready" | "errand" | "war";

type Props = {
  members: DbMember[];
  leaves: DbLeave[];
  isLoading: boolean;
  onReload: () => Promise<void>;

  /** null = admin เห็นทุกกิลด์ */
  lockedGuild?: GuildNo | null;
  /** admin เท่านั้น */
  canViewAllGuilds?: boolean;
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

function isSaturday(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00+07:00`);
  return d.getDay() === 6; // Sat
}

type TodayLeaveMeta = {
  hasErrandToday: boolean; // วันนี้ (ไม่ใช่เสาร์) มีลา => ลากิจ
  war20Today: boolean; // วันนี้เป็นเสาร์ และลา 20:00
  war2030Today: boolean; // วันนี้เป็นเสาร์ และลา 20:30
  warLabelToday: string | null; // "ลา 20.00 น." | "ลา 20.30 น." | "ลาทั้งหมด" | "ลาวอ" | null
};

type TodayStatus = "special" | "errand" | "war" | "ready";

function computeWarLabel(war20: boolean, war2030: boolean) {
  if (war20 && war2030) return "ลาทั้งหมด";
  if (war20) return "ลา 20.00 น.";
  if (war2030) return "ลา 20.30 น.";
  return "ลาวอ";
}

export default function Members({
  members,
  leaves,
  isLoading,
  onReload,
  lockedGuild = null,
  canViewAllGuilds = false,
}: Props) {
  const [tab, setTab] = useState<GuildTab>(() => (lockedGuild ? lockedGuild : "all"));
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

  useEffect(() => {
    if (lockedGuild) setTab(lockedGuild);
  }, [lockedGuild]);

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

      if (date !== todayBkk) continue;

      const cur =
        map.get(l.member_id) ?? {
          hasErrandToday: false,
          war20Today: false,
          war2030Today: false,
          warLabelToday: null,
        };

      if (isSaturday(date)) {
        if (time === "20:00") cur.war20Today = true;
        if (time === "20:30") cur.war2030Today = true;

        // ถ้าเป็นเสาร์ แต่เวลาไม่ใช่ 20:00/20:30 ก็ยังถือว่าเป็น “ลาวอ”
        cur.warLabelToday = computeWarLabel(cur.war20Today, cur.war2030Today);
      } else {
        cur.hasErrandToday = true;
        cur.warLabelToday = null;
      }

      map.set(l.member_id, cur);
    }

    return map;
  }, [leaves, todayBkk]);

  const visibleMembers = useMemo(() => {
    const q = query.trim().toLowerCase();

    return members
      .filter((m) => (m.status ?? "active") === "active")
      .filter((m) => {
        if (tab === "all") return canViewAllGuilds;
        return m.guild === tab;
      })
      .filter((m) => {
        if (!q) return true;
        const c = (m.class_id != null ? classById.get(m.class_id) : undefined) || null;
        const className = c?.name ?? "";
        return `${m.name} ${className} ${m.discord_user_id ?? ""}`.toLowerCase().includes(q);
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
    tab,
    canViewAllGuilds,
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

  const TabButton = ({ value, label }: { value: GuildTab; label: string }) => {
    const active = tab === value;
    return (
      <button
        type="button"
        onClick={() => setTab(value)}
        className={[
          "px-4 py-2 rounded-xl text-sm font-semibold border transition",
          active
            ? "bg-red-600 text-white border-red-600"
            : "bg-white/60 dark:bg-zinc-950/40 text-zinc-700 dark:text-zinc-200 border-zinc-200 dark:border-zinc-800",
        ].join(" ")}
      >
        {label}
      </button>
    );
  };

  const getTodayStatus = (m: DbMember): { status: TodayStatus; label: string; variant: "outline" | "warning" | "success" } => {
    // ✅ priority ตามที่คุณขอ: วันนี้แสดงอย่างใดอย่างหนึ่ง
    if (m.is_special) return { status: "special", label: "ศิษย์เอก", variant: "outline" };

    const meta = todayMetaByMemberId.get(m.id);
    const hasErrandToday = !!meta?.hasErrandToday;
    const hasWarToday = !!(meta?.war20Today || meta?.war2030Today) || (!!meta?.warLabelToday && meta.warLabelToday !== null);

    if (hasErrandToday) return { status: "errand", label: "ลากิจ", variant: "warning" };
    if (hasWarToday) return { status: "war", label: meta?.warLabelToday ?? "ลาวอ", variant: "warning" };

    return { status: "ready", label: "พร้อม", variant: "success" };
  };

  return (
    <div className="space-y-6">
      <Card noPadding className="sticky top-4 z-10">
        <div className="p-4 bg-white/70 dark:bg-zinc-950/50 backdrop-blur rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex gap-2 flex-wrap">
              {lockedGuild ? (
                <TabButton
                  value={lockedGuild}
                  label={lockedGuild === 1 ? "Inferno-1" : lockedGuild === 2 ? "Inferno-2" : "Inferno-3"}
                />
              ) : (
                <>
                  {canViewAllGuilds ? <TabButton value="all" label="ทั้งหมด" /> : null}
                  <TabButton value={1} label="Inferno-1" />
                  <TabButton value={2} label="Inferno-2" />
                  <TabButton value={3} label="Inferno-3" />
                </>
              )}
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
                placeholder="ค้นหา: discord id / ชื่อ / อาชีพ..."
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
                <option value="all">สถานะวันนี้: ทั้งหมด</option>
                <option value="ready">พร้อม</option>
                <option value="errand">ลากิจ</option>
                <option value="war">ลาวอ</option>
              </Select>
            </div>
          </div>

          <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
            สถานะคำนวณจาก “วันนี้” เท่านั้น (เวลาไทย) • วันนี้: {todayBkk}
          </div>
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <div className="text-sm text-zinc-500 dark:text-zinc-400">
          {isLoading ? "กำลังโหลด..." : `แสดง ${visibleMembers.length} สมาชิก`}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {visibleMembers.map((m) => {
          const c = (m.class_id != null ? classById.get(m.class_id) : undefined) || null;
          const className = c?.name ?? (m.class_id == null || m.class_id === 0 ? "ยังไม่เลือกอาชีพ" : "-");
          const iconUrl = c?.icon_url ?? null;

          // ✅ วันนี้เท่านั้น: แสดง badge อย่างเดียว
          const todayStatus = getTodayStatus(m);

          const memberLeaves = leaveByMemberId.get(m.id) ?? [];

          return (
            <Card key={m.id} className="p-4">
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
                      {className} • Guild {m.guild}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">Discord: {m.discord_user_id ?? "-"}</div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <Badge variant={todayStatus.variant}>{todayStatus.label}</Badge>
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
