"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/app/components/UI";
import { supabase } from "@/lib/supabase";

type WarTime = "20:00" | "20:30";

type MemberRow = {
  id: number;
  name: string;
  power: number;
  class_id: number | null;
  guild: number;

  party: number | null;
  party_2: number | null;

  pos_party: number | null;
  pos_party_2: number | null;

  color: string | null;

  special_text: string | null;
  remark: string | null;

  status?: "Active" | "Inactive" | "active" | "inactive" | null;
};

type DbClass = {
  id: number;
  name: string;
  icon_url: string | null;
};

// table: group (id, name, group, color, order_by, guild)
type DbGroup = {
  id: number;
  name: string;
  group: string; // "1,3,7"
  color: string | null;
  order_by: number | null;
  guild: number;
};

// table: leave (id, date_time, member_id, reason)
type LeaveRow = {
  id?: number;
  date_time: string; // timestamptz
  member_id: number;
  reason: string | null;
};

type Slot = { memberId: number | null };
type Party = { id: number; name: string; slots: Slot[] };

function createInitialParties(): Party[] {
  return Array.from({ length: 10 }, (_, i) => ({
    id: i + 1,
    name: `ปาร์ตี้ ${i + 1}`,
    slots: Array.from({ length: 6 }, () => ({ memberId: null })),
  }));
}

type DragItem =
  | { type: "ROSTER"; memberId: number }
  | { type: "SLOT"; partyId: number; index: number; memberId: number };

type DragTarget =
  | { type: "SLOT"; partyId: number; index: number }
  | { type: "ROSTER_BIN" }
  | null;

type Props = {
  forcedGuild: number | null;
  canEdit: boolean;
};

const COLOR_PALETTE: string[] = [
  "#000000",
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#84cc16",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#a855f7",
  "#ec4899",
  "#f43f5e",
  "#64748b",
];

function normalizeActiveStatus(s: MemberRow["status"]): "active" | "inactive" {
  if (!s) return "active";
  const v = String(s).toLowerCase();
  return v === "inactive" ? "inactive" : "active";
}

const REMARK_COLOR_NAME_TO_HEX: Record<string, string> = {
  black: "#000000",
  white: "#ffffff",
  red: "#ef4444",
  orange: "#f97316",
  yellow: "#eab308",
  green: "#22c55e",
  cyan: "#06b6d4",
  blue: "#3b82f6",
  purple: "#a855f7",
  pink: "#ec4899",
  gray: "#64748b",
};

