"use client";

// ⚡ ชิ้นส่วน DayPicker + CSS ถูกแยกเป็น chunk ของตัวเอง
// เพื่อลดขนาด initial bundle ของ LeaveRequestButton (และทุกหน้าที่ใช้ component นี้)
import { DayPicker, type DayPickerProps } from "react-day-picker";
import "react-day-picker/dist/style.css";

export type { DateRange } from "react-day-picker";

export default function DayPickerLazy(props: DayPickerProps) {
  return <DayPicker {...props} />;
}
