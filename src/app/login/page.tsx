import { LoginCardClient } from "./LoginCardClient";

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
          <div className="mb-4 flex justify-center">
            <img
              src="https://i.ibb.co/sdLkHBWK/IMG-3235.png"
              alt="Inferno"
              loading="eager"
              className="w-48 sm:w-56 h-auto mx-auto"
            />
          </div>

          <div className="text-sm tracking-[0.2em] text-white/60">INFERNO</div>
          <div className="text-3xl font-bold">Guild Portal</div>
          <div className="mt-1 text-white/60 text-sm">
            เข้าสู่ระบบด้วย Discord เพื่อยืนยันสมาชิกในกิลด์
          </div>
        </div>

        <LoginCardClient errTitle={errMeta?.title} errDesc={errMeta?.desc} />
      </div>
    </main>
  );
}
