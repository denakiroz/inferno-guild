"use client";

import React, { useEffect, useState } from "react";
import { defineDict, useT } from "@/i18n";

const dict = defineDict({
  promoTitle: { th: "กิจกรรมแข่งขัน 6-6", en: "6-6 Tournament Event" },
  patch: { th: "(ประจำแพท 1.2.1)", en: "(Patch 1.2.1)" },
  durationLabel: { th: "ระยะเวลาการแข่ง :", en: "Schedule :" },
  durationValue: { th: "1 และ 3 May 2026 เวลา 20:00 เป็นต้นไป", en: "1 and 3 May 2026 from 20:00 onwards" },
  formatLabel: { th: "รูปแบบการแข่งขัน :", en: "Format :" },
  formatValue: { th: "ทางทีมงานสุ่มจัดทีมให้", en: "Teams are randomly assigned by the staff" },
  sponsorHeadline: {
    th: "🔥 สมาชิก Inferno ห้ามพลาด! กิจกรรมพิเศษจากสปอนเซอร์ใจดี! 🔥",
    en: "🔥 Inferno members, don't miss out! A special event from our generous sponsor! 🔥",
  },
  sponsorBody: {
    th: "ใจดีจัดหนัก ขนรางวัลมาแจกพวกเราชาว Inferno รวมมูลค่าหลายพันบาท!",
    en: "is going all out, bringing prizes worth thousands of baht for us Inferno folks!",
  },
  sponsorCoin: { th: "เอาเหรียญไปใช้เป็นส่วนลดเติมเกมกันได้แบบฟรีๆ", en: "Use the coins as a free discount on game top-ups" },
  prizeTitle: { th: "✅ รางวัลจัดเต็ม:", en: "✅ Full prize pool:" },
  rank13: { th: "อันดับ 1-3", en: "Rank 1-3" },
  receiveUpTo: { th: "— รับสูงสุด", en: "— receive up to" },
  worth500: { th: "(มูลค่า 500 บาท!)", en: "(worth 500 baht!)" },
  consolation: { th: "รางวัลปลอบใจ", en: "Consolation prize" },
  consolationBody1: { th: "— แค่เข้าร่วมกิจกรรม กีรับไปเลย", en: "— just join the event and everyone gets" },
  consolationBody2: { th: "ทุกคน!", en: "each!" },
  stepsTitle: { th: "เริ่มง่ายๆ แค่ 3 ขั้นตอน:", en: "Get started in just 3 steps:" },
  step1: { th: "1. สมัครสมาชิกที่", en: "1. Sign up at" },
  step2: { th: "2. ลงทะเบียนเข้าร่วมกิจกรรมที่หน้า Website Inferno", en: "2. Register for the event on the Inferno website" },
  step2Hint: { th: "(กดปุ่มด้านล่าง!)", en: "(press the button below!)" },
  step3: { th: "3. เข้าร่วมกิจกรรมและรอรับของรางวัลกันเลย", en: "3. Join the event and wait for your prizes" },
  topUp: { th: "🎮 เติมเกม", en: "🎮 Top up games" },
  thanksPre: { th: "ขอบคุณ", en: "Thank you" },
  thanksPost: { th: "ที่สนับสนุนกิลด์เราครับ 🙏✨", en: "for supporting our guild 🙏✨" },
  error: { th: "เกิดข้อผิดพลาด", en: "Something went wrong" },
  unregisterOk: { th: "ถอนตัวสำเร็จ", en: "Withdrawn successfully" },
  registerOk: { th: "ลงทะเบียนสำเร็จ ✓", en: "Registered successfully ✓" },
  registrationOpen: { th: "เปิดรับสมัคร", en: "Registration open" },
  registeredCount: { th: "{n} คนสมัครแล้ว", en: "{n} registered" },
  registeredWithdraw: { th: "✓ สมัครแล้ว — ถอนตัว?", en: "✓ Registered — withdraw?" },
  join: { th: "เข้าร่วม", en: "Join" },
  registered: { th: "✓ สมัครแล้ว", en: "✓ Registered" },
  registrationClosed: { th: "ปิดรับสมัครแล้ว", en: "Registration closed" },
  youRegistered: { th: "คุณสมัครเข้าร่วม Tournament นี้แล้ว", en: "You are registered for this Tournament" },
  formatInfo: { th: "🎮 รูปแบบ: Party Tournament", en: "🎮 Format: Party Tournament" },
  formulaInfo: { th: "⚔️ สูตร: Round-Robin (เจอทุกทีม)", en: "⚔️ System: Round-Robin (face every team)" },
});

