"use client";

import React, { useEffect, useState } from "react";

// ── Promo Banner ──────────────────────────────────────────────────────────────
function PromoBanner() {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#1c1007", border: "1px solid #3d2a0a" }}>
      {/* Poster image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://img2.pic.in.th/123123123.png"
        alt="Inferno 6-6 Tournament"
        className="w-full object-contain max-h-[480px]"
        referrerPolicy="no-referrer"
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />

      {/* Info — warm brown/gold palette เข้ากับรูป */}
      <div className="px-5 py-5 space-y-4 text-white" style={{ background: "linear-gradient(180deg,#2a1a06 0%,#1c1007 100%)" }}>

        {/* Title */}
        <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: "#4a3010" }}>
          <span className="text-xl">⚔️</span>
          <span className="font-bold text-2xl tracking-wide" style={{ color: "#e8c060", textShadow: "0 2px 8px rgba(0,0,0,0.8)" }}>
            Inferno 6-6 Tournament
          </span>
        </div>

        {/* Basic info */}
        <div className="space-y-2 text-base leading-relaxed">
          <p style={{ color: "#d4a855" }}>
            <span className="font-semibold">กิจกรรมแข่งขัน 6-6</span>
            <span style={{ color: "#a08040" }}>{" "}(ประจำแพท 1.2.1)</span>
          </p>
          <p style={{ color: "#c8b890" }}>
            <span className="font-semibold text-white">ระยะเวลาการแข่ง :</span>
            {" "}1 และ 3 May 2026 เวลา 20:00 เป็นต้นไป
          </p>
          <p style={{ color: "#c8b890" }}>
            <span className="font-semibold text-white">รูปแบบการแข่งขัน :</span>
            {" "}ทางทีมงานสุ่มจัดทีมให้
          </p>
        </div>

        {/* Sponsor block */}
        <div className="rounded-xl px-4 py-3.5 space-y-2.5" style={{ background: "rgba(0,0,0,0.35)", border: "1px solid #5a3a10" }}>
          <p className="font-bold text-base text-center" style={{ color: "#f0c040" }}>
            🔥 สมาชิก Inferno ห้ามพลาด! กิจกรรมพิเศษจากสปอนเซอร์ใจดี! 🔥
          </p>
          <p className="text-base leading-relaxed" style={{ color: "#c8b890" }}>
            <span className="font-bold text-white">Zafezone</span> ใจดีจัดหนัก ขนรางวัลมาแจกพวกเราชาว Inferno รวมมูลค่าหลายพันบาท!
            {" "}<span style={{ color: "#e8c060" }}>เอาเหรียญไปใช้เป็นส่วนลดเติมเกมกันได้แบบฟรีๆ</span>
          </p>

          {/* Prize */}
          <div className="rounded-lg px-3 py-2.5 space-y-1.5 text-base" style={{ background: "rgba(0,0,0,0.4)" }}>
            <p className="font-bold" style={{ color: "#90d090" }}>✅ รางวัลจัดเต็ม:</p>
            <p style={{ color: "#c8b890" }}>🥇 <span style={{ color: "#e8c060" }} className="font-semibold">อันดับ 1-3</span> — รับสูงสุด <span className="font-bold text-white">50,000 Zafe Coin</span> <span style={{ color: "#806040" }} className="text-sm">(มูลค่า 500 บาท!)</span></p>
            <p style={{ color: "#c8b890" }}>🎁 <span className="font-semibold text-white">รางวัลปลอบใจ</span> — แค่เข้าร่วมกิจกรรม กีรับไปเลย <span style={{ color: "#e8c060" }} className="font-bold">2,000 Coin</span> ทุกคน!</p>
          </div>

          {/* Steps */}
          <div className="space-y-1 text-base" style={{ color: "#c8b890" }}>
            <p className="font-semibold text-white">เริ่มง่ายๆ แค่ 3 ขั้นตอน:</p>
            <p>1. สมัครสมาชิกที่ <a href="https://www.zafezone.co" target="_blank" rel="noopener noreferrer" style={{ color: "#e8c060" }} className="underline font-semibold hover:opacity-80">www.zafezone.co</a></p>
            <p>2. ลงทะเบียนเข้าร่วมกิจกรรมที่หน้า Website Inferno <span style={{ color: "#e8c060" }}>(กดปุ่มด้านล่าง!)</span></p>
            <p>3. เข้าร่วมกิจกรรมและรอรับของรางวัลกันเลย</p>
          </div>

          <p className="text-center text-sm pt-1" style={{ color: "#806040" }}>
            ขอบคุณ <span className="font-semibold" style={{ color: "#c8a050" }}>Zafezone</span> ที่สนับสนุนกิลด์เราครับ 🙏✨
          </p>
        </div>

      </div>
    </div>
  );
}

