"use client";

import React, { useState } from "react";
import { LoginInAppNotice } from "./LoginInAppNotice";
import { DiscordLoginButton } from "./DiscordLoginButton";

export function LoginCardClient({
  errTitle,
  errDesc,
}: {
  errTitle?: string | null;
  errDesc?: string | null;
}) {
  const [inApp, setInApp] = useState(false);

  return (
    <div className="p-0">
      <LoginInAppNotice onInAppChange={setInApp} />

      {!!errTitle && (
        <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3">
          <div className="font-semibold">{errTitle}</div>
          {!!errDesc && <div className="text-sm text-white/70">{errDesc}</div>}
        </div>
      )}

      {/* ✅ ถ้าเป็น in-app browser: ซ่อนปุ่มล็อกอิน */}
      {!inApp ? (
        <>
          <DiscordLoginButton />
          <div className="mt-3 text-center text-xs text-white/50">
            ใช้มือถือ? พิมพ์ <span className="font-mono text-white/70">/login</span> ในเซิร์ฟเวอร์ Discord
            ของกิลด์ แล้วกดปุ่มที่บอทส่งให้ เพื่อเข้าสู่เว็บโดยไม่ต้องล็อกอินซ้ำ
          </div>
        </>
      ) : (
        <div className="text-sm text-white/70">
          กรุณาเปิดหน้านี้ด้วย Chrome/เบราว์เซอร์หลักก่อน จึงจะสามารถกดล็อกอินได้
        </div>
      )}
    </div>
  );
}
