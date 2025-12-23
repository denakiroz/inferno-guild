// src/app/login/page.tsx
import { LoginInAppNotice } from "./LoginInAppNotice";
import { DiscordLoginButton } from "./DiscordLoginButton";

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

export default function LoginPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[]>;
}) {
  const error = getParam(searchParams?.error);
  const errMeta = error
    ? ERROR_TEXT[error] ?? { title: "เกิดปัญหา", desc: "กรุณาลองใหม่อีกครั้ง" }
    : null;

  return (
    <main className="min-h-screen bg-[#0b0d13] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <div className="text-sm tracking-[0.2em] text-white/60">INFERNO</div>
          <div className="text-3xl font-bold">Guild Portal</div>
          <div className="mt-1 text-white/60 text-sm">
            เข้าสู่ระบบด้วย Discord เพื่อยืนยันสมาชิกในกิลด์
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6 shadow-xl">
          {/* แจ้งเตือน in-app browser (LINE/FB/IG) */}
          <LoginInAppNotice />

          {errMeta && (
            <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3">
              <div className="font-semibold">{errMeta.title}</div>
              <div className="text-sm text-white/70">{errMeta.desc}</div>
            </div>
          )}

          {/* ปุ่มล็อกอิน: พยายามเด้งเข้า Discord App ก่อน แล้ว fallback ไป /api/auth/discord/start */}
          <DiscordLoginButton />

          <div className="mt-4 text-xs text-white/50">
            หากเข้าระบบแล้วขึ้น <b>not_in_guild</b> ให้เช็คว่า Discord account นี้อยู่ใน Server และ Guild ID ถูกต้อง
          </div>
        </div>
      </div>
    </main>
  );
}