type EventData = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  registration_count: number;
};

export function EventWidget() {
  const [event, setEvent]         = useState<EventData | null>(null);
  const [registered, setRegistered] = useState(false);
  const [loading, setLoading]     = useState(true);
  const [acting, setActing]       = useState(false);
  const [toast, setToast]         = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const load = async () => {
    try {
      const res = await fetch("/api/events/active", { cache: "no-store" });
      const json = await res.json();
      if (json.ok) {
        setEvent(json.event ?? null);
        setRegistered(json.registered ?? false);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleRegister = async () => {
    if (!event) return;
    setActing(true);
    try {
      const method = registered ? "DELETE" : "POST";
      const res = await fetch(`/api/events/${event.id}/register`, { method });
      const json = await res.json();
      if (!json.ok) { showToast(json.error ?? "เกิดข้อผิดพลาด"); return; }
      setRegistered(!registered);
      setEvent((e) => e ? { ...e, registration_count: e.registration_count + (registered ? -1 : 1) } : e);
      showToast(registered ? "ถอนตัวสำเร็จ" : "ลงทะเบียนสำเร็จ ✓");
    } catch {
      showToast("เกิดข้อผิดพลาด");
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
        <div className="h-4 w-32 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
      </div>
    );
  }

  if (!event) {
    return <PromoBanner />;
  }

  return (
    <div className="space-y-4">
    <PromoBanner />
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 relative">
      {/* Toast */}
      {toast && (
        <div className="absolute top-3 right-3 z-10 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium px-3 py-1.5 rounded-xl shadow">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl">🏆</span>
          <div className="min-w-0">
            <div className="font-bold text-zinc-900 dark:text-zinc-100 truncate">{event.name}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                เปิดรับสมัคร
              </span>
              <span className="text-xs text-zinc-400">{event.registration_count} คนสมัครแล้ว</span>
            </div>
          </div>
        </div>

        {/* Register / Unregister button */}
        {event.status === "open" ? (
          <button
            onClick={handleRegister}
            disabled={acting}
            className={`shrink-0 h-9 px-4 rounded-xl text-sm font-semibold transition disabled:opacity-50 ${
              registered
                ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600"
                : "bg-red-600 hover:bg-red-700 text-white"
            }`}
          >
            {acting ? "..." : registered ? "✓ สมัครแล้ว — ถอนตัว?" : "เข้าร่วม"}
          </button>
        ) : (
          registered ? (
            <span className="shrink-0 h-9 px-4 rounded-xl text-sm font-semibold bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 flex items-center">
              ✓ สมัครแล้ว
            </span>
          ) : (
            <span className="shrink-0 h-9 px-4 rounded-xl text-sm font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-400 flex items-center">
              ปิดรับสมัครแล้ว
            </span>
          )
        )}
      </div>

      {/* Description */}
      {event.description && (
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
          {event.description}
        </p>
      )}

      {/* Registered badge */}
      {registered && (
        <div className="mt-3 flex items-center gap-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl px-3 py-2">
          <span className="text-orange-600 dark:text-orange-400 text-sm">✓</span>
          <span className="text-sm font-medium text-orange-700 dark:text-orange-400">คุณสมัครเข้าร่วม Tournament นี้แล้ว</span>
        </div>
      )}

      {/* Format info */}
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1 text-zinc-500">
          🎮 รูปแบบ: Party Tournament
        </span>
        <span className="text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1 text-zinc-500">
          ⚔️ สูตร: Round-Robin (เจอทุกทีม)
        </span>
      </div>
    </div>
    </div>
  );
}