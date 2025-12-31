"use client";

import React, { useEffect, useMemo, useState } from "react";
import { RefreshCw, CalendarDays, Filter, ChevronLeft, ChevronRight } from "lucide-react";

import type { DbLeave, DbMember, GuildNo } from "@/type/db";
import { Badge, Button, Card, Input, Select } from "@/app/components/UI";

type GuildTab = "all" | GuildNo;
type LeaveTypeFilter = "all" | "war" | "errand" | "unknown";
type DateScope = "all" | "today" | "nextSat" | "range";

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

type Props = {
  members: DbMember[];
  leaves: DbLeave[];
  isLoading: boolean;
  onReload: () => Promise<void>;
  lockedGuild?: GuildNo | null;
  canViewAllGuilds?: boolean;
};

type LeaveView = {
  id: number | string;
  memberId: number;
  memberName: string;
  memberGuild: number;
  date: string; // YYYY-MM-DD (BKK)
  time: string; // HH:mm (BKK) (ใช้สำหรับ sort)
  timeDisplay: string; // แสดงผลใน UI
  kind: "war" | "errand" | "unknown";
  label: string;
  reason: string;
  updateDate: string | null;
};

function classifyLeave(date: string, time: string) {
  if (isSaturday(date)) return { kind: "war" as const, label: "ลาวอ" };
  if (time === "00:00") return { kind: "errand" as const, label: "ลากิจ" };
  return { kind: "unknown" as const, label: "ลา" };
}


function fmtWarTime(hhmm: string) {
  if (hhmm === "20:00") return "20.00 น.";
  if (hhmm === "20:30") return "20.30 น.";
  // fallback: 18:05 -> 18.05 น.
  return `${hhmm.replace(":", ".")} น.`;
}
function warTimeDisplay(times: string[]) {
  const uniq = Array.from(new Set(times.filter(Boolean)));
  uniq.sort();
  if (uniq.length === 0) return "-";
  if (uniq.length === 1) return fmtWarTime(uniq[0]);
  return uniq.map(fmtWarTime).join(" / ");
}

const thDayMonthFmt = new Intl.DateTimeFormat("th-TH", {
  timeZone: BKK_TZ,
  day: "2-digit",
  month: "short",
});

const thMonthYearFmt = new Intl.DateTimeFormat("th-TH", {
  timeZone: BKK_TZ,
  month: "short",
  year: "numeric",
});

