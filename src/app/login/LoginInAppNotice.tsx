"use client";

import React, { useEffect, useMemo, useState } from "react";

function isInAppBrowser(ua: string) {
  const u = ua.toLowerCase();
  // LINE / Facebook / Instagram / TikTok in-app browsers (เพิ่มได้ตามที่เจอ)
  return (
    u.includes("line/") ||
    u.includes("fbav") ||
    u.includes("fban") ||
    u.includes("instagram") ||
    u.includes("tiktok") ||
    u.includes("wv") // Android WebView hint
  );
}

export function LoginInAppNotice() {
  const [inApp, setInApp] = useState(false);
  const [copied, setCopied] = useState(false);

  const url = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.href;
  }, []);

  useEffect(() => {
    const ua = navigator.userAgent || "";
    setInApp(isInAppBrowser(ua));
  }, []);

  if (!inApp) return null;

  return (
    <div className="mb-4 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3">
      <div className="font-semibold">ดูเหมือนคุณกำลังเปิดผ่าน In-app Browser</div>
      <div className="text-sm text-white/70 mt-1">
        บางแอป (เช่น LINE/Facebook/Instagram) อาจไม่เปิด Discord App อัตโนมัติ
        แนะนำให้เปิดลิงก์นี้ด้วย Chrome หรือ Safari แล้วล็อกอินอีกครั้ง
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="h-10 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              // fallback: nothing
            }
          }}
        >
          {copied ? "คัดลอกแล้ว" : "คัดลอกลิงก์"}
        </button>

        <button
          type="button"
          className="h-10 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10"
          onClick={() => {
            // พยายามเปิดใน browser ภายนอก (บางเครื่องจะขึ้นตัวเลือก Open in Chrome/Safari)
            window.open(url, "_blank", "noopener,noreferrer");
          }}
        >
          เปิดในเบราว์เซอร์
        </button>
      </div>
    </div>
  );
}
