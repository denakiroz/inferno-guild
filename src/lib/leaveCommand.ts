import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * ลางานผ่านคำสั่ง Discord (/leave) — กติกาเดียวกับ LeaveRequestButton + /api/leave/me
 * - วันเสาร์มี 2 รอบ (20:00 / 20:30): เลือกรอบได้ (ไม่ระบุ = ทั้ง 2 รอบ)
 * - วันอื่น = ลากิจ เก็บเวลา 00:00
 * - ห้ามลาวันที่ผ่านมาแล้ว (ตามวันที่เวลาไทย)
 */

const BKK_TZ = "Asia/Bangkok";
const BKK_OFFSET = "+07:00";

const bkkDateFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: BKK_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const bkkTimeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: BKK_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export type LeaveRound = "20:00" | "20:30" | "both";

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/** day-of-week จาก "YYYY-MM-DD" (คำนวณผ่าน UTC) */
function dowOf(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return ymd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

function isRealDate(y: number, m: number, d: number) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function todayBkk(): string {
  return bkkDateFmt.format(new Date());
}

/** เสาร์ที่จะถึง (ถ้าวันนี้เป็นเสาร์และยังไม่เลย 20:30 = วันนี้) */
export function upcomingSaturday(): string {
  const today = todayBkk();
  const nowHHMM = bkkTimeFmt.format(new Date());
  const dow = dowOf(today);
  let add = (6 - dow + 7) % 7;
  if (add === 0 && nowHHMM >= "20:30") add = 7;
  return addDays(today, add);
}

/**
 * รับ YYYY-MM-DD, DD/MM, DD/MM/YYYY (ปี พ.ศ. ก็ได้) -> "YYYY-MM-DD" | null
 * ไม่ระบุปี = ปีนี้ (ถ้าวันนั้นผ่านไปแล้วในปีนี้ ให้ใช้ปีหน้า)
 */
export function parseLeaveDate(input: string): string | null {
  const s = input.trim();
  if (!s) return null;

  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  let y: number, mo: number, d: number;
  if (m) {
    y = Number(m[1]);
    mo = Number(m[2]);
    d = Number(m[3]);
  } else {
    m = s.match(/^(\d{1,2})[/.\-](\d{1,2})(?:[/.\-](\d{2,4}))?$/);
    if (!m) return null;
    d = Number(m[1]);
    mo = Number(m[2]);
    const today = todayBkk();
    const thisYear = Number(today.slice(0, 4));
    if (m[3]) {
      y = Number(m[3]);
      if (y < 100) y += 2000;
    } else {
      y = thisYear;
    }
    if (y > 2400) y -= 543; // พ.ศ.
    if (!m[3] && isRealDate(y, mo, d) && ymd(y, mo, d) < today) y += 1;
  }

  if (y > 2400) y -= 543;
  if (!isRealDate(y, mo, d)) return null;
  return ymd(y, mo, d);
}

export type CreateLeaveResult =
  | { ok: true; date: string; saturday: boolean; times: string[]; created: number }
  | { ok: false; error: "member_not_found" | "invalid_date" | "past_date" | "too_far" | "db_error"; message?: string };

export async function createLeaveFromCommand(args: {
  discordUserId: string;
  dateInput?: string | null;
  round?: LeaveRound | null;
  reason?: string | null;
}): Promise<CreateLeaveResult> {
  const date = args.dateInput?.trim() ? parseLeaveDate(args.dateInput) : upcomingSaturday();
  if (!date) return { ok: false, error: "invalid_date" };

  const today = todayBkk();
  if (date < today) return { ok: false, error: "past_date" };
  if (date > addDays(today, 180)) return { ok: false, error: "too_far" };

  const { data: member, error: memErr } = await supabaseAdmin
    .from("member")
    .select("id")
    .eq("discord_user_id", args.discordUserId)
    .maybeSingle();
  if (memErr) return { ok: false, error: "db_error", message: memErr.message };
  if (!member?.id) return { ok: false, error: "member_not_found" };

  const saturday = dowOf(date) === 6;
  const round: LeaveRound = args.round ?? "both";
  const times: string[] = saturday ? (round === "both" ? ["20:00", "20:30"] : [round]) : ["00:00"];

  const reason = args.reason?.trim() ? args.reason.trim().slice(0, 200) : null;
  const nowIso = new Date().toISOString();

  // upsert (member_id,date_time): ลาซ้ำไม่ชน unique และชุบรายการที่เคย Cancel กลับเป็น Active
  const rows = times.map((t) => ({
    member_id: Number(member.id),
    date_time: `${date}T${t}:00${BKK_OFFSET}`,
    reason,
    status: "Active",
    update_date: nowIso,
  }));

  const { error } = await supabaseAdmin.from("leave").upsert(rows, { onConflict: "member_id,date_time" });
  if (error) return { ok: false, error: "db_error", message: error.message };

  return { ok: true, date, saturday, times, created: rows.length };
}

// ---------------------------------------------------------------------------
// Autocomplete ของช่อง date ใน /leave (Discord ไม่มี placeholder -> ใช้ตัวเลือกแนะนำแทน)
// ---------------------------------------------------------------------------

function thaiLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  const text = new Intl.DateTimeFormat("th-TH", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "short",
  }).format(dt);
  return `${text} (${dateStr})`;
}

export function leaveDateSuggestions(query: string): Array<{ name: string; value: string }> {
  const q = query.trim();
  const today = todayBkk();

  const out: Array<{ name: string; value: string }> = [];
  const seen = new Set<string>();
  const push = (date: string, prefix = "") => {
    if (seen.has(date) || out.length >= 25) return;
    seen.add(date);
    out.push({ name: `${prefix}${thaiLabel(date)}`.slice(0, 100), value: date });
  };

  // พิมพ์เองและอ่านออก -> แสดงเป็นตัวเลือกแรกให้ยืนยัน
  const typed = q ? parseLeaveDate(q) : null;
  if (typed && typed >= today) push(typed, "✍️ ");

  // เสาร์ที่จะถึง 8 สัปดาห์ (วันวอ) แล้วค่อยวันนี้/พรุ่งนี้ (ลากิจ)
  const firstSat = upcomingSaturday();
  for (let i = 0; i < 8; i++) push(addDays(firstSat, i * 7), i === 0 ? "⭐ " : "");
  push(today, "ลากิจ • ");
  push(addDays(today, 1), "ลากิจ • ");

  if (!q || typed) return out;

  // กรองตามที่พิมพ์ (ข้อความหรือตัวเลข)
  const lc = q.toLowerCase();
  return out.filter((c) => c.name.toLowerCase().includes(lc) || c.value.includes(lc));
}
