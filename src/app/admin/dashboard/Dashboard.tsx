"use client";

// src/app/dashboard/Dashboard.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CalendarClock,
  RefreshCw,
  Users,
  AlertTriangle,
  ListChecks,
  Flame,
  ShieldAlert,
  TrendingUp,
  Clock,
  ChevronRight,
  Swords,
} from "lucide-react";

import type { DbLeave, DbMember, GuildNo } from "@/type/db";
import { Badge, Button, Card } from "@/app/components/UI";

type GuildTab = "all" | GuildNo;

const BKK_TZ = "Asia/Bangkok";

const bkkDateFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: BKK_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
function bkkDateOf(date: Date) {
  return bkkDateFmt.format(date);
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

function guildColor(g: number) {
  if (g === 1) return { bg: "bg-red-500", light: "bg-red-50 dark:bg-red-950/30", text: "text-red-600 dark:text-red-400", border: "border-red-200 dark:border-red-900/50" };
  if (g === 2) return { bg: "bg-orange-500", light: "bg-orange-50 dark:bg-orange-950/30", text: "text-orange-600 dark:text-orange-400", border: "border-orange-200 dark:border-orange-900/50" };
  if (g === 3) return { bg: "bg-amber-500", light: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-600 dark:text-amber-400", border: "border-amber-200 dark:border-amber-900/50" };
  return { bg: "bg-zinc-500", light: "bg-zinc-50 dark:bg-zinc-900", text: "text-zinc-600 dark:text-zinc-400", border: "border-zinc-200 dark:border-zinc-800" };
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

function fmtDisplayDate(dateStr: string) {
  // YYYY-MM-DD → DD/MM/YY
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y?.slice(2)}`;
}

const thMonthYearFmt = new Intl.DateTimeFormat("th-TH", {
  timeZone: BKK_TZ,
  month: "short",
  year: "numeric",
});
function monthKeyOf(dateStr: string) {
  return dateStr.slice(0, 7);
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
  date: string;
  time: string;
  kind: "war" | "errand" | "unknown";
  label: string;
  timeDisplay: string;
  reason: string;
  updateDate: string | null;
};

function barWidth(pct: number) {
  return { width: `${Math.max(0, Math.min(100, pct)).toFixed(0)}%` };
}

const GUILDS = [1, 2, 3];

export default function Dashboard({
  members,
  leaves,
  isLoading,
  onReload,
  lockedGuild = null,
  canViewAllGuilds = false,
}: Props) {
  const [tab, setTab] = useState<GuildTab>(() => (lockedGuild ? lockedGuild : "all"));
  const [reloading, setReloading] = useState(false);

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
    return rows;
  }, [members, tab]);

  const filteredMemberIds = useMemo(() => new Set(filteredMembers.map((m) => m.id)), [filteredMembers]);

  // Active member counts per guild
  const memberCountByGuild = useMemo(() => {
    const m = new Map<number, number>();
    for (const mem of members) {
      if (String((mem as any).status ?? "").toLowerCase() !== "active") continue;
      const g = Number((mem as any).guild ?? 0);
      m.set(g, (m.get(g) ?? 0) + 1);
    }
    return m;
  }, [members]);

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
    out.sort((a, b) => (a.date === b.date ? (a.time < b.time ? 1 : -1) : a.date < b.date ? 1 : -1));
    return out;
  }, [leaves, filteredMemberIds, memberById]);

  const currentMonthKey = useMemo(() => monthKeyOf(todayBkk), [todayBkk]);
  const currentMonthLabel = useMemo(() => thMonthYearLabelFromKey(currentMonthKey), [currentMonthKey]);

  // Today errand
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

  // Next Saturday war
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
      bucket.total += 1;
      byGuild.set(rec.guild, bucket);
    }

    return { totalMembers: memberTimes.size, byGuild };
  }, [rows, nextSatBkk]);

  // War by month
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

  const warThisMonthByGuild = useMemo(() => {
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

  const warThisMonthTotal = useMemo(() => {
    return GUILDS.reduce((acc, g) => acc + (warThisMonthByGuild.get(g) ?? 0), 0);
  }, [warThisMonthByGuild]);

  const topWarMembers = useMemo(() => {
    const totals = new Map<number, number>();
    for (const [, byMember] of warByMonth.entries()) {
      for (const [memberId, dates] of byMember.entries()) {
        totals.set(memberId, (totals.get(memberId) ?? 0) + dates.size);
      }
    }
    return Array.from(totals.entries())
      .map(([memberId, cnt]) => {
        const mem = memberById.get(memberId);
        return { memberId, name: String(mem?.name ?? `Member #${memberId}`), guild: Number((mem as any)?.guild ?? 0), cnt };
      })
      .sort((a, b) => (b.cnt - a.cnt) || a.name.localeCompare(b.name))
      .slice(0, 10);
  }, [warByMonth, memberById]);

  const topWarThisMonthMembers = useMemo(() => {
    const byMember = warByMonth.get(currentMonthKey);
    if (!byMember) return [] as Array<{ memberId: number; name: string; guild: number; cnt: number }>;
    return Array.from(byMember.entries())
      .map(([memberId, dates]) => {
        const mem = memberById.get(memberId);
        return { memberId, name: String(mem?.name ?? `Member #${memberId}`), guild: Number((mem as any)?.guild ?? 0), cnt: dates.size };
      })
      .sort((a, b) => (b.cnt - a.cnt) || a.name.localeCompare(b.name))
      .slice(0, 10);
  }, [warByMonth, currentMonthKey, memberById]);

  const recentRows = useMemo(() => {
    const ts = (s: string) => { const t = new Date(s).getTime(); return Number.isFinite(t) ? t : 0; };
    const fallback = (r: LeaveRow) => `${r.date}T${r.time || "00:00"}:00+07:00`;
    return [...rows]
      .sort((a, b) => ts(b.updateDate ?? fallback(b)) - ts(a.updateDate ?? fallback(a)))
      .slice(0, 10);
  }, [rows]);

  const guildTabs: Array<{ value: GuildTab; label: string }> = useMemo(() => {
    const base: Array<{ value: GuildTab; label: string }> = [{ value: "all", label: "ทั้งหมด" }];
    base.push({ value: 1 as GuildNo, label: "Inferno-1" });
    base.push({ value: 2 as GuildNo, label: "Inferno-2" });
    base.push({ value: 3 as GuildNo, label: "Inferno-3" });
    if (!canViewAllGuilds) {
      if (lockedGuild) return base.filter((x) => x.value === lockedGuild || x.value === "all");
      return base.filter((x) => x.value === "all");
    }
    return base;
  }, [canViewAllGuilds, lockedGuild]);

  const showGuildSummary = tab === "all" && canViewAllGuilds;
  const activeGuilds = tab === "all" ? GUILDS : [Number(tab)];

  const maxWarMonth = useMemo(() => Math.max(...GUILDS.map((g) => warThisMonthByGuild.get(g) ?? 0), 1), [warThisMonthByGuild]);

  async function handleReload() {
    setReloading(true);
    try { await onReload(); } finally { setReloading(false); }
  }

  // Total active members shown
  const totalActiveShown = useMemo(() => filteredMembers.length, [filteredMembers]);

  return (
    <div className="min-h-screen">
      {/* ── Hero Header ─────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl mb-6 bg-gradient-to-br from-red-600 via-red-700 to-rose-900 shadow-lg shadow-red-900/20">
        {/* Decorative background elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-8 -right-8 w-48 h-48 rounded-full bg-white" />
          <div className="absolute -bottom-12 -left-6 w-64 h-64 rounded-full bg-white" />
        </div>

        <div className="relative px-6 py-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur ring-1 ring-white/20">
              <Flame className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Inferno Dashboard</h1>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-red-100/80">
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> วันนี้: {fmtDisplayDate(todayBkk)}
                </span>
                <span className="hidden md:inline text-red-100/40">·</span>
                <span className="flex items-center gap-1">
                  <Swords className="h-3.5 w-3.5" /> สงครามถัดไป: {fmtDisplayDate(nextSatBkk)}
                </span>
                <span className="hidden md:inline text-red-100/40">·</span>
                <span className="flex items-center gap-1">
                  <BarChart3 className="h-3.5 w-3.5" /> {currentMonthLabel}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Guild tabs */}
            <div className="flex items-center gap-1.5 rounded-xl bg-white/10 p-1 backdrop-blur ring-1 ring-white/15">
              {guildTabs.map((t) => (
                <button
                  key={String(t.value)}
                  type="button"
                  onClick={() => setTab(t.value)}
                  className={[
                    "rounded-lg px-3 py-1.5 text-sm font-medium transition-all",
                    tab === t.value
                      ? "bg-white text-red-700 shadow-sm"
                      : "text-white/80 hover:text-white hover:bg-white/10",
                  ].join(" ")}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleReload}
              disabled={isLoading || reloading}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20 text-white hover:bg-white/20 transition-colors disabled:opacity-50"
              title="รีโหลดข้อมูล"
            >
              <RefreshCw className={["h-4 w-4", (isLoading || reloading) ? "animate-spin" : ""].join(" ")} />
            </button>
          </div>
        </div>
      </div>

      {/* Loading overlay */}
      {isLoading && (
        <div className="flex items-center justify-center py-4 mb-4 rounded-xl bg-zinc-100 dark:bg-zinc-900/50 text-sm text-zinc-500 gap-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          กำลังโหลดข้อมูล...
        </div>
      )}

      <div className="space-y-6">
        {/* ── Row 1: KPI strip ───────────────────────── */}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {/* Active Members */}
          <div className="col-span-1 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 flex items-start gap-4 shadow-sm">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/40">
              <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">สมาชิก Active</div>
              <div className="mt-0.5 text-2xl font-bold text-zinc-900 dark:text-zinc-100">{totalActiveShown}</div>
              {showGuildSummary && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {GUILDS.map((g) => {
                    const c = guildColor(g);
                    return (
                      <span key={g} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${c.light} ${c.text}`}>
                        {guildLabel(g)}: {memberCountByGuild.get(g) ?? 0}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Today errand */}
          <div className="col-span-1 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 flex items-start gap-4 shadow-sm">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/40">
              <CalendarClock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">ลากิจวันนี้</div>
              <div className="mt-0.5 text-2xl font-bold text-zinc-900 dark:text-zinc-100">{todayErrandByGuild.totalMembers}</div>
              <div className="mt-1.5 space-y-1">
                {activeGuilds.map((g) => {
                  const cnt = todayErrandByGuild.byGuild.get(g) ?? 0;
                  const c = guildColor(g);
                  return cnt > 0 ? (
                    <div key={g} className="flex items-center justify-between text-xs">
                      <span className={`${c.text} font-medium`}>{guildLabel(g)}</span>
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">{cnt} คน</span>
                    </div>
                  ) : null;
                })}
                {activeGuilds.every((g) => (todayErrandByGuild.byGuild.get(g) ?? 0) === 0) && (
                  <div className="text-xs text-zinc-400">ไม่มีการลากิจ</div>
                )}
              </div>
            </div>
          </div>

          {/* Next Saturday war */}
          <div className="col-span-1 rounded-2xl border border-red-200 dark:border-red-900/50 bg-white dark:bg-zinc-950 p-5 flex items-start gap-4 shadow-sm">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 dark:bg-red-950/40">
              <ShieldAlert className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">ลาวอ ({fmtDisplayDate(nextSatBkk)})</div>
              <div className="mt-0.5 text-2xl font-bold text-red-600 dark:text-red-400">{nextSatWarByGuild.totalMembers}</div>
              <div className="mt-1.5 space-y-1">
                {activeGuilds.map((g) => {
                  const c = nextSatWarByGuild.byGuild.get(g) ?? { t2000: 0, t2030: 0, both: 0, total: 0 };
                  if (c.total === 0) return null;
                  const gc = guildColor(g);
                  return (
                    <div key={g} className="text-xs">
                      <span className={`${gc.text} font-medium`}>{guildLabel(g)}: </span>
                      <span className="text-zinc-600 dark:text-zinc-400">{c.total} คน</span>
                      <span className="text-zinc-400 dark:text-zinc-600 ml-1">
                        ({c.t2000 > 0 ? `20.00×${c.t2000}` : ""}{c.t2000 > 0 && c.t2030 > 0 ? " " : ""}{c.t2030 > 0 ? `20.30×${c.t2030}` : ""}{c.both > 0 ? ` ทั้งคู่×${c.both}` : ""})
                      </span>
                    </div>
                  );
                })}
                {activeGuilds.every((g) => (nextSatWarByGuild.byGuild.get(g)?.total ?? 0) === 0) && (
                  <div className="text-xs text-zinc-400">ยังไม่มีการลา</div>
                )}
              </div>
            </div>
          </div>

          {/* This month war */}
          <div className="col-span-1 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 flex items-start gap-4 shadow-sm">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/40">
              <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">ลาวอเดือนนี้</div>
              <div className="mt-0.5 text-2xl font-bold text-zinc-900 dark:text-zinc-100">{warThisMonthTotal}</div>
              {showGuildSummary && (
                <div className="mt-2 space-y-1.5">
                  {GUILDS.map((g) => {
                    const val = warThisMonthByGuild.get(g) ?? 0;
                    const pct = maxWarMonth > 0 ? (val / maxWarMonth) * 100 : 0;
                    const c = guildColor(g);
                    return (
                      <div key={g} className="space-y-0.5">
                        <div className="flex justify-between text-xs">
                          <span className={`${c.text} font-medium`}>{guildLabel(g)}</span>
                          <span className="text-zinc-600 dark:text-zinc-400">{val}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
                          <div className={`h-1.5 rounded-full ${c.bg} transition-all`} style={barWidth(pct)} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {!showGuildSummary && (
                <div className="mt-1 text-xs text-zinc-400">{currentMonthLabel}</div>
              )}
            </div>
          </div>
        </div>

        {/* ── Row 2: War leave detail cards (next Sat) ── */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Swords className="h-4 w-4 text-red-500" />
            <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">รายละเอียดลาวอ · เสาร์ {fmtDisplayDate(nextSatBkk)}</span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {activeGuilds.map((g) => {
              const c = nextSatWarByGuild.byGuild.get(g) ?? { t2000: 0, t2030: 0, both: 0, total: 0 };
              const gc = guildColor(g);
              return (
                <div key={g} className={`rounded-2xl border ${gc.border} bg-white dark:bg-zinc-950 overflow-hidden shadow-sm`}>
                  {/* Guild header */}
                  <div className={`${gc.light} px-4 py-3 flex items-center justify-between`}>
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${gc.bg}`} />
                      <span className={`text-sm font-semibold ${gc.text}`}>{guildLabel(g)}</span>
                    </div>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">{c.total} คนลา</span>
                  </div>
                  {/* Slot breakdown */}
                  <div className="p-4 grid grid-cols-3 gap-2">
                    {[
                      { label: "20.00 น.", val: c.t2000 },
                      { label: "20.30 น.", val: c.t2030 },
                      { label: "ทั้งสองรอบ", val: c.both },
                    ].map((slot) => (
                      <div key={slot.label} className="flex flex-col items-center rounded-xl bg-zinc-50 dark:bg-zinc-900 py-3 gap-1">
                        <div className={`text-xl font-bold ${slot.val > 0 ? "text-red-600 dark:text-red-400" : "text-zinc-400"}`}>{slot.val}</div>
                        <div className="text-[10px] text-zinc-500 text-center leading-tight">{slot.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Row 3: Leaderboards ────────────────────── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Top war (all time) */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-900 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Flame className="h-4 w-4 text-orange-500" />
                  ลาวอบ่อยสุด (รวมทุกเดือน)
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">นับจำนวนวันเสาร์ที่ลา</div>
              </div>
            </div>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-900">
              {topWarMembers.length > 0 ? topWarMembers.map((x, i) => {
                const gc = guildColor(x.guild);
                const maxVal = topWarMembers[0]?.cnt ?? 1;
                const pct = maxVal > 0 ? (x.cnt / maxVal) * 100 : 0;
                return (
                  <div key={x.memberId} className="flex items-center gap-3 px-5 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                    <span className={`w-6 text-center text-xs font-bold ${i < 3 ? "text-red-500" : "text-zinc-400"}`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{x.name}</span>
                        <span className="shrink-0 text-sm font-bold text-zinc-700 dark:text-zinc-300">{x.cnt}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-900 overflow-hidden">
                          <div className={`h-1.5 rounded-full ${gc.bg}`} style={barWidth(pct)} />
                        </div>
                        <span className={`text-[10px] font-medium ${gc.text}`}>{guildLabel(x.guild)}</span>
                      </div>
                    </div>
                  </div>
                );
              }) : (
                <div className="px-5 py-8 text-center text-sm text-zinc-400">ยังไม่มีข้อมูล</div>
              )}
            </div>
          </div>

          {/* Top war (this month) */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-900 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  ลาวอบ่อยสุด ({currentMonthLabel})
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">เกิน 2 วันจะมาร์คแดง</div>
              </div>
            </div>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-900">
              {topWarThisMonthMembers.length > 0 ? topWarThisMonthMembers.map((x, i) => {
                const isHot = x.cnt > 2;
                const gc = guildColor(x.guild);
                const maxVal = topWarThisMonthMembers[0]?.cnt ?? 1;
                const pct = maxVal > 0 ? (x.cnt / maxVal) * 100 : 0;
                return (
                  <div
                    key={x.memberId}
                    className={[
                      "flex items-center gap-3 px-5 py-2.5 transition-colors",
                      isHot
                        ? "bg-red-50/50 dark:bg-red-950/10 hover:bg-red-50 dark:hover:bg-red-950/20"
                        : "hover:bg-zinc-50 dark:hover:bg-zinc-900/50",
                    ].join(" ")}
                  >
                    <span className={`w-6 text-center text-xs font-bold ${i < 3 ? "text-red-500" : "text-zinc-400"}`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{x.name}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isHot && (
                            <span className="inline-flex items-center rounded-full bg-red-100 dark:bg-red-950/40 px-1.5 py-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400">
                              ⚠ เกิน 2
                            </span>
                          )}
                          <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">{x.cnt}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-900 overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full ${isHot ? "bg-red-500" : gc.bg}`}
                            style={barWidth(pct)}
                          />
                        </div>
                        <span className={`text-[10px] font-medium ${gc.text}`}>{guildLabel(x.guild)}</span>
                      </div>
                    </div>
                  </div>
                );
              }) : (
                <div className="px-5 py-8 text-center text-sm text-zinc-400">ยังไม่มีข้อมูลเดือนนี้</div>
              )}
            </div>
          </div>
        </div>

        {/* ── Row 4: Recent leave requests ──────────── */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-900 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-zinc-500" />
                Recent Leave Requests
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">10 รายการล่าสุด</div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-900">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">วันที่</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">เวลา</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">ประเภท</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">ชื่อ</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">กิลด์</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">เหตุผล</th>
                </tr>
              </thead>
              <tbody>
                {recentRows.length > 0 ? recentRows.map((r) => {
                  const gc = guildColor(r.guild);
                  const isWar = r.kind === "war";
                  return (
                    <tr
                      key={String(r.id)}
                      className={[
                        "border-b border-zinc-50 dark:border-zinc-900/50 last:border-0 transition-colors",
                        isWar
                          ? "hover:bg-red-50/50 dark:hover:bg-red-950/10"
                          : "hover:bg-zinc-50 dark:hover:bg-zinc-900/30",
                      ].join(" ")}
                    >
                      <td className="px-5 py-3 font-mono text-xs font-medium text-zinc-700 dark:text-zinc-300">{fmtDisplayDate(r.date)}</td>
                      <td className="px-3 py-3 text-xs text-zinc-600 dark:text-zinc-400">
                        {isWar ? <span className="font-medium text-red-600 dark:text-red-400">{fmtWarTime(r.time)} น.</span> : r.timeDisplay}
                      </td>
                      <td className="px-3 py-3">
                        <span className={[
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
                          isWar
                            ? "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300"
                            : r.kind === "errand"
                            ? "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300"
                            : "bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400",
                        ].join(" ")}>
                          {r.label}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-medium text-zinc-900 dark:text-zinc-100">{r.name}</td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${gc.text}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${gc.bg}`} />
                          {guildLabel(r.guild)}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-zinc-500 dark:text-zinc-400 max-w-[180px] truncate">{r.reason || "—"}</td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-sm text-zinc-400">
                      ไม่มีข้อมูล
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
