"use client";
import React, { useEffect, useState } from "react";

export function DiscordLoginButton() {
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(/android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent || ""));
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

  // มือถือ: ใช้วิธีเดียวกับเวอร์ชันแรกที่เคยเด้งเข้าแอปได้
  //  = ลิงก์ <a> ธรรมดา -> เซิร์ฟเวอร์ 302 ไป discord.com/api/oauth2/authorize (ไม่มี prompt, ไม่ผ่าน fetch/JS)
  if (isMobile) {
    return (
      <a
        href="/api/auth/discord/start?legacy=1"
        className="w-full h-12 rounded-2xl font-semibold bg-[#5865F2] hover:bg-[#4f5ae0] active:bg-[#4450cd]
                   shadow-[0_0_30px_rgba(88,101,242,0.35)] transition-all flex items-center justify-center gap-3"
      >
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
