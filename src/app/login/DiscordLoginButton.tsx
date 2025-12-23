"use client";
import React, { useState } from "react";

function toAndroidIntentHttps(authorizeUrl: string) {
  const u = new URL(authorizeUrl);
  const hostAndPath = `${u.host}${u.pathname}${u.search}${u.hash}`;
  return `intent://${hostAndPath}#Intent;scheme=https;package=com.discord;end`;
}

export function DiscordLoginButton() {
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    try {
      setLoading(true);

      const r = await fetch("/api/auth/discord/start?mode=url", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      if (!r.ok) throw new Error("start_failed");

      const { authorizeUrl } = (await r.json()) as { authorizeUrl: string };
      if (!authorizeUrl) throw new Error("missing_authorize_url");

      const ua = navigator.userAgent || "";
      const isAndroid = /android/i.test(ua);

      const t0 = Date.now();

      // 1) พยายามเปิดใน Discord app โดยตรง
      if (isAndroid) {
        window.location.href = toAndroidIntentHttps(authorizeUrl);
      } else {
        // iOS: เปิด https ตรง ๆ (ถ้า Discord claim universal link จะเด้งเข้าแอปและไปหน้า authorize)
        window.location.href = authorizeUrl;
      }

      // 2) fallback ไป authorize ผ่านเว็บ เผื่อ intent / universal link ไม่ทำงาน
      setTimeout(() => {
        if (Date.now() - t0 < 2200) {
          window.location.href = authorizeUrl;
        }
      }, 1200);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onLogin}
      disabled={loading}
      className="w-full h-12 rounded-2xl font-semibold bg-[#5865F2] hover:bg-[#4f5ae0] active:bg-[#4450cd]
                 shadow-[0_0_30px_rgba(88,101,242,0.35)] transition-all flex items-center justify-center gap-3
                 disabled:opacity-70 disabled:cursor-not-allowed"
    >
      <span>{loading ? "Opening Discord..." : "Sign in with Discord"}</span>
    </button>
  );
}