function parseColoredPrefix(input: string | null | undefined): { color: string | null; text: string } {
  const raw = (input ?? "").trim();
  if (!raw) return { color: null, text: "" };

  // Accept formats:
  // 1) [#RRGGBB] text
  // 2) [red] text (limited named set)
  // 3) #RRGGBB|text   (legacy / quick typing)
  // 4) #RRGGBB text   (legacy)
  const pipe = raw.match(/^(#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}))\|\s*(.*)$/);
  if (pipe) return { color: pipe[1].toLowerCase(), text: (pipe[2] ?? "").trim() };

  const hashSpace = raw.match(/^(#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}))\s+(.*)$/);
  if (hashSpace) return { color: hashSpace[1].toLowerCase(), text: (hashSpace[2] ?? "").trim() };

  const m = raw.match(/^\[(#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6}|[a-zA-Z]+)\]\s*(.*)$/);
  if (!m) return { color: null, text: raw };

  const token = m[1];
  const rest = (m[2] ?? "").trim();

  if (token.startsWith("#")) return { color: token.toLowerCase(), text: rest };
  const hex = REMARK_COLOR_NAME_TO_HEX[token.toLowerCase()];
  if (hex) return { color: hex, text: rest };

  return { color: null, text: raw };
}

// For remark: always store with a color prefix (no "ไม่มีสี")
function buildColoredTextAlways(color: string, text: string): string {
  const t = (text ?? "").trim();
  if (!t) return "";
  return `[${color}] ${t}`;
}

function ColorDot({ value }: { value: string | null }) {
  return (
    <span
      className="inline-block h-4 w-4 rounded-full border border-zinc-200 dark:border-zinc-700"
      style={{ background: value ?? "transparent" }}
    />
  );
}

function ClassIcon({
  iconUrl,
  label,
  size = 16,
}: {
  iconUrl: string | null | undefined;
  label?: string;
  size?: number;
}) {
  const [broken, setBroken] = useState(false);

  if (!iconUrl || broken) {
    return (
      <span
        className="inline-flex items-center justify-center rounded-md border border-zinc-200 text-[10px] font-bold text-zinc-500 dark:border-zinc-800 dark:text-zinc-300"
        style={{ width: size, height: size }}
        title={label ?? "อาชีพ"}
      >
        ?
      </span>
    );
  }

  return (
    <img
      src={iconUrl}
      width={size}
      height={size}
      className="inline-block rounded-md"
      style={{ width: size, height: size }}
      alt={label ?? "class"}
      onError={() => setBroken(true)}
      title={label ?? "อาชีพ"}
      loading="lazy"
    />
  );
}

function PalettePopover({
  value,
  onPick,
  onClose,
}: {
  value: string | null;
  onPick: (c: string | null) => void;
  onClose: () => void;
}) {
  return (
    <div className="mt-2 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">เลือกสี</div>
        <button
          type="button"
          className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          onClick={onClose}
        >
          ปิด
        </button>
      </div>

      <div className="mt-2 grid grid-cols-7 gap-2">
        {COLOR_PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            className={[
              "h-6 w-6 rounded-full border",
              value === c ? "border-zinc-900 dark:border-zinc-100" : "border-zinc-200 dark:border-zinc-800",
            ].join(" ")}
            style={{ background: c }}
            onClick={() => onPick(c)}
            title={c}
          />
        ))}
        <button
          type="button"
          className="col-span-7 mt-1 rounded-lg border border-zinc-200 px-2 py-1 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900/40"
          onClick={() => onPick(null)}
        >
          ไม่ใส่สี
        </button>
      </div>
    </div>
  );
}

function IconButton({ label, onClick }: { label: string; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      type="button"
      className="rounded-md border border-zinc-200 px-2 py-1 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900/40"
      onClick={onClick}
      title={label}
    >
      {label}
    </button>
  );
}

/**
 * Note line format (persist in DB as text):
 * - if color set: "[#RRGGBB] your text"
 * - if no color:  "your text"
 */
type NoteLine = { id: string; color: string | null; text: string };

function parseNote(raw: string): NoteLine[] {
  const lines = (raw ?? "").split(/\r?\n/);
  const out: NoteLine[] = lines.map((line, idx) => {
    const m = line.match(/^\s*\[(#[0-9a-fA-F]{6})\]\s*(.*)$/);
    if (m) return { id: `L${idx}`, color: m[1], text: m[2] ?? "" };
    return { id: `L${idx}`, color: null, text: line ?? "" };
  });
  return out.length ? out : [{ id: "L0", color: null, text: "" }];
}

function serializeNote(lines: NoteLine[]): string {
  return (lines ?? [])
    .map((l) => {
      const t = (l.text ?? "").replace(/\r?\n/g, " ");
      if (!t && !l.color) return "";
      return l.color ? `[${l.color}] ${t}` : t;
    })
    .join("\n")
    .trimEnd();
}

// deep clone parties to store in ref safely
function cloneParties(ps: Party[]): Party[] {
  return (ps ?? []).map((p) => ({
    ...p,
    slots: p.slots.map((s) => ({ ...s })),
  }));
}

function parsePartyList(input: string | null | undefined): number[] {
  const raw = String(input ?? "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((x) => Number(String(x).trim()))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 10);
}

function serializePartyList(ids: number[]): string {
  const uniq = Array.from(new Set(ids.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n >= 1 && n <= 10)));
  uniq.sort((a, b) => a - b);
  return uniq.join(",");
}

export default function WarBuilderClient({ forcedGuild, canEdit }: Props) {
  const [loading, setLoading] = useState(true);

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [classes, setClasses] = useState<DbClass[]>([]);

  const [warTime, setWarTime] = useState<WarTime>("20:00");
  const [parties, setParties] = useState<Party[]>(createInitialParties());

  // groups
  const [groups, setGroups] = useState<DbGroup[]>([]);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupModalMode, setGroupModalMode] = useState<"create" | "edit">("create");
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [groupNameDraft, setGroupNameDraft] = useState("");
  const [groupColorDraft, setGroupColorDraft] = useState<string | null>("#ef4444");
  const [groupSelectedParties, setGroupSelectedParties] = useState<Set<number>>(new Set());
  const [groupSaving, setGroupSaving] = useState(false);

  // note เป็นรายบรรทัด ใส่สีได้ทีละบรรทัด
  const [noteLines, setNoteLines] = useState<NoteLine[]>([{ id: "L0", color: null, text: "" }]);
  const [paletteForLineId, setPaletteForLineId] = useState<string | null>(null);

  // multi-select for bulk color (click selection)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [openColorPalette, setOpenColorPalette] = useState(false);

  // class filter (multi-select) — empty = all
  const [classFilter, setClassFilter] = useState<Set<number>>(new Set());

  const [dragItem, setDragItem] = useState<DragItem | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<DragTarget>(null);

  // remark modal (popup)
  const [remarkOpen, setRemarkOpen] = useState(false);
  const [editingRemarkMemberId, setEditingRemarkMemberId] = useState<number | null>(null);
  const [remarkDraft, setRemarkDraft] = useState<string>("");
  const [remarkColor, setRemarkColor] = useState<string>("#000000");

  // war map modal (read-only preview)
  const [warMapOpen, setWarMapOpen] = useState(false);

  const dirtyColorsRef = useRef<Map<number, string | null>>(new Map());
  const dirtyRemarksRef = useRef<Map<number, string | null>>(new Map());
  const lastLoadKeyRef = useRef<string>("");

  /**
   * default guild จากผู้ใช้ที่ล็อกอิน (ถ้า forcedGuild เป็น null)
   */
  const [resolvedGuild, setResolvedGuild] = useState<number | null>(forcedGuild ?? null);

  useEffect(() => {
    setResolvedGuild(forcedGuild ?? null);
  }, [forcedGuild]);

  useEffect(() => {
    if (forcedGuild != null) return;

    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/me", { cache: "no-store" });
        if (!r.ok) return;
        const j = (await r.json()) as any;
        const gRaw = j?.user?.guild ?? j?.guild ?? null;
        const gNum = gRaw != null ? Number(gRaw) : null;
        if (!cancelled && gNum && !Number.isNaN(gNum)) setResolvedGuild(gNum);
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [forcedGuild]);

  /**
   * จำ layout แยกตามช่วงเวลา (20:00 / 20:30)
   * - dirty=true = user จัดทัพเอง (ยังไม่ save)
   * - dirty=false = baseline ตาม DB ล่าสุดที่โหลดมา
   *
   * เปลี่ยนกิล => เคลียร์ทิ้งทั้งหมด
   */
  const draftPartiesByTimeRef = useRef<Map<WarTime, Party[]>>(new Map());
  const draftDirtyByTimeRef = useRef<Map<WarTime, boolean>>(new Map());

  function setDraft(time: WarTime, ps: Party[], dirty: boolean) {
    draftPartiesByTimeRef.current.set(time, cloneParties(ps));
    draftDirtyByTimeRef.current.set(time, dirty);
  }

  function getDraft(time: WarTime): Party[] | null {
    const ps = draftPartiesByTimeRef.current.get(time);
    return ps ? cloneParties(ps) : null;
  }

  function commitLayout(next: Party[], dirty: boolean) {
    setParties(next);
    setDraft(warTime, next, dirty);
  }

  const guild = resolvedGuild;

  // ---------- leave helpers ----------
  const [leaveDateISO, setLeaveDateISO] = useState<string>(""); // yyyy-mm-dd local
  const [leaveByTime, setLeaveByTime] = useState<Record<WarTime, Set<number>>>({
    "20:00": new Set<number>(),
    "20:30": new Set<number>(),
  });
  const leaveReasonByMemberRef = useRef<Map<number, string | null>>(new Map());

  function upcomingSaturdayLocalDate(): Date {
    const now = new Date();
    const dow = now.getDay(); // 0=Sun..6=Sat
    const delta = (6 - dow + 7) % 7; // 0 if today is Sat
    const sat = new Date(now);
    sat.setDate(now.getDate() + delta);
    sat.setHours(0, 0, 0, 0);
    return sat;
  }

  function toLocalISODate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  }

  function isOnLeave(memberId: number, time: WarTime): boolean {
    return leaveByTime[time]?.has(memberId) ?? false;
  }

  async function loadLeavesForUpcomingSaturday(memList: MemberRow[]) {
    if (!guild) return;

    const sat = upcomingSaturdayLocalDate();
    const satISO = toLocalISODate(sat);
    setLeaveDateISO(satISO);

    // local day range -> query timestamptz by UTC ISO strings
    const startLocal = new Date(sat.getFullYear(), sat.getMonth(), sat.getDate(), 0, 0, 0, 0);
    const endLocal = new Date(startLocal);
    endLocal.setDate(endLocal.getDate() + 1);

    // leave ไม่มี guild -> filter เฉพาะ member ในกิลด์นี้
    const guildMemberIds = (memList ?? [])
      .filter((m) => Number(m.guild) === Number(guild))
      .map((m) => m.id);

    if (guildMemberIds.length === 0) {
      setLeaveByTime({ "20:00": new Set(), "20:30": new Set() });
      leaveReasonByMemberRef.current = new Map();
      return;
    }

    const { data, error } = await supabase
      .from("leave")
      .select("member_id,date_time,reason,status")
      .in("member_id", guildMemberIds)
      .eq("status","Active")
      .gte("date_time", startLocal.toISOString())
      .lt("date_time", endLocal.toISOString());

    if (error) {
      setLeaveByTime({ "20:00": new Set(), "20:30": new Set() });
      leaveReasonByMemberRef.current = new Map();
      return;
    }

    const s2000 = new Set<number>();
    const s2030 = new Set<number>();
    const reasonMap = new Map<number, string | null>();

    for (const r of (data ?? []) as LeaveRow[]) {
      const mid = Number(r.member_id);
      if (!Number.isFinite(mid) || !mid) continue;

      // date_time stored as timestamptz (UTC). Date() converts to local time (TH => +7)
      const dt = new Date(r.date_time);
      const hh = dt.getHours();
      const mm = dt.getMinutes();

      // เฉพาะรอบวอ
      if (hh === 20 && mm === 0) s2000.add(mid);
      if (hh === 20 && mm === 30) s2030.add(mid);

      reasonMap.set(mid, r.reason ?? null);
    }

    leaveReasonByMemberRef.current = reasonMap;
    setLeaveByTime({ "20:00": s2000, "20:30": s2030 });
  }

  // ---------- Pane height (Roster + Party only) ----------
const headerRef = useRef<HTMLDivElement | null>(null);
const [paneHeight, setPaneHeight] = useState<number>(620);

useEffect(() => {
  function recompute() {
    // ปรับสัดส่วนตรงนี้ได้ เช่น 0.72 = 72% ของ viewport
    const RATIO = 0.72;

    const h = Math.floor(window.innerHeight * RATIO);

    // กันเตี้ย/กันสูงเกิน (ปรับได้)
    const minH = 520;
    const maxH = Math.floor(window.innerHeight - 80);

    setPaneHeight(Math.max(minH, Math.min(maxH, h)));
  }

  recompute();
  window.addEventListener("resize", recompute);
  return () => window.removeEventListener("resize", recompute);
}, []);


  const classById = useMemo(() => new Map<number, DbClass>(classes.map((c) => [Number(c.id), c])), [classes]);

  // groups utilities
  const groupsSorted = useMemo(() => {
    const arr = [...(groups ?? [])].filter((g) => (guild ? Number(g.guild) === Number(guild) : true));
    // order_by null -> last
    arr.sort((a, b) => {
      const ao = a.order_by ?? 999999;
      const bo = b.order_by ?? 999999;
      if (ao !== bo) return ao - bo;
      return (a.id ?? 0) - (b.id ?? 0);
    });
    return arr;
  }, [groups, guild]);

  const partyToGroup = useMemo(() => {
    // Map partyId -> group (first by order)
    const m = new Map<number, DbGroup>();
    for (const g of groupsSorted) {
      for (const pid of parsePartyList(g.group)) {
        if (!m.has(pid)) m.set(pid, g);
      }
    }
    return m;
  }, [groupsSorted]);

  const groupColorByParty = useMemo(() => {
    const m = new Map<number, string | null>();
    for (let pid = 1; pid <= 10; pid++) {
      m.set(pid, partyToGroup.get(pid)?.color ?? null);
    }
    return m;
  }, [partyToGroup]);

  // build parties from members + time (DB baseline)
  function buildPartiesFromMembers(sourceMembers: MemberRow[], sourceTime: WarTime): Party[] {
    const next = createInitialParties();
    const sorted = [...(sourceMembers ?? [])].sort((a, b) => (b.power ?? 0) - (a.power ?? 0));

    for (const m of sorted) {
      if (guild && m.guild !== guild) continue;
      if (normalizeActiveStatus(m.status) !== "active") continue;

      const pid = sourceTime === "20:00" ? m.party : m.party_2;
      const pos = sourceTime === "20:00" ? m.pos_party : m.pos_party_2;

      if (!pid || pid < 1 || pid > 10) continue;
      const p = next[pid - 1];

      if (pos && pos >= 1 && pos <= 6) {
        const idx = pos - 1;
        if (!p.slots[idx].memberId) {
          p.slots[idx].memberId = m.id;
          continue;
        }
      }

      const empty = p.slots.findIndex((s) => s.memberId === null);
      if (empty !== -1) p.slots[empty].memberId = m.id;
    }

    return next;
  }

  async function loadGroups() {
    if (!guild) return;

    // NOTE: table name is "group"
    const { data, error } = await supabase
      .from("group")
      .select("id,name,group,color,order_by,guild")
      .eq("guild", guild)
      .order("order_by", { ascending: true })
      .order("id", { ascending: true });

    if (!error) setGroups(((data ?? []) as any[]) as DbGroup[]);
  }

  async function load() {
    if (!guild) return;

    setLoading(true);
    try {
      const memRes = await fetch(`/api/admin/members?guild=${guild}`, { cache: "no-store" });
      if (!memRes.ok) {
        const txt = await memRes.text().catch(() => "");
        console.error("load members failed", { status: memRes.status, txt });
        alert(`โหลดสมาชิกไม่สำเร็จ (status ${memRes.status})`);
        return;
      }
      const memJson = (await memRes.json()) as { members?: MemberRow[] };
      const memList = Array.isArray(memJson.members) ? memJson.members : [];
      setMembers(memList);
// load leave for upcoming saturday
      await loadLeavesForUpcomingSaturday(memList);

      // baseline ของทั้ง 2 ช่วงเวลา "เฉพาะอันที่ยังไม่ dirty"
      (["20:00", "20:30"] as WarTime[]).forEach((t) => {
        const isDirty = !!draftDirtyByTimeRef.current.get(t);
        if (isDirty) return;
        const baseline = buildPartiesFromMembers(memList, t);
        setDraft(t, baseline, false);
      });

      const currentDirty = !!draftDirtyByTimeRef.current.get(warTime);
      if (!currentDirty) {
        const current = getDraft(warTime) ?? buildPartiesFromMembers(memList, warTime);
        setDraft(warTime, current, false);
        setParties(current);
      }

      const noteRes = await fetch(`/api/admin/note?guild=${guild}`, { cache: "no-store" });
      if (!noteRes.ok) {
        const txt = await noteRes.text().catch(() => "");
        console.error("load note failed", { status: noteRes.status, txt });
        alert(`โหลด NOTE ไม่สำเร็จ (status ${noteRes.status})`);
        return;
      }
      const noteJson = (await noteRes.json()) as { ok?: boolean; data?: { note?: string } };
      setNoteLines(parseNote(noteJson?.data?.note ?? ""));
const { data, error } = await supabase.from("class").select("id,name,icon_url").order("id");
      if (!error) {
        setClasses(
          ((data ?? []) as any[]).map((x) => ({
            id: Number(x.id),
            name: String(x.name ?? ""),
            icon_url: x.icon_url ?? null,
          })),
        );
      }

      await loadGroups();

      dirtyColorsRef.current = new Map();
      dirtyRemarksRef.current = new Map();

      setSelectedIds(new Set());
      setOpenColorPalette(false);
      setPaletteForLineId(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!guild) return;

    const key = String(guild);
    if (lastLoadKeyRef.current === key) return;
    lastLoadKeyRef.current = key;

    // เปลี่ยนกิล => ไม่ต้องจำ layout เก่า + กลุ่มเก่า
    draftPartiesByTimeRef.current = new Map();
    draftDirtyByTimeRef.current = new Map();
    setGroups([]);

    void load();

    setDragItem(null);
    setDragOverTarget(null);
    setOpenColorPalette(false);
    setSelectedIds(new Set());
    setPaletteForLineId(null);
    setClassFilter(new Set());

    setRemarkOpen(false);
    setEditingRemarkMemberId(null);
    setRemarkDraft("");
    setRemarkColor("#000000");

    setGroupModalOpen(false);
    setGroupSaving(false);
    setEditingGroupId(null);
    setGroupSelectedParties(new Set());
    setGroupNameDraft("");
    setGroupColorDraft("#ef4444");
  }, [guild]);

  // เปลี่ยน warTime => ดึง draft ของช่วงเวลานั้น
  useEffect(() => {
    if (!guild) return;

    const draft = getDraft(warTime);
    if (draft) {
      setParties(draft);
      return;
    }

    const baseline = buildPartiesFromMembers(members, warTime);
    setDraft(warTime, baseline, false);
    setParties(baseline);
  }, [warTime, guild, members]);

  const assignedIds = useMemo(() => {
    const s = new Set<number>();
    parties.forEach((p) => p.slots.forEach((sl) => sl.memberId && s.add(sl.memberId)));
    return s;
  }, [parties]);

  const activeInGuild = useMemo(() => {
    return members
      .filter((m) => (guild ? m.guild === guild : true))
      .filter((m) => normalizeActiveStatus(m.status) === "active");
  }, [members, guild]);

  const classCounts = useMemo(() => {
    const m = new Map<number, number>();
    for (const mem of activeInGuild) {
      const cid = typeof mem.class_id === "number" ? Number(mem.class_id) : null;
      if (cid === null) continue;
      if (cid === 0) continue;
      m.set(cid, (m.get(cid) ?? 0) + 1);
    }
    return m;
  }, [activeInGuild]);

  const classOptions = useMemo(() => {
    const base = (classes ?? [])
      .map((c) => {
        const id = Number(c.id);
        return {
          id,
          name: c.name ?? `Class ${id}`,
          icon_url: c.icon_url ?? null,
          count: classCounts.get(id) ?? 0,
        };
      })
      .filter((x) => x.id !== 0);

    const known = new Set(base.map((x) => x.id));
    for (const [cid, count] of classCounts.entries()) {
      if (cid === 0) continue;
      if (known.has(cid)) continue;
      const master = classById.get(cid);
      base.push({
        id: cid,
        name: master?.name ?? `Class ${cid}`,
        icon_url: master?.icon_url ?? null,
        count,
      });
    }

    return base.sort((a, b) => a.id - b.id);
  }, [classes, classCounts, classById]);

  const roster = useMemo(() => {
    let base = [...activeInGuild].sort((a, b) => (b.power ?? 0) - (a.power ?? 0));
    if (classFilter.size > 0) {
      base = base.filter((m) => {
        const cid = typeof m.class_id === "number" ? Number(m.class_id) : null;
        if (cid === null) return false;
        if (cid === 0) return false;
        return classFilter.has(cid);
      });
    }
    return base;
  }, [activeInGuild, classFilter]);

  // ---------- Grouped party view ----------
  const partiesById = useMemo(() => new Map<number, Party>(parties.map((p) => [p.id, p])), [parties]);

  const groupedPartySections = useMemo(() => {
    // sections: [{type:'group', g, parties: Party[]}, {type:'ungrouped', parties: Party[]}]
    const used = new Set<number>();
    const sections: Array<
      | { type: "group"; g: DbGroup; parties: Party[] }
      | { type: "ungrouped"; parties: Party[] }
    > = [];

    for (const g of groupsSorted) {
      const pids = parsePartyList(g.group);
      const ps = pids
        .map((pid) => partiesById.get(pid))
        .filter(Boolean) as Party[];

      // mark used
      pids.forEach((pid) => used.add(pid));

      if (ps.length > 0) sections.push({ type: "group", g, parties: ps });
    }

    const ungrouped = parties.filter((p) => !used.has(p.id));
    if (ungrouped.length > 0) sections.push({ type: "ungrouped", parties: ungrouped });

    return sections;
  }, [groupsSorted, parties, partiesById]);

  // ---------- Drag & Drop ----------
  function onDragStart(e: React.DragEvent, item: DragItem) {
    if (!canEdit) return;

    // คนลาห้ามลากไปจัดปาร์ตี้ (ทั้ง roster และ slot)
    if (item.type === "ROSTER" && isOnLeave(item.memberId, warTime)) return;
    if (item.type === "SLOT" && isOnLeave(item.memberId, warTime)) return;

    setDragItem(item);
    e.dataTransfer.effectAllowed = "move";
  }

  function onDragEnd() {
    setDragItem(null);
    setDragOverTarget(null);
  }

  function onDragOverSlot(e: React.DragEvent, partyId: number, index: number) {
    if (!canEdit) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverTarget({ type: "SLOT", partyId, index });
  }

  function onDropOnSlot(e: React.DragEvent, targetPartyId: number, targetIndex: number) {
    if (!canEdit) return;
    e.preventDefault();
    if (!dragItem) return;

    // guard เผื่อหลุดจาก UI
    if (dragItem.type === "ROSTER" && isOnLeave(dragItem.memberId, warTime)) return;
    if (dragItem.type === "SLOT" && isOnLeave(dragItem.memberId, warTime)) return;

    const next = parties.map((p) => ({ ...p, slots: p.slots.map((s) => ({ ...s })) }));
    const targetParty = next.find((p) => p.id === targetPartyId);
    if (!targetParty) return;

    const targetMemberId = targetParty.slots[targetIndex].memberId;

    if (dragItem.type === "ROSTER") {
      for (const p of next) {
        for (let i = 0; i < p.slots.length; i++) {
          if (p.slots[i].memberId === dragItem.memberId) p.slots[i].memberId = null;
        }
      }
      targetParty.slots[targetIndex].memberId = dragItem.memberId;
    }

    if (dragItem.type === "SLOT") {
      const sourceParty = next.find((p) => p.id === dragItem.partyId);
      if (!sourceParty) return;

      const sourceMemberId = sourceParty.slots[dragItem.index].memberId;
      if (!sourceMemberId) return;

      if (targetMemberId) {
        sourceParty.slots[dragItem.index].memberId = targetMemberId;
        targetParty.slots[targetIndex].memberId = sourceMemberId;
      } else {
        sourceParty.slots[dragItem.index].memberId = null;
        targetParty.slots[targetIndex].memberId = sourceMemberId;
      }
    }

    setDraft(warTime, next, true);
    setParties(next);
    setDragItem(null);
    setDragOverTarget(null);
  }

  function onDragOverRosterBin(e: React.DragEvent) {
    if (!canEdit) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverTarget({ type: "ROSTER_BIN" });
  }

  function onDropOnRosterBin(e: React.DragEvent) {
    if (!canEdit) return;
    e.preventDefault();
    if (!dragItem) return;

    if (dragItem.type !== "SLOT") return;

    // NOTE: คนลายังถอดออกได้ (ไม่ block)
    const next = parties.map((p) => ({ ...p, slots: p.slots.map((s) => ({ ...s })) }));
    const src = next.find((p) => p.id === dragItem.partyId);
    if (!src) return;
    src.slots[dragItem.index].memberId = null;

    setDraft(warTime, next, true);
    setParties(next);
    setDragItem(null);
    setDragOverTarget(null);
  }

  function removeFromSlot(partyId: number, slotIndex: number) {
    if (!canEdit) return;

    setParties((prev) => {
      const next = prev.map((p) => {
        if (p.id !== partyId) return p;
        const slots = p.slots.map((s) => ({ ...s }));
        slots[slotIndex].memberId = null;
        return { ...p, slots };
      });
      setDraft(warTime, next, true);
      return next;
    });
  }

  // ---------- Bulk color ----------
  function toggleSelect(memberId: number, disabled: boolean) {
    if (!canEdit) return;
    if (disabled) return;

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  }

  function applyColorToSelected(color: string | null) {
    if (!canEdit || !guild) return;
    const ids = Array.from(selectedIds.values());
    if (ids.length === 0) return;

    setMembers((prev) => prev.map((m) => (ids.includes(m.id) ? { ...m, color } : m)));
    for (const id of ids) dirtyColorsRef.current.set(id, color);

    setSelectedIds(new Set());
    setOpenColorPalette(false);
  }

  // ---------- Class filter ----------
  function toggleClassFilter(cid: number) {
    if (cid === 0) return;
    setClassFilter((prev) => {
      const next = new Set(prev);
      if (next.has(cid)) next.delete(cid);
      else next.add(cid);
      return next;
    });
  }

  function clearClassFilter() {
    setClassFilter(new Set());
  }

  // ---------- Remark modal ----------
  function openRemarkEditor(memberId: number) {
    if (!canEdit) return;
    const m = members.find((x) => x.id === memberId);
    const parsed = parseColoredPrefix(m?.remark ?? "");

    setEditingRemarkMemberId(memberId);
    setRemarkDraft(parsed.text ?? "");
    setRemarkColor(parsed.color ?? "#000000");
    setRemarkOpen(true);
  }

  function closeRemarkModal() {
    setRemarkOpen(false);
    setEditingRemarkMemberId(null);
    setRemarkDraft("");
    setRemarkColor("#000000");
  }

  function commitRemark(memberId: number) {
    const value = buildColoredTextAlways(remarkColor, remarkDraft);
    const normalized = value.trim() ? value.trim() : "";

    setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, remark: normalized || null } : m)));
    dirtyRemarksRef.current.set(memberId, normalized || null);

    closeRemarkModal();
  }

  // ---------- War layout actions ----------
  function restoreLastSaved() {
    if (!canEdit || !guild) return;
    const baseline = buildPartiesFromMembers(members, warTime);
    commitLayout(baseline, false);
    setSelectedIds(new Set());
    setOpenColorPalette(false);
    setDragItem(null);
    setDragOverTarget(null);
  }

  function clearAllSlots() {
    if (!canEdit) return;
    const empty = createInitialParties();
    commitLayout(empty, true);
    setSelectedIds(new Set());
    setOpenColorPalette(false);
    setDragItem(null);
    setDragOverTarget(null);
  }

  function copyFromOtherTime() {
    if (!canEdit || !guild) return;
    const sourceTime: WarTime = warTime === "20:00" ? "20:30" : "20:00";
    const srcDraft = getDraft(sourceTime) ?? buildPartiesFromMembers(members, sourceTime);
    commitLayout(srcDraft, true);
    setSelectedIds(new Set());
    setOpenColorPalette(false);
    setDragItem(null);
    setDragOverTarget(null);
  }

  // ---------- Groups actions ----------
  function openCreateGroupModal() {
    if (!canEdit || !guild) return;
    setGroupModalMode("create");
    setEditingGroupId(null);
    setGroupNameDraft("");
    setGroupColorDraft("#ef4444");
    setGroupSelectedParties(new Set());
    setGroupModalOpen(true);
  }

  function openEditGroupModal(g: DbGroup) {
    if (!canEdit || !guild) return;
    setGroupModalMode("edit");
    setEditingGroupId(g.id);
    setGroupNameDraft(g.name ?? "");
    setGroupColorDraft(g.color ?? "#ef4444");
    setGroupSelectedParties(new Set(parsePartyList(g.group)));
    setGroupModalOpen(true);
  }

  function closeGroupModal() {
    setGroupModalOpen(false);
    setGroupSaving(false);
    setEditingGroupId(null);
    setGroupSelectedParties(new Set());
    setGroupNameDraft("");
    setGroupColorDraft("#ef4444");
  }

  function isPartyLockedByOtherGroup(pid: number): boolean {
    const g = partyToGroup.get(pid);
    if (!g) return false;
    if (groupModalMode === "edit" && editingGroupId && g.id === editingGroupId) return false;
    return true;
  }

  async function saveGroupModal() {
    if (!canEdit || !guild) return;

    const name = groupNameDraft.trim();
    if (!name) {
      alert("กรุณาตั้งชื่อกลุ่ม");
      return;
    }
    const selected = Array.from(groupSelectedParties.values());
    if (selected.length === 0) {
      alert("กรุณาเลือกปาร์ตี้อย่างน้อย 1 ปาร์ตี้");
      return;
    }

    // guard: prevent overlap
    for (const pid of selected) {
      if (isPartyLockedByOtherGroup(pid)) {
        alert(`ปาร์ตี้ ${pid} ถูกจัดอยู่ในกลุ่มอื่นแล้ว`);
        return;
      }
    }

    setGroupSaving(true);
    try {
      const groupText = serializePartyList(selected);

      if (groupModalMode === "create") {
        const maxOrder = Math.max(0, ...groupsSorted.map((x) => x.order_by ?? 0));
        const order_by = maxOrder + 1;

        const { error } = await supabase.from("group").insert({
          name,
          group: groupText,
          color: groupColorDraft ?? null,
          order_by,
          guild,
        });

        if (error) {
          alert("บันทึกกลุ่มไม่สำเร็จ");
          return;
        }
      } else {
        if (!editingGroupId) return;

        const { error } = await supabase
          .from("group")
          .update({
            name,
            group: groupText,
            color: groupColorDraft ?? null,
          })
          .eq("id", editingGroupId)
          .eq("guild", guild);

        if (error) {
          alert("แก้ไขกลุ่มไม่สำเร็จ");
          return;
        }
      }

      await loadGroups();
      closeGroupModal();
    } finally {
      setGroupSaving(false);
    }
  }

  async function deleteGroup(g: DbGroup) {
    if (!canEdit || !guild) return;
    const ok = confirm(`ลบกลุ่ม "${g.name}" ?`);
    if (!ok) return;

    const { error } = await supabase.from("group").delete().eq("id", g.id).eq("guild", guild);
    if (error) {
      alert("ลบกลุ่มไม่สำเร็จ");
      return;
    }
    await loadGroups();
  }

  async function moveGroup(gid: number, dir: -1 | 1) {
    if (!canEdit || !guild) return;

    const arr = [...groupsSorted];
    const idx = arr.findIndex((x) => x.id === gid);
    if (idx < 0) return;

    const j = idx + dir;
    if (j < 0 || j >= arr.length) return;

    // swap
    const tmp = arr[idx];
    arr[idx] = arr[j];
    arr[j] = tmp;

    // persist order_by = 1..n
    const updates = arr.map((x, i) => ({ id: x.id, order_by: i + 1, guild }));
    // optimistic local
    setGroups((prev) => {
      const map = new Map<number, DbGroup>(prev.map((p) => [p.id, p]));
      return updates
        .map((u) => {
          const old = map.get(u.id);
          return old ? { ...old, order_by: u.order_by } : ({ ...(u as any), name: "", group: "", color: null } as DbGroup);
        })
        .filter((x) => x && Number(x.guild) === Number(guild));
    });

    const results = await Promise.all(
      updates.map((u) => supabase.from("group").update({ order_by: u.order_by }).eq("id", u.id).eq("guild", guild)),
    );

    const hasErr = results.some((r) => !!r.error);
    if (hasErr) {
      alert("อัปเดตลำดับกลุ่มไม่สำเร็จ");
      await loadGroups();
      return;
    }

    await loadGroups();
  }

  // ---------- Save ----------
  async function save() {
    if (!canEdit || !guild) return;

    // IMPORTANT: field mapping by warTime
    // 20:00  => member.party + member.pos_party
    // 20:30  => member.party_2 + member.pos_party_2
    // 1) assign party
    const map = new Map<number, { party: number; pos: number }>();
    parties.forEach((p) => {
      p.slots.forEach((s, idx) => {
        if (!s.memberId) return;

        // NEW: คนลาของรอบนี้ -> ไม่บันทึกลง DB (กันเผลอ)
        if (isOnLeave(s.memberId, warTime)) return;

        map.set(s.memberId, { party: p.id, pos: idx + 1 });
      });
    });

    const assignments = members
      .filter((m) => m.guild === guild)
      .map((m) => ({
        memberId: m.id,
        party: map.get(m.id)?.party ?? null,
        pos: map.get(m.id)?.pos ?? null,
      }));

    // Keep payload minimal; server decides which DB columns to update based on warTime.
    const payload = {
      guild,
      warTime,
      assignments,
    };

    const res = await fetch("/api/admin/members/assign-party", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      alert("บันทึกไม่สำเร็จ (assign party)");
      return;
    }

    // 2) note
    const noteText = serializeNote(noteLines);
    const noteRes = await fetch("/api/admin/note", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ guild, note: noteText }),
    });

    if (!noteRes.ok) {
      alert("บันทึกไม่สำเร็จ (note)");
      return;
    }
    // 3) colors
    const dirtyColors = Array.from(dirtyColorsRef.current.entries()).map(([memberId, color]) => ({
      memberId,
      color,
    }));

    if (dirtyColors.length > 0) {
      // Try "batch" format first: { guild, colors: [{memberId,color}] }
      let cRes = await fetch("/api/admin/members/set-color", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ guild, colors: dirtyColors }),
      });

      if (!cRes.ok) {
        // Fallback to legacy format: { guild, memberIds:[], color }
        const byColor = new Map<string, string[]>();
        for (const dc of dirtyColors) {
          const key = dc.color ?? "__NULL__";
          const arr = byColor.get(key) ?? [];
          arr.push(String(dc.memberId));
          byColor.set(key, arr);
        }

        for (const [key, memberIds] of byColor.entries()) {
          const color = key === "__NULL__" ? null : key;
          const r = await fetch("/api/admin/members/set-color", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ guild, memberIds, color }),
          });

          if (!r.ok) {
            console.error("set-color failed", { status: r.status });
            alert("บันทึกไม่สำเร็จ (color)");
            return;
          }
        }
      }
    }
    // 4) remarks
    const dirtyRemarks = Array.from(dirtyRemarksRef.current.entries()).map(([memberId, remark]) => ({
      memberId,
      remark,
    }));

    if (dirtyRemarks.length > 0) {
      // Try "batch" format first: { guild, remarks: [{memberId,remark}] }
      let rRes = await fetch("/api/admin/members/set-remark", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ guild, remarks: dirtyRemarks }),
      });

      if (!rRes.ok) {
        // Fallback to legacy format: { guild, memberIds:[], remark }
        for (const dr of dirtyRemarks) {
          const rr = await fetch("/api/admin/members/set-remark", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ guild, memberIds: [String(dr.memberId)], remark: dr.remark ?? null }),
          });

          if (!rr.ok) {
            console.error("set-remark failed", { status: rr.status, memberId: dr.memberId });
            alert("บันทึกไม่สำเร็จ (remark)");
            return;
          }
        }
      }
    }



    // current warTime draft is clean
    setDraft(warTime, parties, false);

    lastLoadKeyRef.current = "";
    await load();
    alert("บันทึกสำเร็จ");
  }

  const selectedCount = selectedIds.size;
  const classFilterCount = classFilter.size;

  const copyLabel = useMemo(() => {
    const from = warTime === "20:00" ? "20.30" : "20.00";
    return `คัดลอกปาร์ตี้จาก ${from}`;
  }, [warTime]);

  const header = (
    <div
      ref={headerRef}
      className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold">จัดทัพวอ</div>
          <div className="text-xs text-zinc-500">Guild: {guild ?? "-"}</div>
          {leaveDateISO ? <div className="text-xs text-zinc-400">เสาร์นี้: {leaveDateISO}</div> : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
            <button
              className={`px-3 py-1.5 rounded-md text-sm font-semibold ${
                warTime === "20:00" ? "bg-white dark:bg-zinc-950" : "text-zinc-500"
              }`}
              onClick={() => setWarTime("20:00")}
              type="button"
            >
              20.00
            </button>
            <button
              className={`px-3 py-1.5 rounded-md text-sm font-semibold ${
                warTime === "20:30" ? "bg-white dark:bg-zinc-950" : "text-zinc-500"
              }`}
              onClick={() => setWarTime("20:30")}
              type="button"
            >
              20.30
            </button>
          </div>

          <button
            type="button"
            className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900/40"
            onClick={copyFromOtherTime}
            disabled={!canEdit || !guild || loading}
            title="คัดลอก layout ของอีกช่วงเวลา (ถ้าอีกช่วงเวลามีการจัดไว้แต่ยังไม่ save จะคัดลอกอันนั้นด้วย)"
          >
            {copyLabel}
          </button>

          <button
            type="button"
            className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900/40"
            onClick={restoreLastSaved}
            disabled={!canEdit || !guild || loading}
            title="คืนค่าปาร์ตี้กลับเป็นค่าที่บันทึกไว้ล่าสุด (ของช่วงเวลาที่เลือกอยู่ตอนนี้)"
          >
            คืนค่า
          </button>

          <button
            type="button"
            className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-500 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900/40"
            onClick={clearAllSlots}
            disabled={!canEdit}
            title="ล้างปาร์ตี้ให้ว่างทั้งหมด (ยังไม่บันทึกจนกดปุ่มบันทึก)"
          >
            ล้าง
          </button>

          {/* NEW: group */}
          <button
            type="button"
            className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900/40"
            onClick={openCreateGroupModal}
            disabled={!canEdit || !guild}
            title="จัดกลุ่มปาร์ตี้ (กำหนดชื่อ/สี/ลำดับแสดงผล)"
          >
            จัดกลุ่ม
          </button>

          <button
            type="button"
            className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900/40"
            onClick={() => setWarMapOpen(true)}
            disabled={!guild || loading}
            title="แสดงผังทัพวอ (อ่านอย่างเดียว)"
          >
            แสดงผังทัพวอ
          </button>

          <Button onClick={save} disabled={!canEdit || !guild}>
            บันทึก
          </Button>
        </div>
      </div>

      {/* Note editor */}
      <div className="mt-4">
        <div className="text-xs text-zinc-500">Note (ต่อกิลด์) — ใส่สีได้ทีละบรรทัด</div>

        <div className="mt-2 space-y-2">
          {noteLines.map((l, idx) => (
            <div key={l.id} className="flex items-start gap-2">
              <div className="pt-2">
                <button
                  type="button"
                  className="h-5 w-5"
                  onClick={() => setPaletteForLineId((cur) => (cur === l.id ? null : l.id))}
                  title="เลือกสีบรรทัดนี้"
                >
                  <ColorDot value={l.color} />
                </button>
              </div>

              <div className="flex-1">
                <input
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                  value={l.text}
                  onChange={(e) =>
                    setNoteLines((prev) => prev.map((x) => (x.id === l.id ? { ...x, text: e.target.value } : x)))
                  }
                  placeholder={idx === 0 ? "#เอาของ1มา" : ""}
                  style={l.color ? { color: l.color } : undefined}
                />

                {paletteForLineId === l.id ? (
                  <PalettePopover
                    value={l.color}
                    onPick={(c) => {
                      setNoteLines((prev) => prev.map((x) => (x.id === l.id ? { ...x, color: c } : x)));
                      setPaletteForLineId(null);
                    }}
                    onClose={() => setPaletteForLineId(null)}
                  />
                ) : null}
              </div>

              <button
                type="button"
                className="mt-1 rounded-lg border border-zinc-200 px-2 py-2 text-xs font-semibold text-zinc-500 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/40"
                onClick={() => {
                  if (noteLines.length <= 1) return;
                  setNoteLines((prev) => prev.filter((x) => x.id !== l.id));
                }}
                title="ลบบรรทัด"
              >
                ลบ
              </button>
            </div>
          ))}

          <button
            type="button"
            className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900/40"
            onClick={() => setNoteLines((prev) => [...prev, { id: `L${Date.now()}`, color: null, text: "" }])}
          >
            + เพิ่มบรรทัด
          </button>
        </div>
      </div>

      {/* Bulk color panel */}
      {canEdit ? (
        <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/30">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="text-xs text-zinc-600 dark:text-zinc-300">
              เลือกสมาชิก (คลิกที่รายชื่อ/ในปาร์ตี้) เพื่อใส่สีทีละหลายคน:{" "}
              <span className="font-semibold">{selectedCount}</span> คน
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900/40"
                disabled={selectedCount === 0}
                onClick={() => setOpenColorPalette((v) => !v)}
              >
                เลือกสีให้คนที่เลือก
              </button>

              <button
                type="button"
                className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-500 hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900/40"
                disabled={selectedCount === 0}
                onClick={() => setSelectedIds(new Set())}
              >
                ล้างรายการที่เลือก
              </button>
            </div>
          </div>

          {openColorPalette ? (
            <PalettePopover value={null} onPick={applyColorToSelected} onClose={() => setOpenColorPalette(false)} />
          ) : null}
        </div>
      ) : (
        <div className="mt-3 text-xs text-amber-600">คุณไม่มีสิทธิ์แก้ไข (ต้องเป็น Admin หรือ Head)</div>
      )}

      {/* Class filter panel */}
      <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950/20">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-zinc-500">
            Filter อาชีพ (Roster):{" "}
            <span className="font-semibold text-zinc-700 dark:text-zinc-200">
              {classFilterCount === 0 ? "ทั้งหมด" : `${classFilterCount} อาชีพ`}
            </span>
          </div>

          <button
            type="button"
            className="rounded-lg border border-zinc-200 px-2 py-1 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900/40"
            onClick={clearClassFilter}
            disabled={classFilterCount === 0}
          >
            ทั้งหมด
          </button>
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          {classOptions.length === 0 ? (
            <div className="text-xs text-zinc-400">ยังไม่มีข้อมูลอาชีพ</div>
          ) : (
            classOptions.map((c) => {
              const active = classFilter.has(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  className={[
                    "flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs font-semibold",
                    active
                      ? "border-red-300 bg-red-50 text-zinc-800 dark:bg-red-950/20 dark:text-zinc-100"
                      : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/10 dark:text-zinc-300 dark:hover:bg-zinc-900/40",
                  ].join(" ")}
                  onClick={() => toggleClassFilter(c.id)}
                  aria-pressed={active}
                  title={c.name}
                >
                  <ClassIcon iconUrl={c.icon_url} label={c.name} size={18} />
                  <span className="truncate max-w-[140px]">{c.name}</span>
                  <span className="ml-1 rounded-md border border-zinc-200 px-1.5 py-0.5 text-[10px] font-bold text-zinc-500 dark:border-zinc-800 dark:text-zinc-300">
                    {c.count}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );

  const remarkModal =
    remarkOpen && editingRemarkMemberId ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">แก้ไขหมายเหตุ (remark)</div>
              <div className="mt-1 text-xs text-zinc-500">
                {members.find((m) => m.id === editingRemarkMemberId)?.name ?? ""}
              </div>
            </div>

            <button
              type="button"
              className="text-xs text-zinc-500 underline underline-offset-2"
              onClick={closeRemarkModal}
            >
              ปิด
            </button>
          </div>

          <div className="mt-3">
            <div className="text-xs text-zinc-500 mb-2">สีของ remark</div>

            <div className="flex flex-wrap gap-1.5">
              {COLOR_PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  title={c}
                  className={[
                    "h-7 w-7 rounded-md border",
                    remarkColor === c ? "border-red-300 ring-1 ring-red-300" : "border-zinc-200 dark:border-zinc-800",
                  ].join(" ")}
                  style={{ backgroundColor: c }}
                  onClick={() => setRemarkColor(c)}
                />
              ))}
            </div>

            <div className="mt-3 text-xs text-zinc-500 mb-1">ข้อความ</div>
            <textarea
              className="w-full rounded-lg border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900/40"
              rows={4}
              value={remarkDraft}
              onChange={(e) => setRemarkDraft(e.target.value)}
              placeholder="พิมพ์หมายเหตุ..."
            />

            <div className="mt-3 flex items-center justify-end gap-2">
              <Button onClick={closeRemarkModal} type="button">
                ยกเลิก
              </Button>
              <Button onClick={() => commitRemark(editingRemarkMemberId)} type="button">
                บันทึกหมายเหตุ
              </Button>
            </div>

            <div className="mt-2 text-[11px] text-zinc-500">
              รูปแบบการเก็บสี: ระบบจะบันทึกเป็น <span className="font-mono">[#RRGGBB] ข้อความ</span> ภายใน field remark
            </div>
          </div>
        </div>
      </div>
    ) : null;

  const groupModal =
    groupModalOpen ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">{groupModalMode === "create" ? "เพิ่มกลุ่มปาร์ตี้" : "แก้ไขกลุ่มปาร์ตี้"}</div>
              <div className="mt-1 text-xs text-zinc-500">
                เลือกปาร์ตี้ที่จะอยู่ในกลุ่มเดียวกัน และกำหนดสีเพื่อแสดงหัวปาร์ตี้/หัวกลุ่ม
              </div>
            </div>

            <button
              type="button"
              className="text-xs text-zinc-500 underline underline-offset-2"
              onClick={closeGroupModal}
              disabled={groupSaving}
            >
              ปิด
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[1fr_320px]">
            {/* left */}
            <div>
              <div className="text-xs text-zinc-500 mb-1">ชื่อกลุ่ม</div>
              <input
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                value={groupNameDraft}
                onChange={(e) => setGroupNameDraft(e.target.value)}
                placeholder="เช่น กลุ่ม A"
              />

              <div className="mt-4 text-xs text-zinc-500 mb-2">เลือกสีหัวกลุ่ม</div>
              <div className="flex flex-wrap gap-1.5">
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    title={c}
                    className={[
                      "h-7 w-7 rounded-md border",
                      (groupColorDraft ?? null) === c
                        ? "border-red-300 ring-1 ring-red-300"
                        : "border-zinc-200 dark:border-zinc-800",
                    ].join(" ")}
                    style={{ backgroundColor: c }}
                    onClick={() => setGroupColorDraft(c)}
                  />
                ))}
                <button
                  type="button"
                  className="ml-1 rounded-md border border-zinc-200 px-2 py-1 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900/40"
                  onClick={() => setGroupColorDraft(null)}
                >
                  ไม่ใส่สี
                </button>
              </div>

              <div className="mt-4 text-xs text-zinc-500 mb-2">เลือกปาร์ตี้เข้ากลุ่ม</div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((pid) => {
                  const locked = isPartyLockedByOtherGroup(pid);
                  const checked = groupSelectedParties.has(pid);
                  const lockInfo = partyToGroup.get(pid);

                  return (
                    <label
                      key={pid}
                      className={[
                        "flex items-center gap-2 rounded-lg border px-2 py-2 text-xs font-semibold",
                        locked && !checked
                          ? "border-zinc-200 bg-zinc-50 text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-500"
                          : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/10 dark:text-zinc-200 dark:hover:bg-zinc-900/40",
                      ].join(" ")}
                      title={locked && !checked ? `ปาร์ตี้นี้อยู่ในกลุ่ม "${lockInfo?.name ?? "-"}" แล้ว` : `ปาร์ตี้ ${pid}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={locked && !checked}
                        onChange={(e) => {
                          const on = e.target.checked;
                          setGroupSelectedParties((prev) => {
                            const next = new Set(prev);
                            if (on) next.add(pid);
                            else next.delete(pid);
                            return next;
                          });
                        }}
                      />
                      <span>ปาร์ตี้ {pid}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* right: manage order + existing groups */}
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/30">
              <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">ลำดับแสดงผลกลุ่ม</div>
              <div className="mt-1 text-[11px] text-zinc-500">
                ปรับได้จากหัวกลุ่มในหน้าปาร์ตี้ (ปุ่ม ↑ ↓) หรือดูรายการด้านล่าง
              </div>

              <div className="mt-3 space-y-2">
                {groupsSorted.length === 0 ? (
                  <div className="text-xs text-zinc-400">ยังไม่มีการจัดกลุ่ม</div>
                ) : (
                  groupsSorted.map((g, idx) => (
                    <div
                      key={g.id}
                      className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-2 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-950/30"
                    >
                      <div className="min-w-0 flex items-center gap-2">
                        <ColorDot value={g.color ?? null} />
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-zinc-700 dark:text-zinc-200">{g.name}</div>
                          <div className="truncate text-[11px] text-zinc-500">{g.group}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="rounded-md border border-zinc-200 px-2 py-1 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900/40"
                          disabled={idx === 0}
                          onClick={() => moveGroup(g.id, -1)}
                          title="เลื่อนขึ้น"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-zinc-200 px-2 py-1 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900/40"
                          disabled={idx === groupsSorted.length - 1}
                          onClick={() => moveGroup(g.id, 1)}
                          title="เลื่อนลง"
                        >
                          ↓
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
                <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">จัดการกลุ่มที่มีอยู่</div>
                <div className="mt-2 space-y-2">
                  {groupsSorted.map((g) => (
                    <div key={g.id} className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-2 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-950/30">
                      <div className="min-w-0 flex items-center gap-2">
                        <ColorDot value={g.color ?? null} />
                        <span className="truncate font-semibold text-zinc-700 dark:text-zinc-200">{g.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="rounded-md border border-zinc-200 px-2 py-1 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900/40"
                          onClick={() => openEditGroupModal(g)}
                        >
                          แก้ไข
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-zinc-200 px-2 py-1 text-[11px] font-semibold text-zinc-500 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900/40"
                          onClick={() => deleteGroup(g)}
                        >
                          ลบ
                        </button>
                      </div>
                    </div>
                  ))}
                  {groupsSorted.length === 0 ? <div className="text-xs text-zinc-400">—</div> : null}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <Button onClick={closeGroupModal} type="button" disabled={groupSaving}>
              ยกเลิก
            </Button>
            <Button onClick={saveGroupModal} type="button" disabled={groupSaving}>
              {groupModalMode === "create" ? "เพิ่มกลุ่ม" : "บันทึกการแก้ไข"}
            </Button>
          </div>

          <div className="mt-2 text-[11px] text-zinc-500">
            การเก็บค่า: <span className="font-mono">group.group</span> จะเก็บเป็นรายการปาร์ตี้ เช่น{" "}
            <span className="font-mono">1,3,7</span>
          </div>
        </div>
      </div>
    ) : null;

  const partiesForMap = useMemo(() => {
    const out: Array<{ party: Party; groupColor: string | null; groupLabel: string }> = [];
    for (const sec of groupedPartySections) {
      const label = sec.type === "group" ? (sec.g.name?.trim() || "GROUP") : null;
      for (const p of sec.parties) {
        const fallback = partyToGroup.get(p.id)?.name ?? p.name;
        out.push({
          party: p,
          groupColor: groupColorByParty.get(p.id) ?? null,
          groupLabel: label ?? fallback,
        });
      }
    }
    return out;
  }, [groupedPartySections, groupColorByParty, partyToGroup]);

  const membersById = useMemo(() => {
    const m = new Map<number, MemberRow>();
    for (const x of members) m.set(x.id, x);
    return m;
  }, [members]);

  const reserveForMap = useMemo(() => {
    const active = members
      .filter((m) => (guild ? Number(m.guild) === Number(guild) : true))
      .filter((m) => normalizeActiveStatus(m.status) === "active")
      .filter((m) => !assignedIds.has(m.id))
      .filter((m) => !isOnLeave(m.id, warTime));
    active.sort((a, b) => (b.power ?? 0) - (a.power ?? 0));
    return active;
  }, [members, guild, assignedIds, warTime, isOnLeave]);

  const noteForMap = useMemo(() => {
    return (noteLines ?? []).map((l) => ({ ...l, text: (l.text ?? "").trim() })).filter((l) => !!l.text);
  }, [noteLines]);

  const leaveCountForMap = useMemo(() => {
    return leaveByTime[warTime]?.size ?? 0;
  }, [leaveByTime, warTime]);


  const warMapModal =
    warMapOpen ? (
      <div className="fixed inset-0 z-50 overflow-hidden bg-black/50 p-4">
        <div className="mx-auto w-full max-w-[1700px] rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-200 p-4 dark:border-zinc-800">
            <div>
              <div className="text-sm font-semibold">ผังทัพวอ</div>
              <div className="mt-1 text-xs text-zinc-500">อ่านอย่างเดียว — ใช้สำหรับสรุป/แคปหน้าจอ</div>
            </div>

            <button
              type="button"
              className="text-xs text-zinc-500 underline underline-offset-2"
              onClick={() => setWarMapOpen(false)}
            >
              ปิด
            </button>
          </div>

          <div className="p-3 flex-1 min-h-0 overflow-hidden flex flex-col">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
                  วันที่: {leaveDateISO ?? "-"}
                </div>
                <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
                  รอบเวลา: {warTime === "20:00" ? "20.00 น." : "20.30 น."}
                </div>
              </div>

              <div className="text-center text-3xl font-black tracking-[0.25em] text-zinc-800 dark:text-zinc-100">
                {guild ? `INFERNO-${guild}` : "INFERNO"}
              </div>
            </div>

            <div className="mt-3 flex-1 min-h-0 grid grid-cols-1 gap-2 xl:grid-cols-[1fr_180px_200px]">
              {/* Parties */}
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {partiesForMap.map(({ party, groupColor, groupLabel }) => (
                  <WarMapPartyCard
                    key={`map-${party.id}`}
                    party={party}
                    groupColor={groupColor}
                    groupLabel={groupLabel}
                    membersById={membersById}
                    classById={classById}
                    warTime={warTime}
                    isOnLeave={isOnLeave}
                    getLeaveReason={(id) => leaveReasonByMemberRef.current.get(id) ?? null}
                  />
                ))}
              </div>

              {/* NOTE (replaces leave panel) */}
              <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40 overflow-hidden flex flex-col min-h-0">
                <div className="bg-zinc-900 px-4 py-3 text-center text-sm font-extrabold text-white">
                  NOTE [{noteForMap.length}]
                </div>
                <div className="flex-1 min-h-0 flex flex-col">
                  <div className="p-3 flex-[8] min-h-0 overflow-y-auto">
                    {noteForMap.length === 0 ? (
                      <div className="text-center text-sm text-zinc-400">ไม่มี</div>
                    ) : (
                      <div className="space-y-2">
                        {noteForMap.map((l, idx) => (
                          <div
                            key={`${l.id}-${idx}`}
                            className="text-sm font-semibold whitespace-pre-wrap break-words"
                            style={l.color ? { color: l.color } : undefined}
                          >
                            {l.text}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="h-10 shrink-0 border-t border-zinc-200 px-3 flex items-center justify-center text-xs font-semibold text-zinc-700 dark:border-zinc-800 dark:text-zinc-200 truncate">
                    คนลา: {leaveCountForMap}
                  </div>
                </div>

              </div>

              {/* Reserve */}
              <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40 overflow-hidden flex flex-col min-h-0">
                <div className="bg-zinc-900 px-4 py-3 text-center text-sm font-extrabold text-white">
                  สำรอง [{reserveForMap.length}]
                </div>
                <div className="p-3 flex-1 min-h-0 overflow-y-auto space-y-2">
                  {reserveForMap.length === 0 ? (
                    <div className="text-center text-sm text-zinc-400">ไม่มี</div>
                  ) : (
                    reserveForMap.map((m) => {
                      const cls = m.class_id ? classById.get(Number(m.class_id)) : null;
                      const nameStyle = m.color ? { color: m.color } : undefined;
	                      const pr = parseColoredPrefix(m.remark ?? "");
	                      const remarkStyle = pr.color ? { color: pr.color } : undefined;
	                      const remarkText = pr.text || "";
                      return (
                        <div
                          key={`reserve-${m.id}`}
                          className="flex items-center justify-between rounded-lg border border-zinc-100 bg-white px-2 py-1.5 dark:border-zinc-900 dark:bg-zinc-950/30"
                        >
                          <div className="min-w-0 flex items-center gap-2">
                            <ClassIcon iconUrl={cls?.icon_url} label={cls?.name ?? undefined} size={18} />
	                            <div className="min-w-0 flex-1">
	                              <div className="min-w-0 truncate text-[15px] font-bold" style={nameStyle}>
	                                {m.special_text ? `${m.special_text} ` : ""}
	                                {m.name}
	                              </div>
	                              <div className="mt-0.5 min-w-0 truncate text-[12px] font-semibold" style={remarkStyle}>
	                                {remarkText}
	                              </div>
	                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    ) : null;

  return (
    <div className="space-y-4">
      {header}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr] lg:items-start">
        {/* Roster */}
        <div
          className={[
            "rounded-xl border bg-white dark:bg-zinc-900/40 flex flex-col",
            dragOverTarget?.type === "ROSTER_BIN"
              ? "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/20"
              : "border-zinc-200 dark:border-zinc-800",
          ].join(" ")}
          style={{ height: paneHeight }}
          onDragOver={onDragOverRosterBin}
          onDrop={onDropOnRosterBin}
        >
          <div className="flex items-center justify-between border-b border-zinc-200 p-3 text-xs font-bold text-zinc-500 dark:border-zinc-800">
            <div>
              สมาชิก ({loading ? "กำลังโหลด..." : roster.length})
              {classFilter.size > 0 ? <span className="ml-2 font-normal text-[11px]">(กรอง)</span> : null}
            </div>
            <div className="text-[11px] font-normal">ลากจากปาร์ตี้มาวางเพื่อเอาออก</div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-2">
            {roster.map((m) => {
              const isAssigned = assignedIds.has(m.id);
              const leaveThisTime = isOnLeave(m.id, warTime);
              const leaveReason = leaveReasonByMemberRef.current.get(m.id) ?? null;

              const isSelected = selectedIds.has(m.id);

              const parsedRemark = parseColoredPrefix(m.remark ?? "");
              const remarkStyle = parsedRemark.color ? { color: parsedRemark.color } : undefined;

              const cls = m.class_id ? classById.get(Number(m.class_id)) : null;

              return (
                <div
                  key={m.id}
                  className={[
                    "flex items-center justify-between rounded-lg border p-2 mb-2 select-none",
                    isAssigned
                      ? "bg-zinc-50 text-zinc-300 border-zinc-100 dark:bg-zinc-950/30 dark:border-zinc-900"
                      : leaveThisTime
                        ? "border-red-200 bg-red-50/60 text-zinc-500 dark:bg-red-950/10 dark:border-red-900/50"
                        : isSelected
                          ? "border-red-300 bg-red-50 dark:bg-red-950/20"
                          : "border-transparent hover:border-zinc-200 hover:bg-zinc-50 dark:hover:border-zinc-800 dark:hover:bg-zinc-950/30",
                  ].join(" ")}
                  draggable={canEdit && !isAssigned && !leaveThisTime}
                  onDragStart={(e) => onDragStart(e, { type: "ROSTER", memberId: m.id })}
                  onDragEnd={onDragEnd}
                  onClick={() => toggleSelect(m.id, isAssigned || leaveThisTime)}
                  title={
                    leaveThisTime
                      ? leaveReason
                        ? `ลาวอ (${warTime}) • ${leaveDateISO || "เสาร์นี้"} • ${leaveReason}`
                        : `ลาวอ (${warTime}) • ${leaveDateISO || "เสาร์นี้"}`
                      : undefined
                  }
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <ColorDot value={m.color} />
                      <ClassIcon iconUrl={cls?.icon_url} label={cls?.name ?? undefined} size={16} />
                      <div className="min-w-0 flex items-center gap-2">
                        <span
                          className="min-w-0 flex-1 truncate text-sm font-semibold"
                          style={m.color ? { color: m.color } : undefined}
                        >
                          {m.special_text ? `${m.special_text} ` : ""}
                          {m.name}
                        </span>

                        {leaveThisTime ? (
                          <span className="shrink-0 rounded-md bg-red-600/15 px-2 py-0.5 text-xs font-bold text-red-400">
                            ลา
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  
                </div>
              );
            })}
          </div>
        </div>

        {/* Party Pane (grouped) */}
        <div className="min-h-0 overflow-y-auto pr-1" style={{ height: paneHeight }}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
            {groupedPartySections.map((sec, secIdx) => {
              const partyCount = sec.parties.length;
              const span = Math.min(Math.max(partyCount, 1), 4);

              const xlSpanClass =
                span === 1
                  ? "xl:col-span-1"
                  : span === 2
                    ? "xl:col-span-2"
                    : span === 3
                      ? "xl:col-span-3"
                      : "xl:col-span-4";

              // inner columns: ทำให้จำนวนคอลัมน์สัมพันธ์กับขนาดกลุ่ม เพื่อให้ 1+3 หรือ 2+2 อยู่แถวเดียวกันได้
              const innerColsClass =
                span === 1
                  ? "xl:grid-cols-1"
                  : span === 2
                    ? "xl:grid-cols-2"
                    : span === 3
                      ? "xl:grid-cols-3"
                      : "xl:grid-cols-4";

              // base responsive: ไม่บังคับให้คอลัมน์เยอะเกินในจอเล็ก
              const innerBase =
                span === 1
                  ? "grid-cols-1"
                  : span === 2
                    ? "grid-cols-1 sm:grid-cols-2"
                    : span === 3
                      ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                      : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";

              if (sec.type === "ungrouped") {
                return (
                  <div key={`ungrouped-${secIdx}`} className={["space-y-2", xlSpanClass].join(" ")}>
                    <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950/20">
                      <div className="flex items-center justify-between p-3">
                        <div className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                          ยังไม่จัดกลุ่ม
                        </div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">{partyCount} ปาร์ตี้</div>
                      </div>
                      <div className="h-px w-full bg-zinc-100 dark:bg-zinc-900" />
                    </div>

                    <div className={["grid gap-3", innerBase, innerColsClass].join(" ")}>
                      {sec.parties.map((p) => (
                        <PartyCard
                          key={p.id}
                          party={p}
                          members={members}
                          classById={classById}
                          canEdit={canEdit}
                          selectedIds={selectedIds}
                          dragItem={dragItem}
                          dragOverTarget={dragOverTarget}
                          onDragStart={onDragStart}
                          onDragEnd={onDragEnd}
                          onDropOnSlot={onDropOnSlot}
                          onOpenMemberEditor={openRemarkEditor}
                          onToggleSelect={toggleSelect}
                          onOpenRemark={openRemarkEditor}
                          onRemoveFromSlot={removeFromSlot}
                          groupColor={null}
                          warTime={warTime}
                          isOnLeave={isOnLeave}
                          getLeaveReason={(id) => leaveReasonByMemberRef.current.get(id) ?? null}
                        />
                      ))}
                    </div>
                  </div>
                );
              }

              const g = sec.g;
              const gColor = g.color ?? null;

              return (
                <div key={`group-${g.id}`} className={["space-y-2", xlSpanClass].join(" ")}>
                  <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950/20">
                    <div className="flex items-center justify-between p-3">
                      <div className="min-w-0 flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full border border-zinc-200 dark:border-zinc-800"
                          style={{ backgroundColor: gColor ?? "transparent" }}
                        />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                            {g.name}
                          </div>
                          <div className="text-xs text-zinc-500 dark:text-zinc-400">
                            ปาร์ตี้: {g.group}
                          </div>
                        </div>
                      </div>

                      {canEdit ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="rounded-md border border-zinc-200 px-2 py-1 text-xs hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900/40"
                            onClick={() => moveGroup(g.id, -1)}
                            title="เลื่อนกลุ่มขึ้น"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="rounded-md border border-zinc-200 px-2 py-1 text-xs hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900/40"
                            onClick={() => moveGroup(g.id, 1)}
                            title="เลื่อนกลุ่มลง"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            className="rounded-md border border-zinc-200 px-2 py-1 text-xs hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900/40"
                            onClick={() => openEditGroupModal(g)}
                            title="แก้ไขกลุ่ม"
                          >
                            แก้ไข
                          </button>
                        </div>
                      ) : null}
                    </div>

                    {gColor ? <div className="h-1 w-full" style={{ backgroundColor: gColor, opacity: 0.7 }} /> : null}
                  </div>

                  <div className={["grid gap-3", innerBase, innerColsClass].join(" ")}>
                    {sec.parties.map((p) => (
                      <PartyCard
                        key={p.id}
                        party={p}
                        members={members}
                        classById={classById}
                        canEdit={canEdit}
                        selectedIds={selectedIds}
                        dragItem={dragItem}
                        dragOverTarget={dragOverTarget}
                        onDragStart={onDragStart}
                        onDragEnd={onDragEnd}
                        onDropOnSlot={onDropOnSlot}
                        onOpenMemberEditor={openRemarkEditor}
                        onToggleSelect={toggleSelect}
                        onOpenRemark={openRemarkEditor}
                        onRemoveFromSlot={removeFromSlot}
                        groupColor={gColor}
                        warTime={warTime}
                        isOnLeave={isOnLeave}
                        getLeaveReason={(id) => leaveReasonByMemberRef.current.get(id) ?? null}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          </div>
        </div>
      </div>

      {remarkModal}
      {groupModal}
      {warMapModal}
    </div>
  );
}

// -------------------- WarMapPartyCard component (local) --------------------
function WarMapPartyCard(props: {
  party: Party;
  groupColor: string | null;
  groupLabel: string;
  membersById: Map<number, MemberRow>;
  classById: Map<number, DbClass>;
  warTime: WarTime;
  isOnLeave: (memberId: number, time: WarTime) => boolean;
  getLeaveReason: (memberId: number) => string | null;
}) {
  const { party: p, groupColor, groupLabel, membersById, classById, warTime, isOnLeave, getLeaveReason } = props;

  return (
    <div
      className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40 flex flex-col overflow-hidden"
      style={{ height: "clamp(360px, calc((100vh - 260px) / 2), 520px)" }}
    >
      <div
        className="px-2 py-1.5 text-center text-2xl font-black tracking-widest text-white"
        style={{ backgroundColor: groupColor ?? "#111827" }}
      >
        {groupLabel}
      </div>

      <div className="flex-1 min-h-0 p-1.5 grid grid-rows-6 gap-1.5">
        {p.slots.map((s, idx) => {
          const mem = s.memberId ? membersById.get(s.memberId) ?? null : null;
          if (!mem) {
            return (
              <div
                key={idx}
                className="h-full rounded-lg border border-zinc-100 dark:border-zinc-900 flex items-center justify-center text-[11px] text-zinc-400 font-semibold tracking-widest"
              >
                ว่าง
              </div>
            );
          }

          const cls = mem.class_id ? classById.get(Number(mem.class_id)) : null;
          const leaveThisTime = isOnLeave(mem.id, warTime);
          const leaveReason = getLeaveReason(mem.id);
          const pr = parseColoredPrefix(mem.remark ?? "");
          const remarkStyle = pr.color ? { color: pr.color } : undefined;
          const remarkText = pr.text || "";

          return (
            <div
              key={idx}
              className={[
                "h-full rounded-lg border px-3 py-2 flex items-start justify-between gap-2",
                leaveThisTime
                  ? "border-red-200 bg-red-50/60 dark:bg-red-950/10 dark:border-red-900/50"
                  : "border-zinc-100 dark:border-zinc-900",
              ].join(" ")}
              title={leaveThisTime ? (leaveReason ? `ลาวอ (${warTime}) • ${leaveReason}` : `ลาวอ (${warTime})`) : undefined}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2 min-w-0">
                  <ClassIcon iconUrl={cls?.icon_url} label={cls?.name ?? undefined} size={16} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="truncate text-[15px] font-bold" style={mem.color ? { color: mem.color } : undefined}>
                        {mem.special_text ? `${mem.special_text} ` : ""}
                        {mem.name}
                      </div>
                      {leaveThisTime ? (
                        <span className="shrink-0 rounded-md bg-red-600/15 px-2 py-0.5 text-[10px] font-bold text-red-600 dark:text-red-400">
                          ลาวอ
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 truncate text-[12px] font-semibold leading-tight" style={remarkStyle}>
                      {remarkText}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// -------------------- PartyCard component (local) --------------------
function PartyCard(props: {
  party: Party;
  members: MemberRow[];
  classById: Map<number, DbClass>;
  canEdit: boolean;
  selectedIds: Set<number>;
  dragItem: DragItem | null;
  dragOverTarget: DragTarget;
  onDragStart: (e: React.DragEvent, item: DragItem) => void;
  onDragEnd: () => void;
  onDragOverSlot: (e: React.DragEvent, partyId: number, index: number) => void;
  onDropOnSlot: (e: React.DragEvent, partyId: number, index: number) => void;
  onToggleSelect: (memberId: number, disabled: boolean) => void;
  onOpenRemark: (memberId: number) => void;
  onRemoveFromSlot: (partyId: number, slotIndex: number) => void;
  groupColor: string | null;

  // NEW
  warTime: WarTime;
  isOnLeave: (memberId: number, time: WarTime) => boolean;
  getLeaveReason: (memberId: number) => string | null;
}) {
  const {
    party: p,
    members,
    classById,
    canEdit,
    selectedIds,
    dragOverTarget,
    onDragStart,
    onDragEnd,
    onDragOverSlot,
    onDropOnSlot,
    onToggleSelect,
    onOpenRemark,
    onRemoveFromSlot,
    groupColor,
    warTime,
    isOnLeave,
    getLeaveReason,
  } = props;

  function NameText({ m }: { m: MemberRow }) {
    const style = m.color ? { color: m.color } : undefined;
    return (
      <span className="truncate" style={style}>
        {m.special_text ? `${m.special_text} ` : ""}
        {m.name}
      </span>
    );
  }

  function RemarkText({ remark }: { remark: string | null }) {
    const parsed = parseColoredPrefix(remark ?? "");
    if (!parsed.text) return <span className="block truncate text-[11px] text-zinc-300">—</span>;
    const style = parsed.color ? { color: parsed.color } : undefined;
    return (
      <span className="block truncate text-[11px]" style={style}>
        {parsed.text}
      </span>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40 flex flex-col h-[440px] overflow-hidden">
      {/* group color strip */}
      {groupColor ? <div className="h-1 w-full" style={{ backgroundColor: groupColor, opacity: 0.75 }} /> : null}

      <div className="flex items-center justify-between border-b border-zinc-200 p-3 dark:border-zinc-800">
        <div className="font-semibold">{p.name}</div>
        <div className="text-xs text-zinc-500 font-mono">{p.slots.filter((s) => s.memberId).length}/6</div>
      </div>

      <div className="flex-1 min-h-0 p-1.5 grid grid-rows-6 gap-1.5">
        {p.slots.map((s, idx) => {
          const mem = s.memberId ? members.find((m) => m.id === s.memberId) : null;

          const isTarget =
            dragOverTarget?.type === "SLOT" && dragOverTarget?.partyId === p.id && dragOverTarget?.index === idx;

          const isSelected = mem ? selectedIds.has(mem.id) : false;
          const cls = mem?.class_id ? classById.get(Number(mem.class_id)) : null;

          const leaveThisTime = mem ? isOnLeave(mem.id, warTime) : false;
          const leaveReason = mem ? getLeaveReason(mem.id) : null;

          return (
            <div
              key={idx}
              className={[
                "h-full rounded-lg border px-3 py-2 flex items-start justify-between gap-2 select-none",
                isTarget
                  ? "border-red-300 bg-red-50 dark:bg-red-950/20"
                  : isSelected
                    ? "border-red-300 bg-red-50 dark:bg-red-950/20"
                    : "border-zinc-100 dark:border-zinc-900",
              ].join(" ")}
              onDragOver={(e) => onDragOverSlot(e, p.id, idx)}
              onDrop={(e) => onDropOnSlot(e, p.id, idx)}
              title={leaveThisTime ? (leaveReason ? `ลาวอ (${warTime}) • ${leaveReason}` : `ลาวอ (${warTime})`) : undefined}
            >
              {mem ? (
                <>
                  <div
                    className="min-w-0 flex-1"
                    draggable={canEdit && !leaveThisTime}
                    onDragStart={(e) =>
                      onDragStart(e, {
                        type: "SLOT",
                        partyId: p.id,
                        index: idx,
                        memberId: mem.id,
                      })
                    }
                    onDragEnd={onDragEnd}
                    onClick={() => onToggleSelect(mem.id, leaveThisTime)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <ClassIcon iconUrl={cls?.icon_url} label={cls?.name ?? undefined} size={16} />
                      <div className="text-sm font-semibold truncate flex items-center gap-2">
                        <NameText m={mem} />
                        {leaveThisTime ? (
                          <span className="shrink-0 rounded-md bg-red-600/15 px-2 py-0.5 text-[10px] font-bold text-red-600 dark:text-red-400">
                            ลาวอ
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-1">
                      <RemarkText remark={mem.remark ?? null} />
                    </div>
                  </div>

                  <div className="flex shrink-0 items-start gap-1">
                    <IconButton
                      label="แก้ไข"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenRemark(mem.id);
                      }}
                    />
                    <IconButton
                      label="เอาออก"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveFromSlot(p.id, idx);
                      }}
                    />
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[11px] text-zinc-300 font-semibold tracking-widest">
                  ว่าง
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

