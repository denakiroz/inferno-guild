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

  /**
   * ใช้สำหรับตัดสมาชิกพิเศษออกจาก War Builder (ไม่เข้า roster / ไม่โชว์สำรอง)
   * ฟิลด์นี้ควรถูกส่งมาจาก /api/admin/members (table member.is_special)
   */
  is_special?: boolean | null;

  /**
   * Ultimate ที่สมาชิก add ไว้ (ถ้ามี)
   * แนะนำให้ /api/admin/members ส่งมาเป็น array ของ id (จาก table member_ultimate_skill)
   */
  ultimate_skill_ids?: number[] | null;
  special_skill_ids?: number[] | null;
  equipment_create_ids?: number[] | null;

  party: number | null;
  party_2: number | null;

  pos_party: number | null;
  pos_party_2: number | null;

  color: string | null;

  special_text: string | null;
  remark: string | null;

  status?: "Active" | "Inactive" | "active" | "inactive" | null;
};

function isSpecialMember(m: MemberRow): boolean {
  return (m as any)?.is_special === true;
}

type DbClass = {
  id: number;
  name: string;
  icon_url: string | null;
};

// table: ultimate_skill (id, name, ultimate_skill_url)
type DbUltimateSkill = {
  id: number;
  name: string;
  ultimate_skill_url: string | null;
};

// table: special_skill (id, name, special_skill_url)
type DbSpecialSkill = {
  id: number;
  name: string;
  special_skill_url: string | null;
};

