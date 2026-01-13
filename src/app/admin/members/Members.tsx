"use client";

import React, { useEffect, useMemo, useState } from "react";
import { RefreshCw, Pencil, X, Info } from "lucide-react";

import type { DbClass, DbLeave, DbMember, GuildNo } from "@/type/db";
import { classService } from "@/services/classService";
import { memberService } from "@/services/memberService";
import { leaveService } from "@/services/leaveService";
import { Badge, Button, Card, Input, Modal, Select } from "@/app/components/UI";
import LeaveRequestButton, { type LeaveCreateRow } from "@/app/components/LeaveRequestButton";

type GuildTab = "all" | GuildNo;
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

function computeWarLabel(war20: boolean, war2030: boolean) {
  if (war20 && war2030) return "ลาทั้งหมด";
  if (war20) return "ลาวอ 20.00 น.";
  if (war2030) return "ลาวอ 20.30 น.";
  return "ลาวอ";
}

/** ===== Admin Detail Modal Types ===== */
type UltimateSkillDetail = { id: number; name: string; ultimate_skill_url: string | null };

type EquipmentCreateDetail = { id: number; name: string; image_url: string | null; type: number };

type SkillStoneDetail = {
  id: number;
  equipment_create_id: number;
  color: string | null;
  created_at: string | null;
  equipment_create: EquipmentCreateDetail | null;
};

type EquipmentSetDetail = {
  id: number;
  element: any; // jsonb
  image: string | null;
  image_2: string | null;
  created_at: string | null;
  update_date: string | null;
};

type MemberDetailRes =
  | {
      ok: true;
      member: any;
      ultimate_skills: UltimateSkillDetail[];
      equipment_sets: EquipmentSetDetail[];
      skill_stones: SkillStoneDetail[];
    }
  | { ok: false; error?: string };

function equipTypeLabel(t: number) {
  if (t === 1) return "อาวุธ";
  if (t === 2) return "เสื้อ";
  if (t === 3) return "รองเท้า";
  if (t === 4) return "สร้อย";
  return `Type ${t}`;
}

function colorLabel(c: string | null) {
  const s = String(c ?? "").trim().toLowerCase();
  if (!s) return "-";
  if (s === "red" || s === "แดง") return "แดง";
  if (s === "purple" || s === "ม่วง") return "ม่วง";
  if (s === "gold" || s === "ทอง") return "ทอง";
  return c ?? "-";
}

function elementLabel(k: string) {
  if (k === "gold") return "ทอง";
  if (k === "wood") return "ไม้";
  if (k === "water") return "น้ำ";
  if (k === "fire") return "ไฟ";
  if (k === "earth") return "ดิน";
  return k;
}

function shortUrl(url: string, max = 44) {
  const u = String(url ?? "");
  if (!u) return "";
  if (u.length <= max) return u;
  // keep start+end for readability
  const head = u.slice(0, Math.max(0, max - 12));
  const tail = u.slice(-11);
  return `${head}…${tail}`;
}

const ELEMENT_THEME: Record<string, { bg: string; text: string; subText: string }> = {
  // เพิ่มความชัดของตัวอักษร: ใช้สีพื้นเข้มขึ้น + ตัวอักษรหนาขึ้น + drop-shadow ในกรณีตัวอักษรสีขาว
  fire: { bg: "bg-red-600", text: "text-white drop-shadow-sm", subText: "text-white drop-shadow-sm" },
  gold: { bg: "bg-yellow-300", text: "text-zinc-900", subText: "text-zinc-900" },
  wood: { bg: "bg-green-700", text: "text-white drop-shadow-sm", subText: "text-white drop-shadow-sm" },
  water: { bg: "bg-sky-600", text: "text-white drop-shadow-sm", subText: "text-white drop-shadow-sm" },
  earth: { bg: "bg-amber-900", text: "text-white drop-shadow-sm", subText: "text-white drop-shadow-sm" },
};

