"use client";

import React from "react";

function buildAuthorizeUrl() {
  // ไปที่ /api/auth/discord/start ตามเดิมของคุณ (ฝั่ง server จะ redirect ไป authorize อีกที)
  // แต่เพื่อให้ "เด้งเข้าแอป" ได้ดีขึ้น เราจะพยายามเปิด authorize ในโดเมน discord โดยตรงก่อน
  // ถ้าคุณอยากให้ทุกอย่างยังผ่าน server ของคุณ: ใช้ "/api/auth/discord/start" เป็น web fallback ได้
  return "/api/auth/discord/start";
}

function buildDiscordDeepLink(webUrl: string) {
  // iOS/Android หลายเคสจะเปิดแอปจาก discord:// ได้ (แต่ไม่ 100%)
  // Discord app บางเวอร์ชันรับ universal link จาก https://discord.com/... ได้ดีขึ้น
  // เราเลยทำ 2 ชั้น: discord:// แล้วค่อย https
  // หมายเหตุ: discord:// เปิด path แบบ universal link ไม่เสถียรทุกเวอร์ชัน แต่ยังคุ้มลอง
  const encoded = encodeURIComponent(webUrl);
  return {
    ios: `discord://discord.com/app`, // แบบง่ายสุดให้เด้งเข้าแอป (แล้วให้ผู้ใช้กด authorize ต่อ)
    // ถ้าต้องการพยายามพาไป authorize ตรงๆ (อาจไม่ work บางเครื่อง):
    // ios: `discord://discord.com/oauth2/authorize?${...}`,
    androidIntent: `intent://discord.com/app#Intent;scheme=https;package=com.discord;end`,
    web: webUrl,
  };
}

export function DiscordLoginButton() {
  const onLogin = () => {
    const webUrl = buildAuthorizeUrl();
    const ua = navigator.userAgent || "";
    const isAndroid = /android/i.test(ua);
    const isIOS = /iphone|ipad|ipod/i.test(ua);

    const { ios, androidIntent, web } = buildDiscordDeepLink(webUrl);

    // 1) ลองเปิดแอปก่อน
    const start = Date.now();

    if (isAndroid) {
      // Android: intent มีโอกาสเด้งเข้าแอปสูงสุด
      window.location.href = androidIntent;
    } else if (isIOS) {
      // iOS: ลอง scheme ก่อน
      window.location.href = ios;
    }

    // 2) fallback ไปเว็บ (ถ้าแอปไม่เปิดจริง ๆ จะยังอยู่หน้าเดิม)
    // ถ้าแอปเปิดสำเร็จ ผู้ใช้จะออกจาก browser ไปแล้ว ทำให้โค้ดนี้ไม่กวน
    setTimeout(() => {
      // ถ้ายังอยู่หน้าเดิม ให้ไป web auth
      // ใช้เงื่อนไขเวลาช่วยกัน loop แปลกๆ
      if (Date.now() - start < 2200) {
        window.location.href = web;
      }
    }, 1200);
  };

  return (
    <button
      type="button"
      onClick={onLogin}
      className={[
        "w-full h-12 rounded-2xl font-semibold",
        "bg-[#5865F2] hover:bg-[#4f5ae0] active:bg-[#4450cd]",
        "shadow-[0_0_30px_rgba(88,101,242,0.35)]",
        "transition-all flex items-center justify-center gap-3",
      ].join(" ")}
    >
      <span className="inline-flex items-center justify-center">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="white" aria-hidden="true">
          <path d="M19.7 5.3A14.6 14.6 0 0 0 16.2 4c-.2.3-.4.7-.6 1a13.6 13.6 0 0 0-3.2-.4c-1.1 0-2.2.1-3.2.4-.2-.3-.4-.7-.6-1a14.6 14.6 0 0 0-3.5 1.3C2.7 8 2 10.6 2.3 13.1c1.6 1.2 3.1 1.9 4.6 2.2.4-.5.7-1 .9-1.5-.5-.2-1-.4-1.4-.7l.3-.2c2.7 1.2 5.6 1.2 8.3 0l.3.2c-.4.3-.9.5-1.4.7.2.5.6 1 1 1.5 1.5-.3 3-.9 4.6-2.2.3-2.5-.4-5.1-2.3-7.8ZM9.2 12.8c-.7 0-1.2-.6-1.2-1.3 0-.7.6-1.3 1.2-1.3.7 0 1.2.6 1.2 1.3 0 .7-.6 1.3-1.2 1.3Zm5.6 0c-.7 0-1.2-.6-1.2-1.3 0-.7.6-1.3 1.2-1.3.7 0 1.2.6 1.2 1.3 0 .7-.5 1.3-1.2 1.3Z" />
        </svg>
      </span>
      <span>Sign in with Discord</span>
    </button>
  );
}