// ── Promo Banner ──────────────────────────────────────────────────────────────
function PromoBanner() {
  const t = useT(dict);
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
      <div className="px-4 py-4 sm:px-5 sm:py-5 space-y-4 text-white" style={{ background: "linear-gradient(180deg,#2a1a06 0%,#1c1007 100%)" }}>

        {/* Title */}
        <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: "#4a3010" }}>
          <span className="text-xl">⚔️</span>
          <span className="font-bold text-xl sm:text-2xl tracking-wide min-w-0 break-words" style={{ color: "#e8c060", textShadow: "0 2px 8px rgba(0,0,0,0.8)" }}>
            Inferno 6-6 Tournament
          </span>
        </div>

        {/* Basic info */}
        <div className="space-y-2 text-base leading-relaxed">
          <p style={{ color: "#d4a855" }}>
            <span className="font-semibold">{t("promoTitle")}</span>
            <span style={{ color: "#a08040" }}>{" "}{t("patch")}</span>
          </p>
          <p style={{ color: "#c8b890" }}>
            <span className="font-semibold text-white">{t("durationLabel")}</span>
            {" "}{t("durationValue")}
          </p>
          <p style={{ color: "#c8b890" }}>
            <span className="font-semibold text-white">{t("formatLabel")}</span>
            {" "}{t("formatValue")}
          </p>
        </div>

        {/* Sponsor block */}
        <div className="rounded-xl px-3 py-3 sm:px-4 sm:py-3.5 space-y-2.5" style={{ background: "rgba(0,0,0,0.35)", border: "1px solid #5a3a10" }}>
          <p className="font-bold text-base text-center" style={{ color: "#f0c040" }}>
            {t("sponsorHeadline")}
          </p>
          <p className="text-base leading-relaxed" style={{ color: "#c8b890" }}>
            <span className="font-bold text-white">Zafezone</span> {t("sponsorBody")}
            {" "}<span style={{ color: "#e8c060" }}>{t("sponsorCoin")}</span>
          </p>

          {/* Prize */}
          <div className="rounded-lg px-3 py-2.5 space-y-1.5 text-base" style={{ background: "rgba(0,0,0,0.4)" }}>
            <p className="font-bold" style={{ color: "#90d090" }}>{t("prizeTitle")}</p>
            <p style={{ color: "#c8b890" }}>🥇 <span style={{ color: "#e8c060" }} className="font-semibold">{t("rank13")}</span> {t("receiveUpTo")} <span className="font-bold text-white">50,000 Zafe Coin</span> <span style={{ color: "#806040" }} className="text-sm">{t("worth500")}</span></p>
            <p style={{ color: "#c8b890" }}>🎁 <span className="font-semibold text-white">{t("consolation")}</span> {t("consolationBody1")} <span style={{ color: "#e8c060" }} className="font-bold">2,000 Coin</span> {t("consolationBody2")}</p>
          </div>

          {/* Steps */}
          <div className="space-y-1 text-base" style={{ color: "#c8b890" }}>
            <p className="font-semibold text-white">{t("stepsTitle")}</p>
            <p>{t("step1")} <a href="https://www.zafezone.co" target="_blank" rel="noopener noreferrer" style={{ color: "#e8c060" }} className="underline font-semibold hover:opacity-80">www.zafezone.co</a></p>
            <p>{t("step2")} <span style={{ color: "#e8c060" }}>{t("step2Hint")}</span></p>
            <p>{t("step3")}</p>
          </div>

          {/* CTA Button */}
          <a
            href="https://www.zafezone.co"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center font-bold text-base py-2.5 rounded-xl transition hover:opacity-90 active:scale-95"
            style={{ background: "linear-gradient(135deg,#f0a020,#e06010)", color: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.4)" }}
          >
            {t("topUp")}
          </a>

          <p className="text-center text-sm pt-1" style={{ color: "#806040" }}>
            {t("thanksPre")} <span className="font-semibold" style={{ color: "#c8a050" }}>Zafezone</span> {t("thanksPost")}
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
  const t = useT(dict);
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
      if (!json.ok) { showToast(json.error ?? t("error")); return; }
      setRegistered(!registered);
      setEvent((e) => e ? { ...e, registration_count: e.registration_count + (registered ? -1 : 1) } : e);
      showToast(registered ? t("unregisterOk") : t("registerOk"));
    } catch {
      showToast(t("error"));
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5">
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
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 relative">
      {/* Toast */}
      {toast && (
        <div className="absolute top-3 right-3 z-10 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium px-3 py-1.5 rounded-xl shadow">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl">🏆</span>
          <div className="min-w-0">
            <div className="font-bold text-zinc-900 dark:text-zinc-100 truncate">{event.name}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                {t("registrationOpen")}
              </span>
              <span className="text-xs text-zinc-400">{t("registeredCount", { n: event.registration_count })}</span>
            </div>
          </div>
        </div>

        {/* Register / Unregister button */}
        {event.status === "open" ? (
          <button
            onClick={handleRegister}
            disabled={acting}
            className={`w-full sm:w-auto shrink-0 h-10 sm:h-9 px-4 rounded-xl text-sm font-semibold transition disabled:opacity-50 ${
              registered
                ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600"
                : "bg-red-600 hover:bg-red-700 text-white"
            }`}
          >
            {acting ? "..." : registered ? t("registeredWithdraw") : t("join")}
          </button>
        ) : (
          registered ? (
            <span className="shrink-0 h-9 px-4 rounded-xl text-sm font-semibold bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 flex items-center">
              {t("registered")}
            </span>
          ) : (
            <span className="shrink-0 h-9 px-4 rounded-xl text-sm font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-400 flex items-center">
              {t("registrationClosed")}
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
          <span className="text-sm font-medium text-green-700 dark:text-green-400">{t("youRegistered")}</span>
        </div>
      )}

      {/* Format info */}
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1 text-zinc-500">
          {t("formatInfo")}
        </span>
        <span className="text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1 text-zinc-500">
          {t("formulaInfo")}
        </span>
      </div>
    </div>
    </div>
  );
}