function elementTheme(k: string) {
  return (
    ELEMENT_THEME[k] ?? {
      bg: "bg-zinc-100 dark:bg-zinc-900",
      text: "text-zinc-900 dark:text-zinc-100",
      subText: "text-zinc-600 dark:text-zinc-300",
    }
  );
}


export default function Members({
  members,
  leaves,
  isLoading,
  onReload,
  lockedGuild = null,
  canViewAllGuilds = false,
}: Props) {
  // บางโปรเจกต์ Modal component อาจไม่ได้ประกาศ prop สำหรับ size/className ใน typings
  // เราจึง cast เป็น any เพื่อให้สามารถส่ง className เพื่อขยาย modal ได้โดยไม่ชน TypeScript
  const ModalAny = Modal as any;

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

  // ✅ Admin detail modal
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailMember, setDetailMember] = useState<DbMember | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailErr, setDetailErr] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    ultimate: UltimateSkillDetail[];
    equipSets: EquipmentSetDetail[];
    stones: SkillStoneDetail[];
  } | null>(null);


  // ✅ image preview (click thumbnail to view large)
  const [imgPreview, setImgPreview] = useState<{ url: string; title?: string } | null>(null);

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
      .filter((m) => {
        if (tab === "all") return canViewAllGuilds;
        return m.guild === tab;
      })
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

  async function openDetail(m: DbMember) {
    setIsDetailOpen(true);
    setDetailMember(m);
    setDetail(null);
    setDetailErr(null);
    setDetailLoading(true);

    try {
      const res = await fetch(`/api/admin/members/${m.id}/detail`, { cache: "no-store" });
      const j = (await res.json()) as MemberDetailRes;
      if (!res.ok || !j.ok) throw new Error((j as any)?.error || "load_detail_failed");

      setDetail({
        ultimate: Array.isArray(j.ultimate_skills) ? j.ultimate_skills : [],
        equipSets: Array.isArray(j.equipment_sets) ? j.equipment_sets : [],
        stones: Array.isArray(j.skill_stones) ? j.skill_stones : [],
      });
    } catch (e: any) {
      setDetailErr(String(e?.message ?? e));
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

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

  const stonesByType = useMemo(() => {
    const map = new Map<number, SkillStoneDetail[]>();
    const rows = detail?.stones ?? [];
    for (const r of rows) {
      const t = Number(r.equipment_create?.type ?? 0);
      const arr = map.get(t) ?? [];
      arr.push(r);
      map.set(t, arr);
    }
    for (const [t, arr] of map.entries()) {
      arr.sort((a, b) => (a.equipment_create_id ?? 0) - (b.equipment_create_id ?? 0));
      map.set(t, arr);
    }
    return map;
  }, [detail]);

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 md:px-6 space-y-6">
      <Card noPadding className="sticky top-4 z-10">
        <div className="p-4 bg-white/70 dark:bg-zinc-950/50 backdrop-blur rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex gap-2 flex-wrap">
              {lockedGuild ? (
                <TabButton value={lockedGuild} label={lockedGuild === 1 ? "Inferno-1" : lockedGuild === 2 ? "Inferno-2" : "Inferno-3"} />
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
              <Input placeholder="ค้นหา: ชื่อ " value={query} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)} />
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
              <Select value={specialFilter} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSpecialFilter(e.target.value as SpecialFilter)}>
                <option value="all">ศิษย์เอก: ทั้งหมด</option>
                <option value="special">เฉพาะศิษย์เอก</option>
                <option value="normal">ไม่ใช่ศิษย์เอก</option>
              </Select>
            </div>

            <div className="lg:col-span-2">
              <Select value={leaveTypeFilter} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setLeaveTypeFilter(e.target.value as LeaveTypeFilter)}>
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
        <div className="text-sm text-zinc-500 dark:text-zinc-400">{isLoading ? "กำลังโหลด..." : `แสดง ${visibleMembers.length} สมาชิก`}</div>
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
                        {className} • Guild {m.guild}
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">Update: {formatBkkDateTime((m as any).update_date)}</div>
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

                {/* ✅ เดิมเป็น POWER -> เปลี่ยนเป็นปุ่มดูข้อมูล */}
                <div className="mt-4">
                  <Button variant="outline" className="w-full" onClick={() => void openDetail(m)}>
                    <Info className="w-4 h-4" />
                    ดูข้อมูล
                  </Button>
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

          <Select value={form.class_id} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm((s) => ({ ...s, class_id: e.target.value }))}>
            <option value="0">ยังไม่เลือกอาชีพ</option>
            {classList
              .filter((c) => c.id !== 0)
              .map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
          </Select>

          <Input type="number" placeholder="Power" value={form.power} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((s) => ({ ...s, power: e.target.value }))} />

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

      {/* ✅ Detail modal */}
      <ModalAny
        open={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setDetailMember(null);
          setDetail(null);
          setDetailErr(null);
          setDetailLoading(false);
        }}
        title={`ข้อมูลสมาชิก${detailMember ? `: ${detailMember.name}` : ""}`}
        className="w-[95vw] max-w-[1100px]"
      >
        <div className="flex flex-col max-h-[80vh]">
          {/* scrollable body */}
          <div className="flex-1 overflow-y-auto pr-2 space-y-4">
            {detailErr ? <div className="text-sm text-rose-600">Error: {detailErr}</div> : null}
            {detailLoading ? (
              <div className="text-sm text-zinc-500">Loading...</div>
            ) : !detail ? (
              <div className="text-sm text-zinc-500">ไม่มีข้อมูล</div>
            ) : (
              <>
                {/* 1) Internal Power */}
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3">
                  <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">กำลังภายใน</div>
                  {detail.equipSets.length === 0 ? (
                    <div className="mt-2 text-sm text-zinc-500">ยังไม่มีเซ็ต</div>
                  ) : (
                    <div className="mt-2 space-y-3">
                      {detail.equipSets.map((set, idx) => {
                        const el = typeof set.element === "object" && set.element ? set.element : {};
                        const keys = ["gold", "wood", "water", "fire", "earth"];
                        return (
                          <div key={set.id} className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3">
                            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">เซ็ต {idx + 1}</div>
                            <div className="mt-0.5 text-xs text-zinc-500">
                              อัปเดตล่าสุด: <span className="font-semibold text-zinc-700 dark:text-zinc-200">{formatBkkDateTime((set as any).update_date ?? set.created_at)}</span>
                            </div>

                            <div className="mt-2 grid grid-cols-1 md:grid-cols-[120px_120px_1fr] gap-3 items-start">
                              <div>
                                <div className="text-xs text-zinc-500 mb-1">รูป 1</div>
                                <div className="h-24 w-24 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/40">
                                  {set.image ? (
                                    <button
                                      type="button"
                                      className="h-full w-full cursor-zoom-in"
                                      onClick={() => setImgPreview({ url: set.image!, title: `กำลังภายใน เซ็ต ${idx + 1} รูป 1` })}
                                    >
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img src={set.image} alt="img1" className="h-full w-full object-cover" />
                                    </button>
                                  ) : (
                                    <div className="h-full w-full flex items-center justify-center text-xs text-zinc-500">No</div>
                                  )}
                                </div>
                              </div>

                              <div>
                                <div className="text-xs text-zinc-500 mb-1">รูป 2</div>
                                <div className="h-24 w-24 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/40">
                                  {set.image_2 ? (
                                    <button
                                      type="button"
                                      className="h-full w-full cursor-zoom-in"
                                      onClick={() => setImgPreview({ url: set.image_2!, title: `กำลังภายใน เซ็ต ${idx + 1} รูป 2` })}
                                    >
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img src={set.image_2} alt="img2" className="h-full w-full object-cover" />
                                    </button>
                                  ) : (
                                    <div className="h-full w-full flex items-center justify-center text-xs text-zinc-500">No</div>
                                  )}
                                </div>
                              </div>

                              <div className="min-w-0">
                                <div className="grid grid-cols-2 gap-2">
                                  {keys.map((k) => {
                                    const th = elementTheme(k);
                                    return (
                                      <div
                                        key={k}
                                        className={`rounded-xl p-2 ${th.bg} ring-2 ring-black/15 dark:ring-white/20`}
                                      >
                                        <div className={`text-sm font-extrabold tracking-wide ${th.subText}`}>{elementLabel(k)}</div>
                                        <div className={`text-lg font-extrabold ${th.text}`}>
                                          {Number((el as any)[k] ?? 0)}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 2) Ultimate */}
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3">
                  <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Ultimate</div>
                  {detail.ultimate.length === 0 ? (
                    <div className="mt-2 text-sm text-zinc-500">ยังไม่เลือก</div>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {detail.ultimate.map((u) => (
                        <div key={u.id} className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            {u.ultimate_skill_url ? (
                              <button
                                type="button"
                                className="cursor-zoom-in"
                                onClick={() => setImgPreview({ url: u.ultimate_skill_url!, title: u.name })}
                                aria-label="ดูรูปใหญ่"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={u.ultimate_skill_url}
                                  alt={u.name}
                                  className="w-10 h-10 rounded-lg object-cover border border-zinc-200 dark:border-zinc-800"
                                  loading="lazy"
                                />
                              </button>
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800" />
                            )}

                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{u.name}</div>
</div>
                          </div>
</div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3) Skill Stones */}
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3">
                  <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">หินสกิล</div>

                  {[1, 2, 3, 4].map((t) => {
                    const list = stonesByType.get(t) ?? [];
                    return (
                      <div key={t} className="mt-3">
                        <div className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                          {equipTypeLabel(t)} <span className="text-zinc-400">({list.length})</span>
                        </div>

                        {list.length === 0 ? (
                          <div className="mt-2 text-sm text-zinc-500">ยังไม่มี</div>
                        ) : (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {list.map((s) => {
                              const ec = s.equipment_create;
                              return (
                                <div
                                  key={s.id}
                                  className="flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/40 px-2 py-2"
                                >
                                  {ec?.image_url ? (
                                    <button
                                      type="button"
                                      className="cursor-zoom-in"
                                      onClick={() =>
                                        setImgPreview({
                                          url: ec.image_url!,
                                          title: ec.name ?? "หินสกิล",
                                        })
                                      }
                                    >
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={ec.image_url}
                                        alt={ec.name}
                                        className="w-9 h-9 rounded-lg object-cover border border-zinc-200 dark:border-zinc-800"
                                        loading="lazy"
                                      />
                                    </button>
                                  ) : (
                                    <div className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800" />
                                  )}

                                  <div className="min-w-0">
                                    <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate max-w-[420px]">
                                      {ec?.name ?? "หินสกิล"}
                                    </div>
                                    <div className="text-xs text-zinc-500">
                                      สี: <span className="font-semibold">{colorLabel(s.color)}</span>
                                    </div>
</div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* sticky-ish footer */}
          <div className="pt-3 mt-3 border-t border-zinc-200 dark:border-zinc-800">
            <Button variant="secondary" className="w-full" onClick={() => setIsDetailOpen(false)}>
              ปิด
            </Button>
          </div>
        </div>
      </ModalAny>
      {/* ✅ Image preview modal */}
      <ModalAny
        open={!!imgPreview}
        onClose={() => setImgPreview(null)}
        title={imgPreview?.title ?? "ดูรูปใหญ่"}
        // ✅ ให้รูปใหญ่ขึ้นแบบเต็มจอ (โดยเฉพาะกรณีเปิดจาก 'กำลังภายใน เซ็ต X รูป Y')
        className="w-[100vw] max-w-none"
      >
        <div className="h-[92vh] overflow-auto">
{imgPreview?.url ? (
            <div className="rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imgPreview.url} alt={imgPreview.title ?? "preview"} className="w-full max-h-[86vh] h-auto object-contain" />
            </div>
          ) : (
            <div className="text-sm text-zinc-500">ไม่มีรูป</div>
          )}

          <div className="pt-3">
            <Button variant="secondary" className="w-full" onClick={() => setImgPreview(null)}>
              ปิด
            </Button>
          </div>
        </div>
      </ModalAny>

    </div>
  );
}