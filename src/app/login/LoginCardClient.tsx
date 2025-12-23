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
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6 shadow-xl">
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
        </>
      ) : (
        <div className="text-sm text-white/70">
          กรุณาเปิดหน้านี้ด้วย Chrome/เบราว์เซอร์หลักก่อน จึงจะสามารถกดล็อกอินได้
        </div>
      )}
    </div>
  );
}
