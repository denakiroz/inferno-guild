"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/app/components/UI";
import { supabase } from "@/lib/supabase";

type MemberRow = {
  id: number;
  name: string;
  power: number;
  class_id: number | null;
  guild: number;
  is_special?: boolean | null;
  status?: string | null;
  color?: string | null;

  // added for ultimate filter
  ultimate_skill_ids?: number[] | null;
};

type DbClass = { id: number; name: string; icon_url: string | null };
type DbUltimateSkill = { id: number; name: string; ultimate_skill_url: string | null };

type LeaveRow = {
  date_time: string; // timestamptz
  member_id: number;
  reason: string | null;
  status?: string | null;
};

type Slot = { memberId: number | null };
type Party = { id: number; name: string; slots: Slot[] };

type PlanRow = {
  id: string;
  created_at: string;
  our_name: string;
  opponent_name: string;
  match_date: string; // YYYY-MM-DD
  parties: Party[];
  note?: string | null;
};

type DragItem =
  | { type: "ROSTER"; memberId: number }
  | { type: "SLOT"; partyId: number; index: number; memberId: number };

type DragTarget =
  | { type: "SLOT"; partyId: number; index: number }
  | { type: "ROSTER_BIN" };

type RosterFilter = "unassigned" | "assigned" | "all";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}
function isSpecialMember(m: MemberRow) {
  return !!m.is_special;
}
function isActiveMember(m: MemberRow) {
  const s = String(m.status ?? "active").toLowerCase();
  return s === "active" || s === "Active".toLowerCase();
}
function createDefaultParties(): Party[] {
  return Array.from({ length: 10 }, (_, i) => ({
    id: i + 1,
    name: `ปาร์ตี้ ${i + 1}`,
    slots: Array.from({ length: 6 }, () => ({ memberId: null })),
  }));
}

