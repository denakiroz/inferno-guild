"use client";

// src/app/dashboard/Dashboard.tsx
import React, { useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarClock, RefreshCw, Users, AlertTriangle, ListChecks } from "lucide-react";

import type { DbLeave, DbMember, GuildNo } from "@/type/db";
import { Badge, Button, Card, Input, Select } from "@/app/components/UI";

type GuildTab = "all" | GuildNo;

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
  return bkkWeekdayFmt.format(new Date(`${dateStr}T12:00:00+07:00`)) === "Sat";
}

function nextSaturdayFrom(dateStr: string) {
  let d = new Date(`${dateStr}T12:00:00+07:00`);
  for (let i = 0; i < 7; i++) {
    const cur = bkkDateOf(d);
    if (isSaturday(cur)) return cur;
    d = new Date(d.getTime() + 86400000);
  }
  return dateStr;
}

function isCancelLeaveStatus(status?: string | null) {
  const s = String(status ?? "").trim().toLowerCase();
  return s === "cancel";
}

function guildLabel(g: number) {
  if (g === 1) return "Inferno-1";
  if (g === 2) return "Inferno-2";
  if (g === 3) return "Inferno-3";
  return `Guild ${g}`;
}

function classifyLeave(date: string, time: string) {
  if (isSaturday(date)) return { kind: "war" as const, label: "ลาวอ" };
  if (time === "00:00") return { kind: "errand" as const, label: "ลากิจ" };
  return { kind: "unknown" as const, label: "ลา" };
}

function fmtWarTime(hhmm: string) {
  if (hhmm === "20:00") return "20.00";
  if (hhmm === "20:30") return "20.30";
  return hhmm.replace(":", ".");
}

const thMonthYearFmt = new Intl.DateTimeFormat("th-TH", {
  timeZone: BKK_TZ,
  month: "short",
  year: "numeric",
});
function monthKeyOf(dateStr: string) {
  // dateStr: YYYY-MM-DD
  return dateStr.slice(0, 7); // YYYY-MM
}
function thMonthYearLabelFromKey(ym: string) {
  const d = new Date(`${ym}-01T12:00:00+07:00`);
  return thMonthYearFmt.format(d);
}

type Props = {
  members: DbMember[];
  leaves: DbLeave[];
  isLoading: boolean;
  onReload: () => Promise<void>;
  lockedGuild?: GuildNo | null;
  canViewAllGuilds?: boolean;
};

type LeaveRow = {
  id: number | string;
  memberId: number;
  name: string;
  guild: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  kind: "war" | "errand" | "unknown";
  label: string;
  timeDisplay: string;
  reason: string;
  updateDate: string | null; // ISO (string) สำหรับ sorting Recent
};

function badgeVariant(kind: LeaveRow["kind"]) {
  if (kind === "war") return "danger";
  if (kind === "errand") return "warning"; // เหลือง
  return "outline";
}

function rowBg(kind: LeaveRow["kind"]) {
  if (kind === "war") return "bg-red-50 dark:bg-red-950/20";
  if (kind === "errand") return "bg-yellow-50 dark:bg-yellow-950/20";
  return "";
}

function barWidth(pct: number) {
  return { width: `${Math.max(0, Math.min(100, pct)).toFixed(0)}%` };
}

