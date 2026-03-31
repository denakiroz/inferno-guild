"use client";

import React, { useEffect, useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Clock, CalendarDays } from "lucide-react";

type CalEvent = {
  id: number;
  title: string;
  event_date: string;  // YYYY-MM-DD
  event_time: string | null;
  color: string;
  description: string | null;
};

/* ── colour maps ─────────────────────────────────────── */
const DOT: Record<string, string> = {
  indigo:  "bg-indigo-500",
  rose:    "bg-rose-500",
  emerald: "bg-emerald-500",
  amber:   "bg-amber-500",
  sky:     "bg-sky-500",
  purple:  "bg-purple-500",
  orange:  "bg-orange-500",
  zinc:    "bg-zinc-400",
};
const PILL_BG: Record<string, string> = {
  indigo:  "bg-indigo-500/15 text-indigo-600 dark:text-indigo-300",
  rose:    "bg-rose-500/15 text-rose-600 dark:text-rose-300",
  emerald: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  amber:   "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  sky:     "bg-sky-500/15 text-sky-600 dark:text-sky-300",
  purple:  "bg-purple-500/15 text-purple-600 dark:text-purple-300",
  orange:  "bg-orange-500/15 text-orange-600 dark:text-orange-300",
  zinc:    "bg-zinc-500/15 text-zinc-600 dark:text-zinc-300",
};
const LEFT_BAR: Record<string, string> = {
  indigo:  "bg-indigo-500",
  rose:    "bg-rose-500",
  emerald: "bg-emerald-500",
  amber:   "bg-amber-500",
  sky:     "bg-sky-500",
  purple:  "bg-purple-500",
  orange:  "bg-orange-500",
  zinc:    "bg-zinc-400",
};

/* ── date helpers ────────────────────────────────────── */
const MONTH_TH = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน",
                  "กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
const DAY_TH   = ["อา","จ","อ","พ","พฤ","ศ","ส"];

