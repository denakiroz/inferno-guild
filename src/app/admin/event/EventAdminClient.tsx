"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
type EventRow = {
  id: string;
  name: string;
  description: string | null;
  status: "open" | "closed" | "finished";
  created_at: string;
  registration_count: number;
};

type Registration = {
  id: string;
  discord_user_id: string;
  member_name: string | null;
  registered_at: string;
  class_name: string;
  class_icon: string;
};

type PartyMember = {
  discord_user_id: string;
  member_name: string;
  class_name: string;
  class_icon: string;
  position: number;
};

const PARTY_MAX_SIZE = 6;

type Party = {
  id: string;
  name: string;
  color: string;
  members: PartyMember[];
};

type Match = {
  id: string;
  round: number;
  match_order: number;
  status: "pending" | "done";
  winner_party_id: string | null;
  played_at: string | null;
  party1: { id: string; name: string; color: string } | null;
  party2: { id: string; name: string; color: string } | null;
  winner: { id: string; name: string; color: string } | null;
};

type Tab = "events" | "registrations" | "parties" | "league";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = { open: "เปิดรับสมัคร", closed: "ปิดรับสมัคร", finished: "จบแล้ว" };
const STATUS_COLOR: Record<string, string> = {
  open:     "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400",
  closed:   "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400",
  finished: "bg-zinc-100 dark:bg-zinc-800 text-zinc-500",
};

const PARTY_COLORS = [
  "#ef4444","#f97316","#eab308","#22c55e",
  "#06b6d4","#6366f1","#a855f7","#ec4899",
];

function colorSwatch(hex: string) {
  return <span className="inline-block w-3 h-3 rounded-full border border-white/20 shadow-sm" style={{ background: hex }} />;
}

