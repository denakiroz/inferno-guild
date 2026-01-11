// app/me/_lib/bkkDate.ts
export const BKK_TZ = "Asia/Bangkok";

const bkkDateFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: BKK_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function bkkDateOf(date: Date) {
  return bkkDateFmt.format(date); // YYYY-MM-DD
}

const bkkDateTimeFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: BKK_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function bkkDateTimeParts(dt: string) {
  const parts = bkkDateTimeFmt.formatToParts(new Date(dt));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  const time = `${get("hour")}:${get("minute")}`;
  return { date, time };
}

// HH:MM (Bangkok)
const bkkTimeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: BKK_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function bkkNowHHMM() {
  return bkkTimeFmt.format(new Date()); // "20:05"
}

export function isSaturday(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00+07:00`);
  return d.getDay() === 6;
}

export function prettyDate(dateStr: string) {
  const dt = new Date(`${dateStr}T00:00:00+07:00`);
  return dt.toLocaleDateString("th-TH", {
    timeZone: BKK_TZ,
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// rule: อดีตห้าม, อนาคตได้, วันนี้ได้ก่อน 20:00
export function canCancelLeave(dateYYYYMMDD: string) {
  const today = bkkDateOf(new Date());
  if (dateYYYYMMDD < today) return false;
  if (dateYYYYMMDD > today) return true;
  return bkkNowHHMM() < "20:00";
}
