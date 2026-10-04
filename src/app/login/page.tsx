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
  { left: 10, size: 2, dx: 25, dur: 11, delay: 5 },
  { left: 33, size: 3, dx: -35, dur: 13, delay: 9 },
  { left: 57, size: 2, dx: 30, dur: 12, delay: 6 },
  { left: 82, size: 3, dx: -25, dur: 10, delay: 2 },
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
    <main className="relative min-h-screen overflow-hidden bg-[#05060a] text-white flex items-center justify-center p-4 sm:p-6">
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
        @keyframes snow-fall {
          0%   { transform: translate3d(0, 0, 0) scale(1); opacity: 0; }
          10%  { opacity: 0.9; }
          100% { transform: translate3d(var(--dx), 110vh, 0) scale(0.5); opacity: 0; }
        }
        @keyframes float-y {
          0%, 100% { transform: translateY(0) scale(1); }
          50%      { transform: translateY(-12px) scale(1.015); }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: none; }
        }
        @keyframes emblem-in {
          from { opacity: 0; transform: scale(0.92); filter: blur(6px); }
          to   { opacity: 1; transform: none; filter: none; }
        }
        @keyframes shimmer {
          0%   { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ember, .snow, .glow-pulse, .anim { animation: none !important; }
        }
      `}</style>

      {/* พื้นหลัง: ดำ + แสงไฟส้มฝั่งซ้าย / แสงน้ำแข็งฟ้าฝั่งขวา ตามธีมรูป (ฟีนิกซ์ไฟ vs จิ้งจอกน้ำแข็ง) */}
      <div
        aria-hidden
        className="glow-pulse pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_65%_at_28%_42%,rgba(255,90,30,0.34),transparent_70%)]"
        style={{ animation: "glow-pulse 6s ease-in-out infinite" }}
      />
      <div
        aria-hidden
        className="glow-pulse pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_65%_at_72%_50%,rgba(70,120,255,0.32),transparent_70%)]"
        style={{ animation: "glow-pulse 6s ease-in-out 3s infinite" }}
      />
      {/* แสงเรืองกลางจอด้านหลังตรา */}
      <div
        aria-hidden
        className="glow-pulse pointer-events-none absolute left-1/2 top-[34%] h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.10),transparent_65%)] animate-[glow-pulse_5s_ease-in-out_infinite]"
      />
      {/* วินเนตต์ให้ขอบมืด โฟกัสกลางจอ */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.85)_100%)]"
      />

      {/* ซ้าย: ประกายไฟลอยขึ้น / ขวา: เกล็ดน้ำแข็งโปรยลง */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {EMBERS.map((e, i) =>
          e.left < 50 ? (
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
          ) : (
            <span
              key={i}
              className="snow absolute top-[-10px] rounded-full bg-sky-200"
              style={
                {
                  left: `${e.left}%`,
                  width: e.size,
                  height: e.size,
                  boxShadow: "0 0 8px 2px rgba(120,170,255,0.8)",
                  "--dx": `${-e.dx}px`,
                  animation: `snow-fall ${e.dur + 4}s linear ${e.delay}s infinite`,
                } as React.CSSProperties
              }
            />
          )
        )}
      </div>

      <div className="relative w-full max-w-3xl">
        <div className="mb-4 sm:mb-6 text-center">
          {/* ตราสัญลักษณ์ — ขอบรูปถูกมาสก์แบบวงกลมเฟดหาย + blend ให้พื้นหลังดำของรูปกลืนไปกับพื้นหน้าเว็บ (ไม่ใช้ drop-shadow เพราะจะเห็นเป็นกรอบสี่เหลี่ยม) */}
          <img
            src="/login-emblem.webp"
            alt="Phoenix and fox emblem"
            loading="eager"
            className="anim mx-auto h-64 w-64 sm:h-96 sm:w-96 object-contain mix-blend-screen"
            style={{
              animation: "emblem-in 1.2s ease-out both, float-y 7s ease-in-out 1.2s infinite",
              WebkitMaskImage: "radial-gradient(circle at center, #000 62%, transparent 78%)",
              maskImage: "radial-gradient(circle at center, #000 62%, transparent 78%)",
            }}
          />
          <div
            className="anim -mt-4 sm:-mt-6 bg-[linear-gradient(90deg,#fdba74,#fff,#7dd3fc,#fff,#fdba74)] bg-[length:200%_100%] bg-clip-text text-3xl sm:text-4xl font-extrabold tracking-[0.18em] text-transparent"
            style={{ animation: "fade-up 0.9s ease-out 0.4s both, shimmer 6s linear 1.3s infinite" }}
          >
            CELESTIER
          </div>
          <div
            className="anim mt-1 text-sm sm:text-base font-semibold tracking-[0.35em] text-white/70"
            style={{ animation: "fade-up 0.9s ease-out 0.55s both" }}
          >
            GUILD PORTAL
          </div>
          <div className="anim mt-1 text-white/60 text-sm" style={{ animation: "fade-up 0.9s ease-out 0.7s both" }}>
            เข้าสู่ระบบด้วย Discord เพื่อยืนยันสมาชิกในกิลด์
          </div>
        </div>

        <div className="anim mx-auto w-full max-w-md" style={{ animation: "fade-up 0.9s ease-out 0.9s both" }}>
          <LoginCardClient errTitle={errMeta?.title} errDesc={errMeta?.desc} />
        </div>
      </div>
    </main>
  );
}
