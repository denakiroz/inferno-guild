"use client";

// ⚡ ชิ้นส่วน DayPicker + CSS ถูกแยกเป็น chunk ของตัวเอง
// เพื่อลดขนาด initial bundle ของ LeaveRequestButton (และทุกหน้าที่ใช้ component นี้)
import { DayPicker, type DayPickerProps } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { th } from "date-fns/locale/th";
import { useLang } from "@/i18n";

export type { DateRange } from "react-day-picker";

export default function DayPickerLazy(props: DayPickerProps) {
  const { lang } = useLang();
  // ภาษาไทย: ชื่อเดือน/วันเป็นไทย, อังกฤษ: ใช้ค่าเริ่มต้นของ react-day-picker
  return <DayPicker locale={lang === "th" ? th : undefined} {...props} />;
}
