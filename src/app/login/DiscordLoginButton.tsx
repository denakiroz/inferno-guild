"use client";
import React, { useEffect, useState } from "react";

export function DiscordLoginButton() {
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [mobileUrl, setMobileUrl] = useState<string | null>(null);

  useEffect(() => {
    const ua = navigator.userAgent || "";
    const mobile = /android|iphone|ipad|ipod|mobile/i.test(ua);
    setIsMobile(mobile);
    setIsAndroid(/android/i.test(ua));
    if (!mobile) return;

    // มือถือ: เตรียม authorize URL ล่วงหน้า (เซิร์ฟเวอร์ตั้ง cookie state ให้ตอนเรียก)
    // แล้วให้ผู้ใช้ "แตะลิงก์จริง" ไปที่ discord.com โดยตรง -> ระบบมือถือถึงจะเปิดแอป Discord ได้
    // (redirect จากเซิร์ฟเวอร์/JS ไม่ถูกนับเป็นการแตะลิงก์ แอปจึงไม่เด้ง)
    fetch("/api/auth/discord/start?mode=url", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.authorizeUrl) setMobileUrl(String(j.authorizeUrl));
      })
      .catch(() => {});
  }, []);

  const onLogin = async () => {
    try {
      setLoading(true);

      // 1) ลองแบบไม่ให้ขึ้นหน้า login ถ้ามี session อยู่แล้ว
      const r = await fetch("/api/auth/discord/start?mode=url&prompt=none", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      if (!r.ok) throw new Error("start_failed");

      const { authorizeUrl } = (await r.json()) as { authorizeUrl: string };
      if (!authorizeUrl) throw new Error("missing_authorize_url");

      window.location.href = authorizeUrl;
    } finally {
      setLoading(false);
    }
  };

  const cls = `w-full h-12 rounded-2xl font-semibold bg-[#5865F2] hover:bg-[#4f5ae0] active:bg-[#4450cd]
                 shadow-[0_0_30px_rgba(88,101,242,0.35)] transition-all flex items-center justify-center gap-3
                 disabled:opacity-70 disabled:cursor-not-allowed`;

  if (isMobile) {
    let href = "/api/auth/discord/start"; // fallback ระหว่างรอ/ถ้าเตรียม URL ไม่สำเร็จ
    if (mobileUrl) {
      if (isAndroid) {
        // Android: บังคับเปิดด้วยแอป Discord (package com.discord) ถ้าไม่มีแอป -> fallback เปิดเว็บ
        const u = new URL(mobileUrl);
        href =
          `intent://${u.host}${u.pathname}${u.search}` +
          `#Intent;scheme=https;package=com.discord;` +
          `S.browser_fallback_url=${encodeURIComponent(mobileUrl)};end`;
      } else {
        href = mobileUrl;
      }
    }

    return (
      <a href={href} className={cls}>
        <span>Sign in with Discord</span>
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={onLogin}
      disabled={loading}
      className="w-full h-12 rounded-2xl font-semibold bg-[#5865F2] hover:bg-[#4f5ae0] active:bg-[#4450cd]
                 shadow-[0_0_30px_rgba(88,101,242,0.35)] transition-all flex items-center justify-center gap-3
                 disabled:opacity-70 disabled:cursor-not-allowed"
    >
      <span>{loading ? "Redirecting..." : "Sign in with Discord"}</span>
    </button>
  );
}