export default function ClubWarBuilderClient({ canEdit }: { canEdit: boolean }) {
  const [loading, setLoading] = useState(true);

  // Flow: select date -> opponent -> arrange party
  const [matchDateISO, setMatchDateISO] = useState<string>(todayISO());
  const [ourName, setOurName] = useState("Inferno");
  const [opponentName, setOpponentName] = useState("");

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [classes, setClasses] = useState<DbClass[]>([]);
  const classById = useMemo(
    () => new Map<number, DbClass>(classes.map((c) => [Number(c.id), c])),
    [classes]
  );

  // ultimate list for filter
  const [ultimateSkills, setUltimateSkills] = useState<DbUltimateSkill[]>([]);

  // leave set for selected date (badge only — NOT excluded)
  const [leaveSet, setLeaveSet] = useState<Set<number>>(new Set());
  const leaveReasonByMemberRef = useRef<Map<number, string | null>>(new Map());

  const [parties, setParties] = useState<Party[]>(createDefaultParties());

  // Saved plans (cards)
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansPage, setPlansPage] = useState(1);
  const [plansTotal, setPlansTotal] = useState(0);
  const pageSize = 10;

  // Detail modal
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanRow | null>(null);



  // War map (capture) modal
  const [warMapOpen, setWarMapOpen] = useState(false);
  const [captureBusy, setCaptureBusy] = useState(false);
  const warMapCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const warMapViewportRef = useRef<HTMLDivElement | null>(null);
  const warMapSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const [warMapSize, setWarMapSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [warMapFit, setWarMapFit] = useState(true);
  const [warMapScale, setWarMapScale] = useState(1);
  // Roster UI
  const [q, setQ] = useState("");
  const [showLeft, setShowLeft] = useState(true);
  const [rosterFilter, setRosterFilter] = useState<RosterFilter>("unassigned");

  // Filters: class + ultimate (multi-select)
  const [classFilter, setClassFilter] = useState<Set<number>>(new Set());
  const [ultimateFilter, setUltimateFilter] = useState<Set<number>>(new Set());
  const [openClassFilter, setOpenClassFilter] = useState(false);
  const [openUltimateFilter, setOpenUltimateFilter] = useState(false);

  const assignedIds = useMemo(() => {
    const s = new Set<number>();
    for (const p of parties) for (const sl of p.slots) if (sl.memberId) s.add(sl.memberId);
    return s;
  }, [parties]);

  const baseRoster = useMemo(() => {
    // club roster only, exclude special, keep leave members (badge)
    return (members ?? [])
      .filter((m) => isActiveMember(m))
      .filter((m) => !isSpecialMember(m));
  }, [members]);

  const roster = useMemo(() => {
    const needle = q.trim().toLowerCase();

    let list = baseRoster.slice();

    // party filter
    if (rosterFilter === "unassigned") list = list.filter((m) => !assignedIds.has(m.id));
    if (rosterFilter === "assigned") list = list.filter((m) => assignedIds.has(m.id));

    // class filter
    if (classFilter.size > 0) {
      list = list.filter((m) => m.class_id != null && classFilter.has(Number(m.class_id)));
    }

    // ultimate filter (intersection)
    if (ultimateFilter.size > 0) {
      list = list.filter((m) => {
        const ids = m.ultimate_skill_ids ?? [];
        if (!Array.isArray(ids) || ids.length === 0) return false;
        for (const id of ids) if (ultimateFilter.has(Number(id))) return true;
        return false;
      });
    }

    if (needle) list = list.filter((m) => String(m.name ?? "").toLowerCase().includes(needle));

    return list.sort((a, b) => Number(b.power ?? 0) - Number(a.power ?? 0));
  }, [baseRoster, assignedIds, q, rosterFilter, classFilter, ultimateFilter]);

  const leaveCount = useMemo(() => leaveSet.size, [leaveSet.size]);

  // --------- Load classes, ultimate, club roster, leave ----------
  const loadClasses = useCallback(async () => {
    const { data, error } = await supabase.from("class").select("id,name,icon_url").order("id");
    if (!error) {
      setClasses(
        ((data ?? []) as any[]).map((x) => ({
          id: Number(x.id),
          name: String(x.name ?? ""),
          icon_url: x.icon_url ?? null,
        }))
      );
    }
  }, []);

  const loadUltimateSkills = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/ultimate-skills", { cache: "no-store" });
      if (!r.ok) return;
      const json = await r.json().catch(() => ({}));
      const list = Array.isArray(json.data) ? json.data : Array.isArray(json.items) ? json.items : Array.isArray(json.ultimate_skills) ? json.ultimate_skills : [];
      setUltimateSkills(
        (list as any[]).map((x) => ({
          id: Number(x.id),
          name: String(x.name ?? ""),
          ultimate_skill_url: x.ultimate_skill_url ?? x.url ?? null,
        }))
      );
    } catch {
      // ignore
    }
  }, []);

  const loadClubRoster = useCallback(async () => {
    const res = await fetch("/api/admin/club-roster", { cache: "no-store" });
    if (!res.ok) throw new Error(`club roster status ${res.status}`);
    const json = await res.json().catch(() => ({}));
    const list = Array.isArray(json.members) ? json.members : [];
    setMembers(list as MemberRow[]);
    return list as MemberRow[];
  }, []);

  const loadLeavesForDate = useCallback(async (memList: MemberRow[], isoDate: string) => {
    // interpret isoDate as LOCAL day range [00:00, next day 00:00)
    const [yy, mm, dd] = isoDate.split("-").map((x) => Number(x));
    if (!yy || !mm || !dd) {
      setLeaveSet(new Set());
      leaveReasonByMemberRef.current = new Map();
      return;
    }

    const startLocal = new Date(yy, mm - 1, dd, 0, 0, 0, 0);
    const endLocal = new Date(yy, mm - 1, dd, 0, 0, 0, 0);
    endLocal.setDate(endLocal.getDate() + 1);

    const ids = (memList ?? []).map((m) => Number(m.id)).filter((n) => Number.isFinite(n) && n > 0);
    if (ids.length === 0) {
      setLeaveSet(new Set());
      leaveReasonByMemberRef.current = new Map();
      return;
    }

    const { data, error } = await supabase
      .from("leave")
      .select("date_time, member_id, reason, status")
      .in("member_id", ids)
      .eq("status", "Active")
      .gte("date_time", startLocal.toISOString())
      .lt("date_time", endLocal.toISOString());

    if (error) {
      setLeaveSet(new Set());
      leaveReasonByMemberRef.current = new Map();
      return;
    }

    // Rule: if ANY leave record exists in that day => treat as leave.
    const union = new Set<number>();
    const reasonMap = new Map<number, string | null>();

    for (const r of (data ?? []) as LeaveRow[]) {
      const mid = Number(r.member_id);
      if (!Number.isFinite(mid) || !mid) continue;
      union.add(mid);
      if (!reasonMap.has(mid)) reasonMap.set(mid, r.reason ?? null);
    }

    leaveReasonByMemberRef.current = reasonMap;
    setLeaveSet(union);
  }, []);

  const initialLoad = useCallback(async (isoDate: string) => {
    setLoading(true);
    try {
      await Promise.all([loadClasses(), loadUltimateSkills()]);
      const memList = await loadClubRoster();
      await loadLeavesForDate(memList, isoDate);
    } finally {
      setLoading(false);
    }
  }, [loadClasses, loadUltimateSkills, loadClubRoster, loadLeavesForDate]);

  useEffect(() => {
    initialLoad(matchDateISO);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // reload leaves when date changes (roster stays same)
  useEffect(() => {
    (async () => {
      try {
        await loadLeavesForDate(members, matchDateISO);
      } catch {}
    })();
  }, [matchDateISO, members, loadLeavesForDate]);

  // ---------- Plans API ----------
  const loadPlans = useCallback(async (page: number) => {
    setPlansLoading(true);
    try {
      const res = await fetch(`/api/admin/club-party-plans?page=${page}&pageSize=${pageSize}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`plans status ${res.status}`);
      const json = await res.json().catch(() => ({}));
      setPlans(Array.isArray(json.items) ? (json.items as PlanRow[]) : []);
      setPlansTotal(Number(json.total ?? 0));
      setPlansPage(Number(json.page ?? page));
    } finally {
      setPlansLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlans(1);
  }, [loadPlans]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(plansTotal / pageSize)), [plansTotal]);

  // ---------- Drag & Drop ----------
  const dragItemRef = useRef<DragItem | null>(null);

  function onDragStartRoster(mid: number) {
    dragItemRef.current = { type: "ROSTER", memberId: mid };
  }
  function onDragStartSlot(partyId: number, index: number, mid: number) {
    dragItemRef.current = { type: "SLOT", partyId, index, memberId: mid };
  }
  function clearDrag() {
    dragItemRef.current = null;
  }

  function handleDrop(target: DragTarget) {
    const item = dragItemRef.current;
    if (!item) return;

    setParties((prev) => {
      const next = prev.map((p) => ({ ...p, slots: p.slots.map((s) => ({ ...s })) }));
      const findParty = (partyId: number) => next.find((x) => x.id === partyId) ?? null;

      const removeMember = (memberId: number) => {
        for (const p of next) for (const sl of p.slots) if (sl.memberId === memberId) sl.memberId = null;
      };

      if (target.type === "ROSTER_BIN") {
        if (item.type === "SLOT") {
          const p = findParty(item.partyId);
          if (!p) return prev;
          if (item.index < 0 || item.index >= p.slots.length) return prev;
          p.slots[item.index].memberId = null;
        }
        return next;
      }

      const destP = findParty(target.partyId);
      if (!destP) return prev;
      if (target.index < 0 || target.index >= destP.slots.length) return prev;

      const destMid = destP.slots[target.index].memberId;

      if (item.type === "ROSTER") {
        removeMember(item.memberId);
        destP.slots[target.index].memberId = item.memberId;
        return next;
      }

      const srcP = findParty(item.partyId);
      if (!srcP) return prev;
      if (item.partyId === target.partyId && item.index === target.index) return prev;

      // swap
      srcP.slots[item.index].memberId = destMid ?? null;
      destP.slots[target.index].memberId = item.memberId;
      return next;
    });

    clearDrag();
  }

  // ---------- Save / Load plan ----------
  const [saving, setSaving] = useState(false);

  const savePlan = useCallback(async () => {
    if (!canEdit) return;

    const dt = matchDateISO?.trim();
    if (!dt) {
      alert("กรุณาเลือกวันที่");
      return;
    }
    const opp = opponentName.trim();
    if (!opp) {
      alert("กรุณากรอกชื่อคู่ต่อสู้");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        our_name: ourName.trim() || "Inferno",
        opponent_name: opp,
        match_date: dt,
        parties,
      };

      const res = await fetch("/api/admin/club-party-plans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        console.error("save failed", json);
        alert("บันทึกไม่สำเร็จ");
        return;
      }

      await loadPlans(1);
      alert("บันทึกสำเร็จ");
    } finally {
      setSaving(false);
    }
  }, [canEdit, opponentName, matchDateISO, ourName, parties, loadPlans]);

  const openPlanDetail = useCallback((p: PlanRow) => {
    setSelectedPlan(p);
    setPlanModalOpen(true);
  }, []);

  const applyPlanToEditor = useCallback((p: PlanRow) => {
    setOurName(p.our_name || "Inferno");
    setOpponentName(p.opponent_name || "");
    setMatchDateISO(p.match_date || todayISO());
    setParties(p.parties ?? createDefaultParties());
    setPlanModalOpen(false);
  }, []);

  const deletePlan = useCallback(async (id: string) => {
    if (!canEdit) return;
    if (!confirm("ลบประวัติการ์ดนี้?")) return;

    const res = await fetch(`/api/admin/club-party-plans/${id}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.ok) {
      console.error("delete failed", json);
      alert("ลบไม่สำเร็จ (ตรวจสอบสิทธิ์/ RLS / API)");
      return;
    }
    await loadPlans(plansPage);
  }, [canEdit, loadPlans, plansPage]);

  // ---------- Render helpers ----------
  const memberById = useMemo(() => new Map<number, MemberRow>(members.map((m) => [Number(m.id), m])), [members]);

  const renderMember = (m: MemberRow) => {
    const cls = m.class_id ? classById.get(Number(m.class_id)) : null;
    const onLeave = leaveSet.has(m.id);

    const tag = assignedIds.has(m.id)
      ? (() => {
          for (const p of parties) {
            const idx = p.slots.findIndex((s) => s.memberId === m.id);
            if (idx >= 0) return `${p.name} • ช่อง ${idx + 1}`;
          }
          return "มีตี้";
        })()
      : "ว่าง";

    const reason = onLeave ? (leaveReasonByMemberRef.current.get(m.id) ?? null) : null;

    return (
      <div className="flex items-center gap-2 min-w-0">
        {cls?.icon_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cls.icon_url}
            alt={cls.name}
            className="h-6 w-6 rounded-md object-cover border border-zinc-200 dark:border-zinc-800"
          />
        ) : (
          <div className="h-6 w-6 rounded-md bg-zinc-200 dark:bg-zinc-800" />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <div className="text-sm font-semibold truncate">{m.name}</div>
            {onLeave ? (
              <span
                className="shrink-0 rounded-full border border-red-600/50 bg-red-600/10 px-2 py-0.5 text-[10px] text-red-700 dark:text-red-300"
                title={reason ? `ลา: ${reason}` : "ลา"}
              >
                ลา
              </span>
            ) : null}
          </div>

          <div className="text-[11px] text-zinc-500 truncate">
            {tag}
            {onLeave && reason ? ` • ${reason}` : ""}
          </div>
        </div>
      </div>
    );
  };

  const canSave = matchDateISO.trim() && opponentName.trim();



  // ---------- War map capture ----------
  const warMapFilename = useMemo(() => {
    const d = matchDateISO?.trim() || todayISO();
    const opp = opponentName?.trim() || "Opponent";
    const ours = ourName?.trim() || "Inferno";
    const safe = (s: string) =>
      s
        .replace(/[\/:*?"<>|]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80);
    return `${safe(ours)}_vs_${safe(opp)}_${d}.png`;
  }, [matchDateISO, opponentName, ourName]);

  const truncateText = (ctx: CanvasRenderingContext2D, text: string, maxW: number) => {
    const t = String(text ?? "");
    if (ctx.measureText(t).width <= maxW) return t;
    const ell = "…";
    let lo = 0;
    let hi = t.length;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      const sub = t.slice(0, mid) + ell;
      if (ctx.measureText(sub).width <= maxW) lo = mid + 1;
      else hi = mid;
    }
    return t.slice(0, Math.max(0, lo - 1)) + ell;
  };

  const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  };

  const drawWarMap = useCallback(() => {
    const canvas = warMapCanvasRef.current;
    if (!canvas) return;

    const DPR = Math.min(2, Math.max(1, Math.floor(window.devicePixelRatio || 1)));
    const COLS = 5;
    const PARTY_W = 320;
    const PARTY_H = 210;
    const GAP = 18;
    const PAD = 24;
    const HEADER_H = 92;

    const totalW = PAD * 2 + COLS * PARTY_W + (COLS - 1) * GAP;
    const totalH = PAD * 2 + HEADER_H + 2 * PARTY_H + GAP;

    canvas.width = totalW * DPR;
    canvas.height = totalH * DPR;

    if (warMapSizeRef.current.w !== totalW || warMapSizeRef.current.h !== totalH) {
      warMapSizeRef.current = { w: totalW, h: totalH };
      setWarMapSize({ w: totalW, h: totalH });
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    // background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, totalW, totalH);

    // header
    const title = `${ourName?.trim() || "Inferno"} vs ${opponentName?.trim() || "-"}`;
    const subtitle = `Match date: ${matchDateISO?.trim() || "-"}`;

    ctx.fillStyle = "#111827";
    ctx.font = "700 26px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(truncateText(ctx, title, totalW - PAD * 2), PAD, PAD + 28);

    ctx.fillStyle = "#6b7280";
    ctx.font = "400 14px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(subtitle, PAD, PAD + 52);

    ctx.fillStyle = "#9ca3af";
    ctx.font = "400 12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Generated from Club War Builder", PAD, PAD + 72);

    // parties grid
    const list = parties ?? [];
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      const row = Math.floor(i / COLS);
      const col = i % COLS;

      const x = PAD + col * (PARTY_W + GAP);
      const y = PAD + HEADER_H + row * (PARTY_H + GAP);

      // card
      ctx.save();
      roundRect(ctx, x, y, PARTY_W, PARTY_H, 16);
      ctx.fillStyle = "#f8fafc";
      ctx.fill();
      ctx.strokeStyle = "#e5e7eb";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      // party title
      ctx.fillStyle = "#111827";
      ctx.font = "700 16px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.fillText(truncateText(ctx, `#${p.id} ${p.name}`, PARTY_W - 18), x + 12, y + 26);

      // slots
      const baseY = y + 50;
      const lineH = 24;
      const maxTextW = PARTY_W - 24;

      for (let s = 0; s < 6; s++) {
        const mid = p.slots?.[s]?.memberId ?? null;
        const mem = mid ? memberById.get(Number(mid)) : null;

        const yy = baseY + s * lineH;

        // line background
        ctx.save();
        roundRect(ctx, x + 10, yy - 16, PARTY_W - 20, 20, 10);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.strokeStyle = "#f1f5f9";
        ctx.stroke();
        ctx.restore();

        const left = x + 18;
        const slotNo = `${s + 1}.`;

        ctx.fillStyle = "#6b7280";
        ctx.font = "600 12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
        ctx.fillText(slotNo, left, yy);

        const nameX = left + 22;
        const nameMax = maxTextW - 44;

        if (!mem) {
          ctx.fillStyle = "#9ca3af";
          ctx.font = "500 13px system-ui, -apple-system, Segoe UI, Roboto, Arial";
          ctx.fillText("-", nameX, yy);
          continue;
        }

        const onLeave = leaveSet.has(Number(mem.id));
        const text = `${mem.name}${onLeave ? " • ลา" : ""}`;

        ctx.fillStyle = onLeave ? "#b91c1c" : "#111827";
        ctx.font = "500 13px system-ui, -apple-system, Segoe UI, Roboto, Arial";
        ctx.fillText(truncateText(ctx, text, nameMax), nameX, yy);
      }
    }
  }, [leaveSet, matchDateISO, memberById, opponentName, ourName, parties]);

  useEffect(() => {
    if (!warMapOpen) return;
    const id = window.requestAnimationFrame(() => drawWarMap());
    return () => window.cancelAnimationFrame(id);
  }, [warMapOpen, drawWarMap]);

  useEffect(() => {
    if (!warMapOpen) return;

    if (!warMapFit) {
      setWarMapScale(1);
      return;
    }

    const compute = () => {
      const el = warMapViewportRef.current;
      const w = warMapSize.w;
      const h = warMapSize.h;
      if (!el || !w || !h) return;

      // keep a little breathing room for borders/padding
      const availW = Math.max(0, el.clientWidth - 8);
      const availH = Math.max(0, el.clientHeight - 8);

      const s = Math.min(1, availW / w, availH / h);
      setWarMapScale(Number.isFinite(s) && s > 0 ? s : 1);
    };

    // run after layout & after canvas is drawn
    const id = window.requestAnimationFrame(compute);
    window.addEventListener("resize", compute);
    return () => {
      window.cancelAnimationFrame(id);
      window.removeEventListener("resize", compute);
    };
  }, [warMapOpen, warMapFit, warMapSize.w, warMapSize.h]);
  
  const canvasToBlob = (canvas: HTMLCanvasElement) =>
    new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png");
    });

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const copyWarMapToClipboard = useCallback(async () => {
    const canvas = warMapCanvasRef.current;
    if (!canvas) return;

    setCaptureBusy(true);
    try {
      drawWarMap();
      const blob = await canvasToBlob(canvas);

      const ClipboardItemCtor = (window as any).ClipboardItem;
      if (navigator.clipboard && ClipboardItemCtor) {
        await navigator.clipboard.write([new ClipboardItemCtor({ "image/png": blob })]);
        alert("คัดลอกภาพผังทัพวอแล้ว");
        return;
      }

      downloadBlob(blob, warMapFilename);
      alert("เบราว์เซอร์นี้ไม่รองรับคัดลอกภาพ: ดาวน์โหลดไฟล์แทนแล้ว");
    } catch (e) {
      console.error(e);
      alert("คัดลอกภาพไม่สำเร็จ");
    } finally {
      setCaptureBusy(false);
    }
  }, [drawWarMap, warMapFilename]);

  const downloadWarMap = useCallback(async () => {
    const canvas = warMapCanvasRef.current;
    if (!canvas) return;

    setCaptureBusy(true);
    try {
      drawWarMap();
      const blob = await canvasToBlob(canvas);
      downloadBlob(blob, warMapFilename);
    } catch (e) {
      console.error(e);
      alert("ดาวน์โหลดไม่สำเร็จ");
    } finally {
      setCaptureBusy(false);
    }
  }, [drawWarMap, warMapFilename]);
  // ---------- Filter helpers ----------
  const toggleSet = (set: Set<number>, id: number) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };

  // ---------- UI ----------
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/40 p-3">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-2">
          <div className="xl:col-span-3 flex items-center gap-2">
            <div className="text-xs text-zinc-500 w-14">วันที่</div>
            <input
              type="date"
              value={matchDateISO}
              onChange={(e) => setMatchDateISO(e.target.value)}
              className="h-9 flex-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/60 px-3 text-sm"
            />
          </div>

          <div className="xl:col-span-3 flex items-center gap-2">
            <div className="text-xs text-zinc-500 w-14">ฝ่ายเรา</div>
            <input
              value={ourName}
              onChange={(e) => setOurName(e.target.value)}
              className="h-9 flex-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/60 px-3 text-sm"
            />
          </div>

          <div className="xl:col-span-4 flex items-center gap-2">
            <div className="text-xs text-zinc-500 w-20">คู่ต่อสู้</div>
            <input
              value={opponentName}
              onChange={(e) => setOpponentName(e.target.value)}
              placeholder="กรอกชื่อคู่ต่อสู้"
              className="h-9 flex-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/60 px-3 text-sm"
            />
          </div>

          <div className="xl:col-span-2 flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowLeft((v) => !v)}
              className="h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 text-sm"
            >
              {showLeft ? "ซ่อน Roster" : "แสดง Roster"}
            </button>

            

            <button
              type="button"
              onClick={() => setWarMapOpen(true)}
              className="h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 text-sm"
              title="แสดงผังทัพวอและแคปเป็นรูป"
            >
              ผังทัพวอ
            </button>

            <Button onClick={savePlan} disabled={!canEdit || saving || !canSave} className="h-9 rounded-xl">
              {saving ? "กำลังบันทึก..." : "บันทึกเป็นการ์ด"}
            </Button>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
          <div>
            คนลา (ตามวันที่ที่เลือก):{" "}
            <span className="font-semibold text-zinc-700 dark:text-zinc-200">{leaveCount}</span>
          </div>
          <button type="button" onClick={() => initialLoad(matchDateISO)} className="underline">
            รีเฟรชรายชื่อ/วันลา
          </button>
          <div className="ml-auto">{canSave ? null : <span className="text-amber-600">เลือกวันที่ + ใส่ชื่อคู่ต่อสู้ก่อน</span>}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {showLeft ? (
          <div className="lg:col-span-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/40 p-3">
            <div className="flex items-center gap-2">
              <div className="font-semibold">Roster (Club)</div>
              <div className="ml-auto text-xs text-zinc-500">{roster.length}</div>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={cn(
                  "h-8 px-3 rounded-xl border text-xs",
                  rosterFilter === "unassigned" ? "border-red-600 text-red-600" : "border-zinc-200 dark:border-zinc-800"
                )}
                onClick={() => setRosterFilter("unassigned")}
              >
                ไม่มีตี้
              </button>
              <button
                type="button"
                className={cn(
                  "h-8 px-3 rounded-xl border text-xs",
                  rosterFilter === "assigned" ? "border-red-600 text-red-600" : "border-zinc-200 dark:border-zinc-800"
                )}
                onClick={() => setRosterFilter("assigned")}
              >
                มีตี้
              </button>
              <button
                type="button"
                className={cn(
                  "h-8 px-3 rounded-xl border text-xs",
                  rosterFilter === "all" ? "border-red-600 text-red-600" : "border-zinc-200 dark:border-zinc-800"
                )}
                onClick={() => setRosterFilter("all")}
              >
                ทั้งหมด
              </button>

              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  className={cn(
                    "h-8 px-3 rounded-xl border text-xs",
                    classFilter.size > 0 ? "border-red-600 text-red-600" : "border-zinc-200 dark:border-zinc-800"
                  )}
                  onClick={() => {
                    setOpenClassFilter((v) => !v);
                    setOpenUltimateFilter(false);
                  }}
                >
                  อาชีพ{classFilter.size > 0 ? ` (${classFilter.size})` : ""}
                </button>
                <button
                  type="button"
                  className={cn(
                    "h-8 px-3 rounded-xl border text-xs",
                    ultimateFilter.size > 0 ? "border-red-600 text-red-600" : "border-zinc-200 dark:border-zinc-800"
                  )}
                  onClick={() => {
                    setOpenUltimateFilter((v) => !v);
                    setOpenClassFilter(false);
                  }}
                >
                  Ultimate{ultimateFilter.size > 0 ? ` (${ultimateFilter.size})` : ""}
                </button>
              </div>
            </div>

            {openClassFilter ? (
              <div className="mt-2 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/40 p-2">
                <div className="flex items-center gap-2">
                  <div className="text-xs font-semibold">กรองอาชีพ</div>
                  <button
                    type="button"
                    className="ml-auto text-xs underline text-zinc-500"
                    onClick={() => setClassFilter(new Set())}
                  >
                    ล้าง
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 max-h-40 overflow-auto pr-1">
                  {classes.map((c) => {
                    const checked = classFilter.has(Number(c.id));
                    return (
                      <button
                        key={c.id}
                        type="button"
                        className={cn(
                          "flex items-center gap-2 rounded-xl border px-2 py-1 text-xs",
                          checked ? "border-red-600 text-red-600" : "border-zinc-200 dark:border-zinc-800"
                        )}
                        onClick={() => setClassFilter((prev) => toggleSet(prev, Number(c.id)))}
                      >
                        {c.icon_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.icon_url} alt={c.name} className="h-5 w-5 rounded-md object-cover" />
                        ) : (
                          <div className="h-5 w-5 rounded-md bg-zinc-200 dark:bg-zinc-800" />
                        )}
                        <span className="truncate">{c.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {openUltimateFilter ? (
              <div className="mt-2 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/40 p-2">
                <div className="flex items-center gap-2">
                  <div className="text-xs font-semibold">กรอง Ultimate</div>
                  <button
                    type="button"
                    className="ml-auto text-xs underline text-zinc-500"
                    onClick={() => setUltimateFilter(new Set())}
                  >
                    ล้าง
                  </button>
                </div>
                <div className="mt-2 space-y-2 max-h-52 overflow-auto pr-1">
                  {ultimateSkills.map((u) => {
                    const checked = ultimateFilter.has(Number(u.id));
                    return (
                      <button
                        key={u.id}
                        type="button"
                        className={cn(
                          "w-full flex items-center gap-2 rounded-xl border px-2 py-1 text-xs text-left",
                          checked ? "border-red-600 text-red-600" : "border-zinc-200 dark:border-zinc-800"
                        )}
                        onClick={() => setUltimateFilter((prev) => toggleSet(prev, Number(u.id)))}
                        title={u.name}
                      >
                        {u.ultimate_skill_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={u.ultimate_skill_url} alt={u.name} className="h-5 w-5 rounded-md object-cover" />
                        ) : (
                          <div className="h-5 w-5 rounded-md bg-zinc-200 dark:bg-zinc-800" />
                        )}
                        <span className="truncate">{u.name}</span>
                      </button>
                    );
                  })}
                  {ultimateSkills.length === 0 ? (
                    <div className="text-xs text-zinc-500">ไม่พบ ultimate (ตรวจสอบ /api/admin/ultimate-skills)</div>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="mt-2">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ค้นหาชื่อ..."
                className="h-9 w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/60 px-3 text-sm"
              />
            </div>

            <div
              className="mt-2 space-y-2 max-h-[70vh] overflow-auto pr-1"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop({ type: "ROSTER_BIN" })}
            >
              {loading ? (
                <div className="text-sm text-zinc-500">กำลังโหลด...</div>
              ) : roster.length === 0 ? (
                <div className="text-sm text-zinc-500">ไม่มีสมาชิกให้เลือก</div>
              ) : (
                roster.map((m) => {
                  const onLeave = leaveSet.has(m.id);
                  const draggable = canEdit && !onLeave;
                  return (
                    <div
                      key={m.id}
                      draggable={draggable}
                      onDragStart={() => draggable && onDragStartRoster(m.id)}
                      onDragEnd={clearDrag}
                      className={cn(
                        "rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/60 p-2",
                        draggable ? "cursor-grab active:cursor-grabbing" : "opacity-70 cursor-not-allowed"
                      )}
                      title={onLeave ? `ลา: ${leaveReasonByMemberRef.current.get(m.id) ?? ""}` : undefined}
                    >
                      {renderMember(m)}
                      {onLeave ? (
                        <div className="mt-1 text-[10px] text-zinc-500">
                          * คนลาวันนี้: ลากลงตี้ไม่ได้ (แสดงไว้เพื่อเช็ค)
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : null}

        <div
          className={cn(
            showLeft ? "lg:col-span-6" : "lg:col-span-9",
            "rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/40 p-3"
          )}
        >
          <div className="flex items-center gap-2">
            <div className="font-semibold">จัดปาร์ตี้ (10 x 6 = 60)</div>
            <div className="ml-auto text-xs text-zinc-500">Drag & Drop • ลากลงช่องว่างเพื่อเอาออก</div>
          </div>

          <div className="mt-3 grid grid-cols-1 xl:grid-cols-2 gap-3">
            {parties.map((p) => (
              <div key={p.id} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/60 p-3">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold">#{p.id}</div>
                  <input
                    value={p.name}
                    onChange={(e) => {
                      const v = e.target.value;
                      setParties((prev) => prev.map((x) => (x.id === p.id ? { ...x, name: v } : x)));
                    }}
                    disabled={!canEdit}
                    className="h-8 flex-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/40 px-3 text-sm"
                  />
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => {
                      if (!confirm(`ล้างสมาชิกใน ${p.name}?`)) return;
                      setParties((prev) => prev.map((x) => (x.id === p.id ? { ...x, slots: x.slots.map(() => ({ memberId: null })) } : x)));
                    }}
                    className="h-8 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs"
                  >
                    ล้าง
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {p.slots.map((sl, idx) => {
                    const mid = sl.memberId;
                    const mem = mid ? memberById.get(mid) : null;
                    return (
                      <div
                        key={idx}
                        className={cn(
                          "h-16 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/40 p-2",
                          canEdit ? "cursor-pointer" : "opacity-80"
                        )}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => handleDrop({ type: "SLOT", partyId: p.id, index: idx })}
                      >
                        {mem ? (
                          <div
                            draggable={canEdit}
                            onDragStart={() => onDragStartSlot(p.id, idx, mem.id)}
                            onDragEnd={clearDrag}
                            className="h-full flex items-center gap-2 cursor-grab active:cursor-grabbing"
                            title={mem.name}
                          >
                            {renderMember(mem)}
                          </div>
                        ) : (
                          <div className="h-full flex items-center justify-center text-xs text-zinc-400">ว่าง</div>
                        )}

                        {mem && canEdit ? (
                          <div className="mt-1 flex justify-end">
                            <button
                              type="button"
                              className="text-[11px] text-zinc-500 underline"
                              onClick={() => {
                                setParties((prev) => {
                                  const next = prev.map((x) => ({ ...x, slots: x.slots.map((s) => ({ ...s })) }));
                                  const pp = next.find((x) => x.id === p.id)!;
                                  pp.slots[idx].memberId = null;
                                  return next;
                                });
                              }}
                            >
                              เอาออก
                            </button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/40 p-3">
          <div className="flex items-center gap-2">
            <div className="font-semibold">ประวัติการ์ด</div>
            <div className="ml-auto text-xs text-zinc-500">{plansLoading ? "กำลังโหลด..." : `${plansTotal}`}</div>
          </div>

          <div className="mt-2 space-y-2 max-h-[70vh] overflow-auto pr-1">
            {plans.map((p) => (
              <div key={p.id} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/60 p-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">
                      {p.our_name} vs {p.opponent_name}
                    </div>
                    <div className="text-xs text-zinc-500">{p.match_date}</div>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <button type="button" className="text-xs underline" onClick={() => openPlanDetail(p)}>
                      ดู
                    </button>
                    {canEdit ? (
                      <button type="button" className="text-xs underline text-red-600" onClick={() => deletePlan(p.id)}>
                        ลบ
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    className="h-8 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs"
                    onClick={() => applyPlanToEditor(p)}
                  >
                    โหลดมาแก้ไข
                  </button>
                </div>
              </div>
            ))}

            {plans.length === 0 && !plansLoading ? <div className="text-sm text-zinc-500">ยังไม่มีประวัติ</div> : null}
          </div>

          <div className="mt-2 flex items-center justify-between">
            <button
              type="button"
              className="h-8 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs"
              disabled={plansPage <= 1}
              onClick={() => loadPlans(Math.max(1, plansPage - 1))}
            >
              ก่อนหน้า
            </button>
            <div className="text-xs text-zinc-500">
              {plansPage} / {totalPages}
            </div>
            <button
              type="button"
              className="h-8 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs"
              disabled={plansPage >= totalPages}
              onClick={() => loadPlans(Math.min(totalPages, plansPage + 1))}
            >
              ถัดไป
            </button>
          </div>
        </div>
      </div>

      

      {warMapOpen ? (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setWarMapOpen(false)} />
          <div className="relative w-full max-w-[95vw] max-h-[95vh] rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
            <div className="flex items-start gap-2">
              <div className="min-w-0">
                <div className="text-lg font-semibold truncate">ผังทัพวอ (สำหรับแคป)</div>
                <div className="text-sm text-zinc-500 truncate">
                  {ourName || "Inferno"} vs {opponentName || "-"} • {matchDateISO}
                </div>
              </div>

              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  className="h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 text-sm"
                  onClick={() => setWarMapFit((v) => !v)}
                  title={warMapFit ? "สลับเป็น 100% (เลื่อนได้)" : "สลับเป็นพอดีจอ"}
                >
                  {warMapFit ? "100%" : "พอดีจอ"}
                </button>
                <button
                  type="button"
                  className="h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 text-sm"
                  onClick={drawWarMap}
                  disabled={captureBusy}
                >
                  รีเฟรช
                </button>
                <button
                  type="button"
                  className="h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 text-sm"
                  onClick={copyWarMapToClipboard}
                  disabled={captureBusy}
                >
                  {captureBusy ? "กำลังทำ..." : "คัดลอกภาพ"}
                </button>
                <button
                  type="button"
                  className="h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 text-sm"
                  onClick={downloadWarMap}
                  disabled={captureBusy}
                >
                  ดาวน์โหลด PNG
                </button>
                <button
                  type="button"
                  className="h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 text-sm"
                  onClick={() => setWarMapOpen(false)}
                >
                  ปิด
                </button>
              </div>
            </div>

            <div
              ref={warMapViewportRef}
              className={cn(
                "mt-3 h-[75vh] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/40 p-2",
                warMapFit ? "overflow-hidden" : "overflow-auto"
              )}
            >
              <canvas
                ref={warMapCanvasRef}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white"
                style={{
                  width: warMapSize.w
                    ? `${Math.round(warMapSize.w * (warMapFit ? warMapScale : 1))}px`
                    : undefined,
                  height: warMapSize.h
                    ? `${Math.round(warMapSize.h * (warMapFit ? warMapScale : 1))}px`
                    : undefined,
                }}
              />
            </div>

            <div className="mt-2 text-xs text-zinc-500">
              * ถ้ากด “คัดลอกภาพ” ไม่ได้ เบราว์เซอร์จะดาวน์โหลดไฟล์ PNG ให้อัตโนมัติ
            </div>
          </div>
        </div>
      ) : null}
{planModalOpen && selectedPlan ? (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setPlanModalOpen(false)} />
          <div className="relative w-full max-w-4xl rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
            <div className="flex items-start gap-2">
              <div className="min-w-0">
                <div className="text-lg font-semibold truncate">
                  {selectedPlan.our_name} vs {selectedPlan.opponent_name}
                </div>
                <div className="text-sm text-zinc-500">{selectedPlan.match_date}</div>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  className="h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 text-sm"
                  onClick={() => applyPlanToEditor(selectedPlan)}
                >
                  โหลดมาแก้ไข
                </button>
                <button
                  type="button"
                  className="h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 text-sm"
                  onClick={() => setPlanModalOpen(false)}
                >
                  ปิด
                </button>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[70vh] overflow-auto pr-1">
              {(selectedPlan.parties ?? []).map((p) => (
                <div key={p.id} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/40 p-3">
                  <div className="font-semibold text-sm">
                    #{p.id} {p.name}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {p.slots.map((sl, i) => {
                      const mem = sl.memberId ? memberById.get(Number(sl.memberId)) : null;
                      return (
                        <div key={i} className="h-14 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/40 p-2">
                          {mem ? renderMember(mem) : <div className="h-full flex items-center justify-center text-xs text-zinc-400">ว่าง</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
