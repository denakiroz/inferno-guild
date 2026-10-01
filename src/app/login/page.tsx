import type React from "react";
import { LoginCardClient } from "./LoginCardClient";

const EMBERS = [
  { left: 6, size: 3, dx: 30, dur: 9, delay: 0 },
  { left: 13, size: 2, dx: -20, dur: 12, delay: 3 },
  { left: 21, size: 4, dx: 40, dur: 10, delay: 6 },
  { left: 29, size: 2, dx: -30, dur: 13, delay: 1 },
  { left: 37, size: 3, dx: 20, dur: 11, delay: 4 },
  { left: 45, size: 2, dx: -40, dur: 14, delay: 8 },
  { left: 53, size: 4, dx: 30, dur: 9, delay: 2 },
  { left: 61, size: 3, dx: -20, dur: 12, delay: 7 },
  { left: 69, size: 2, dx: 40, dur: 10, delay: 5 },
  { left: 77, size: 3, dx: -30, dur: 13, delay: 0 },
  { left: 85, size: 4, dx: 20, dur: 11, delay: 9 },
  { left: 93, size: 2, dx: -40, dur: 14, delay: 3 },
];

const ERROR_TEXT: Record<string, { title: string; desc: string }> = {
  missing_code: { title: "ไม่พบโค้ดล็อกอิน", desc: "กรุณาลองล็อกอินใหม่อีกครั้ง" },
  auth_failed: { title: "ล็อกอินไม่สำเร็จ", desc: "กรุณาลองใหม่ หรือเช็คค่า Client ID/Secret" },
  not_in_guild: { title: "ไม่อยู่ในกิลด์", desc: "บัญชีนี้ไม่ได้อยู่ใน Discord Server ที่กำหนด" },
};

function getParam(v: unknown) {
  if (!v) return "";
  if (Array.isArray(v)) return String(v[0] ?? "");
  return String(v);
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[]>>;
}) {
  const sp = searchParams ? await searchParams : undefined;
  const error = getParam(sp?.error);
  const errMeta = error
    ? ERROR_TEXT[error] ?? { title: "เกิดปัญหา", desc: "กรุณาลองใหม่อีกครั้ง" }
    : null;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070204] text-white flex items-center justify-center p-4 sm:p-6">
      <style>{`
        @keyframes ember-rise {
          0%   { transform: translate3d(0, 0, 0) scale(1); opacity: 0; }
          10%  { opacity: 0.9; }
          100% { transform: translate3d(var(--dx), -110vh, 0) scale(0.3); opacity: 0; }
        }
        @keyframes glow-pulse {
          0%, 100% { opacity: 0.55; }
          50%      { opacity: 0.85; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ember, .glow-pulse { animation: none !important; }
        }
      `}</style>

      {/* พื้นหลัง: ไล่เฉดแดงเลือดหมู -> ดำ */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,#5c0b10_0%,#25060a_45%,#070204_100%)]"
      />
      {/* ภาพแบนเนอร์เบลอ ให้สีโทนเดียวกัน */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-50 blur-xl scale-125 mix-blend-screen"
        style={{ backgroundImage: "url(/login-banner.webp)" }}
      />
      {/* แสงไฟเรืองขอบฟ้าด้านล่าง */}
      <div
        aria-hidden
        className="glow-pulse pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_40%_at_50%_105%,rgba(255,90,20,0.45),transparent_70%)] animate-[glow-pulse_5s_ease-in-out_infinite]"
      />
      {/* วินเนตต์ให้ขอบมืด โฟกัสกลางจอ */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(0,0,0,0.75)_100%)]"
      />

      {/* ประกายไฟลอยขึ้น */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {EMBERS.map((e, i) => (
          <span
            key={i}
            className="ember absolute bottom-[-10px] rounded-full bg-orange-400"
            style={
              {
                left: `${e.left}%`,
                width: e.size,
                height: e.size,
                boxShadow: "0 0 8px 2px rgba(255,120,40,0.8)",
                "--dx": `${e.dx}px`,
                animation: `ember-rise ${e.dur}s linear ${e.delay}s infinite`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      <div className="relative w-full max-w-3xl">
        <div className="mb-4 sm:mb-6 text-center">
          <img
            src="/login-banner.webp"
            alt="Phoenix Celes"
            loading="eager"
            className="w-full h-auto rounded-2xl border border-red-500/30 shadow-[0_0_60px_rgba(220,38,38,0.35)]"
          />

          <div className="mt-4 sm:mt-5 text-2xl sm:text-3xl font-bold">Guild Portal</div>
          <div className="mt-1 text-white/60 text-sm">
            เข้าสู่ระบบด้วย Discord เพื่อยืนยันสมาชิกในกิลด์
          </div>
        </div>

        <div className="mx-auto w-full max-w-md">
          <LoginCardClient errTitle={errMeta?.title} errDesc={errMeta?.desc} />
        </div>
      </div>
    </main>
  );
}