// ─── Standing calculator ──────────────────────────────────────────────────────
function calcStandings(parties: Party[], matches: Match[]) {
  const map = new Map<string, { name: string; color: string; w: number; l: number; d: number; pts: number }>();
  for (const p of parties) map.set(p.id, { name: p.name, color: p.color, w: 0, l: 0, d: 0, pts: 0 });

  for (const m of matches) {
    if (m.status !== "done" || !m.winner_party_id) continue;
    const loserPartyId = m.winner_party_id === m.party1?.id ? m.party2?.id : m.party1?.id;
    const winner = map.get(m.winner_party_id);
    const loser  = loserPartyId ? map.get(loserPartyId) : undefined;
    if (winner) { winner.w++; winner.pts += 3; }
    if (loser)  { loser.l++; }
  }

  return Array.from(map.entries())
    .map(([id, s]) => ({ id, ...s, played: s.w + s.l }))
    .sort((a, b) => b.pts - a.pts || b.w - a.w);
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function EventAdminClient() {
  const [tab, setTab] = useState<Tab>("events");

  // Events list
  const [events, setEvents]       = useState<EventRow[]>([]);
  const [loadingEvents, setLE]    = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<EventRow | null>(null);
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [newEventName, setNewEventName]   = useState("");
  const [newEventDesc, setNewEventDesc]   = useState("");
  const [savingEvent, setSavingEvent]     = useState(false);

  // Registrations
  const [regs, setRegs]           = useState<Registration[]>([]);
  const [loadingRegs, setLoadingRegs] = useState(false);

  // Parties
  const [parties, setParties]     = useState<Party[]>([]);
  const [loadingParties, setLP]   = useState(false);
  const [newPartyName, setNewPartyName]   = useState("");
  const [newPartyColor, setNewPartyColor] = useState(PARTY_COLORS[0]);
  const [savingParty, setSavingParty]     = useState(false);
  // Assign member from regs to party
  const [assigningUid, setAssigningUid]     = useState<string | null>(null);
  const [assignToParty, setAssignToParty]   = useState<string>("");
  const [assignToPosition, setAssignToPosition] = useState<number | null>(null);
  // Rename party (inline)
  const [renamingPartyId, setRenamingPartyId] = useState<string | null>(null);
  const [renamingPartyName, setRenamingPartyName] = useState("");
  // Recolor party (inline popover)
  const [colorPickerPid, setColorPickerPid] = useState<string | null>(null);
  // ลำดับที่ยังไม่บันทึก (แต่ละ party id ที่มีการเลื่อน)
  const [dirtyPartyIds, setDirtyPartyIds] = useState<Set<string>>(new Set());
  const [savingOrder, setSavingOrder] = useState(false);
  // ref ให้ async callback อ่าน parties ล่าสุดได้ (หลัง await)
  const partiesRef = useRef<Party[]>(parties);
  useEffect(() => { partiesRef.current = parties; }, [parties]);

  // League
  const [matches, setMatches]     = useState<Match[]>([]);
  const [loadingMatches, setLM]   = useState(false);
  const [generatingLeague, setGL] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  // Confirm modal สำหรับเปลี่ยนสถานะ event
  const [confirmStatus, setConfirmStatus] = useState<{
    eventId: string;
    eventName: string;
    currentStatus: "open" | "closed" | "finished";
    newStatus: "open" | "closed" | "finished";
  } | null>(null);
  const [statusChanging, setStatusChanging] = useState(false);

  // Confirm modal สำหรับลบผู้สมัคร
  const [confirmDeleteReg, setConfirmDeleteReg] = useState<{
    discord_user_id: string;
    member_name: string;
  } | null>(null);
  const [deletingReg, setDeletingReg] = useState(false);

  // Registrations sort
  type RegSortField = "name" | "class" | "date";
  const [regSortField, setRegSortField] = useState<RegSortField>("date");
  const [regSortDir, setRegSortDir]     = useState<"asc" | "desc">("asc");
  const toggleRegSort = (field: RegSortField) => {
    if (regSortField === field) {
      setRegSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setRegSortField(field);
      setRegSortDir(field === "date" ? "desc" : "asc");
    }
  };
  const sortIcon = (field: RegSortField) => {
    if (regSortField !== field) return "↕";
    return regSortDir === "asc" ? "↑" : "↓";
  };

  // ── Load events ──
  const loadEvents = useCallback(async () => {
    setLE(true);
    try {
      const res = await fetch("/api/admin/events", { cache: "no-store" });
      const json = await res.json();
      if (json.ok) setEvents(json.items ?? []);
    } finally { setLE(false); }
  }, []);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  // ── Load registrations ──
  const loadRegs = useCallback(async (eventId: string) => {
    setLoadingRegs(true);
    try {
      const res = await fetch(`/api/admin/events/${eventId}/registrations`, { cache: "no-store" });
      const json = await res.json();
      if (json.ok) setRegs(json.items ?? []);
    } finally { setLoadingRegs(false); }
  }, []);

  // ── Load parties ──
  const loadParties = useCallback(async (eventId: string) => {
    setLP(true);
    try {
      const res = await fetch(`/api/admin/events/${eventId}/parties`, { cache: "no-store" });
      const json = await res.json();
      if (json.ok) setParties(json.items ?? []);
    } finally { setLP(false); }
  }, []);

  // ── Load matches ──
  const loadMatches = useCallback(async (eventId: string) => {
    setLM(true);
    try {
      const res = await fetch(`/api/admin/events/${eventId}/matches`, { cache: "no-store" });
      const json = await res.json();
      if (json.ok) setMatches(json.items ?? []);
    } finally { setLM(false); }
  }, []);

  // When tab or selectedEvent changes, load data
  useEffect(() => {
    if (!selectedEvent) return;
    if (tab === "registrations") loadRegs(selectedEvent.id);
    if (tab === "parties")       { loadParties(selectedEvent.id); loadRegs(selectedEvent.id); }
    if (tab === "league")        { loadMatches(selectedEvent.id); loadParties(selectedEvent.id); }
  }, [tab, selectedEvent, loadRegs, loadParties, loadMatches]);

  // ── Create event ──
  const createEvent = async () => {
    if (!newEventName.trim()) return;
    setSavingEvent(true);
    try {
      const res = await fetch("/api/admin/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: newEventName.trim(), description: newEventDesc.trim() || undefined }),
      });
      const json = await res.json();
      if (!json.ok) { showToast(json.error ?? "สร้างไม่สำเร็จ", false); return; }
      showToast("สร้าง Event สำเร็จ ✓");
      setCreatingEvent(false);
      setNewEventName("");
      setNewEventDesc("");
      await loadEvents();
    } finally { setSavingEvent(false); }
  };

  // ── Change event status (ยืนยันก่อน) ──
  const requestStatusChange = (
    eventId: string,
    eventName: string,
    currentStatus: "open" | "closed" | "finished",
    newStatus: "open" | "closed" | "finished"
  ) => {
    setConfirmStatus({ eventId, eventName, currentStatus, newStatus });
  };

  const doStatusChange = async () => {
    if (!confirmStatus) return;
    setStatusChanging(true);
    try {
      await fetch(`/api/admin/events/${confirmStatus.eventId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: confirmStatus.newStatus }),
      });
      await loadEvents();
      if (selectedEvent?.id === confirmStatus.eventId) {
        setSelectedEvent((e) => e ? { ...e, status: confirmStatus.newStatus } : e);
      }
      showToast(`เปลี่ยนเป็น "${STATUS_LABEL[confirmStatus.newStatus]}" แล้ว`);
      setConfirmStatus(null);
    } finally {
      setStatusChanging(false);
    }
  };

  // ── Delete registration (ยืนยันก่อน) ──
  const doDeleteRegistration = async () => {
    if (!confirmDeleteReg || !selectedEvent) return;
    setDeletingReg(true);
    try {
      await fetch(`/api/admin/events/${selectedEvent.id}/registrations`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ discord_user_id: confirmDeleteReg.discord_user_id }),
      });
      await loadRegs(selectedEvent.id);
      showToast("ลบผู้สมัครแล้ว");
      setConfirmDeleteReg(null);
    } finally {
      setDeletingReg(false);
    }
  };

  // ── Create party ──
  const createParty = async () => {
    if (!selectedEvent || !newPartyName.trim()) return;
    setSavingParty(true);
    try {
      const res = await fetch(`/api/admin/events/${selectedEvent.id}/parties`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: newPartyName.trim(), color: newPartyColor }),
      });
      const json = await res.json();
      if (!json.ok) { showToast(json.error ?? "สร้างไม่สำเร็จ", false); return; }
      setNewPartyName("");
      setNewPartyColor(PARTY_COLORS[(parties.length + 1) % PARTY_COLORS.length]);
      await loadParties(selectedEvent.id);
    } finally { setSavingParty(false); }
  };

  // ── Delete party ──
  const deleteParty = async (pid: string) => {
    if (!selectedEvent) return;
    // optimistic
    setParties((prev) => prev.filter((p) => p.id !== pid));
    const res = await fetch(`/api/admin/events/${selectedEvent.id}/parties/${pid}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({ ok: false }));
    if (!json.ok) {
      showToast("ลบไม่สำเร็จ", false);
      await loadParties(selectedEvent.id); // rollback
      return;
    }
    showToast("ลบปาร์ตี้แล้ว");
  };

  // ── Rename party (optimistic inline) ──
  const renameParty = async (pid: string, newName: string) => {
    if (!selectedEvent) return;
    const trimmed = newName.trim();
    if (!trimmed) {
      setRenamingPartyId(null);
      return;
    }
    const original = parties.find((p) => p.id === pid);
    if (!original || original.name === trimmed) {
      setRenamingPartyId(null);
      return;
    }

    // optimistic
    setParties((prev) => prev.map((p) => (p.id === pid ? { ...p, name: trimmed } : p)));
    setRenamingPartyId(null);

    const res = await fetch(`/api/admin/events/${selectedEvent.id}/parties/${pid}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    const json = await res.json().catch(() => ({ ok: false }));
    if (!json.ok) {
      showToast(json.error ?? "เปลี่ยนชื่อไม่สำเร็จ", false);
      // rollback
      setParties((prev) => prev.map((p) => (p.id === pid ? { ...p, name: original.name } : p)));
    }
  };

  // ── Recolor party (optimistic inline) ──
  const recolorParty = async (pid: string, newColor: string) => {
    if (!selectedEvent) return;
    const original = parties.find((p) => p.id === pid);
    if (!original || original.color === newColor) {
      setColorPickerPid(null);
      return;
    }

    // optimistic
    setParties((prev) => prev.map((p) => (p.id === pid ? { ...p, color: newColor } : p)));
    setColorPickerPid(null);

    const res = await fetch(`/api/admin/events/${selectedEvent.id}/parties/${pid}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ color: newColor }),
    });
    const json = await res.json().catch(() => ({ ok: false }));
    if (!json.ok) {
      showToast(json.error ?? "เปลี่ยนสีไม่สำเร็จ", false);
      // rollback
      setParties((prev) => prev.map((p) => (p.id === pid ? { ...p, color: original.color } : p)));
    }
  };

  // ── Assign member to party — validate + optimistic ──
  const assignMember = async (
    uid: string,
    memberName: string,
    partyId: string,
    position: number,
    classInfo?: { class_name: string; class_icon: string }
  ) => {
    if (!selectedEvent || !partyId) return;

    const targetParty = parties.find((p) => p.id === partyId);
    if (!targetParty) return;

    // client-side validate (เสริม server)
    if (targetParty.members.length >= PARTY_MAX_SIZE) {
      showToast(`ปาร์ตี้ "${targetParty.name}" เต็มแล้ว (6/6)`, false);
      return;
    }
    if (targetParty.members.some((m) => m.position === position)) {
      showToast(`ตำแหน่งที่ ${position + 1} มีคนอยู่แล้ว`, false);
      return;
    }

    // optimistic: เพิ่มลง state ทันที (sorted by position asc)
    setParties((prev) => prev.map((p) => {
      if (p.id !== partyId) return p;
      if (p.members.some((m) => m.discord_user_id === uid)) return p;
      const next: PartyMember[] = [
        ...p.members,
        {
          discord_user_id: uid,
          member_name: memberName,
          class_name: classInfo?.class_name ?? "",
          class_icon: classInfo?.class_icon ?? "",
          position,
        },
      ].sort((a, b) => a.position - b.position);
      return { ...p, members: next };
    }));
    setAssigningUid(null);
    setAssignToParty("");
    setAssignToPosition(null);

    const res = await fetch(`/api/admin/events/${selectedEvent.id}/parties/${partyId}/members`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ discord_user_id: uid, member_name: memberName, position }),
    });
    const json = await res.json().catch(() => ({ ok: false }));
    if (!json.ok) {
      showToast(json.error ?? "กำหนดไม่สำเร็จ", false);
      await loadParties(selectedEvent.id); // rollback
    }
  };

  // ── Move member up/down within party (local only — instant, ไม่ยิง API) ──
  //    bounds check แบบ synchronous ผ่าน partiesRef
  //    (React queue setState updater ไปรอบ render ถัดไป เลยอย่าใช้ flag จากใน updater)
  const moveMember = (pid: string, uid: string, direction: "up" | "down") => {
    const cur = partiesRef.current.find((p) => p.id === pid);
    if (!cur) return;
    const idx = cur.members.findIndex((m) => m.discord_user_id === uid);
    if (idx < 0) return;
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= cur.members.length) return;

    setParties((prev) => prev.map((p) => {
      if (p.id !== pid) return p;
      const i = p.members.findIndex((m) => m.discord_user_id === uid);
      if (i < 0) return p;
      const ni = direction === "up" ? i - 1 : i + 1;
      if (ni < 0 || ni >= p.members.length) return p;
      const arr = [...p.members];
      [arr[i], arr[ni]] = [arr[ni], arr[i]];
      return { ...p, members: arr };
    }));
    setDirtyPartyIds((prev) => {
      if (prev.has(pid)) return prev;
      const next = new Set(prev);
      next.add(pid);
      return next;
    });
  };

  // ── Save ลำดับทุกปาร์ตี้ที่ dirty (ครั้งเดียว) ──
  const saveAllOrders = async () => {
    if (!selectedEvent) return;
    const pids = Array.from(dirtyPartyIds);
    if (pids.length === 0) return;

    // snapshot ที่จะส่งไป — เก็บไว้เทียบหลัง save
    const snapshots: Record<string, string[]> = {};
    for (const pid of pids) {
      const party = parties.find((p) => p.id === pid);
      if (party) snapshots[pid] = party.members.map((m) => m.discord_user_id);
    }

    setSavingOrder(true);
    try {
      const results = await Promise.all(
        pids.map(async (pid) => {
          const order = snapshots[pid];
          if (!order) return { pid, ok: true };
          const res = await fetch(`/api/admin/events/${selectedEvent.id}/parties/${pid}/members`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ order }),
          });
          const json = await res.json().catch(() => ({ ok: false }));
          return { pid, ok: !!json.ok, error: json.error };
        })
      );

      const failed = results.filter((r) => !r.ok);
      if (failed.length > 0) {
        showToast(`บันทึก ${failed.length}/${pids.length} ปาร์ตี้ไม่สำเร็จ`, false);
      } else {
        showToast(`บันทึกลำดับ ${pids.length} ปาร์ตี้ ✓`);
      }

      // clear dirty เฉพาะ party ที่ save ผ่าน และ local ยังตรงกับ snapshot
      setDirtyPartyIds((prev) => {
        const next = new Set(prev);
        for (const r of results) {
          if (!r.ok) continue;
          const latest = partiesRef.current.find((x) => x.id === r.pid);
          const snap = snapshots[r.pid];
          const stillMatches =
            !!latest &&
            latest.members.length === snap.length &&
            latest.members.every((m, i) => m.discord_user_id === snap[i]);
          if (stillMatches) next.delete(r.pid);
        }
        return next;
      });
    } finally {
      setSavingOrder(false);
    }
  };

  // ── Discard: reload ทุกปาร์ตี้กลับเป็นของเซิร์ฟเวอร์ ──
  const discardAllOrders = async () => {
    if (!selectedEvent) return;
    await loadParties(selectedEvent.id);
    setDirtyPartyIds(new Set());
  };

  // ── Remove member from party (optimistic) ──
  const removeMember = async (pid: string, uid: string) => {
    if (!selectedEvent) return;

    // optimistic: ลบออกจาก state ทันที
    setParties((prev) => prev.map((p) =>
      p.id === pid
        ? { ...p, members: p.members.filter((m) => m.discord_user_id !== uid) }
        : p
    ));

    const res = await fetch(`/api/admin/events/${selectedEvent.id}/parties/${pid}/members`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ discord_user_id: uid }),
    });
    const json = await res.json().catch(() => ({ ok: false }));
    if (!json.ok) {
      showToast("ลบไม่สำเร็จ", false);
      await loadParties(selectedEvent.id); // rollback
    }
  };

  // ── Generate league ──
  const generateLeague = async () => {
    if (!selectedEvent) return;
    setGL(true);
    try {
      const res = await fetch(`/api/admin/events/${selectedEvent.id}/generate-league`, { method: "POST" });
      const json = await res.json();
      if (!json.ok) { showToast(json.error ?? "สร้างตารางไม่สำเร็จ", false); return; }
      showToast(`สร้างตารางแข่ง ${json.match_count} แมทช์ ✓`);
      await loadMatches(selectedEvent.id);
    } finally { setGL(false); }
  };

  // ── Record match result ──
  const recordResult = async (matchId: string, winnerPartyId: string | null) => {
    if (!selectedEvent) return;
    await fetch(`/api/admin/events/${selectedEvent.id}/matches/${matchId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ winner_party_id: winnerPartyId }),
    });
    await loadMatches(selectedEvent.id);
  };

  // ── Standings ──
  const standings = calcStandings(parties, matches);

  // ── Group matches by round ──
  const matchByRound = matches.reduce<Record<number, Match[]>>((acc, m) => {
    if (!acc[m.round]) acc[m.round] = [];
    acc[m.round].push(m);
    return acc;
  }, {});

  const tabBase   = "px-4 py-2 text-sm rounded-xl transition font-medium whitespace-nowrap";
  const tabActive = "bg-red-600 text-white shadow-sm";
  const tabIdle   = "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100";

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[60] px-4 py-3 rounded-xl text-sm font-medium shadow-lg border ${
          toast.ok
            ? "bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200"
            : "bg-red-50 border-red-200 text-red-900 dark:bg-red-950/40 dark:border-red-800 dark:text-red-200"
        }`}>{toast.msg}</div>
      )}

      {/* Saving overlay — block clicks ระหว่างบันทึกลำดับ */}
      {savingOrder && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl px-6 py-4 flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">กำลังบันทึกลำดับ...</span>
          </div>
        </div>
      )}

      {/* ── Page Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">🏆 Event</h1>
        <p className="text-sm text-zinc-500 mt-1">จัดการ Tournament — สมัคร / ปาร์ตี้ / ลีก</p>
      </div>

      {/* ── Tabs ── */}
      <div className="flex flex-wrap gap-1.5 bg-zinc-100 dark:bg-zinc-900 rounded-2xl p-1 w-fit">
        {(["events", "registrations", "parties", "league"] as Tab[]).map((t) => {
          const labels: Record<Tab, string> = {
            events:        "📋 Events",
            registrations: "👥 ผู้สมัคร",
            parties:       "⚔️ ปาร์ตี้",
            league:        "🏅 League",
          };
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              disabled={t !== "events" && !selectedEvent}
              className={`${tabBase} ${tab === t ? tabActive : tabIdle} disabled:opacity-30 disabled:cursor-not-allowed`}
            >
              {labels[t]}
            </button>
          );
        })}
      </div>

      {/* Selected event banner */}
      {selectedEvent && tab !== "events" && (
        <div className="flex flex-wrap items-center gap-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-3">
          <span className="text-lg">🏆</span>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">{selectedEvent.name}</div>
            <div className="text-xs text-zinc-400">กำลังดู Event นี้อยู่</div>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLOR[selectedEvent.status]}`}>
            {STATUS_LABEL[selectedEvent.status]}
          </span>

          {/* ── เปลี่ยนสถานะ (inline ใน banner) ── */}
          <div className="flex items-center gap-1 pl-1 border-l border-zinc-200 dark:border-zinc-700">
            <span className="text-[11px] text-zinc-400 mr-1">เปลี่ยน:</span>
            {selectedEvent.status !== "open" && (
              <button
                onClick={() => requestStatusChange(selectedEvent.id, selectedEvent.name, selectedEvent.status, "open")}
                className="text-xs px-2 py-1 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:opacity-80 transition"
              >เปิด</button>
            )}
            {selectedEvent.status !== "closed" && (
              <button
                onClick={() => requestStatusChange(selectedEvent.id, selectedEvent.name, selectedEvent.status, "closed")}
                className="text-xs px-2 py-1 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:opacity-80 transition"
              >ปิด</button>
            )}
            {selectedEvent.status !== "finished" && (
              <button
                onClick={() => requestStatusChange(selectedEvent.id, selectedEvent.name, selectedEvent.status, "finished")}
                className="text-xs px-2 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:opacity-80 transition"
              >จบ</button>
            )}
          </div>

        </div>
      )}

      {/* ════════════════════════════ TAB: EVENTS ════════════════════════════ */}
      {tab === "events" && (
        <div className="space-y-4">
          {/* Create button */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-500">{events.length} Event{events.length !== 1 ? "s" : ""}</span>
            <button
              onClick={() => setCreatingEvent(true)}
              className="h-9 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition"
            >+ สร้าง Event</button>
          </div>

          {/* Create modal */}
          {creatingEvent && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setCreatingEvent(false)}>
              <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
                <div className="font-bold text-zinc-900 dark:text-zinc-100 text-lg">🏆 สร้าง Event ใหม่</div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">ชื่อ Event</label>
                    <input
                      type="text"
                      value={newEventName}
                      onChange={(e) => setNewEventName(e.target.value)}
                      placeholder="เช่น Guild War Tournament Season 1"
                      autoFocus
                      className="w-full h-10 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">รายละเอียด (ไม่บังคับ)</label>
                    <textarea
                      value={newEventDesc}
                      onChange={(e) => setNewEventDesc(e.target.value)}
                      placeholder="อธิบาย Event..."
                      rows={3}
                      className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={createEvent}
                    disabled={savingEvent || !newEventName.trim()}
                    className="flex-1 h-10 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-50 transition"
                  >{savingEvent ? "กำลังสร้าง..." : "✓ สร้าง"}</button>
                  <button onClick={() => setCreatingEvent(false)} className="h-10 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition">ยกเลิก</button>
                </div>
              </div>
            </div>
          )}

          {/* Events table */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">ชื่อ Event</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-zinc-500">สถานะ</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-zinc-500">ผู้สมัคร</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {loadingEvents ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-zinc-400">กำลังโหลด...</td></tr>
                ) : events.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-zinc-400">ยังไม่มี Event</td></tr>
                ) : events.map((ev) => (
                  <tr key={ev.id} className={`border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition ${selectedEvent?.id === ev.id ? "bg-red-50/40 dark:bg-red-950/10" : ""}`}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100">{ev.name}</div>
                      {ev.description && <div className="text-xs text-zinc-400 truncate max-w-xs">{ev.description}</div>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLOR[ev.status]}`}>
                        {STATUS_LABEL[ev.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      {ev.registration_count} คน
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => {
                          setSelectedEvent(ev);
                          setTab("registrations");
                        }}
                        className="text-xs font-semibold text-red-600 hover:underline"
                      >จัดการ →</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════════════════════════ TAB: REGISTRATIONS ════════════════════ */}
      {tab === "registrations" && selectedEvent && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-500">{regs.length} คนสมัครแล้ว</span>
            <button onClick={() => loadRegs(selectedEvent.id)} className="text-xs text-zinc-400 hover:text-zinc-600">↺ รีเฟรช</button>
          </div>

          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                  <th
                    onClick={() => toggleRegSort("name")}
                    className={`px-4 py-3 text-left text-xs font-semibold cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition select-none ${
                      regSortField === "name" ? "text-red-600 dark:text-red-400" : "text-zinc-500"
                    }`}
                  >ชื่อ <span className="ml-0.5 opacity-60">{sortIcon("name")}</span></th>
                  <th
                    onClick={() => toggleRegSort("class")}
                    className={`px-4 py-3 text-left text-xs font-semibold cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition select-none ${
                      regSortField === "class" ? "text-red-600 dark:text-red-400" : "text-zinc-500"
                    }`}
                  >อาชีพ <span className="ml-0.5 opacity-60">{sortIcon("class")}</span></th>
                  <th
                    onClick={() => toggleRegSort("date")}
                    className={`px-4 py-3 text-left text-xs font-semibold cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition select-none ${
                      regSortField === "date" ? "text-red-600 dark:text-red-400" : "text-zinc-500"
                    }`}
                  >วันที่สมัคร <span className="ml-0.5 opacity-60">{sortIcon("date")}</span></th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {loadingRegs ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-zinc-400">กำลังโหลด...</td></tr>
                ) : regs.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-zinc-400">ยังไม่มีผู้สมัคร</td></tr>
                ) : [...regs]
                  .sort((a, b) => {
                    const dir = regSortDir === "asc" ? 1 : -1;
                    if (regSortField === "name") {
                      return (a.member_name || a.discord_user_id || "").localeCompare(
                        b.member_name || b.discord_user_id || "", "th"
                      ) * dir;
                    }
                    if (regSortField === "class") {
                      const clsCmp = (a.class_name || "").localeCompare(b.class_name || "", "th");
                      if (clsCmp !== 0) return clsCmp * dir;
                      // secondary by name (a-z เสมอ)
                      return (a.member_name || a.discord_user_id || "").localeCompare(
                        b.member_name || b.discord_user_id || "", "th"
                      );
                    }
                    // date
                    const ta = new Date(a.registered_at).getTime();
                    const tb = new Date(b.registered_at).getTime();
                    return (ta - tb) * dir;
                  })
                  .map((r) => (
                  <tr key={r.id} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition">
                    <td className="px-4 py-3 font-medium text-zinc-800 dark:text-zinc-200">{r.member_name || r.discord_user_id}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {r.class_icon && <img src={r.class_icon} alt="" className="w-5 h-5 rounded" />}
                        <span className="text-xs text-zinc-500">{r.class_name || "-"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-400">{new Date(r.registered_at).toLocaleString("th-TH")}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setConfirmDeleteReg({
                          discord_user_id: r.discord_user_id,
                          member_name: r.member_name || r.discord_user_id,
                        })}
                        className="text-xs text-red-500 hover:underline"
                      >ลบ</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════════════════════════ TAB: PARTIES ══════════════════════════ */}
      {tab === "parties" && selectedEvent && (
        <div className="space-y-6">
          {/* ── Save bar: sticky ที่บน เลื่อนก็เห็น ── */}
          {dirtyPartyIds.size > 0 && (
            <div className="sticky top-2 z-30 flex items-center gap-3 bg-amber-50 dark:bg-amber-950/60 border-2 border-amber-300 dark:border-amber-700 rounded-2xl px-4 py-3 shadow-lg backdrop-blur">
              <span className="text-lg">⚠️</span>
              <div className="flex-1 text-sm text-amber-900 dark:text-amber-200">
                <span className="font-semibold">มีลำดับที่ยังไม่ได้บันทึก</span>
                <span className="ml-2 text-xs opacity-75">({dirtyPartyIds.size} ปาร์ตี้)</span>
              </div>
              <button
                onClick={discardAllOrders}
                disabled={savingOrder}
                className="h-8 px-3 rounded-xl border border-zinc-300 dark:border-zinc-600 text-xs text-zinc-700 dark:text-zinc-200 bg-white/70 dark:bg-zinc-900/70 hover:bg-white dark:hover:bg-zinc-800 disabled:opacity-50 transition"
              >↺ ยกเลิก</button>
              <button
                onClick={saveAllOrders}
                disabled={savingOrder}
                className="h-8 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-50 transition shadow"
              >{savingOrder ? "กำลังบันทึก..." : "💾 บันทึก"}</button>
            </div>
          )}

          {/* Create party */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-zinc-500">ชื่อปาร์ตี้</label>
              <input
                type="text"
                value={newPartyName}
                onChange={(e) => setNewPartyName(e.target.value)}
                placeholder="เช่น Team Alpha"
                className="h-9 w-48 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-zinc-500">สี</label>
              <div className="flex gap-1">
                {PARTY_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewPartyColor(c)}
                    className={`w-6 h-6 rounded-full border-2 transition ${newPartyColor === c ? "border-zinc-900 dark:border-zinc-100 scale-110" : "border-transparent"}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
            <button
              onClick={createParty}
              disabled={savingParty || !newPartyName.trim()}
              className="h-9 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-50 transition"
            >+ สร้างปาร์ตี้</button>
          </div>

          {/* Unassigned registrations */}
          {regs.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">ผู้สมัครที่ยังไม่ได้อยู่ปาร์ตี้</div>
              <div className="flex flex-wrap gap-2">
                {regs
                  .filter((r) => !parties.some((p) => p.members.some((m) => m.discord_user_id === r.discord_user_id)))
                  .map((r) => {
                    const selectedParty = parties.find((p) => p.id === assignToParty);
                    const usedPositions = new Set((selectedParty?.members ?? []).map((m) => m.position));
                    return (
                    <div key={r.discord_user_id} className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-2.5 py-1.5">
                      {r.class_icon && <img src={r.class_icon} alt="" className="w-4 h-4 rounded" />}
                      <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{r.member_name || r.discord_user_id}</span>
                      {assigningUid === r.discord_user_id ? (
                        <div className="flex items-center gap-1 ml-1">
                          <select
                            value={assignToParty}
                            onChange={(e) => {
                              const pid = e.target.value;
                              setAssignToParty(pid);
                              // auto-pick first empty slot
                              const p = parties.find((x) => x.id === pid);
                              if (p) {
                                const used = new Set(p.members.map((m) => m.position));
                                let firstFree: number | null = null;
                                for (let i = 0; i < PARTY_MAX_SIZE; i++) {
                                  if (!used.has(i)) { firstFree = i; break; }
                                }
                                setAssignToPosition(firstFree);
                              } else {
                                setAssignToPosition(null);
                              }
                            }}
                            className="h-6 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-1"
                          >
                            <option value="">เลือกปาร์ตี้</option>
                            {parties.map((p) => {
                              const full = p.members.length >= PARTY_MAX_SIZE;
                              return (
                                <option key={p.id} value={p.id} disabled={full}>
                                  {p.name} ({p.members.length}/{PARTY_MAX_SIZE}){full ? " — เต็ม" : ""}
                                </option>
                              );
                            })}
                          </select>
                          {assignToParty && selectedParty && (
                            <select
                              value={assignToPosition ?? ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                setAssignToPosition(v === "" ? null : Number(v));
                              }}
                              className="h-6 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-1"
                            >
                              <option value="">ตำแหน่ง</option>
                              {Array.from({ length: PARTY_MAX_SIZE }).map((_, i) => {
                                const taken = selectedParty.members.find((m) => m.position === i);
                                return (
                                  <option key={i} value={i} disabled={!!taken}>
                                    #{i + 1}{taken ? ` — ${taken.member_name || taken.discord_user_id}` : " (ว่าง)"}
                                  </option>
                                );
                              })}
                            </select>
                          )}
                          <button
                            onClick={() => {
                              if (assignToPosition == null) return;
                              assignMember(
                                r.discord_user_id,
                                r.member_name ?? "",
                                assignToParty,
                                assignToPosition,
                                { class_name: r.class_name, class_icon: r.class_icon }
                              );
                            }}
                            disabled={!assignToParty || assignToPosition == null || usedPositions.has(assignToPosition) || (selectedParty?.members.length ?? 0) >= PARTY_MAX_SIZE}
                            className="h-6 px-2 rounded-lg bg-red-600 text-white text-[10px] disabled:opacity-50"
                          >ใส่</button>
                          <button
                            onClick={() => { setAssigningUid(null); setAssignToParty(""); setAssignToPosition(null); }}
                            className="text-zinc-400 text-xs"
                          >✕</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setAssigningUid(r.discord_user_id);
                            setAssignToParty("");
                            setAssignToPosition(null);
                          }}
                          className="ml-1 text-[10px] text-red-600 hover:underline font-semibold"
                        >+ ใส่</button>
                      )}
                    </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Party cards */}
          {loadingParties ? (
            <div className="text-sm text-zinc-400 py-4 text-center">กำลังโหลด...</div>
          ) : parties.length === 0 ? (
            <div className="text-sm text-zinc-400 py-4 text-center">ยังไม่มีปาร์ตี้ — กดสร้างด้านบน</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {parties.map((p) => (
                <div
                  key={p.id}
                  className={`rounded-2xl border overflow-hidden transition ${
                    dirtyPartyIds.has(p.id)
                      ? "border-amber-400 dark:border-amber-600 ring-2 ring-amber-200 dark:ring-amber-900/60"
                      : "border-zinc-200 dark:border-zinc-800"
                  }`}
                >
                  {/* Party header */}
                  <div className="relative flex items-center gap-2 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800" style={{ borderTopWidth: 4, borderTopColor: p.color }}>
                    <button
                      onClick={() => setColorPickerPid((cur) => (cur === p.id ? null : p.id))}
                      title="เปลี่ยนสี"
                      className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-white/20 shadow-sm hover:ring-2 hover:ring-offset-1 hover:ring-red-300 transition"
                      style={{ background: p.color }}
                    />
                    {colorPickerPid === p.id && (
                      <>
                        {/* backdrop — click outside to close */}
                        <div className="fixed inset-0 z-20" onClick={() => setColorPickerPid(null)} />
                        <div className="absolute z-30 top-full left-3 mt-1 flex gap-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-1.5 shadow-xl">
                          {PARTY_COLORS.map((c) => (
                            <button
                              key={c}
                              onClick={() => recolorParty(p.id, c)}
                              className={`w-6 h-6 rounded-full border-2 transition ${p.color === c ? "border-zinc-900 dark:border-zinc-100 scale-110" : "border-transparent hover:scale-110"}`}
                              style={{ background: c }}
                              title={c}
                            />
                          ))}
                        </div>
                      </>
                    )}
                    {renamingPartyId === p.id ? (
                      <input
                        type="text"
                        value={renamingPartyName}
                        onChange={(e) => setRenamingPartyName(e.target.value)}
                        onBlur={() => renameParty(p.id, renamingPartyName)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") renameParty(p.id, renamingPartyName);
                          if (e.key === "Escape") setRenamingPartyId(null);
                        }}
                        autoFocus
                        className="flex-1 min-w-0 h-7 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 text-sm font-bold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-400"
                      />
                    ) : (
                      <>
                        <span className="font-bold text-zinc-900 dark:text-zinc-100 flex-1 truncate">{p.name}</span>
                        <button
                          onClick={() => { setRenamingPartyId(p.id); setRenamingPartyName(p.name); }}
                          title="เปลี่ยนชื่อ"
                          className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                        >✎</button>
                      </>
                    )}
                    <span className={`text-xs ${p.members.length >= PARTY_MAX_SIZE ? "text-amber-600 dark:text-amber-400 font-semibold" : "text-zinc-400"}`}>
                      {p.members.length}/{PARTY_MAX_SIZE}
                    </span>
                    {/* badge เล็กบอกว่าปาร์ตี้นี้ยังไม่ save */}
                    {dirtyPartyIds.has(p.id) && (
                      <span title="ยังไม่ได้บันทึก" className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    )}
                    <button onClick={() => deleteParty(p.id)} className="text-xs text-red-400 hover:text-red-600">🗑</button>
                  </div>
                  {/* Members */}
                  <div className="p-3 space-y-1 min-h-[60px]">
                    {p.members.length === 0 ? (
                      <div className="text-xs text-zinc-400 text-center py-2">ยังไม่มีสมาชิก</div>
                    ) : p.members.map((m, mi) => (
                      <div key={m.discord_user_id} className="flex items-center gap-1.5">
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded text-[9px] font-bold text-zinc-500 bg-zinc-100 dark:bg-zinc-800 shrink-0" title={`ตำแหน่งที่ ${mi + 1}`}>{mi + 1}</span>
                        {m.class_icon && <img src={m.class_icon} alt="" className="w-4 h-4 rounded" />}
                        <span className="text-xs text-zinc-700 dark:text-zinc-300 flex-1 truncate">{m.member_name || m.discord_user_id}</span>
                        {/* move up / down — โผล่ตลอด */}
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={() => moveMember(p.id, m.discord_user_id, "up")}
                            disabled={mi === 0}
                            title="เลื่อนขึ้น"
                            className="w-5 h-5 flex items-center justify-center rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 text-[10px] leading-none disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                          >▲</button>
                          <button
                            onClick={() => moveMember(p.id, m.discord_user_id, "down")}
                            disabled={mi === p.members.length - 1}
                            title="เลื่อนลง"
                            className="w-5 h-5 flex items-center justify-center rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 text-[10px] leading-none disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                          >▼</button>
                          <button
                            onClick={() => removeMember(p.id, m.discord_user_id)}
                            title="ลบออกจากปาร์ตี้"
                            className="w-5 h-5 flex items-center justify-center rounded text-zinc-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-500 text-xs ml-0.5"
                          >✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════ CONFIRM: STATUS CHANGE ════════════════ */}
      {confirmStatus && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => !statusChanging && setConfirmStatus(null)}
        >
          <div
            className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-bold text-zinc-900 dark:text-zinc-100 text-lg">
              เปลี่ยนสถานะ Event?
            </div>
            <div className="text-sm text-zinc-600 dark:text-zinc-400 space-y-2">
              <div>
                <span className="text-zinc-500">Event:</span>{" "}
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">{confirmStatus.eventName}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLOR[confirmStatus.currentStatus]}`}>
                  {STATUS_LABEL[confirmStatus.currentStatus]}
                </span>
                <span className="text-zinc-400">→</span>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLOR[confirmStatus.newStatus]}`}>
                  {STATUS_LABEL[confirmStatus.newStatus]}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={doStatusChange}
                disabled={statusChanging}
                className="flex-1 h-10 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-50 transition"
              >
                {statusChanging ? "กำลังเปลี่ยน..." : "✓ ยืนยัน"}
              </button>
              <button
                onClick={() => setConfirmStatus(null)}
                disabled={statusChanging}
                className="h-10 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 transition"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════ CONFIRM: DELETE REGISTRATION ══════════ */}
      {confirmDeleteReg && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => !deletingReg && setConfirmDeleteReg(null)}
        >
          <div
            className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-bold text-zinc-900 dark:text-zinc-100 text-lg">
              ลบผู้สมัคร?
            </div>
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              คุณต้องการลบ{" "}
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                {confirmDeleteReg.member_name}
              </span>{" "}
              ออกจาก Event นี้ใช่ไหม?
            </div>
            <div className="flex gap-2">
              <button
                onClick={doDeleteRegistration}
                disabled={deletingReg}
                className="flex-1 h-10 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-50 transition"
              >
                {deletingReg ? "กำลังลบ..." : "🗑 ลบ"}
              </button>
              <button
                onClick={() => setConfirmDeleteReg(null)}
                disabled={deletingReg}
                className="h-10 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 transition"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════ TAB: LEAGUE ═══════════════════════════ */}
      {tab === "league" && selectedEvent && (
        <div className="space-y-6">
          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={generateLeague}
              disabled={generatingLeague || parties.length < 2}
              className="h-9 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-50 transition"
            >{generatingLeague ? "กำลังสร้าง..." : "🔄 สร้างตารางแข่ง (Round-Robin)"}</button>
            {parties.length < 2 && (
              <span className="text-xs text-zinc-400">ต้องมีอย่างน้อย 2 ปาร์ตี้ก่อน</span>
            )}
            {matches.length > 0 && (
              <span className="text-xs text-zinc-400 ml-auto">{matches.filter((m) => m.status === "done").length}/{matches.length} แมทช์เสร็จแล้ว</span>
            )}
          </div>

          {loadingMatches ? (
            <div className="text-sm text-zinc-400 py-8 text-center">กำลังโหลด...</div>
          ) : matches.length === 0 ? (
            <div className="text-sm text-zinc-400 py-8 text-center">ยังไม่มีตารางแข่ง — กดสร้างด้านบน</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Standings */}
              <div className="lg:col-span-1">
                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                  <div className="bg-zinc-50 dark:bg-zinc-900 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
                    <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">🏅 ตารางคะแนน</span>
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-zinc-100 dark:border-zinc-800">
                        <th className="px-3 py-2 text-left text-zinc-500">#</th>
                        <th className="px-3 py-2 text-left text-zinc-500">ปาร์ตี้</th>
                        <th className="px-3 py-2 text-center text-zinc-500">แข่ง</th>
                        <th className="px-3 py-2 text-center text-zinc-500">ชนะ</th>
                        <th className="px-3 py-2 text-center text-zinc-500">แพ้</th>
                        <th className="px-3 py-2 text-center font-bold text-zinc-700 dark:text-zinc-300">แต้ม</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.map((s, i) => (
                        <tr key={s.id} className={`border-b border-zinc-100 dark:border-zinc-800 ${i === 0 ? "bg-amber-50/50 dark:bg-amber-950/20" : ""}`}>
                          <td className="px-3 py-2 font-bold text-zinc-400">{i + 1}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5">
                              {colorSwatch(s.color)}
                              <span className="font-semibold text-zinc-800 dark:text-zinc-200">{s.name}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center text-zinc-500">{s.played}</td>
                          <td className="px-3 py-2 text-center text-green-600 font-semibold">{s.w}</td>
                          <td className="px-3 py-2 text-center text-red-500">{s.l}</td>
                          <td className="px-3 py-2 text-center font-bold text-zinc-900 dark:text-zinc-100">{s.pts}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Matches by round */}
              <div className="lg:col-span-2 space-y-4">
                {Object.entries(matchByRound)
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .map(([round, rMatches]) => (
                  <div key={round} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                    <div className="bg-zinc-50 dark:bg-zinc-900 px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800">
                      <span className="font-bold text-sm text-zinc-700 dark:text-zinc-300">รอบที่ {round}</span>
                    </div>
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {rMatches.map((m) => (
                        <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                          {/* Party 1 */}
                          <div className={`flex items-center gap-1.5 flex-1 justify-end ${m.winner?.id === m.party1?.id ? "font-bold" : "opacity-70"}`}>
                            <span className="text-sm text-zinc-800 dark:text-zinc-200">{m.party1?.name ?? "?"}</span>
                            {m.party1 && colorSwatch(m.party1.color)}
                          </div>

                          {/* VS / Result */}
                          <div className="text-center w-16 shrink-0">
                            {m.status === "done" ? (
                              <div className="text-xs font-bold text-zinc-400">จบแล้ว</div>
                            ) : (
                              <div className="text-xs text-zinc-400 font-semibold">VS</div>
                            )}
                          </div>

                          {/* Party 2 */}
                          <div className={`flex items-center gap-1.5 flex-1 ${m.winner?.id === m.party2?.id ? "font-bold" : "opacity-70"}`}>
                            {m.party2 && colorSwatch(m.party2.color)}
                            <span className="text-sm text-zinc-800 dark:text-zinc-200">{m.party2?.name ?? "?"}</span>
                          </div>

                          {/* Record result */}
                          <div className="shrink-0 w-28">
                            {m.status === "done" ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-semibold" style={{ color: m.winner?.color }}>
                                  {colorSwatch(m.winner?.color ?? "#666")} {m.winner?.name}
                                </span>
                                <button
                                  onClick={() => recordResult(m.id, null)}
                                  className="text-[10px] text-zinc-400 hover:text-zinc-600 underline"
                                >รีเซ็ต</button>
                              </div>
                            ) : (
                              <div className="flex gap-1">
                                <button
                                  onClick={() => recordResult(m.id, m.party1?.id ?? null)}
                                  className="flex-1 h-7 rounded-lg text-[11px] font-semibold text-white transition hover:opacity-90"
                                  style={{ background: m.party1?.color ?? "#666" }}
                                >P1 ชนะ</button>
                                <button
                                  onClick={() => recordResult(m.id, m.party2?.id ?? null)}
                                  className="flex-1 h-7 rounded-lg text-[11px] font-semibold text-white transition hover:opacity-90"
                                  style={{ background: m.party2?.color ?? "#666" }}
                                >P2 ชนะ</button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
