import { Card, Button } from "@/app/components/UI";

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

export default function LoginPage({ searchParams }: { searchParams?: Record<string, string | string[]> }) {
  const error = getParam(searchParams?.error);
  const errMeta = error ? (ERROR_TEXT[error] ?? { title: "เกิดปัญหา", desc: "กรุณาลองใหม่อีกครั้ง" }) : null;

  return (
    <main className="min-h-screen bg-[#0b0d13] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <div className="text-sm tracking-[0.2em] text-white/60">INFERNO</div>
          <div className="text-3xl font-bold">Guild Portal</div>
          <div className="mt-1 text-white/60 text-sm">เข้าสู่ระบบด้วย Discord เพื่อยืนยันสมาชิกในกิลด์</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6 shadow-xl">
          {errMeta && (
            <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3">
              <div className="font-semibold">{errMeta.title}</div>
              <div className="text-sm text-white/70">{errMeta.desc}</div>
            </div>
          )}

          <a href="/api/auth/discord/start" className="block">
            <button
              className={[
                "w-full h-12 rounded-2xl font-semibold",
                "bg-[#5865F2] hover:bg-[#4f5ae0] active:bg-[#4450cd]",
                "shadow-[0_0_30px_rgba(88,101,242,0.35)]",
                "transition-all flex items-center justify-center gap-3",
              ].join(" ")}
            >
              <span className="inline-flex items-center justify-center">
                {/* Discord-like glyph (simple) */}
                <svg width="22" height="22" viewBox="0 0 24 24" fill="white" aria-hidden="true">
                  <path d="M19.7 5.3A14.6 14.6 0 0 0 16.2 4c-.2.3-.4.7-.6 1a13.6 13.6 0 0 0-3.2-.4c-1.1 0-2.2.1-3.2.4-.2-.3-.4-.7-.6-1a14.6 14.6 0 0 0-3.5 1.3C2.7 8 2 10.6 2.3 13.1c1.6 1.2 3.1 1.9 4.6 2.2.4-.5.7-1 .9-1.5-.5-.2-1-.4-1.4-.7l.3-.2c2.7 1.2 5.6 1.2 8.3 0l.3.2c-.4.3-.9.5-1.4.7.2.5.6 1 1 1.5 1.5-.3 3-.9 4.6-2.2.3-2.5-.4-5.1-2.3-7.8ZM9.2 12.8c-.7 0-1.2-.6-1.2-1.3 0-.7.6-1.3 1.2-1.3.7 0 1.2.6 1.2 1.3 0 .7-.6 1.3-1.2 1.3Zm5.6 0c-.7 0-1.2-.6-1.2-1.3 0-.7.6-1.3 1.2-1.3.7 0 1.2.6 1.2 1.3 0 .7-.5 1.3-1.2 1.3Z" />
                </svg>
              </span>
              <span>Sign in with Discord</span>
            </button>
          </a>

          <div className="mt-4 text-xs text-white/50">
            หากเข้าระบบแล้วขึ้น <b>not_in_guild</b> ให้เช็คว่า Discord account นี้อยู่ใน Server และ Guild ID ถูกต้อง
          </div>
        </div>
      </div>
    </main>
  );
}
