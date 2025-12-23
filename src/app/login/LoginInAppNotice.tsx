"use client";

import React, { useEffect, useMemo, useState } from "react";

function isInAppBrowser(ua: string) {
  const u = ua.toLowerCase();
  return (
    u.includes("line/") ||
    u.includes("fbav") ||
    u.includes("fban") ||
    u.includes("instagram") ||
    u.includes("tiktok") ||
    u.includes("wv")
  );
}

function openCurrentInChrome(url: string) {
  const u = new URL(url);
  const hostAndPath = `${u.host}${u.pathname}${u.search}${u.hash}`;
  const chromeIntent = `intent://${hostAndPath}#Intent;scheme=https;package=com.android.chrome;end`;
  window.location.href = chromeIntent;

  // fallback
  setTimeout(() => window.open(url, "_blank", "noopener,noreferrer"), 1200);
}

export function LoginInAppNotice() {
  const [inApp, setInApp] = useState(false);

  const url = useMemo(() => (typeof window === "undefined" ? "" : window.location.href), []);

  useEffect(() => {
    const ua = navigator.userAgent || "";
    setInApp(isInAppBrowser(ua));
  }, []);

  if (!inApp) return null;

  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isAndroid = /android/i.test(ua);
  const isIOS = /iphone|ipad|ipod/i.test(ua);

  return (
    <div className="mb-4 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3">
      <div className="font-semibold">กำลังเปิดผ่าน In-app Browser</div>
      <div className="text-sm text-white/70 mt-1">
        เพื่อให้ล็อกอิน Discord ได้ลื่นและไม่ต้องกรอกซ้ำ แนะนำให้เปิดด้วย{" "}
        {isAndroid ? "Chrome" : isIOS ? "Safari" : "เบราว์เซอร์หลัก"} ก่อน
      </div>

      <div className="mt-3 flex gap-2">
        {isAndroid && (
          <button
            type="button"
            className="h-10 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10"
            onClick={() => openCurrentInChrome(url)}
          >
            เปิดใน Chrome
          </button>
        )}

        {!isAndroid && (
          <button
            type="button"
            className="h-10 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10"
            onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
          >
            เปิดในเบราว์เซอร์
          </button>
        )}

        <button
          type="button"
          className="h-10 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
            } catch {}
          }}
        >
          คัดลอกลิงก์
        </button>
      </div>
    </div>
  );
}