const thFullDateFmt = new Intl.DateTimeFormat("th-TH", {
  timeZone: BKK_TZ,
  weekday: "short",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function monthKeyOf(dateStr: string) {
  // dateStr = YYYY-MM-DD
  return dateStr.slice(0, 7); // YYYY-MM
}

function monthLabelOf(monthKey: string) {
  // monthKey = YYYY-MM
  return thMonthYearFmt.format(new Date(`${monthKey}-01T12:00:00+07:00`));
}
function bkkDateObj(dateStr: string) {
  // ใช้ 12:00 เพื่อลด edge case เรื่อง timezone/ข้ามวัน
  return new Date(`${dateStr}T12:00:00+07:00`);
}
function addDays(d: Date, days: number) {
  return new Date(d.getTime() + days * 86400000);
}
function weekStartDate(dateStr: string) {
  const d = bkkDateObj(dateStr);
  const dow = d.getUTCDay(); // 0=Sun ... 6=Sat (สอดคล้องกับ +07:00)
  // Week start = Monday
  const diffToMon = (dow + 6) % 7;
  const start = addDays(d, -diffToMon);
  return bkkDateOf(start);
}
function weekHeaderLabel(weekStartStr: string) {
  const start = bkkDateObj(weekStartStr);
  const end = addDays(start, 6);
  return `\tสัปดาห์ ${thDayMonthFmt.format(start)} - ${thDayMonthFmt.format(end)}`;
}

export default function Leaves({
  members,
  leaves,
  isLoading,
  onReload,
  lockedGuild = null,
  canViewAllGuilds = false,
}: Props) {
  const [tab, setTab] = useState<GuildTab>(() => (lockedGuild ? lockedGuild : "all"));
  const [query, setQuery] = useState("");
  const [leaveTypeFilter, setLeaveTypeFilter] = useState<LeaveTypeFilter>("all");
  const [dateScope, setDateScope] = useState<DateScope>("nextSat");
  const [rangeStart, setRangeStart] = useState<string>(() => bkkDateOf(new Date()));
  const [rangeEnd, setRangeEnd] = useState<string>(() => bkkDateOf(new Date()));

  // ✅ วันนี้ (เวลาไทย) — อัปเดตทุกนาทีให้ไม่ค้างข้ามวัน
  const [todayBkk, setTodayBkk] = useState(() => bkkDateOf(new Date()));
  useEffect(() => {
    const t = setInterval(() => setTodayBkk(bkkDateOf(new Date())), 60_000);
    return () => clearInterval(t);
  }, []);
  const nextSaturdayBkk = useMemo(() => nextSaturdayFrom(todayBkk), [todayBkk]);

  useEffect(() => {
    if (lockedGuild) setTab(lockedGuild);
  }, [lockedGuild]);

  const memberById = useMemo(() => {
    const m = new Map<number, DbMember>();
    for (const row of members) m.set(row.id, row);
    return m;
  }, [members]);

  const items = useMemo<LeaveView[]>(() => {
    // 1) สร้างรายการดิบก่อน
    const raw: LeaveView[] = [];

    for (const l of leaves) {
      if (isCancelLeaveStatus((l as any).status)) continue;

      const dt = String((l as any).date_time ?? "");
      if (!dt) continue;

      const { date, time } = bkkDateTimeParts(dt);
      if (!date) continue;

      const mem = memberById.get((l as any).member_id);
      const memberName = mem?.name ?? `Member #${(l as any).member_id}`;
      const memberGuild = Number(mem?.guild ?? 0);

      const cls = classifyLeave(date, time);

      raw.push({
        id: (l as any).id ?? `${(l as any).member_id}-${dt}`,
        memberId: Number((l as any).member_id),
        memberName,
        memberGuild,
        date,
        time,
        timeDisplay: cls.kind === "errand" ? "-" : time, // ✅ ลากิจให้แสดงเวลาเป็น "-"
        kind: cls.kind,
        label: cls.label,
        reason: String((l as any).reason ?? "").trim(),
        updateDate: (l as any).update_date ? String((l as any).update_date) : null,
      });
    }

    // 2) รวมรายการ "ลาวอ" ของวันเดียวกันให้เหลือ 1 แถว/คน
    //    (ถ้าเดิมมี 20:00 และ 20:30 จะโชว์ในคอลัมน์เวลาแทน)
    const mergedWar = new Map<string, { base: LeaveView; times: Set<string>; reasons: Set<string>; updateDate: string | null }>();
    const out: LeaveView[] = [];

    const maxIso = (a: string | null, b: string | null) => {
      if (!a) return b;
      if (!b) return a;
      return a >= b ? a : b;
    };

    for (const it of raw) {
      if (it.kind !== "war") {
        out.push(it);
        continue;
      }

      const key = `${it.memberId}-${it.date}`;
      const ex = mergedWar.get(key);
      if (!ex) {
        mergedWar.set(key, {
          base: { ...it, id: `${it.memberId}-${it.date}-war`, label: "ลาวอ" },
          times: new Set([it.time]),
          reasons: new Set(it.reason ? [it.reason] : []),
          updateDate: it.updateDate,
        });
      } else {
        ex.times.add(it.time);
        if (it.reason) ex.reasons.add(it.reason);
        ex.updateDate = maxIso(ex.updateDate, it.updateDate);
      }
    }

    for (const v of mergedWar.values()) {
      const times = Array.from(v.times);
      const display = warTimeDisplay(times);
      const sortTime = times.includes("20:30") ? "20:30" : times.includes("20:00") ? "20:00" : (times[0] ?? "00:00");

      out.push({
        ...v.base,
        time: sortTime,
        timeDisplay: display, // ✅ วันเสาร์ไม่ต้องแสดง 2 row แล้ว แสดงเป็น 20.00 / 20.30 หรือทั้งสองรอบ
        reason: Array.from(v.reasons).join("; "),
        updateDate: v.updateDate,
      });
    }

    // 3) ล่าสุดก่อน
    out.sort((a, b) => (a.date === b.date ? b.time.localeCompare(a.time) : b.date.localeCompare(a.date)));
    return out;
  }, [leaves, memberById]);

  const warAllByMemberId = useMemo(() => {
    const m = new Map<number, number>();
    for (const it of items) {
      if (it.kind !== "war") continue;
      m.set(it.memberId, (m.get(it.memberId) ?? 0) + 1);
    }
    return m;
  }, [items]);

  const warByMemberMonth = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) {
      if (it.kind !== "war") continue;
      const mk = monthKeyOf(it.date);
      const key = `${it.memberId}-${mk}`;
      m.set(key, (m.get(key) ?? 0) + 1);
    }
    return m;
  }, [items]);

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();

    return items
      .filter((it) => {
        // ✅ เลือก "ทั้งหมด" = แสดงทั้งหมด (admin) / หรือ fallback เป็นกิลด์ของตัวเอง (non-admin)
        if (tab === "all") {
          if (canViewAllGuilds) return true;
          if (lockedGuild) return it.memberGuild === lockedGuild;
          return false;
        }
        return it.memberGuild === tab;
      })
      .filter((it) => {
        if (!q) return true;
        return `${it.memberName} ${it.reason} ${it.label}`.toLowerCase().includes(q);
      })
      .filter((it) => {
        if (leaveTypeFilter === "all") return true;
        return it.kind === leaveTypeFilter;
      })
      .filter((it) => {
        if (dateScope === "all") return true;
        if (dateScope === "today") return it.date === todayBkk;
        if (dateScope === "nextSat") return it.date === nextSaturdayBkk;
        if (dateScope === "range") {
          // inclusive range: start <= date <= end
          return (!rangeStart || it.date >= rangeStart) && (!rangeEnd || it.date <= rangeEnd);
        }
        return true;
      });
  }, [items, tab, canViewAllGuilds, query, leaveTypeFilter, dateScope, todayBkk, nextSaturdayBkk, rangeStart, rangeEnd]);

  type DayGroup = { key: string; title: string; rows: LeaveView[] };
  type WeekGroup = { key: string; title: string; rows: LeaveView[]; days: DayGroup[] };
  type MonthGroup = { key: string; label: string; weeks: WeekGroup[]; rows: LeaveView[] };

  const groupedByMonth = useMemo<MonthGroup[]>(() => {
    const months: MonthGroup[] = [];

    for (const it of visibleItems) {
      const mk = monthKeyOf(it.date);
      const mLabel = monthLabelOf(mk);

      const lastMonth = months[months.length - 1];
      const monthGroup = !lastMonth || lastMonth.key !== mk
        ? (() => {
            const g: MonthGroup = { key: mk, label: mLabel, weeks: [], rows: [] };
            months.push(g);
            return g;
          })()
        : lastMonth;

      monthGroup.rows.push(it);

      const wkStart = weekStartDate(it.date);
      const wkTitle = weekHeaderLabel(wkStart);
      const lastWeek = monthGroup.weeks[monthGroup.weeks.length - 1];
      if (!lastWeek || lastWeek.key !== wkStart) {
        monthGroup.weeks.push({
          key: wkStart,
          title: wkTitle,
          rows: [it],
          days: [
            {
              key: it.date,
              title: thFullDateFmt.format(bkkDateObj(it.date)),
              rows: [it],
            },
          ],
        });
      } else {
        lastWeek.rows.push(it);

        const lastDay = lastWeek.days[lastWeek.days.length - 1];
        if (!lastDay || lastDay.key !== it.date) {
          lastWeek.days.push({
            key: it.date,
            title: thFullDateFmt.format(bkkDateObj(it.date)),
            rows: [it],
          });
        } else {
          lastDay.rows.push(it);
        }
      }
    }

    return months;
  }, [visibleItems]);

  const [monthsPerPage, setMonthsPerPage] = useState<number>(1);
  const [pageIndex, setPageIndex] = useState<number>(0);

  useEffect(() => {
    // เปลี่ยน filter แล้วกลับไปหน้าแรก เพื่อไม่ให้ group หลุด
    setPageIndex(0);
  }, [tab, query, leaveTypeFilter, dateScope, rangeStart, rangeEnd]);

  const totalPages = useMemo(() => {
    if (!groupedByMonth.length) return 1;
    return Math.max(1, Math.ceil(groupedByMonth.length / Math.max(1, monthsPerPage)));
  }, [groupedByMonth.length, monthsPerPage]);

  useEffect(() => {
    if (pageIndex > totalPages - 1) setPageIndex(0);
  }, [pageIndex, totalPages]);

  const pageGroups = useMemo(() => {
    const size = Math.max(1, monthsPerPage);
    const start = pageIndex * size;
    return groupedByMonth.slice(start, start + size);
  }, [groupedByMonth, monthsPerPage, pageIndex]);

  const summary = useMemo(() => {
    const byGuild: Record<string, { total: number; war: number; errand: number; unknown: number }> = {};
    const guildKeys = [1, 2, 3];

    const init = () => ({ total: 0, war: 0, errand: 0, unknown: 0 });
    for (const g of guildKeys) byGuild[String(g)] = init();
    byGuild["all"] = init();

    for (const it of visibleItems) {
      const gKey = String(it.memberGuild);
      if (!byGuild[gKey]) byGuild[gKey] = init();

      byGuild[gKey].total += 1;
      byGuild["all"].total += 1;

      if (it.kind === "war") {
        byGuild[gKey].war += 1;
        byGuild["all"].war += 1;
      } else if (it.kind === "errand") {
        byGuild[gKey].errand += 1;
        byGuild["all"].errand += 1;
      } else {
        byGuild[gKey].unknown += 1;
        byGuild["all"].unknown += 1;
      }
    }

    return byGuild;
  }, [visibleItems]);

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

  const kindBadge = (kind: LeaveView["kind"]) => {
    if (kind === "war") return <Badge variant="danger">ลาวอ</Badge>;
    if (kind === "errand")
      return (
        <Badge
          variant="warning"
          className="bg-yellow-200 text-zinc-900 border-yellow-300 dark:bg-yellow-400 dark:text-zinc-950 dark:border-yellow-500"
        >
          ลากิจ
        </Badge>
      );
    return <Badge variant="outline">อื่นๆ</Badge>;
  };

  const rowBg = (kind: LeaveView["kind"]) => {
    if (kind === "errand") return "bg-yellow-50 dark:bg-yellow-950/25";
    if (kind === "war") return "bg-red-50 dark:bg-red-950/25";
    return "bg-white dark:bg-zinc-950";
  };

  const scopeLabel =
    dateScope === "all"
      ? "ทั้งหมด"
      : dateScope === "today"
      ? `วันนี้: ${todayBkk}`
      : dateScope === "nextSat"
      ? `เสาร์ที่จะถึง: ${nextSaturdayBkk}`
      : `ช่วงวันที่: ${rangeStart || "-"} ถึง ${rangeEnd || "-"}`;

  return (
    <div className="space-y-6">
      <Card noPadding className="sticky top-4 z-10">
        <div className="p-4 bg-white/70 dark:bg-zinc-950/50 backdrop-blur rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex gap-2 flex-wrap">
              {lockedGuild ? (
                <TabButton value={lockedGuild} label={guildLabel(lockedGuild)} />
              ) : (
                <>
                  {canViewAllGuilds ? <TabButton value="all" label="ทั้งหมด" /> : null}
                  <TabButton value={1} label="Inferno-1" />
                  <TabButton value={2} label="Inferno-2" />
                  <TabButton value={3} label="Inferno-3" />
                </>
              )}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-3">
            <div className="lg:col-span-5">
              <Input
                placeholder="ค้นหา: ชื่อ / เหตุผล / ประเภทลา"
                value={query}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
              />
            </div>

            <div className="lg:col-span-3">
              <Select
                value={dateScope}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setDateScope(e.target.value as DateScope)}
              >
                <option value="nextSat">เสาร์ที่จะถึง (วอ)</option>
                <option value="today">วันนี้ (ลากิจ)</option>
                <option value="all">ทุกวัน</option>
                <option value="range">เลือกช่วงวันที่</option>
              </Select>
            </div>

            <div className="lg:col-span-2">
              <Select
                value={leaveTypeFilter}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setLeaveTypeFilter(e.target.value as LeaveTypeFilter)}
              >
                <option value="all">ประเภทลา: ทั้งหมด</option>
                <option value="war">ลาวอ</option>
                <option value="errand">ลากิจ</option>
              </Select>
            </div>

            <div className="lg:col-span-2">
              <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800">
                <CalendarDays className="w-4 h-4" />
                {scopeLabel}
              </div>
            </div>
          </div>

          {dateScope === "range" ? (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs text-zinc-500 w-16">เริ่ม</label>
                <Input type="date" value={rangeStart} onChange={(e: any) => setRangeStart(e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-zinc-500 w-16">สิ้นสุด</label>
                <Input type="date" value={rangeEnd} onChange={(e: any) => setRangeEnd(e.target.value)} />
              </div>
            </div>
          ) : null}

          <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
            <Filter className="w-4 h-4" />
            คำนวณจากเวลาไทย (Asia/Bangkok) • วันนี้: {todayBkk} • เสาร์ที่จะถึง: {nextSaturdayBkk}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {tab === "all" ? (
          <Card className="p-4">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">รวม (ตามตัวกรอง)</div>
            <div className="mt-1 text-2xl font-semibold">{summary["all"]?.total ?? 0}</div>
            <div className="mt-2 flex gap-2 flex-wrap">
              <Badge variant="danger">ลาวอ: {summary["all"]?.war ?? 0}</Badge>
              <Badge
                variant="warning"
                className="bg-yellow-200 text-zinc-900 border-yellow-300 dark:bg-yellow-400 dark:text-zinc-950 dark:border-yellow-500"
              >
                ลากิจ: {summary["all"]?.errand ?? 0}
              </Badge>
            </div>
          </Card>
        ) : null}

        {(tab === "all" ? [1, 2, 3] : [tab as number]).map((g) => (
          <Card key={g} className="p-4">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">{guildLabel(g)}</div>
            <div className="mt-1 text-2xl font-semibold">{summary[String(g)]?.total ?? 0}</div>
            <div className="mt-2 flex gap-2 flex-wrap">
              <Badge variant="danger">ลาวอ: {summary[String(g)]?.war ?? 0}</Badge>
              <Badge
                variant="warning"
                className="bg-yellow-200 text-zinc-900 border-yellow-300 dark:bg-yellow-400 dark:text-zinc-950 dark:border-yellow-500"
              >
                ลากิจ: {summary[String(g)]?.errand ?? 0}
              </Badge>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm text-zinc-500 dark:text-zinc-400">
          {isLoading ? "กำลังโหลด..." : `แสดง ${visibleItems.length} รายการลา`}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-xs text-zinc-500 dark:text-zinc-400">แสดง</div>
          <Select
            value={String(monthsPerPage)}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setMonthsPerPage(Math.max(1, Number(e.target.value) || 1))}
          >
            <option value="1">1 เดือน/หน้า</option>
            <option value="2">2 เดือน/หน้า</option>
            <option value="3">3 เดือน/หน้า</option>
          </Select>

          <Button
            variant="secondary"
            onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
            disabled={pageIndex <= 0 || totalPages <= 1}
          >
            <ChevronLeft className="w-4 h-4" />
            ก่อนหน้า
          </Button>

          <div className="text-xs text-zinc-500 dark:text-zinc-400 px-2">
            หน้า {Math.min(totalPages, pageIndex + 1)}/{totalPages}
          </div>

          <Button
            variant="secondary"
            onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}
            disabled={pageIndex >= totalPages - 1 || totalPages <= 1}
          >
            ถัดไป
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {visibleItems.length === 0 ? (
        <Card className="p-6 text-sm text-zinc-500 dark:text-zinc-400">ไม่พบรายการลา</Card>
      ) : (
        <div className="space-y-6">
          {pageGroups.map((m) => (
            <Card key={m.key} noPadding className="overflow-hidden border border-zinc-200 dark:border-zinc-800">
              {/* Month header (theme-aware: ดำ/ขาว) */}
              <div className="px-4 py-3 bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <div className="text-base font-semibold">{m.label}</div>
                  <div className="text-xs opacity-90">รวม {m.rows.length} รายการ</div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-950/40 border-b border-zinc-200 dark:border-zinc-800">
                      <th className="text-left px-4 py-3 whitespace-nowrap">วันที่</th>
                      <th className="text-left px-4 py-3 whitespace-nowrap">เวลา</th>
                      <th className="text-left px-4 py-3 whitespace-nowrap">ประเภท</th>
                      <th className="text-left px-4 py-3">ชื่อ</th>
                      <th className="text-left px-4 py-3 whitespace-nowrap">กิลด์</th>
                      <th className="text-left px-4 py-3 whitespace-nowrap">
                        <div className="leading-tight">ลาวอประจำเดือน {m.label}</div>
                      </th>
                      <th className="text-left px-4 py-3 whitespace-nowrap">ลาวอทั้งหมด</th>
                      <th className="text-left px-4 py-3">เหตุผล</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {m.weeks.map((w) => (
                      <React.Fragment key={w.key}>
                        <tr>
                          <td
                            colSpan={8}
                            className="px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-950/40 border-y border-zinc-200 dark:border-zinc-800"
                          >
                            {w.title}
                          </td>
                        </tr>

                        {w.days.map((d) => (
                          <React.Fragment key={d.key}>
                            <tr>
                              <td
                                colSpan={8}
                                className="px-4 py-2 text-xs font-semibold text-zinc-800 dark:text-zinc-100 bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800"
                              >
                                <div className="flex items-center justify-between">
                                  <div>{d.title}</div>
                                  <div className="text-[11px] font-normal text-zinc-500 dark:text-zinc-400">{d.rows.length} รายการ</div>
                                </div>
                              </td>
                            </tr>

                            {d.rows.map((it) => {
                              const warThisMonth = warByMemberMonth.get(`${it.memberId}-${m.key}`) ?? 0;
                              const warAll = warAllByMemberId.get(it.memberId) ?? 0;

                              return (
                                <tr key={String(it.id)} className={rowBg(it.kind)}>
                                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-200 whitespace-nowrap">{it.date}</td>
                                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-200 whitespace-nowrap">{it.timeDisplay}</td>
                                  <td className="px-4 py-3 whitespace-nowrap">{kindBadge(it.kind)}</td>
                                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">{it.memberName}</td>
                                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-200 whitespace-nowrap">{guildLabel(it.memberGuild)}</td>
                                  <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                                    <span className="font-semibold">{warThisMonth}</span>
                                  </td>
                                  <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                                    <span className="font-semibold">{warAll}</span>
                                  </td>
                                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                                    <div className="truncate" title={it.reason || ""}>{it.reason || "-"}</div>
                                  </td>
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="text-xs text-zinc-500 dark:text-zinc-400">
        หมายเหตุ: หน้านี้ซ่อนรายการที่ status = Cancel อัตโนมัติ
      </div>
    </div>
  );
}