// table: equipment_create (id, name, image_url, type)
type DbSkillStone = {
  id: number;
  name: string;
  image_url: string | null;
  type: number | null;
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

function countMemberParties(m: MemberRow): number {
  const p1 = typeof m.party === "number" && m.party > 0;
  const p2 = typeof m.party_2 === "number" && m.party_2 > 0;
  return (p1 ? 1 : 0) + (p2 ? 1 : 0);
}

function PartyCountBadge({ count }: { count: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-extrabold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/20 dark:text-zinc-200 tabular-nums"
      title="จำนวนปาร์ตี้ที่อยู่ (party + party_2)"
    >
      ({count})
    </span>
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
  const [groupSavedName, setGroupSavedName] = useState<string | null>(null); // feedback หลัง save

  // note เป็นรายบรรทัด ใส่สีได้ทีละบรรทัด
  const [noteLines, setNoteLines] = useState<NoteLine[]>([{ id: "L0", color: null, text: "" }]);
  const [paletteForLineId, setPaletteForLineId] = useState<string | null>(null);

  // multi-select for bulk color (click selection)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [openColorPalette, setOpenColorPalette] = useState(false);

  // class filter (multi-select) — empty = all
  const [classFilter, setClassFilter] = useState<Set<number>>(new Set());

  // party filter (roster) — all / assigned / unassigned (based on current layout)
  const [partyFilter, setPartyFilter] = useState<"all" | "assigned" | "unassigned">("all");

  // ultimate filter (multi-select) — empty = all
  const [ultimateSkills, setUltimateSkills] = useState<DbUltimateSkill[]>([]);
  const [ultimateFilter, setUltimateFilter] = useState<Set<number>>(new Set());

  // special skill filter (multi-select) — empty = all
  const [specialSkills, setSpecialSkills] = useState<DbSpecialSkill[]>([]);
  const [specialSkillFilter, setSpecialSkillFilter] = useState<Set<number>>(new Set());

  // skill stone filter (multi-select) — empty = all
  const [skillStones, setSkillStones] = useState<DbSkillStone[]>([]);
  const [skillStoneFilter, setSkillStoneFilter] = useState<Set<number>>(new Set());

  const [dragItem, setDragItem] = useState<DragItem | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<DragTarget>(null);

  // scroll assist during drag (ทำให้เลื่อนง่ายขึ้นตอนลากสมาชิก)
  const rosterScrollRef = useRef<HTMLDivElement | null>(null);
  const partyScrollRef = useRef<HTMLDivElement | null>(null);
  const dragPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragScrollRafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!dragItem) return;

    const EDGE_PX = 120; // ทำให้โซนขอบกว้างขึ้น (เลื่อนง่ายขึ้น)
    const MAX_SPEED = 22; // px/frame

    function inRect(x: number, y: number, r: DOMRect): boolean {
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    }

    function scrollElementByPointer(el: HTMLElement, x: number, y: number) {
      const r = el.getBoundingClientRect();
      if (!inRect(x, y, r)) return;

      const topDist = y - r.top;
      const bottomDist = r.bottom - y;

      // intensity: 0..1 แล้วเร่งแบบ quadratic ให้รู้สึก "ติดมือ"
      if (topDist < EDGE_PX) {
        const t = Math.max(0, Math.min(1, 1 - topDist / EDGE_PX));
        el.scrollTop -= Math.round(MAX_SPEED * t * t);
      } else if (bottomDist < EDGE_PX) {
        const t = Math.max(0, Math.min(1, 1 - bottomDist / EDGE_PX));
        el.scrollTop += Math.round(MAX_SPEED * t * t);
      }
    }

    function scrollWindowByPointer(y: number) {
      const vh = window.innerHeight;
      const topDist = y;
      const bottomDist = vh - y;
      const EDGE = 90;
      const MAX = 18;

      if (topDist < EDGE) {
        const t = Math.max(0, Math.min(1, 1 - topDist / EDGE));
        window.scrollBy(0, -Math.round(MAX * t * t));
      } else if (bottomDist < EDGE) {
        const t = Math.max(0, Math.min(1, 1 - bottomDist / EDGE));
        window.scrollBy(0, Math.round(MAX * t * t));
      }
    }

    function pickTarget(x: number, y: number): HTMLElement | null {
      // ให้ priority: ถ้า pointer อยู่ใน roster list ให้เลื่อน roster; ไม่งั้นถ้าอยู่ใน party pane ให้เลื่อน party pane
      const rosterEl = rosterScrollRef.current;
      if (rosterEl) {
        const r = rosterEl.getBoundingClientRect();
        if (inRect(x, y, r)) return rosterEl;
      }

      const partyEl = partyScrollRef.current;
      if (partyEl) {
        const r = partyEl.getBoundingClientRect();
        if (inRect(x, y, r)) return partyEl;
      }

      return null;
    }

    const onDragOver = (e: DragEvent) => {
      // ทำให้ dragover ถูกยิงต่อเนื่อง เพื่ออัปเดตตำแหน่ง pointer
      dragPointerRef.current = { x: e.clientX, y: e.clientY };
      // allow drop
      e.preventDefault();
    };

    const tick = () => {
      const { x, y } = dragPointerRef.current;
      const target = pickTarget(x, y);

      if (target) {
        scrollElementByPointer(target, x, y);
      } else {
        // fallback: เลื่อนหน้าจอ (กรณีจอเล็ก/มี modal)
        scrollWindowByPointer(y);
      }

      dragScrollRafRef.current = window.requestAnimationFrame(tick);
    };

    window.addEventListener("dragover", onDragOver, { passive: false });
    dragScrollRafRef.current = window.requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("dragover", onDragOver as any);
      if (dragScrollRafRef.current) window.cancelAnimationFrame(dragScrollRafRef.current);
      dragScrollRafRef.current = null;
    };
  }, [dragItem]);

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

  // ---------- Quick War mode ----------
  const [isQuickWarMode, setIsQuickWarMode] = useState(false);
  const [quickWarPickOpen, setQuickWarPickOpen] = useState(false);
  const [quickWarDate, setQuickWarDate] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });
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

  async function loadLeavesForToday(memList: MemberRow[], dateISO?: string) {
    if (!guild) return;

    const now = new Date();
    const defaultISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const targetISO = dateISO ?? defaultISO;
    const [y, mo, d] = targetISO.split("-").map(Number);
    const today = new Date(y, mo - 1, d, 0, 0, 0, 0);
    setLeaveDateISO(targetISO);

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

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
      .eq("status", "Active")
      .gte("date_time", today.toISOString())
      .lt("date_time", tomorrow.toISOString());

    if (error) {
      setLeaveByTime({ "20:00": new Set(), "20:30": new Set() });
      leaveReasonByMemberRef.current = new Map();
      return;
    }

    // ใน Quick War mode รวมทุก leave วันนี้เป็น "ลา" ทั้ง 2 รอบ
    const allLeaving = new Set<number>();
    const reasonMap = new Map<number, string | null>();
    for (const r of (data ?? []) as LeaveRow[]) {
      const mid = Number(r.member_id);
      if (!Number.isFinite(mid) || !mid) continue;
      allLeaving.add(mid);
      reasonMap.set(mid, r.reason ?? null);
    }

    leaveReasonByMemberRef.current = reasonMap;
    setLeaveByTime({ "20:00": allLeaving, "20:30": allLeaving });
  }

  function enterQuickWarMode(sourceTime: WarTime) {
    if (!canEdit || !guild) return;
    // คัดลอก layout จาก sourceTime
    const srcDraft = getDraft(sourceTime) ?? buildPartiesFromMembers(members, sourceTime);
    commitLayout(cloneParties(srcDraft), true);
    setSelectedIds(new Set());
    setOpenColorPalette(false);
    setDragItem(null);
    setDragOverTarget(null);
    // โหลด leave วันที่เลือก
    void loadLeavesForToday(members, quickWarDate);
    setIsQuickWarMode(true);
    setQuickWarPickOpen(false);
  }

  function exitQuickWarMode() {
    setIsQuickWarMode(false);
    // โหลด leave เสาร์กลับ
    void loadLeavesForUpcomingSaturday(members);
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
      if (isSpecialMember(m)) continue;

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

  /**
   * Sanitize layout:
   * - remove member ที่ไม่อยู่ในกิลด์ / inactive / is_special
   * - กันซ้ำ (member เดียวอยู่หลายช่อง)
   */
  function sanitizePartiesLayout(input: Party[], sourceMembers: MemberRow[]): { next: Party[]; changed: boolean } {
    const eligible = new Set<number>();
    for (const m of sourceMembers ?? []) {
      if (guild && Number(m.guild) !== Number(guild)) continue;
      if (normalizeActiveStatus(m.status) !== "active") continue;
      if (isSpecialMember(m)) continue;
      eligible.add(m.id);
    }

    const next = cloneParties(input ?? []);
    const seen = new Set<number>();
    let changed = false;

    for (const p of next) {
      for (const sl of p.slots) {
        const mid = sl.memberId;
        if (!mid) continue;
        if (!eligible.has(mid) || seen.has(mid)) {
          sl.memberId = null;
          changed = true;
          continue;
        }
        seen.add(mid);
      }
    }

    return { next, changed };
  }


  async function loadUltimateSkills() {
    // Use API as source of truth (avoid RLS issues on client-side select).
    try {
      const r = await fetch("/api/admin/ultimate-skills", { cache: "no-store" });
      if (!r.ok) return;

      const j = (await r.json()) as any;
      const list = Array.isArray(j?.skills)
        ? j.skills
        : Array.isArray(j?.data)
          ? j.data
          : Array.isArray(j)
            ? j
            : [];

      setUltimateSkills(
        (list ?? []).map((x: any) => ({
          id: Number(x.id),
          name: String(x.name ?? ""),
          ultimate_skill_url: x.ultimate_skill_url ?? x.url ?? null,
        })),
      );
    } catch {
      // ignore
    }
  }

  async function loadSpecialSkills() {
    try {
      const r = await fetch("/api/admin/special-skills", { cache: "no-store" });
      if (!r.ok) return;
      const j = (await r.json()) as any;
      const list = Array.isArray(j?.skills) ? j.skills : [];
      setSpecialSkills(
        list.map((x: any) => ({
          id: Number(x.id),
          name: String(x.name ?? ""),
          special_skill_url: x.special_skill_url ?? null,
        })),
      );
    } catch {
      // ignore
    }
  }

  async function loadSkillStones() {
    try {
      const r = await fetch("/api/admin/skill-stones", { cache: "no-store" });
      if (!r.ok) return;
      const j = (await r.json()) as any;
      const list = Array.isArray(j?.skill_stones) ? j.skill_stones : [];
      setSkillStones(
        list.map((x: any) => ({
          id: Number(x.id),
          name: String(x.name ?? ""),
          image_url: x.image_url ?? null,
          type: x.type ?? null,
        })),
      );
    } catch {
      // ignore
    }
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
      } else {
        // draft ที่ dirty อาจมี member ที่ไม่ควรอยู่ (เช่น is_special) -> sanitize ทิ้ง
        const draft = getDraft(warTime) ?? parties;
        const { next, changed } = sanitizePartiesLayout(draft, memList);
        if (changed) {
          setDraft(warTime, next, true);
          setParties(next);
        }
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

      await loadUltimateSkills();
      await loadSpecialSkills();
      await loadSkillStones();

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
    setPartyFilter("all");
    setUltimateFilter(new Set());
    setSpecialSkillFilter(new Set());

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
      const wasDirty = !!draftDirtyByTimeRef.current.get(warTime);
      const { next, changed } = sanitizePartiesLayout(draft, members);
      setParties(next);

      // ถ้ามีการ sanitize (เช่น ตัด is_special) ให้ถือว่า dirty เพื่อให้กด save แล้ว DB ถูกเคลียร์
      setDraft(warTime, next, changed ? true : wasDirty);
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
      .filter((m) => normalizeActiveStatus(m.status) === "active")
      .filter((m) => !isSpecialMember(m));
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


  const ultimateCounts = useMemo(() => {
  const m = new Map<number, number>();
  for (const mem of activeInGuild) {
    const ids = (mem as any)?.ultimate_skill_ids;
    if (!Array.isArray(ids)) continue;

    // count per member (unique)
    const uniq = new Set<number>();
    for (const raw of ids) {
      const id = Number(raw);
      if (!Number.isFinite(id) || id <= 0) continue;
      uniq.add(id);
    }
    for (const id of uniq.values()) {
      m.set(id, (m.get(id) ?? 0) + 1);
    }
  }
  return m;
}, [activeInGuild]);


  const ultimateOptions = useMemo(() => {
  const base = (ultimateSkills ?? [])
    .map((u) => {
      const id = Number(u.id);
      return {
        id,
        name: u.name ?? `Ultimate ${id}`,
        ultimate_skill_url: u.ultimate_skill_url ?? null,
        count: ultimateCounts.get(id) ?? 0,
      };
    })
    .filter((x) => x.id !== 0);

  const known = new Set(base.map((x) => x.id));
  for (const [uid, count] of ultimateCounts.entries()) {
    if (uid === 0) continue;
    if (known.has(uid)) continue;
    base.push({
      id: uid,
      name: `Ultimate ${uid}`,
      ultimate_skill_url: null,
      count,
    });
  }

  return base.sort((a, b) => a.id - b.id);
}, [ultimateSkills, ultimateCounts]);

  const specialSkillCounts = useMemo(() => {
    const m = new Map<number, number>();
    for (const mem of activeInGuild) {
      const ids = (mem as any)?.special_skill_ids;
      if (!Array.isArray(ids)) continue;
      const uniq = new Set<number>();
      for (const raw of ids) {
        const id = Number(raw);
        if (!Number.isFinite(id) || id <= 0) continue;
        uniq.add(id);
      }
      for (const id of uniq.values()) {
        m.set(id, (m.get(id) ?? 0) + 1);
      }
    }
    return m;
  }, [activeInGuild]);

  const specialSkillOptions = useMemo(() => {
    const base = (specialSkills ?? []).map((s) => ({
      id: Number(s.id),
      name: s.name ?? `Special ${s.id}`,
      special_skill_url: s.special_skill_url ?? null,
      count: specialSkillCounts.get(Number(s.id)) ?? 0,
    })).filter((x) => x.id !== 0);
    return base.sort((a, b) => a.id - b.id);
  }, [specialSkills, specialSkillCounts]);

  const skillStoneCounts = useMemo(() => {
    const m = new Map<number, number>();
    for (const mem of activeInGuild) {
      const ids = (mem as any)?.equipment_create_ids;
      if (!Array.isArray(ids)) continue;
      const uniq = new Set<number>();
      for (const raw of ids) {
        const id = Number(raw);
        if (!Number.isFinite(id) || id <= 0) continue;
        uniq.add(id);
      }
      for (const id of uniq.values()) {
        m.set(id, (m.get(id) ?? 0) + 1);
      }
    }
    return m;
  }, [activeInGuild]);

  const skillStoneOptions = useMemo(() => {
    const base = (skillStones ?? []).map((s) => ({
      id: Number(s.id),
      name: s.name ?? `Stone ${s.id}`,
      image_url: s.image_url ?? null,
      type: s.type ?? null,
      count: skillStoneCounts.get(Number(s.id)) ?? 0,
    })).filter((x) => x.id !== 0 && x.type === 1); // เฉพาะ type 1 (อาวุธ)
    return base.sort((a, b) => a.id - b.id);
  }, [skillStones, skillStoneCounts]);

  const roster = useMemo(() => {
  let base = [...activeInGuild].sort((a, b) => (b.power ?? 0) - (a.power ?? 0));

  // class filter
  if (classFilter.size > 0) {
    base = base.filter((m) => {
      const cid = typeof m.class_id === "number" ? Number(m.class_id) : null;
      if (cid === null || cid === 0) return false;
      return classFilter.has(cid);
    });
  }

  // party filter (based on current layout)
    if (partyFilter !== "all") {
    base = base.filter((m) => {
      const hasParty = assignedIds.has(m.id);
      return partyFilter === "assigned" ? hasParty : !hasParty;
    });
  }

  // ultimate filter (match ANY selected ultimate)
  if (ultimateFilter.size > 0) {
    base = base.filter((m) => {
      const ids = (m as any)?.ultimate_skill_ids;
      if (!Array.isArray(ids) || ids.length === 0) return false;
      for (const raw of ids) {
        const id = Number(raw);
        if (ultimateFilter.has(id)) return true;
      }
      return false;
    });
  }

  // special skill filter (match ANY selected special skill)
  if (specialSkillFilter.size > 0) {
    base = base.filter((m) => {
      const ids = (m as any)?.special_skill_ids;
      if (!Array.isArray(ids) || ids.length === 0) return false;
      for (const raw of ids) {
        const id = Number(raw);
        if (specialSkillFilter.has(id)) return true;
      }
      return false;
    });
  }

  // skill stone filter (match ANY selected skill stone)
  if (skillStoneFilter.size > 0) {
    base = base.filter((m) => {
      const ids = (m as any)?.equipment_create_ids;
      if (!Array.isArray(ids) || ids.length === 0) return false;
      for (const raw of ids) {
        const id = Number(raw);
        if (skillStoneFilter.has(id)) return true;
      }
      return false;
    });
  }

  return base;
}, [activeInGuild, classFilter, partyFilter, assignedIds, ultimateFilter, specialSkillFilter, skillStoneFilter]);

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

  // ---------- Ultimate filter ----------
  function toggleUltimateFilter(uid: number) {
    if (!uid) return;
    setUltimateFilter((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }

  function clearUltimateFilter() {
    setUltimateFilter(new Set());
  }

  // ---------- Special skill filter ----------
  function toggleSpecialSkillFilter(sid: number) {
    setSpecialSkillFilter((prev) => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid);
      else next.add(sid);
      return next;
    });
  }

  function clearSpecialSkillFilter() {
    setSpecialSkillFilter(new Set());
  }

  // ---------- Skill stone filter ----------
  function toggleSkillStoneFilter(id: number) {
    setSkillStoneFilter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSkillStoneFilter() {
    setSkillStoneFilter(new Set());
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
    setGroupSavedName(null);
  }

  /** reset ฟอร์มกลับเป็น create-mode โดย modal ยังเปิดอยู่ */
  function resetGroupFormToCreate() {
    setGroupModalMode("create");
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

      if (groupModalMode === "create") {
        // ✅ ไม่ปิด modal — reset ฟอร์มกลับเป็น create ใหม่เลย
        setGroupSavedName(name);
        resetGroupFormToCreate();
        // เคลียร์ feedback หลัง 3 วินาที
        setTimeout(() => setGroupSavedName((cur) => (cur === name ? null : cur)), 3000);
      } else {
        // แก้ไขกลุ่ม → ปิด modal เหมือนเดิม
        closeGroupModal();
      }
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


  const partyFilterLabel = useMemo(() => {
    if (partyFilter === "assigned") return "มีปาร์ตี้";
    if (partyFilter === "unassigned") return "ยังไม่มีปาร์ตี้";
    return "ทั้งหมด";
  }, [partyFilter]);


  const ultimateFilterCount = ultimateFilter.size;
  const specialSkillFilterCount = specialSkillFilter.size;
  const skillStoneFilterCount = skillStoneFilter.size;

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
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-sm font-semibold">จัดทัพวอ</div>
          <div className="text-xs text-zinc-500">Guild: {guild ?? "-"}</div>
          {isQuickWarMode ? (
            <div className="flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-0.5 text-xs font-semibold text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
              <span>⚡ จัดวอด่วน</span>
              <span className="text-orange-400">•</span>
              <span>ลาวันที่: {leaveDateISO}</span>
            </div>
          ) : (
            leaveDateISO ? <div className="text-xs text-zinc-400">เสาร์นี้: {leaveDateISO}</div> : null
          )}
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

          {isQuickWarMode ? (
            <button
              type="button"
              className="rounded-lg border border-orange-400 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700 hover:bg-orange-100 dark:border-orange-600 dark:bg-orange-900/20 dark:text-orange-300 dark:hover:bg-orange-900/40"
              onClick={exitQuickWarMode}
            >
              ออกจากโหมดวอด่วน
            </button>
          ) : (
            <button
              type="button"
              className="rounded-lg border border-orange-300 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700 hover:bg-orange-100 disabled:opacity-40 dark:border-orange-700 dark:bg-orange-900/20 dark:text-orange-300 dark:hover:bg-orange-900/40"
              onClick={() => setQuickWarPickOpen(true)}
              disabled={!canEdit || !guild || loading}
              title="จัดทีมวอนอกรอบ/วันธรรมดา — โหลดคนลาวันนี้ ไม่บันทึก DB"
            >
              ⚡ จัดวอด่วน
            </button>
          )}

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

          <Button onClick={save} disabled={!canEdit || !guild || isQuickWarMode}>
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

            {/* Filter panels (F1 / F2 / F3) */}
      <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950/20">
        <div className="grid grid-cols-1 divide-y divide-zinc-200 dark:divide-zinc-800 md:grid-cols-3 md:divide-y-0 md:divide-x">
          {/* F1: อาชีพ + ปาร์ตี้ */}
          <div className="p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-zinc-500">
                Filter อาชีพ:{" "}
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

            <div className="mt-2 max-h-[120px] overflow-y-auto pr-1">
              <div className="flex flex-wrap gap-2">
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

            {/* ปาร์ตี้ (รวมใน F1) */}
            <div className="mt-3 border-t border-zinc-100 dark:border-zinc-800 pt-3">
              <div className="text-xs text-zinc-500 mb-2">
                Filter ปาร์ตี้:{" "}
                <span className="font-semibold text-zinc-700 dark:text-zinc-200">{partyFilterLabel}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {([
                  { key: "all" as const, label: "ทั้งหมด" },
                  { key: "assigned" as const, label: "มีปาร์ตี้" },
                  { key: "unassigned" as const, label: "ยังไม่มีปาร์ตี้" },
                ] as const).map((x) => {
                  const active = partyFilter === x.key;
                  return (
                    <button
                      key={x.key}
                      type="button"
                      className={[
                        "inline-flex items-center rounded-xl border px-2.5 py-1 text-xs font-semibold",
                        active
                          ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                          : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900/40",
                      ].join(" ")}
                      onClick={() => setPartyFilter(x.key)}
                    >
                      {x.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* F2: ศิษย์พี่ + หินสกิล (50-50) */}
          <div className="grid grid-cols-2 divide-x divide-zinc-200 dark:divide-zinc-800">
            {/* F2-left: ศิษย์พี่ */}
            <div className="p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-zinc-500">
                  Filter ศิษย์พี่:{" "}
                  <span className="font-semibold text-zinc-700 dark:text-zinc-200">
                    {specialSkillFilterCount === 0 ? "ทั้งหมด" : `${specialSkillFilterCount} อย่าง`}
                  </span>
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-zinc-200 px-2 py-1 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900/40"
                  onClick={clearSpecialSkillFilter}
                  disabled={specialSkillFilterCount === 0}
                >
                  ล้าง
                </button>
              </div>

              <div className="mt-2 max-h-[180px] overflow-y-auto pr-1">
                <div className="flex flex-wrap gap-2">
                  {specialSkillOptions.length === 0 ? (
                    <div className="text-xs text-zinc-400">ยังไม่มีข้อมูลศิษย์พี่</div>
                  ) : (
                    specialSkillOptions.map((s) => {
                      const active = specialSkillFilter.has(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          className={[
                            "inline-flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs font-semibold",
                            active
                              ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                              : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900/40",
                          ].join(" ")}
                          onClick={() => toggleSpecialSkillFilter(s.id)}
                          title={s.name}
                        >
                          {s.special_skill_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={s.special_skill_url} alt="" className="h-4 w-4 rounded object-cover" />
                          ) : null}
                          <span className="max-w-[120px] truncate">{s.name}</span>
                          <span className="rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-extrabold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/20 dark:text-zinc-200 tabular-nums">
                            {s.count}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* F2-right: หินสกิล */}
            <div className="p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-zinc-500">
                  Filter หินสกิล:{" "}
                  <span className="font-semibold text-zinc-700 dark:text-zinc-200">
                    {skillStoneFilterCount === 0 ? "ทั้งหมด" : `${skillStoneFilterCount} อย่าง`}
                  </span>
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-zinc-200 px-2 py-1 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900/40"
                  onClick={clearSkillStoneFilter}
                  disabled={skillStoneFilterCount === 0}
                >
                  ล้าง
                </button>
              </div>

              <div className="mt-2 max-h-[180px] overflow-y-auto pr-1">
                <div className="flex flex-wrap gap-2">
                  {skillStoneOptions.length === 0 ? (
                    <div className="text-xs text-zinc-400">ยังไม่มีข้อมูลหินสกิล</div>
                  ) : (
                    skillStoneOptions.map((s) => {
                      const active = skillStoneFilter.has(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          className={[
                            "inline-flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs font-semibold",
                            active
                              ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                              : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900/40",
                          ].join(" ")}
                          onClick={() => toggleSkillStoneFilter(s.id)}
                          title={s.name}
                        >
                          {s.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={s.image_url} alt="" className="h-4 w-4 rounded object-cover" />
                          ) : null}
                          <span className="max-w-[120px] truncate">{s.name}</span>
                          <span className="rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-extrabold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/20 dark:text-zinc-200 tabular-nums">
                            {s.count}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* F3 */}
          <div className="p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-zinc-500">
                Filter Ultimate (Roster):{" "}
                <span className="font-semibold text-zinc-700 dark:text-zinc-200">
                  {ultimateFilterCount === 0 ? "ทั้งหมด" : `${ultimateFilterCount} อย่าง`}
                </span>
              </div>

              <button
                type="button"
                className="rounded-lg border border-zinc-200 px-2 py-1 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900/40"
                onClick={clearUltimateFilter}
              >
                ล้าง
              </button>
            </div>

            <div className="mt-2 max-h-[120px] overflow-y-auto pr-1">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={[
                    "inline-flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs font-semibold",
                    ultimateFilterCount === 0
                      ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                      : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900/40",
                  ].join(" ")}
                  onClick={clearUltimateFilter}
                >
                  ทั้งหมด
                </button>

                {ultimateOptions.length === 0 ? (
                  <div className="text-xs text-zinc-400">ยังไม่มีข้อมูล Ultimate</div>
                ) : (
                  ultimateOptions.map((u) => {
                    const active = ultimateFilter.has(u.id);
                    return (
                      <button
                        key={u.id}
                        type="button"
                        className={[
                          "inline-flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs font-semibold",
                          active
                            ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                            : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900/40",
                        ].join(" ")}
                        onClick={() => toggleUltimateFilter(u.id)}
                        title={u.name}
                      >
                        {u.ultimate_skill_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={u.ultimate_skill_url} alt="" className="h-4 w-4 rounded object-cover" />
                        ) : null}
                        <span className="max-w-[160px] truncate">{u.name}</span>
                        <span className="rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-extrabold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/20 dark:text-zinc-200 tabular-nums">
                          {u.count}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
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
              <div className="text-sm font-semibold">
                {groupModalMode === "create" ? "จัดการกลุ่มปาร์ตี้" : "แก้ไขกลุ่มปาร์ตี้"}
              </div>
              <div className="mt-0.5 text-xs text-zinc-500">
                {groupModalMode === "create"
                  ? "เพิ่มได้หลายกลุ่มต่อเนื่อง — กด \"เพิ่มกลุ่ม\" แล้วฟอร์มจะ reset ให้ใส่กลุ่มถัดไปได้เลย"
                  : "แก้ไขกลุ่มที่เลือก แล้วกด \"บันทึกการแก้ไข\""}
              </div>
            </div>

            <button
              type="button"
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900/40"
              onClick={closeGroupModal}
              disabled={groupSaving}
            >
              ปิด
            </button>
          </div>

          {/* Feedback banner หลัง save กลุ่มใหม่ */}
          {groupSavedName ? (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 dark:border-green-800/50 dark:bg-green-950/30 dark:text-green-400">
              <span>✓</span>
              <span>เพิ่มกลุ่ม &ldquo;{groupSavedName}&rdquo; แล้ว — ใส่กลุ่มถัดไปได้เลย</span>
            </div>
          ) : null}

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[1fr_320px]">
            {/* left */}
            <div>
              <div className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1">
                {groupModalMode === "create" ? `กลุ่มที่ ${groupsSorted.length + 1}` : "ชื่อกลุ่ม"}
              </div>
              <input
                autoFocus
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={groupNameDraft}
                onChange={(e) => setGroupNameDraft(e.target.value)}
                placeholder="เช่น กลุ่ม A, B, หรือ ทีมหน้า"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !groupSaving) saveGroupModal();
                }}
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

              <div className="mt-4 flex items-center justify-between mb-2">
                <div className="text-xs text-zinc-500">เลือกปาร์ตี้เข้ากลุ่ม</div>
                {groupSelectedParties.size > 0 && (
                  <div className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                    เลือก {groupSelectedParties.size} ตี้
                  </div>
                )}
              </div>
              {/* 5×2 toggle grid — เห็นครบ 10 ตี้ */}
              <div className="grid grid-cols-5 gap-1.5">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((pid) => {
                  const locked = isPartyLockedByOtherGroup(pid);
                  const checked = groupSelectedParties.has(pid);
                  const lockInfo = partyToGroup.get(pid);
                  const lockColor = lockInfo?.color ?? null;

                  return (
                    <button
                      key={pid}
                      type="button"
                      disabled={locked && !checked}
                      title={locked && !checked ? `ตี้ ${pid} อยู่ในกลุ่ม "${lockInfo?.name ?? "-"}" แล้ว` : `ปาร์ตี้ ${pid}`}
                      onClick={() => {
                        if (locked && !checked) return;
                        setGroupSelectedParties((prev) => {
                          const next = new Set(prev);
                          if (checked) next.delete(pid);
                          else next.add(pid);
                          return next;
                        });
                      }}
                      className={[
                        "relative flex flex-col items-center justify-center rounded-xl border py-2.5 text-xs font-bold transition-all",
                        checked
                          ? "border-blue-400 bg-blue-50 text-blue-700 ring-2 ring-blue-300 dark:border-blue-600 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-700"
                          : locked
                          ? "cursor-not-allowed border-zinc-200 bg-zinc-50 text-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/20 dark:text-zinc-600"
                          : "border-zinc-200 bg-white text-zinc-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 dark:border-zinc-700 dark:bg-zinc-900/20 dark:text-zinc-400 dark:hover:border-blue-600 dark:hover:text-blue-400",
                      ].join(" ")}
                    >
                      {/* ถ้า locked แสดงจุดสีของกลุ่ม */}
                      {locked && !checked && lockColor && (
                        <span
                          className="absolute top-1 right-1 h-2 w-2 rounded-full"
                          style={{ background: lockColor }}
                          title={`กลุ่ม: ${lockInfo?.name ?? "-"}`}
                        />
                      )}
                      <span className="text-base leading-none">{pid}</span>
                      <span className="mt-0.5 text-[9px] font-medium leading-none opacity-60">
                        {checked ? "✓" : locked ? lockInfo?.name?.slice(0, 4) ?? "—" : "ตี้"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* right: กลุ่มที่มีอยู่ — รวม order + edit/delete ในบรรทัดเดียว */}
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/30">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                  กลุ่มที่มีอยู่
                  {groupsSorted.length > 0 && (
                    <span className="ml-1.5 rounded-full bg-zinc-200 px-1.5 py-0.5 text-[10px] font-bold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                      {groupsSorted.length}
                    </span>
                  )}
                </div>
                {groupsSorted.length > 0 && (
                  <div className="text-[10px] text-zinc-400">↑↓ = เรียงลำดับ</div>
                )}
              </div>

              <div className="mt-2 max-h-72 overflow-y-auto space-y-1.5 pr-0.5">
                {groupsSorted.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-zinc-200 py-4 text-center text-xs text-zinc-400 dark:border-zinc-700">
                    ยังไม่มีกลุ่ม — เพิ่มจากฟอร์มทางซ้าย
                  </div>
                ) : (
                  groupsSorted.map((g, idx) => (
                    <div
                      key={g.id}
                      className={[
                        "flex items-center justify-between rounded-lg border bg-white px-2 py-1.5 text-xs dark:bg-zinc-950/30",
                        groupModalMode === "edit" && editingGroupId === g.id
                          ? "border-blue-400 ring-1 ring-blue-300 dark:border-blue-600"
                          : "border-zinc-200 dark:border-zinc-800",
                      ].join(" ")}
                    >
                      <div className="min-w-0 flex items-center gap-1.5 flex-1">
                        <ColorDot value={g.color ?? null} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-semibold text-zinc-700 dark:text-zinc-200">{g.name}</div>
                          <div className="truncate text-[10px] text-zinc-400">ปาร์ตี้ {g.group}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-0.5 ml-1 shrink-0">
                        <button
                          type="button"
                          className="rounded border border-zinc-200 px-1.5 py-0.5 text-[10px] text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 dark:border-zinc-700 dark:hover:bg-zinc-800"
                          disabled={idx === 0}
                          onClick={() => moveGroup(g.id, -1)}
                          title="เลื่อนขึ้น"
                        >↑</button>
                        <button
                          type="button"
                          className="rounded border border-zinc-200 px-1.5 py-0.5 text-[10px] text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 dark:border-zinc-700 dark:hover:bg-zinc-800"
                          disabled={idx === groupsSorted.length - 1}
                          onClick={() => moveGroup(g.id, 1)}
                          title="เลื่อนลง"
                        >↓</button>
                        <button
                          type="button"
                          className="rounded border border-zinc-200 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600 hover:bg-blue-50 dark:border-zinc-700 dark:text-blue-400 dark:hover:bg-blue-950/30"
                          onClick={() => openEditGroupModal(g)}
                          title="แก้ไขกลุ่มนี้"
                        >แก้</button>
                        <button
                          type="button"
                          className="rounded border border-zinc-200 px-1.5 py-0.5 text-[10px] font-semibold text-red-500 hover:bg-red-50 dark:border-zinc-700 dark:text-red-400 dark:hover:bg-red-950/30"
                          onClick={() => deleteGroup(g)}
                          title="ลบกลุ่มนี้"
                        >ลบ</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-2">
            <div className="text-[11px] text-zinc-400">
              {groupModalMode === "create"
                ? "กด Enter หรือปุ่ม \"เพิ่มกลุ่ม\" — ฟอร์มจะ reset ให้ใส่กลุ่มถัดไปได้ทันที"
                : "กด \"บันทึกการแก้ไข\" เพื่อยืนยันการเปลี่ยนแปลง"}
            </div>
            <div className="flex items-center gap-2">
              {groupModalMode === "edit" && (
                <button
                  type="button"
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300"
                  onClick={resetGroupFormToCreate}
                  disabled={groupSaving}
                >
                  + เพิ่มกลุ่มใหม่
                </button>
              )}
              <Button onClick={saveGroupModal} type="button" disabled={groupSaving}>
                {groupModalMode === "create" ? "เพิ่มกลุ่ม" : "บันทึกการแก้ไข"}
              </Button>
            </div>
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
      .filter((m) => !isSpecialMember(m))
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
                            <PartyCountBadge count={countMemberParties(m)} />
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

            <div ref={rosterScrollRef} className="flex-1 min-h-0 overflow-y-auto p-2">
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
                      <PartyCountBadge count={countMemberParties(m)} />
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

        {/* Party Pane (grouped) — 5-column proportional grid */}
        <div ref={partyScrollRef} className="min-h-0 overflow-y-auto pr-1" style={{ height: paneHeight }}>
          {/* Layout: 5-column grid, each group spans its party count */}
          <div
            className="grid items-start gap-2"
            style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}
          >
            {groupedPartySections.map((sec, secIdx) => {
              const partyCount = sec.parties.length;
              // clamp ที่ 5 — ถ้ากลุ่มมีมากกว่า 5 ตี้ก็ยังแสดงได้ (wrap ภายใน)
              const spanCols = Math.min(partyCount, 5);

              // helper: render party cards
              const partyCards = sec.parties.map((p) => (
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
                  onDragOverSlot={onDragOverSlot}
                  onDropOnSlot={onDropOnSlot}
                  onToggleSelect={toggleSelect}
                  onOpenRemark={openRemarkEditor}
                  onRemoveFromSlot={removeFromSlot}
                  groupColor={sec.type === "group" ? (sec.g.color ?? null) : null}
                  warTime={warTime}
                  isOnLeave={isOnLeave}
                  getLeaveReason={(id) => leaveReasonByMemberRef.current.get(id) ?? null}
                />
              ));

              if (sec.type === "ungrouped") {
                return (
                  <div
                    key={`ungrouped-${secIdx}`}
                    className="flex flex-col gap-1.5"
                    style={{ gridColumn: `span ${spanCols}` }}
                  >
                    {/* ungrouped header */}
                    <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/20">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                          ยังไม่จัดกลุ่ม
                        </div>
                        <div className="text-xs text-zinc-400">{partyCount} ตี้</div>
                      </div>
                    </div>
                    {/* party grid — 1 ตี้ต่อ 1 column */}
                    <div
                      className="grid gap-2"
                      style={{ gridTemplateColumns: `repeat(${spanCols}, minmax(0, 1fr))` }}
                    >
                      {partyCards}
                    </div>
                  </div>
                );
              }

              const g = sec.g;
              const gColor = g.color ?? null;

              return (
                <div
                  key={`group-${g.id}`}
                  className="flex flex-col gap-1.5"
                  style={{ gridColumn: `span ${spanCols}` }}
                >
                  {/* group header — spans full width of this group */}
                  <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950/20 overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2">
                      <div className="min-w-0 flex items-center gap-2">
                        {gColor ? (
                          <div
                            className="h-3 w-3 shrink-0 rounded-full"
                            style={{ backgroundColor: gColor }}
                          />
                        ) : null}
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                            {g.name}
                          </div>
                          <div className="text-[11px] text-zinc-400 dark:text-zinc-500">
                            ตี้: {g.group}
                          </div>
                        </div>
                      </div>

                      {canEdit ? (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            className="rounded border border-zinc-200 px-1.5 py-0.5 text-[11px] text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                            onClick={() => moveGroup(g.id, -1)}
                            title="เลื่อนกลุ่มไปทางซ้าย/ขึ้น"
                          >↑</button>
                          <button
                            type="button"
                            className="rounded border border-zinc-200 px-1.5 py-0.5 text-[11px] text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                            onClick={() => moveGroup(g.id, 1)}
                            title="เลื่อนกลุ่มไปทางขวา/ลง"
                          >↓</button>
                          <button
                            type="button"
                            className="rounded border border-zinc-200 px-1.5 py-0.5 text-[11px] font-semibold text-blue-600 hover:bg-blue-50 dark:border-zinc-700 dark:text-blue-400 dark:hover:bg-blue-950/30"
                            onClick={() => openEditGroupModal(g)}
                            title="แก้ไขกลุ่ม"
                          >แก้ไข</button>
                        </div>
                      ) : null}
                    </div>
                    {gColor ? (
                      <div className="h-1 w-full" style={{ backgroundColor: gColor, opacity: 0.8 }} />
                    ) : null}
                  </div>

                  {/* party cards — 1 ตี้ต่อ 1 column ตรงกับ span ของกลุ่ม */}
                  <div
                    className="grid gap-2"
                    style={{ gridTemplateColumns: `repeat(${spanCols}, minmax(0, 1fr))` }}
                  >
                    {partyCards}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {remarkModal}
      {groupModal}
      {warMapModal}

      {/* Quick War Pick Dialog */}
      {quickWarPickOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <div className="mb-1 text-base font-bold">⚡ จัดวอด่วน</div>
            <div className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
              เลือกวันและรอบเวลาที่จะคัดลอกทีมมาใช้ — ระบบจะโหลดคนลาของวันที่เลือก และปิดการบันทึก
            </div>
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-semibold text-zinc-600 dark:text-zinc-400">วันที่</label>
              <input
                type="date"
                value={quickWarDate}
                onChange={(e) => setQuickWarDate(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-orange-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                className="w-full rounded-xl border-2 border-orange-300 bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-800 hover:bg-orange-100 dark:border-orange-700 dark:bg-orange-900/20 dark:text-orange-200 dark:hover:bg-orange-900/40"
                onClick={() => enterQuickWarMode("20:00")}
              >
                คัดลอกจากรอบ 20.00
              </button>
              <button
                type="button"
                className="w-full rounded-xl border-2 border-orange-300 bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-800 hover:bg-orange-100 dark:border-orange-700 dark:bg-orange-900/20 dark:text-orange-200 dark:hover:bg-orange-900/40"
                onClick={() => enterQuickWarMode("20:30")}
              >
                คัดลอกจากรอบ 20.30
              </button>
              <button
                type="button"
                className="mt-1 w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                onClick={() => setQuickWarPickOpen(false)}
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
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
                "h-full rounded-lg border px-3 py-2 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2",
                leaveThisTime
                  ? "border-red-200 bg-red-50/60 dark:bg-red-950/10 dark:border-red-900/50"
                  : "border-zinc-100 dark:border-zinc-900",
              ].join(" ")}
              title={leaveThisTime ? (leaveReason ? `ลาวอ (${warTime}) • ${leaveReason}` : `ลาวอ (${warTime})`) : undefined}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2 min-w-0">
                  <PartyCountBadge count={countMemberParties(mem)} />
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
      <span className="min-w-0 flex-1 truncate" style={style}>
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
    <div className="min-w-0 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40 flex flex-col overflow-hidden">
      {/* group color strip */}
      {groupColor ? <div className="h-1 w-full" style={{ backgroundColor: groupColor, opacity: 0.75 }} /> : null}

      {/* header */}
      <div className="flex items-center justify-end border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
        <div className="text-xs text-zinc-500 font-mono shrink-0">{p.slots.filter((s) => s.memberId).length}/6</div>
      </div>

      {/* slots — compact single-row layout */}
      <div className="flex-1 min-h-0 p-1 flex flex-col gap-1">
        {p.slots.map((s, idx) => {
          const mem = s.memberId ? members.find((m) => m.id === s.memberId) : null;

          const isTarget =
            dragOverTarget?.type === "SLOT" && dragOverTarget?.partyId === p.id && dragOverTarget?.index === idx;

          const isSelected = mem ? selectedIds.has(mem.id) : false;
          const cls = mem?.class_id ? classById.get(Number(mem.class_id)) : null;

          const leaveThisTime = mem ? isOnLeave(mem.id, warTime) : false;
          const leaveReason = mem ? getLeaveReason(mem.id) : null;

          // build tooltip: ชื่อ + remark + leave info
          const remarkParsed = mem ? parseColoredPrefix(mem.remark ?? "") : null;
          const tooltipParts: string[] = [];
          if (mem) tooltipParts.push(mem.name);
          if (remarkParsed?.text) tooltipParts.push(remarkParsed.text);
          if (leaveThisTime) tooltipParts.push(`🚫 ลาวอ (${warTime})${leaveReason ? ` • ${leaveReason}` : ""}`);
          const tooltip = tooltipParts.join(" — ");

          return (
            <div
              key={idx}
              className={[
                "flex flex-col rounded-lg border px-2 py-1 select-none",
                isTarget
                  ? "border-red-300 bg-red-50 dark:bg-red-950/20"
                  : isSelected
                    ? "border-red-300 bg-red-50 dark:bg-red-950/20"
                    : "border-zinc-100 dark:border-zinc-900",
              ].join(" ")}
              onDragOver={(e) => onDragOverSlot(e, p.id, idx)}
              onDrop={(e) => onDropOnSlot(e, p.id, idx)}
              title={tooltip || undefined}
            >
              {mem ? (
                <>
                  {/* แถวบน: ชื่อ + ปุ่ม */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    {/* drag + select area */}
                    <div
                      className="min-w-0 flex-1 flex items-center gap-1.5 cursor-pointer"
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
                      <PartyCountBadge count={countMemberParties(mem)} />
                      <ClassIcon iconUrl={cls?.icon_url} label={cls?.name ?? undefined} size={14} />
                      <div className="min-w-0 flex items-center gap-1 text-xs font-semibold flex-1">
                        <NameText m={mem} />
                        {leaveThisTime ? (
                          <span className="shrink-0 rounded bg-red-600/15 px-1 text-[9px] font-bold text-red-600 dark:text-red-400">
                            ลา
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {/* action buttons */}
                    {canEdit ? (
                      <div className="flex shrink-0 items-center gap-0.5">
                        <button
                          type="button"
                          className="rounded border border-zinc-200 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                          title="แก้ไข remark / สี"
                          onClick={(e) => { e.stopPropagation(); onOpenRemark(mem.id); }}
                        >แก้</button>
                        <button
                          type="button"
                          className="rounded border border-zinc-200 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-400 hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:border-zinc-700 dark:text-zinc-500 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                          title="เอาออกจากตี้"
                          onClick={(e) => { e.stopPropagation(); onRemoveFromSlot(p.id, idx); }}
                        >ออก</button>
                      </div>
                    ) : null}
                  </div>

                  {/* แถวล่าง: remark — แสดงเฉพาะเมื่อมีข้อมูล */}
                  {remarkParsed?.text ? (
                    <div
                      className="mt-0.5 truncate text-[10px] leading-tight text-zinc-400 dark:text-zinc-500"
                      style={remarkParsed.color ? { color: remarkParsed.color } : undefined}
                    >
                      {remarkParsed.text}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="flex items-center justify-center py-0.5 text-[10px] text-zinc-300 font-semibold tracking-widest">
                  —
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

