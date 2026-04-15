"use client";

import React, { useEffect, useState } from "react";

// ── Promo Banner ──────────────────────────────────────────────────────────────
function PromoBanner() {
  return (
    <div className="rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
      {/* Poster image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://img1.pic.in.th/images/content8c98807f37f36478.png"
        alt="Inferno 6-6 Tournament"
        className="w-full object-contain"
        referrerPolicy="no-referrer"
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
      {/* Info */}
      <div className="px-5 py-4 space-y-4 bg-gradient-to-b from-[#1a2e1a] to-[#0f1f0f] text-white">

        {/* Tournament title */}
        <div className="flex items-center gap-2">
          <span className="text-xl">⚔️</span>
          <span className="font-bold text-lg tracking-wide" style={{ color: "#c8a84b", textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>
            Inferno 6-6 Tournament
          </span>
        </div>

        {/* Basic info */}
        <div className="space-y-1.5 text-sm leading-relaxed">
          <p className="text-zinc-200">
            <span className="font-semibold text-amber-300">กิจกรรมแข่งขัน 6-6</span>
            {" "}(ประจำแพท 1.2.1)
          </p>
          <p className="text-zinc-300">
            <span className="font-semibold text-white">ระยะเวลาการแข่ง :</span>
            {" "}1 และ 3 May 2026 เวลา 20:00 เป็นต้นไป
          </p>
          <p className="text-zinc-300">
            <span className="font-semibold text-white">รูปแบบการแข่งขัน :</span>
            {" "}ทางทีมงานสุ่มจัดทีมให้
          </p>
        </div>

        {/* Sponsor banner */}
        <div className="rounded-xl border border-amber-400/40 bg-amber-950/60 px-4 py-3 space-y-2.5">
          <p className="text-amber-300 font-bold text-sm text-center">
            🔥 สมาชิก Inferno ห้ามพลาด! กิจกรรมพิเศษจากสปอนเซอร์ใจดี! 🔥
          </p>
          <p className="text-zinc-200 text-sm leading-relaxed">
            <span className="font-bold text-white">Zafezone</span> ใจดีจัดหนัก ขนรางวัลมาแจกพวกเราชาว Inferno รวมมูลค่าหลายพันบาท!
            {" "}<span className="text-amber-300">เอาเหรียญไปใช้เป็นส่วนลดเติมเกมกันได้แบบฟรีๆ</span>
          </p>

          {/* Prize */}
          <div className="bg-black/30 rounded-lg px-3 py-2.5 space-y-1 text-sm">
            <p className="text-green-400 font-bold">✅ รางวัลจัดเต็ม:</p>
            <p className="text-zinc-200">🥇 <span className="text-amber-300 font-semibold">อันดับ 1-3</span> — รับสูงสุด <span className="font-bold text-white">50,000 Zafe Coin</span> <span className="text-zinc-400 text-xs">(มูลค่า 500 บาท!)</span></p>
            <p className="text-zinc-200">🎁 <span className="font-semibold text-white">รางวัลปลอบใจ</span> — แค่เข้าร่วมกิจกรรม กีรับไปเลย <span className="text-amber-300 font-bold">2,000 Coin</span> ทุกคน!</p>
          </div>

          {/* Steps */}
          <div className="space-y-1 text-sm">
            <p className="text-zinc-300 font-semibold">เริ่มง่ายๆ แค่ 3 ขั้นตอน:</p>
            <p className="text-zinc-300">1. สมัครสมาชิกที่ <a href="https://www.zafezone.co" target="_blank" rel="noopener noreferrer" className="text-amber-300 underline font-semibold hover:text-amber-200">www.zafezone.co</a></p>
            <p className="text-zinc-300">2. ลงทะเบียนเข้าร่วมกิจกรรมที่หน้า Website Inferno <span className="text-amber-300">(กดปุ่มด้านล่าง!)</span></p>
            <p className="text-zinc-300">3. เข้าร่วมกิจกรรมและรอรับของรางวัลกันเลย</p>
          </div>

          <p className="text-center text-zinc-400 text-xs pt-1">
            ขอบคุณ <span className="text-white font-semibold">Zafezone</span> ที่สนับสนุนกิลด์เราครับ 🙏✨
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
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
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
            <span className="shrink-0 h-9 px-4 rounded-xl text-sm font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 flex items-center">
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
        <div className="mt-3 flex items-center gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-3 py-2">
          <span className="text-green-600 dark:text-green-400 text-sm">✓</span>
          <span className="text-sm font-medium text-green-700 dark:text-green-400">คุณสมัครเข้าร่วม Tournament นี้แล้ว</span>
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