function toISO(y: number, m: number, d: number) {
  return `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
}
function todayISO() {
  const n = new Date();
  return toISO(n.getFullYear(), n.getMonth(), n.getDate());
}
function fmtTime(t: string | null) { return t ? t.slice(0,5) : ""; }

/* builds the 6×7 grid for a month (Sun-first) */
function buildGrid(year: number, month: number): Array<{ iso: string; day: number } | null> {
  const first = new Date(year, month, 1).getDay(); // 0=Sun
  const days  = new Date(year, month + 1, 0).getDate();
  const cells: Array<{ iso: string; day: number } | null> = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push({ iso: toISO(year, month, d), day: d });
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/* ─────────────────────────────────────────────────────── */
export function UpcomingEventsWidget() {
  const [events, setEvents]     = useState<CalEvent[]>([]);
  const [loading, setLoading]   = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  const today = todayISO();
  const todayDate = new Date();

  const [viewYear,  setViewYear]  = useState(todayDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(todayDate.getMonth());
  const [selected,  setSelected]  = useState<string | null>(null);

  /* ── fetch ── */
  useEffect(() => {
    fetch("/api/calendar", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) {
          const text = await r.text();
          console.error("[UpcomingEventsWidget] API error", r.status, text);
          setApiError(`API ${r.status}`);
          return [];
        }
        return r.json();
      })
      .then((d) => setEvents(Array.isArray(d) ? d : []))
      .catch((e) => { setApiError(String(e)); setEvents([]); })
      .finally(() => setLoading(false));
  }, []);

  /* ── event lookup map  date → events[] ── */
  const eventMap = useMemo(() => {
    const m = new Map<string, CalEvent[]>();
    for (const ev of events) {
      const arr = m.get(ev.event_date) ?? [];
      arr.push(ev);
      m.set(ev.event_date, arr);
    }
    return m;
  }, [events]);

  const grid = useMemo(() => buildGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const selectedEvents = selected ? (eventMap.get(selected) ?? []) : [];

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
    setSelected(null);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
    setSelected(null);
  }

  if (loading) return null;
  if (events.length === 0 && !apiError) return null;

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-4 shadow-sm">

      {/* ── API error ── */}
      {apiError && (
        <div className="mb-3 text-xs text-rose-400 dark:text-rose-500">
          ไม่สามารถโหลดกิจกรรมได้ ({apiError}) — กรุณาตรวจสอบว่าสร้างตาราง calendar_event ใน Supabase แล้ว
        </div>
      )}

      {/* ── Month header ── */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CalendarDays size={14} className="text-zinc-400 dark:text-zinc-500" />
          <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            {MONTH_TH[viewMonth]} {viewYear + 543}
          </span>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={prevMonth}
            className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 transition"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={nextMonth}
            className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 transition"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* ── Day-of-week headers ── */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_TH.map((d) => (
          <div
            key={d}
            className="text-center text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500 py-1"
          >
            {d}
          </div>
        ))}
      </div>

      {/* ── Day cells ── */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {grid.map((cell, idx) => {
          if (!cell) return <div key={`empty-${idx}`} />;

          const { iso, day } = cell;
          const isToday    = iso === today;
          const isSelected = iso === selected;
          const evs        = eventMap.get(iso) ?? [];
          const hasEvent   = evs.length > 0;
          const isPast     = iso < today;

          return (
            <button
              key={iso}
              type="button"
              onClick={() => setSelected(isSelected ? null : iso)}
              className={[
                "relative flex flex-col items-center justify-center rounded-xl py-1 transition",
                "hover:bg-zinc-100 dark:hover:bg-zinc-800",
                isSelected
                  ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900"
                  : isToday
                    ? "ring-2 ring-indigo-500 ring-inset"
                    : "",
                isPast && !isToday
                  ? "opacity-40"
                  : "",
              ].filter(Boolean).join(" ")}
            >
              <span className={[
                "text-sm font-medium leading-tight",
                isSelected
                  ? "text-white dark:text-zinc-900"
                  : isToday
                    ? "text-indigo-600 dark:text-indigo-300 font-bold"
                    : "text-zinc-700 dark:text-zinc-200",
              ].join(" ")}>
                {day}
              </span>

              {/* Event dots (max 3) */}
              {hasEvent && (
                <div className="flex gap-0.5 mt-0.5 h-1.5">
                  {evs.slice(0, 3).map((ev, i) => (
                    <div
                      key={i}
                      className={[
                        "w-1.5 h-1.5 rounded-full",
                        isSelected
                          ? "bg-white dark:bg-zinc-900 opacity-80"
                          : (DOT[ev.color] ?? DOT.indigo),
                      ].join(" ")}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Selected day events ── */}
      {selected && selectedEvents.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-zinc-100 dark:border-zinc-800 pt-3">
          {selectedEvents.map((ev) => {
            const bar  = LEFT_BAR[ev.color] ?? LEFT_BAR.indigo;
            const pill = PILL_BG[ev.color]  ?? PILL_BG.indigo;
            return (
              <div
                key={ev.id}
                className="flex gap-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 p-3"
              >
                {/* colour bar */}
                <div className={`w-1 rounded-full flex-shrink-0 self-stretch ${bar}`} />

                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                    {ev.title}
                  </div>

                  {ev.event_time && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Clock size={11} className="text-zinc-400" />
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded-md ${pill}`}>
                        {fmtTime(ev.event_time)} น.
                      </span>
                    </div>
                  )}

                  {ev.description && (
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">
                      {ev.description}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Click a day with no events ── */}
      {selected && selectedEvents.length === 0 && (
        <div className="mt-3 border-t border-zinc-100 dark:border-zinc-800 pt-3">
          <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center">ไม่มีกิจกรรมในวันนี้</p>
        </div>
      )}
    </div>
  );
}
