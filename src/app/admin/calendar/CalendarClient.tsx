"use client";

// src/app/admin/calendar/CalendarClient.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, X, Trash2, Edit2, Clock, AlignLeft, Loader2, CalendarDays } from "lucide-react";
import { useTheme } from "@/app/theme/ThemeProvider";

// ─── Types ────────────────────────────────────────────────────────────────────

type CalEvent = {
  id: number;
  title: string;
  description: string | null;
  event_date: string;
  event_time: string | null;
  color: string;
  mention_roles: string | null; // JSON array string
  created_by_name: string | null;
  discord_notified: boolean;
  reminder_sent: boolean;
  created_at: string;
};

type CalendarRole = { id: string; label: string; mention: string };

type ModalMode = "create" | "edit" | "view";

// ─── Colors ───────────────────────────────────────────────────────────────────

const EVENT_COLORS = [
  { id: "indigo",  label: "คราม",   bgL: "bg-indigo-50",   bgD: "dark:bg-indigo-500/15",  borderL: "border-indigo-300",   borderD: "dark:border-indigo-500/60",  textL: "text-indigo-700",   textD: "dark:text-indigo-300",  dot: "bg-indigo-500",  pill: "bg-indigo-500" },
  { id: "rose",    label: "แดง",    bgL: "bg-rose-50",     bgD: "dark:bg-rose-500/15",    borderL: "border-rose-300",     borderD: "dark:border-rose-500/60",    textL: "text-rose-700",     textD: "dark:text-rose-300",    dot: "bg-rose-500",    pill: "bg-rose-500" },
  { id: "emerald", label: "เขียว",  bgL: "bg-emerald-50",  bgD: "dark:bg-emerald-500/15", borderL: "border-emerald-300",  borderD: "dark:border-emerald-500/60", textL: "text-emerald-700",  textD: "dark:text-emerald-300", dot: "bg-emerald-500", pill: "bg-emerald-500" },
  { id: "amber",   label: "เหลือง", bgL: "bg-amber-50",    bgD: "dark:bg-amber-500/15",   borderL: "border-amber-300",    borderD: "dark:border-amber-500/60",   textL: "text-amber-700",    textD: "dark:text-amber-300",   dot: "bg-amber-500",   pill: "bg-amber-500" },
  { id: "sky",     label: "ฟ้า",    bgL: "bg-sky-50",      bgD: "dark:bg-sky-500/15",     borderL: "border-sky-300",      borderD: "dark:border-sky-500/60",     textL: "text-sky-700",      textD: "dark:text-sky-300",     dot: "bg-sky-500",     pill: "bg-sky-500" },
  { id: "purple",  label: "ม่วง",   bgL: "bg-purple-50",   bgD: "dark:bg-purple-500/15",  borderL: "border-purple-300",   borderD: "dark:border-purple-500/60",  textL: "text-purple-700",   textD: "dark:text-purple-300",  dot: "bg-purple-500",  pill: "bg-purple-500" },
  { id: "orange",  label: "ส้ม",    bgL: "bg-orange-50",   bgD: "dark:bg-orange-500/15",  borderL: "border-orange-300",   borderD: "dark:border-orange-500/60",  textL: "text-orange-700",   textD: "dark:text-orange-300",  dot: "bg-orange-500",  pill: "bg-orange-500" },
  { id: "zinc",    label: "เทา",    bgL: "bg-zinc-100",    bgD: "dark:bg-zinc-500/15",    borderL: "border-zinc-300",     borderD: "dark:border-zinc-500/60",    textL: "text-zinc-700",     textD: "dark:text-zinc-300",    dot: "bg-zinc-500",    pill: "bg-zinc-500" },
] as const;

