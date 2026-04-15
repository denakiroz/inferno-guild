"use client";

import React, { useCallback, useEffect, useState } from "react";

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
};

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

  // ── Change event status ──
  const changeStatus = async (eventId: string, status: string) => {
    await fetch(`/api/admin/events/${eventId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await loadEvents();
    if (selectedEvent?.id === eventId) setSelectedEvent((e) => e ? { ...e, status: status as any } : e);
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
    await fetch(`/api/admin/events/${selectedEvent.id}/parties/${pid}`, { method: "DELETE" });
    await loadParties(selectedEvent.id);
    showToast("ลบปาร์ตี้แล้ว");
  };

  // ── Assign member to party ──
  const assignMember = async (uid: string, memberName: string, partyId: string) => {
    if (!selectedEvent || !partyId) return;
    const res = await fetch(`/api/admin/events/${selectedEvent.id}/parties/${partyId}/members`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ discord_user_id: uid, member_name: memberName }),
    });
    const json = await res.json();
    if (!json.ok) { showToast(json.error ?? "กำหนดไม่สำเร็จ", false); return; }
    setAssigningUid(null);
    setAssignToParty("");
    await loadParties(selectedEvent.id);
  };

  // ── Remove member from party ──
  const removeMember = async (pid: string, uid: string) => {
    if (!selectedEvent) return;
    await fetch(`/api/admin/events/${selectedEvent.id}/parties/${pid}/members`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ discord_user_id: uid }),
    });
    await loadParties(selectedEvent.id);
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
        <div className="flex items-center gap-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-3">
          <span className="text-lg">🏆</span>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">{selectedEvent.name}</div>
            <div className="text-xs text-zinc-400">กำลังดู Event นี้อยู่</div>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLOR[selectedEvent.status]}`}>
            {STATUS_LABEL[selectedEvent.status]}
          </span>
          <button
            onClick={() => { setTab("events"); }}
            className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >เปลี่ยน</button>
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
                  <th className="px-4 py-3 text-xs font-semibold text-zinc-500">เปลี่ยนสถานะ</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {loadingEvents ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-zinc-400">กำลังโหลด...</td></tr>
                ) : events.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-zinc-400">ยังไม่มี Event</td></tr>
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
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {ev.status !== "open"     && <button onClick={() => changeStatus(ev.id, "open")}     className="text-xs px-2 py-1 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:opacity-80 transition">เปิด</button>}
                        {ev.status !== "closed"   && <button onClick={() => changeStatus(ev.id, "closed")}   className="text-xs px-2 py-1 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:opacity-80 transition">ปิด</button>}
                        {ev.status !== "finished" && <button onClick={() => changeStatus(ev.id, "finished")} className="text-xs px-2 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:opacity-80 transition">จบ</button>}
                      </div>
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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">ชื่อ</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">อาชีพ</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">วันที่สมัคร</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {loadingRegs ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-zinc-400">กำลังโหลด...</td></tr>
                ) : regs.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-zinc-400">ยังไม่มีผู้สมัคร</td></tr>
                ) : regs.map((r) => (
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
                        onClick={async () => {
                          await fetch(`/api/admin/events/${selectedEvent.id}/registrations`, {
                            method: "DELETE",
                            headers: { "content-type": "application/json" },
                            body: JSON.stringify({ discord_user_id: r.discord_user_id }),
                          });
                          await loadRegs(selectedEvent.id);
                          showToast("ลบผู้สมัครแล้ว");
                        }}
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
                  .map((r) => (
                    <div key={r.discord_user_id} className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-2.5 py-1.5">
                      {r.class_icon && <img src={r.class_icon} alt="" className="w-4 h-4 rounded" />}
                      <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{r.member_name || r.discord_user_id}</span>
                      {assigningUid === r.discord_user_id ? (
                        <div className="flex items-center gap-1 ml-1">
                          <select
                            value={assignToParty}
                            onChange={(e) => setAssignToParty(e.target.value)}
                            className="h-6 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-1"
                          >
                            <option value="">เลือกปาร์ตี้</option>
                            {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                          <button
                            onClick={() => assignMember(r.discord_user_id, r.member_name ?? "", assignToParty)}
                            disabled={!assignToParty}
                            className="h-6 px-2 rounded-lg bg-red-600 text-white text-[10px] disabled:opacity-50"
                          >ใส่</button>
                          <button onClick={() => setAssigningUid(null)} className="text-zinc-400 text-xs">✕</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setAssigningUid(r.discord_user_id); setAssignToParty(""); }}
                          className="ml-1 text-[10px] text-red-600 hover:underline font-semibold"
                        >+ ใส่</button>
                      )}
                    </div>
                  ))}
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
                <div key={p.id} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                  {/* Party header */}
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800" style={{ borderTopWidth: 4, borderTopColor: p.color }}>
                    {colorSwatch(p.color)}
                    <span className="font-bold text-zinc-900 dark:text-zinc-100 flex-1">{p.name}</span>
                    <span className="text-xs text-zinc-400">{p.members.length} คน</span>
                    <button onClick={() => deleteParty(p.id)} className="text-xs text-red-400 hover:text-red-600">🗑</button>
                  </div>
                  {/* Members */}
                  <div className="p-3 space-y-1 min-h-[60px]">
                    {p.members.length === 0 ? (
                      <div className="text-xs text-zinc-400 text-center py-2">ยังไม่มีสมาชิก</div>
                    ) : p.members.map((m) => (
                      <div key={m.discord_user_id} className="flex items-center gap-1.5 group">
                        {m.class_icon && <img src={m.class_icon} alt="" className="w-4 h-4 rounded" />}
                        <span className="text-xs text-zinc-700 dark:text-zinc-300 flex-1">{m.member_name || m.discord_user_id}</span>
                        <button
                          onClick={() => removeMember(p.id, m.discord_user_id)}
                          className="text-zinc-300 dark:text-zinc-600 hover:text-red-500 text-xs opacity-0 group-hover:opacity-100 transition"
                        >✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
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