export default function Dashboard({
  members,
  leaves,
  isLoading,
  onReload,
  lockedGuild = null,
  canViewAllGuilds = false,
}: Props) {
  const [tab, setTab] = useState<GuildTab>(() => (lockedGuild ? lockedGuild : "all"));
  const [q, setQ] = useState("");

  // วันนี้ (BKK) — อัปเดตทุกนาที
  const [todayBkk, setTodayBkk] = useState(() => bkkDateOf(new Date()));
  useEffect(() => {
    const t = setInterval(() => setTodayBkk(bkkDateOf(new Date())), 60_000);
    return () => clearInterval(t);
  }, []);
  const nextSatBkk = useMemo(() => nextSaturdayFrom(todayBkk), [todayBkk]);

  useEffect(() => {
    if (lockedGuild) setTab(lockedGuild);
  }, [lockedGuild]);

  const memberById = useMemo(() => {
    const m = new Map<number, DbMember>();
    for (const row of members) m.set(row.id, row);
    return m;
  }, [members]);

  const filteredMembers = useMemo(() => {
    let rows = members;
    rows = rows.filter((m) => String((m as any).status ?? "").toLowerCase() === "active");
    if (tab !== "all") rows = rows.filter((m) => Number((m as any).guild) === Number(tab));
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      rows = rows.filter((m) => String((m as any).name ?? "").toLowerCase().includes(s));
    }
    return rows;
  }, [members, tab, q]);

  const filteredMemberIds = useMemo(() => new Set(filteredMembers.map((m) => m.id)), [filteredMembers]);

  const rows = useMemo<LeaveRow[]>(() => {
    const out: LeaveRow[] = [];
    for (const l of leaves) {
      if (isCancelLeaveStatus((l as any).status)) continue;

      const memId = Number((l as any).member_id);
      if (!filteredMemberIds.has(memId)) continue;

      const dt = String((l as any).date_time ?? "");
      if (!dt) continue;
      const { date, time } = bkkDateTimeParts(dt);
      if (!date) continue;

      const mem = memberById.get(memId);
      const name = String(mem?.name ?? `Member #${memId}`);
      const guild = Number((mem as any)?.guild ?? 0);
      const cls = classifyLeave(date, time);

      out.push({
        id: (l as any).id ?? `${memId}-${dt}`,
        memberId: memId,
        name,
        guild,
        date,
        time,
        kind: cls.kind,
        label: cls.label,
        timeDisplay: cls.kind === "errand" ? "-" : time,
        reason: String((l as any).reason ?? "").trim(),
        updateDate: (l as any).update_date ? String((l as any).update_date) : null,
      });
    }
    // 최신순
    out.sort((a, b) => (a.date === b.date ? (a.time < b.time ? 1 : -1) : a.date < b.date ? 1 : -1));
    return out;
  }, [leaves, filteredMemberIds, memberById]);

  const currentMonthKey = useMemo(() => monthKeyOf(todayBkk), [todayBkk]);
  const currentMonthLabel = useMemo(() => thMonthYearLabelFromKey(currentMonthKey), [currentMonthKey]);

  // Today (errand)
  // Today (errand) — group by guild (unique member)
  const todayErrandByGuild = useMemo(() => {
    const memberGuild = new Map<number, number>();
    for (const r of rows) {
      if (r.kind !== "errand") continue;
      if (r.date !== todayBkk) continue;
      memberGuild.set(r.memberId, r.guild);
    }

    const byGuild = new Map<number, number>();
    for (const g of memberGuild.values()) {
      byGuild.set(g, (byGuild.get(g) ?? 0) + 1);
    }

    return { totalMembers: memberGuild.size, byGuild };
  }, [rows, todayBkk]);

  // Next Saturday war leaves (group by guild, per member shows 20.00 / 20.30 / both)
  // Next Saturday war leaves — group by guild, count slots (no member names)
  const nextSatWarByGuild = useMemo(() => {
    const memberTimes = new Map<number, { guild: number; times: Set<string> }>();
    for (const r of rows) {
      if (r.kind !== "war") continue;
      if (r.date !== nextSatBkk) continue;
      const cur = memberTimes.get(r.memberId) ?? { guild: r.guild, times: new Set<string>() };
      cur.guild = r.guild;
      cur.times.add(r.time);
      memberTimes.set(r.memberId, cur);
    }

    type SlotCount = { t2000: number; t2030: number; both: number; total: number };
    const byGuild = new Map<number, SlotCount>();

    for (const rec of memberTimes.values()) {
      const times = Array.from(rec.times).sort();
      const has2000 = times.includes("20:00");
      const has2030 = times.includes("20:30");
      const bucket = byGuild.get(rec.guild) ?? { t2000: 0, t2030: 0, both: 0, total: 0 };
      if (has2000 && has2030) bucket.both += 1;
      else if (has2000) bucket.t2000 += 1;
      else if (has2030) bucket.t2030 += 1;
      else bucket.t2000 += 0; // ignore unknown
      bucket.total += 1;
      byGuild.set(rec.guild, bucket);
    }

    return { totalMembers: memberTimes.size, byGuild };
  }, [rows, nextSatBkk]);

  // War days (unique member+date) by month
  const warByMonth = useMemo(() => {
    const m = new Map<string, Map<number, Set<string>>>();
    for (const r of rows) {
      if (r.kind !== "war") continue;
      const ym = monthKeyOf(r.date);
      const byMember = m.get(ym) ?? new Map<number, Set<string>>();
      const set = byMember.get(r.memberId) ?? new Set<string>();
      set.add(r.date);
      byMember.set(r.memberId, set);
      m.set(ym, byMember);
    }
    return m;
  }, [rows]);

  const warThisMonthTotalDays = useMemo(() => {
    const byMember = warByMonth.get(currentMonthKey);
    if (!byMember) return 0;
    let total = 0;
    for (const dates of byMember.values()) total += dates.size;
    return total;
  }, [warByMonth, currentMonthKey]);

  const warThisMonthByGuild = useMemo(() => {
    // sum unique war days per guild
    const byMember = warByMonth.get(currentMonthKey);
    const out = new Map<number, number>();
    if (!byMember) return out;
    for (const [memberId, dates] of byMember.entries()) {
      const mem = memberById.get(memberId);
      const g = Number((mem as any)?.guild ?? 0);
      out.set(g, (out.get(g) ?? 0) + dates.size);
    }
    return out;
  }, [warByMonth, currentMonthKey, memberById]);

  const topWarMembers = useMemo(() => {
    const totals = new Map<number, number>();
    for (const [ym, byMember] of warByMonth.entries()) {
      for (const [memberId, dates] of byMember.entries()) {
        totals.set(memberId, (totals.get(memberId) ?? 0) + dates.size);
      }
    }
    const list = Array.from(totals.entries())
      .map(([memberId, cnt]) => {
        const mem = memberById.get(memberId);
        return { memberId, name: String(mem?.name ?? `Member #${memberId}`), guild: Number((mem as any)?.guild ?? 0), cnt };
      })
      // order by count (desc), then name (asc) for stability
      .sort((a, b) => (b.cnt - a.cnt) || a.name.localeCompare(b.name) || a.memberId - b.memberId)
      .slice(0, 10);
    return list;
  }, [warByMonth, memberById]);

  const topWarThisMonthMembers = useMemo(() => {
    const byMember = warByMonth.get(currentMonthKey);
    if (!byMember) return [] as Array<{ memberId: number; name: string; guild: number; cnt: number }>;

    return Array.from(byMember.entries())
      .map(([memberId, dates]) => {
        const mem = memberById.get(memberId);
        return {
          memberId,
          name: String(mem?.name ?? `Member #${memberId}`),
          guild: Number((mem as any)?.guild ?? 0),
          cnt: dates.size,
        };
      })
      // order by count (desc), then name (asc) for stability
      .sort((a, b) => (b.cnt - a.cnt) || a.name.localeCompare(b.name) || a.memberId - b.memberId)
      .slice(0, 10);
  }, [warByMonth, currentMonthKey, memberById]);

  const recentRows = useMemo(() => {
    const ts = (s: string) => {
      const t = new Date(s).getTime();
      return Number.isFinite(t) ? t : 0;
    };
    const fallback = (r: LeaveRow) => `${r.date}T${r.time || "00:00"}:00+07:00`;
    const list = [...rows].sort((a, b) => {
      const ta = ts(a.updateDate ?? fallback(a));
      const tb = ts(b.updateDate ?? fallback(b));
      return tb - ta;
    });
    return list.slice(0, 10);
  }, [rows]);

  const guildTabs = useMemo(() => {
    const base: Array<{ value: GuildTab; label: string }> = [{ value: "all", label: "ทั้งหมด" }];
    base.push({ value: 1 as GuildNo, label: "Inferno-1" });
    base.push({ value: 2 as GuildNo, label: "Inferno-2" });
    base.push({ value: 3 as GuildNo, label: "Inferno-3" });
    if (!canViewAllGuilds) {
      // head/member: ซ่อนตัวเลือกอื่น (ยึดตาม lockedGuild)
      if (lockedGuild) return base.filter((x) => x.value === lockedGuild || x.value === "all");
      return base.filter((x) => x.value === "all");
    }
    return base;
  }, [canViewAllGuilds, lockedGuild]);

  // กล่องสรุป per-guild: แสดงครบเมื่อ tab=all เท่านั้น
  const showGuildSummaryAll = tab === "all" && canViewAllGuilds;

  const guildSummaryCards = useMemo(() => {
    const allGuilds = [1, 2, 3];
    const totalAll = allGuilds.reduce((acc, g) => acc + (warThisMonthByGuild.get(g) ?? 0), 0);
    const mkCard = (g: number) => {
      const val = warThisMonthByGuild.get(g) ?? 0;
      const pct = totalAll ? (val / totalAll) * 100 : 0;
      return { g, val, pct };
    };
    return allGuilds.map(mkCard);
  }, [warThisMonthByGuild]);

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto w-full max-w-[1400px] space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl border border-zinc-200 bg-white shadow-sm flex items-center justify-center dark:border-zinc-800 dark:bg-zinc-950">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xl font-semibold">Dashboard</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              วันนี้ (BKK): {todayBkk} · เสาร์ถัดไป: {nextSatBkk} · เดือนปัจจุบัน: {currentMonthLabel}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="min-w-[180px]">
            <Select
              value={String(tab)}
              onChange={(e) => setTab((e.target.value === "all" ? "all" : (Number(e.target.value) as GuildNo)) as GuildTab)}
            >
              {guildTabs.map((t) => (
                <option key={String(t.value)} value={String(t.value)}>
                  {t.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm text-zinc-500 dark:text-zinc-400">สมาชิก (ตามตัวกรอง)</div>
              <div className="mt-1 text-2xl font-semibold">{filteredMembers.length}</div>
            </div>
            <Users className="h-5 w-5 text-zinc-500" />
          </div>
          <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
            ตัวเลขนี้อ้างอิงจากสมาชิกที่ถูกโหลด + ตัวกรองกิลด์/ค้นหา
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm text-zinc-500 dark:text-zinc-400">ลากิจวันนี้</div>
              <div className="mt-1 text-2xl font-semibold">{todayErrandByGuild.totalMembers}</div>
            </div>
            <CalendarClock className="h-5 w-5 text-zinc-500" />
          </div>

          <div className="mt-3 space-y-2">
            {(tab === "all" ? [1, 2, 3] : [Number(tab)]).map((g) => {
              const cnt = todayErrandByGuild.byGuild.get(g) ?? 0;
              return (
                <div
                  key={g}
                  className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <div className="text-sm font-medium">{guildLabel(g)}</div>
                  <Badge variant="warning" className="shrink-0"> {cnt} คน </Badge>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm text-zinc-500 dark:text-zinc-400">ลาวอ (เสาร์ถัดไป)</div>
              <div className="mt-1 text-2xl font-semibold">{nextSatWarByGuild.totalMembers}</div>
            </div>
            <AlertTriangle className="h-5 w-5 text-zinc-500" />
          </div>
          <div className="mt-3 space-y-3">
            {(tab === "all" ? [1, 2, 3] : [Number(tab)]).map((g) => {
              const c =
                nextSatWarByGuild.byGuild.get(g) ??
                ({ t2000: 0, t2030: 0, both: 0, total: 0 } as { t2000: number; t2030: number; both: number; total: number });

              return (
                <div
                  key={g}
                  className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <div className="flex items-center justify-between bg-zinc-50 px-3 py-2 dark:bg-zinc-900">
                    <div className="text-sm font-medium">{guildLabel(g)}</div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">{c.total} คน</div>
                  </div>

                  <div className="p-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">
                      <div className="text-sm text-zinc-600 dark:text-zinc-300">20.00</div>
                      <Badge variant="danger">{c.t2000}</Badge>
                    </div>

                    <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">
                      <div className="text-sm text-zinc-600 dark:text-zinc-300">20.30</div>
                      <Badge variant="danger">{c.t2030}</Badge>
                    </div>

                    <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">
                      <div className="text-sm text-zinc-600 dark:text-zinc-300">ทั้งสองรอบ</div>
                      <Badge variant="danger">{c.both}</Badge>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm text-zinc-500 dark:text-zinc-400">ลาวอเดือนนี้ (รวมวัน)</div>
              <div className="mt-1 text-2xl font-semibold">{warThisMonthTotalDays}</div>
            </div>
            <ListChecks className="h-5 w-5 text-zinc-500" />
          </div>

          {showGuildSummaryAll ? (
            <div className="mt-3 space-y-2">
              {guildSummaryCards.map((c) => (
                <div key={c.g} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-600 dark:text-zinc-300">{guildLabel(c.g)}</span>
                    <span className="font-medium">{c.val}</span>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-900 overflow-hidden">
                    <div className="h-2 rounded-full bg-zinc-900 dark:bg-zinc-100" style={barWidth(c.pct)} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
              แสดงรายกิลด์เฉพาะเมื่อเลือกแท็บ “ทั้งหมด” (admin)
            </div>
          )}
        </Card>
      </div>

      {/* Mid row */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base font-semibold">Top: ลาวอบ่อย (รวมทุกเดือน)</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">นับเป็น “จำนวนวันเสาร์” ต่อสมาชิก</div>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {topWarMembers.length ? (
              topWarMembers.map((x) => (
                <div key={x.memberId} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{x.name}</div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">{guildLabel(x.guild)}</div>
                  </div>
                  <div className="shrink-0 text-sm font-semibold">{x.cnt}</div>
                </div>
              ))
            ) : (
              <div className="text-sm text-zinc-500 dark:text-zinc-400">ยังไม่มีข้อมูลลาวอ</div>
            )}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base font-semibold">Top: ลาวอบ่อย (เดือนนี้)</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">{currentMonthLabel} · ถ้าเกิน 2 วันจะถูกมาร์ค</div>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {topWarThisMonthMembers.length ? (
              topWarThisMonthMembers.map((x) => {
                const isHot = x.cnt > 2;
                return (
                  <div
                    key={x.memberId}
                    className={
                      "flex items-center justify-between gap-3 rounded-xl border px-3 py-2 " +
                      (isHot
                        ? "border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/20"
                        : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950")
                    }
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{x.name}</div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">{guildLabel(x.guild)}</div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {isHot ? <Badge variant="danger">เกิน 2</Badge> : null}
                      <span className="text-sm font-semibold">{x.cnt}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-sm text-zinc-500 dark:text-zinc-400">ยังไม่มีข้อมูลลาวอเดือนนี้</div>
            )}
          </div>
        </Card>
      </div>

      {/* Recent */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-base font-semibold">Recent Leave Requests</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">ล่าสุด 10 รายการ </div>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[900px] w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500 dark:text-zinc-400">
                <th className="py-2 pr-3">วันที่</th>
                <th className="py-2 pr-3">เวลา</th>
                <th className="py-2 pr-3">ประเภท</th>
                <th className="py-2 pr-3">ชื่อ</th>
                <th className="py-2 pr-3">กิลด์</th>
                <th className="py-2 pr-3">เหตุผล</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {recentRows.map((r) => (
                <tr key={String(r.id)} className={rowBg(r.kind)}>
                  <td className="py-2 pr-3 font-medium">{r.date}</td>
                  <td className="py-2 pr-3">{r.kind === "war" ? `${fmtWarTime(r.time)} น.` : r.timeDisplay}</td>
                  <td className="py-2 pr-3">
                    <Badge variant={badgeVariant(r.kind)}>{r.label}</Badge>
                  </td>
                  <td className="py-2 pr-3">{r.name}</td>
                  <td className="py-2 pr-3">{guildLabel(r.guild)}</td>
                  <td className="py-2 pr-3 text-zinc-600 dark:text-zinc-300">{r.reason || "-"}</td>
                </tr>
              ))}
              {recentRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-zinc-500 dark:text-zinc-400">
                    ไม่มีข้อมูล
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
      </div>
    </div>
  );
}