function getColor(id: string) {
  return EVENT_COLORS.find((c) => c.id === id) ?? EVENT_COLORS[0];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAYS_TH        = ["อา","จ","อ","พ","พฤ","ศ","ส"];
const MONTHS_TH      = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
const MONTHS_SHORT   = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
const DAYS_TH_FULL   = ["อาทิตย์","จันทร์","อังคาร","พุธ","พฤหัสบดี","ศุกร์","เสาร์"];

function toISO(y: number, m: number, d: number) {
  return `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
}
function todayISO() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-${String(n.getDate()).padStart(2,"0")}`;
}
function fmtTime(t: string | null) { return t ? t.slice(0,5) : ""; }
function fmtDateTH(s: string) {
  const [y,m,d] = s.split("-").map(Number);
  return `${d} ${MONTHS_TH[m-1]} ${y+543}`;
}
function fmtDateShort(s: string) {
  const [y,m,d] = s.split("-").map(Number);
  return `${d} ${MONTHS_SHORT[m-1]} ${y+543}`;
}
function getDayOfWeek(s: string) {
  const [y,m,d] = s.split("-").map(Number);
  return new Date(y, m-1, d).getDay();
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function CalendarClient() {
  const { theme } = useTheme();
  const inputColorScheme = theme === "dark" ? "dark" : "light";

  const today   = useMemo(() => todayISO(), []);
  const nowDate = useMemo(() => new Date(), []);

  const [year, setYear]         = useState(nowDate.getFullYear());
  const [month, setMonth]       = useState(nowDate.getMonth());
  const [selectedDate, setSelectedDate] = useState(today);

  const [events, setEvents]     = useState<CalEvent[]>([]);
  const [loading, setLoading]   = useState(true);

  // Modal
  const [modal, setModal]       = useState<{ mode: ModalMode; event?: CalEvent; date?: string } | null>(null);
  const [fTitle, setFTitle]       = useState("");
  const [fDesc, setFDesc]         = useState("");
  const [fDate, setFDate]         = useState("");
  const [fTime, setFTime]         = useState("");
  const [fColor, setFColor]       = useState("indigo");
  const [fMentions, setFMentions] = useState<string[]>([]); // selected mention strings
  const [saving, setSaving]       = useState(false);
  const [deleting, setDeleting]   = useState(false);
  const [formError, setFormError] = useState("");

  // Available Discord roles from server
  const [availableRoles, setAvailableRoles] = useState<CalendarRole[]>([]);

  // ── Load ─────────────────────────────────────────────────────────────────────
  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/calendar", { cache: "no-store" });
      setEvents(res.ok ? await res.json() : []);
    } catch { setEvents([]); }
    finally  { setLoading(false); }
  }, []);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  useEffect(() => {
    fetch("/api/admin/calendar/roles", { cache: "no-store" })
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setAvailableRoles(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  // ── Grid ──────────────────────────────────────────────────────────────────────
  const { firstDow, daysInMonth } = useMemo(() => ({
    firstDow:    new Date(year, month, 1).getDay(),
    daysInMonth: new Date(year, month+1, 0).getDate(),
  }), [year, month]);

  const eventsByDate = useMemo(() => {
    const m = new Map<string, CalEvent[]>();
    for (const ev of events) {
      const arr = m.get(ev.event_date);
      arr ? arr.push(ev) : m.set(ev.event_date, [ev]);
    }
    return m;
  }, [events]);

  const gridCells = useMemo(() => {
    const cells: (number | null)[] = Array(firstDow).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [firstDow, daysInMonth]);

  // ── Nav ───────────────────────────────────────────────────────────────────────
  function prevMonth() { month === 0  ? (setYear(y=>y-1), setMonth(11)) : setMonth(m=>m-1); }
  function nextMonth() { month === 11 ? (setYear(y=>y+1), setMonth(0))  : setMonth(m=>m+1); }
  function goToday()   { setYear(nowDate.getFullYear()); setMonth(nowDate.getMonth()); setSelectedDate(today); }

  // ── Modal ─────────────────────────────────────────────────────────────────────
  function openCreate(date?: string) {
    setFTitle(""); setFDesc(""); setFDate(date ?? selectedDate); setFTime(""); setFColor("indigo"); setFMentions([]); setFormError("");
    setModal({ mode: "create", date });
  }
  function openView(ev: CalEvent)  { setModal({ mode: "view", event: ev }); }
  function openEdit(ev: CalEvent)  {
    setFTitle(ev.title); setFDesc(ev.description ?? ""); setFDate(ev.event_date);
    setFTime(ev.event_time ? fmtTime(ev.event_time) : ""); setFColor(ev.color || "indigo");
    const saved: string[] = ev.mention_roles ? (() => { try { return JSON.parse(ev.mention_roles!); } catch { return []; } })() : [];
    setFMentions(saved);
    setFormError("");
    setModal({ mode: "edit", event: ev });
  }
  function closeModal() { setModal(null); }

  // ── Save ──────────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!fTitle.trim()) { setFormError("กรุณากรอกชื่อกิจกรรม"); return; }
    if (!fDate)         { setFormError("กรุณาเลือกวันที่"); return; }
    setFormError(""); setSaving(true);
    try {
      const body = { title: fTitle.trim(), description: fDesc.trim() || null, event_date: fDate, event_time: fTime || null, color: fColor, mention_roles: fMentions };
      const url  = modal?.mode === "edit" ? `/api/admin/calendar?id=${modal.event!.id}` : "/api/admin/calendar";
      const res  = await fetch(url, { method: modal?.mode === "edit" ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { const j = await res.json(); setFormError(j.error ?? "เกิดข้อผิดพลาด"); return; }
      await loadEvents(); closeModal();
    } finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    if (!confirm("ลบกิจกรรมนี้?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/calendar?id=${id}`, { method: "DELETE" });
      if (!res.ok) { alert("ลบไม่สำเร็จ"); return; }
      await loadEvents(); closeModal();
    } finally { setDeleting(false); }
  }

  const selectedEvents = useMemo(() =>
    (eventsByDate.get(selectedDate) ?? []).sort((a,b) => (a.event_time??"").localeCompare(b.event_time??"")),
    [eventsByDate, selectedDate]
  );
  const selectedDow = useMemo(() => getDayOfWeek(selectedDate), [selectedDate]);

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className={[
      // ยกเลิก padding ของ <main p-4 md:p-6> ที่ AdminShell ครอบอยู่
      "-m-4 md:-m-6",
      // height = 100vh ลบ pt-14 ที่ AdminShell ใส่บน mobile (desktop ไม่มี pt)
      "h-[calc(100vh-3.5rem)] md:h-screen",
      "flex flex-col bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 overflow-hidden",
    ].join(" ")}>

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between pl-14 pr-5 py-3 border-b border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 flex-shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors">
            <ChevronLeft size={16} />
          </button>
          <h2 className="text-xl font-bold min-w-[180px] text-center tracking-wide text-zinc-800 dark:text-zinc-100">
            {MONTHS_TH[month]} {year + 543}
          </h2>
          <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors">
            <ChevronRight size={16} />
          </button>
          <button onClick={goToday} className="ml-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">
            วันนี้
          </button>
        </div>
        <button
          onClick={() => openCreate()}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-all text-sm shadow-md shadow-indigo-200 dark:shadow-indigo-900/40 active:scale-95"
        >
          <Plus size={15} /> เพิ่มกิจกรรม
        </button>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Calendar grid ── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-zinc-800/60 bg-zinc-50 dark:bg-zinc-900/40 flex-shrink-0">
            {DAYS_TH.map((d, i) => (
              <div key={d} className={`py-3 text-center text-sm font-semibold tracking-widest ${
                i === 0 ? "text-rose-500" : i === 6 ? "text-sky-500" : "text-zinc-400 dark:text-zinc-500"
              }`}>{d}</div>
            ))}
          </div>

          {/* Cells */}
          {loading ? (
            <div className="flex-1 flex items-center justify-center gap-2 text-sm text-zinc-400">
              <Loader2 size={18} className="animate-spin" /> กำลังโหลด...
            </div>
          ) : (
            <div
              className="flex-1 grid grid-cols-7 overflow-auto"
              style={{ gridTemplateRows: `repeat(${Math.ceil(gridCells.length / 7)}, minmax(0, 1fr))` }}
            >
              {gridCells.map((day, idx) => {
                if (day === null) return (
                  <div key={`e-${idx}`} className="border-b border-r border-zinc-200 dark:border-zinc-800/40 bg-zinc-50/60 dark:bg-zinc-950/60" />
                );
                const iso    = toISO(year, month, day);
                const isToday = iso === today;
                const isSel   = iso === selectedDate;
                const dayEvs  = eventsByDate.get(iso) ?? [];
                const dow     = (firstDow + day - 1) % 7;
                const isSun   = dow === 0;
                const isSat   = dow === 6;

                return (
                  <div
                    key={iso}
                    onClick={() => setSelectedDate(iso)}
                    className={`border-b border-r border-zinc-200 dark:border-zinc-800/40 p-1.5 cursor-pointer transition-all group
                      ${isSel
                        ? "bg-indigo-50 dark:bg-zinc-800/80 ring-1 ring-inset ring-indigo-200 dark:ring-zinc-600"
                        : isToday
                        ? "bg-zinc-50 dark:bg-zinc-900/80 hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
                        : "bg-white dark:bg-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800/30"
                      }`}
                  >
                    {/* Date number */}
                    <div className="flex items-start justify-between mb-1.5">
                      <span className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold transition-all
                        ${isToday
                          ? "bg-indigo-500 text-white shadow-md shadow-indigo-200 dark:shadow-indigo-900/50"
                          : isSun ? "text-rose-500"
                          : isSat ? "text-sky-500"
                          : isSel ? "text-indigo-600 dark:text-zinc-100"
                          : "text-zinc-600 dark:text-zinc-400"
                        }`}
                      >{day}</span>
                      {dayEvs.length > 0 && !isToday && (
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-300 dark:bg-zinc-500 mt-1 mr-0.5 flex-shrink-0" />
                      )}
                    </div>

                    {/* Pill events */}
                    <div className="space-y-0.5">
                      {dayEvs.slice(0, 2).map((ev) => {
                        const col = getColor(ev.color);
                        return (
                          <div
                            key={ev.id}
                            onClick={(e) => { e.stopPropagation(); setSelectedDate(iso); openView(ev); }}
                            className={`truncate text-sm font-semibold rounded-md px-2 py-0.5 flex items-center gap-1 cursor-pointer hover:opacity-80 transition-all
                              ${col.pill} text-white`}
                          >
                            {ev.event_time && <span className="opacity-80 flex-shrink-0">{fmtTime(ev.event_time)}</span>}
                            <span className="truncate">{ev.title}</span>
                          </div>
                        );
                      })}
                      {dayEvs.length > 2 && (
                        <div className="text-xs text-zinc-400 dark:text-zinc-500 px-1 font-medium">+{dayEvs.length - 2}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Sidebar ── */}
        <div className="w-72 flex-shrink-0 border-l border-zinc-200 dark:border-zinc-800/80 flex flex-col bg-zinc-50 dark:bg-zinc-900/30">
          {/* Header */}
          <div className="px-4 py-3.5 border-b border-zinc-200 dark:border-zinc-800/60 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  {DAYS_TH_FULL[selectedDow]}
                </div>
                <div className="text-2xl font-bold mt-0.5 text-zinc-800 dark:text-zinc-100">
                  {fmtDateShort(selectedDate)}
                </div>
              </div>
              <button
                onClick={() => openCreate(selectedDate)}
                title="เพิ่มกิจกรรมวันนี้"
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all active:scale-95 shadow-md shadow-indigo-200 dark:shadow-indigo-900/30"
              >
                <Plus size={15} />
              </button>
            </div>
          </div>

          {/* Event list */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
            {selectedEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 gap-2 text-zinc-300 dark:text-zinc-600">
                <CalendarDays size={32} strokeWidth={1.2} />
                <span className="text-sm text-zinc-400 dark:text-zinc-500">ไม่มีกิจกรรมในวันนี้</span>
                <button
                  onClick={() => openCreate(selectedDate)}
                  className="mt-1 text-xs text-indigo-500 hover:text-indigo-400 underline underline-offset-2 transition-colors"
                >
                  + เพิ่มกิจกรรม
                </button>
              </div>
            ) : (
              selectedEvents.map((ev) => {
                const col = getColor(ev.color);
                return (
                  <div
                    key={ev.id}
                    onClick={() => openView(ev)}
                    className={`rounded-xl p-3 border cursor-pointer transition-all hover:brightness-95 dark:hover:brightness-110 active:scale-[0.98]
                      ${col.bgL} ${col.bgD} ${col.borderL} ${col.borderD}`}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${col.dot}`} />
                      <div className="flex-1 min-w-0">
                        <div className={`font-semibold text-base leading-snug ${col.textL} ${col.textD}`}>{ev.title}</div>
                        {ev.event_time && (
                          <div className="flex items-center gap-1 text-sm text-zinc-400 dark:text-zinc-500 mt-0.5">
                            <Clock size={12} />
                            <span>{fmtTime(ev.event_time)} น.</span>
                          </div>
                        )}
                        {ev.description && (
                          <div className="text-sm text-zinc-400 dark:text-zinc-500 mt-1 line-clamp-2 leading-relaxed">{ev.description}</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ─── Modal ─────────────────────────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/70 backdrop-blur-sm p-4" onClick={closeModal}>
          <div
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/80 rounded-2xl w-full max-w-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="font-bold text-sm text-zinc-800 dark:text-zinc-100">
                {modal.mode === "create" && "สร้างกิจกรรม"}
                {modal.mode === "edit"   && "แก้ไขกิจกรรม"}
                {modal.mode === "view"   && "รายละเอียดกิจกรรม"}
              </h3>
              <div className="flex items-center gap-1.5">
                {modal.mode === "view" && modal.event && (<>
                  <button onClick={() => openEdit(modal.event!)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors">
                    <Edit2 size={13} />
                  </button>
                  <button onClick={() => handleDelete(modal.event!.id)} disabled={deleting} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/50 text-zinc-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors disabled:opacity-40">
                    {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  </button>
                </>)}
                <button onClick={closeModal} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors">
                  <X size={13} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="px-5 py-4">
              {/* View */}
              {modal.mode === "view" && modal.event && (() => {
                const ev  = modal.event;
                const col = getColor(ev.color);
                return (
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-2 ${col.dot}`} />
                      <div className={`text-2xl font-bold leading-tight ${col.textL} ${col.textD}`}>{ev.title}</div>
                    </div>
                    <div className="pl-6 flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                      🗓 <span>{fmtDateTH(ev.event_date)}</span>
                      {ev.event_time && <><Clock size={12} /><span>{fmtTime(ev.event_time)} น.</span></>}
                    </div>
                    {ev.description && (
                      <div className="pl-6 flex items-start gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                        <AlignLeft size={13} className="mt-0.5 flex-shrink-0 text-zinc-300 dark:text-zinc-600" />
                        <span className="whitespace-pre-wrap leading-relaxed">{ev.description}</span>
                      </div>
                    )}
                    {ev.mention_roles && (() => {
                      try {
                        const roles: string[] = JSON.parse(ev.mention_roles);
                        if (!roles.length) return null;
                        return (
                          <div className="pl-6 flex flex-wrap gap-1 pt-1">
                            {roles.map((r) => (
                              <span key={r} className="px-2 py-0.5 rounded-md text-xs font-semibold bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/40">
                                {r}
                              </span>
                            ))}
                          </div>
                        );
                      } catch { return null; }
                    })()}
                    <div className="pl-6 text-xs text-zinc-400 dark:text-zinc-600 pt-1">
                      สร้างโดย: {ev.created_by_name ?? "—"}{ev.discord_notified && " · แจ้งเตือน Discord ✓"}
                    </div>
                  </div>
                );
              })()}

              {/* Create / Edit */}
              {(modal.mode === "create" || modal.mode === "edit") && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">ชื่อกิจกรรม *</label>
                    <input
                      type="text" value={fTitle} onChange={(e) => setFTitle(e.target.value)} autoFocus
                      placeholder="เช่น Guild War, อัพเดทเกม..."
                      className="w-full bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-zinc-800 dark:text-zinc-100 placeholder-zinc-300 dark:placeholder-zinc-600 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500/80 focus:bg-white dark:focus:bg-zinc-800 transition-all"
                    />
                  </div>
                  <div className="flex gap-2.5">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">วันที่ *</label>
                      <input type="date" value={fDate} onChange={(e) => setFDate(e.target.value)}
                        className="w-full bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500/80 transition-all"
                        style={{ colorScheme: inputColorScheme }}
                      />
                    </div>
                    <div className="w-28">
                      <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">เวลา</label>
                      <input type="time" value={fTime} onChange={(e) => setFTime(e.target.value)}
                        className="w-full bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500/80 transition-all"
                        style={{ colorScheme: inputColorScheme }}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">รายละเอียด</label>
                    <textarea value={fDesc} onChange={(e) => setFDesc(e.target.value)} rows={3}
                      placeholder="รายละเอียดกิจกรรม..."
                      className="w-full bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-zinc-800 dark:text-zinc-100 placeholder-zinc-300 dark:placeholder-zinc-600 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500/80 transition-all resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">สี</label>
                    <div className="flex flex-wrap gap-2">
                      {EVENT_COLORS.map((c) => (
                        <button key={c.id} onClick={() => setFColor(c.id)} title={c.label}
                          className={`w-6 h-6 rounded-full transition-all ${c.dot}
                            ${fColor === c.id ? "ring-2 ring-offset-2 ring-offset-white dark:ring-offset-zinc-900 ring-indigo-500 scale-110" : "opacity-50 hover:opacity-90"}`}
                        />
                      ))}
                    </div>
                  </div>
                  {/* Role mention picker */}
                  {availableRoles.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">แท็กโรล Discord</label>
                      <div className="flex flex-wrap gap-1.5">
                        {availableRoles.map((role) => {
                          const active = fMentions.includes(role.mention);
                          return (
                            <button
                              key={role.id}
                              type="button"
                              onClick={() => setFMentions((prev) =>
                                active ? prev.filter((m) => m !== role.mention) : [...prev, role.mention]
                              )}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                                active
                                  ? "bg-indigo-600 border-indigo-500 text-white shadow-sm"
                                  : "bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-indigo-400 hover:text-indigo-500"
                              }`}
                            >
                              {role.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {formError && (
                    <div className="text-xs text-rose-500 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-xl px-3 py-2">{formError}</div>
                  )}
                  {modal.mode === "create" && (
                    <div className="text-xs text-zinc-400 dark:text-zinc-600">📢 Discord จะแจ้งเตือนทันทีและแจ้งเตือนอีกครั้งในวันที่กิจกรรม</div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            {(modal.mode === "create" || modal.mode === "edit") && (
              <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-zinc-100 dark:border-zinc-800">
                <button onClick={closeModal} className="px-4 py-2 text-sm rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">
                  ยกเลิก
                </button>
                {modal.mode === "edit" && modal.event && (
                  <button onClick={() => handleDelete(modal.event!.id)} disabled={deleting || saving}
                    className="px-4 py-2 text-sm rounded-xl bg-rose-50 dark:bg-rose-900/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-500 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50 transition-colors disabled:opacity-40 flex items-center gap-1.5"
                  >
                    {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} ลบ
                  </button>
                )}
                <button onClick={handleSave} disabled={saving}
                  className="px-4 py-2 text-sm rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-all disabled:opacity-40 flex items-center gap-1.5 shadow-md shadow-indigo-200 dark:shadow-indigo-900/30 active:scale-95"
                >
                  {saving && <Loader2 size={13} className="animate-spin" />}
                  {modal.mode === "create" ? "สร้างกิจกรรม" : "บันทึก"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
