// src/app/components/LeaveRequestButton.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { CalendarDays, X } from "lucide-react";
import { DayPicker, DateRange } from "react-day-picker";
import "react-day-picker/dist/style.css";

import type { DbLeave } from "@/type/db";
import { Button, Input, Modal, Select } from "@/app/components/UI";

const BKK_OFFSET = "+07:00";
const BKK_TZ = "Asia/Bangkok";

export type LeaveCreateRow = {
  date_time: string;
  reason: string | null;
};

type Props = {
  memberName: string;
  existingLeaves: DbLeave[];
  onCreate: (rows: LeaveCreateRow[]) => Promise<void>;
  onAfterSave?: () => Promise<void> | void;

  /** ซ่อนปุ่ม/ฟังก์ชันลา (เช่น ศิษย์เอก) */
  hidden?: boolean;
  /** ปิดการใช้งานปุ่ม */
  disabled?: boolean;

  /** ปรับข้อความปุ่ม */
  buttonLabel?: string;

  /** className ให้ปุ่ม */
  className?: string;

  /** (optional) admin bypass rules อื่น ๆ (ถ้ามีในโปรเจคคุณ) */
  isAdmin?: boolean;
};

/** yyyy-mm-dd + hh:mm -> ISO string with +07:00 */
function toBkkIso(dateStr: string, hhmm: string) {
  return `${dateStr}T${hhmm}:00${BKK_OFFSET}`;
}

function isSaturday(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00${BKK_OFFSET}`);
  return d.getDay() === 6; // Sat
}

function rangeDatesInclusive(start: string, end: string) {
  const out: string[] = [];
  if (!start || !end) return out;

  const s = new Date(`${start}T00:00:00${BKK_OFFSET}`);
  const e = new Date(`${end}T00:00:00${BKK_OFFSET}`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return out;

  const dir = s <= e ? 1 : -1;
  const cur = new Date(s);

  for (;;) {
    const yyyy = cur.getFullYear();
    const mm = String(cur.getMonth() + 1).padStart(2, "0");
    const dd = String(cur.getDate()).padStart(2, "0");
    out.push(`${yyyy}-${mm}-${dd}`);

    if (cur.toDateString() === e.toDateString()) break;
    cur.setDate(cur.getDate() + dir);
  }
  return out;
}

/** format Date -> yyyy-mm-dd in Bangkok timezone */
const bkkDateFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: BKK_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
function bkkDateOf(date: Date) {
  return bkkDateFmt.format(date); // en-CA => YYYY-MM-DD
}

/** parse dt string -> {date,time} in Bangkok timezone */
const bkkDateTimeFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: BKK_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
function bkkDateTimeParts(dt: string) {
  const parts = bkkDateTimeFmt.formatToParts(new Date(dt));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  const time = `${get("hour")}:${get("minute")}`;
  return { date, time };
}

type LeaveIndex = {
  byDate: Map<string, { hasErrand: boolean; has20: boolean; has2030: boolean }>;
  keySet: Set<string>; // `${date}#${time}` where weekday uses 00:00
};

// ✅ helper: treat Cancel as "not existing"
function isCancelledLeave(l: any) {
  const s = String(l?.status ?? "").trim().toLowerCase();
  return s === "cancel";
}

function buildExistingLeaveIndex(existingLeaves: DbLeave[]): LeaveIndex {
  const byDate = new Map<string, { hasErrand: boolean; has20: boolean; has2030: boolean }>();
  const keySet = new Set<string>();

  for (const l of existingLeaves) {
    // ✅ สำคัญ: ถ้า status = Cancel ให้ข้าม (ถือว่าเลือกได้)
    if (isCancelledLeave(l as any)) continue;

    const dt = String((l as any).date_time ?? "");
    if (!dt) continue;

    const { date, time } = bkkDateTimeParts(dt);
    if (!date || !time) continue;

    // normalize weekday leaves to 00:00 key (ระบบเก็บแบบนี้)
    const normalizedTime = isSaturday(date) ? time : "00:00";
    keySet.add(`${date}#${normalizedTime}`);

    const cur = byDate.get(date) ?? { hasErrand: false, has20: false, has2030: false };

    if (isSaturday(date)) {
      if (time === "20:00") cur.has20 = true;
      if (time === "20:30") cur.has2030 = true;
    } else {
      cur.hasErrand = true;
    }

    byDate.set(date, cur);
  }

  return { byDate, keySet };
}

export default function LeaveRequestButton({
  memberName,
  existingLeaves,
  onCreate,
  onAfterSave,
  hidden = false,
  disabled = false,
  buttonLabel = "แจ้งลา",
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const [leaveReason, setLeaveReason] = useState<string>("");

  // เสาร์เลือก 20:00 / 20:30 / both (ทั้งสองรอบ)
  const [satRoundByDate, setSatRoundByDate] = useState<Record<string, "select" | "20:00" | "20:30" | "both">>({});
  const [satErrors, setSatErrors] = useState<Record<string, boolean>>({});

  const existingLeaveIndex = useMemo(() => buildExistingLeaveIndex(existingLeaves), [existingLeaves]);

  // derived range -> strings
  const leaveStart = useMemo(() => (range?.from ? bkkDateOf(range.from) : ""), [range?.from]);
  const leaveEnd = useMemo(() => (range?.to ? bkkDateOf(range.to) : ""), [range?.to]);

  const saturdayDates = useMemo(() => {
    const dates = rangeDatesInclusive(leaveStart, leaveEnd);
    return dates.filter((d) => isSaturday(d));
  }, [leaveStart, leaveEnd]);

  // ensure default selection exists for each saturday in range
  useEffect(() => {
    if (!saturdayDates.length) return;

    setSatRoundByDate((prev) => {
      const next = { ...prev };

      for (const d of saturdayDates) {
        if (next[d]) continue;

        const info = existingLeaveIndex.byDate.get(d);
        const has20 = !!info?.has20;
        const has2030 = !!info?.has2030;

        // ✅ ให้เริ่มต้นเป็น "select" เสมอ (ถ้ายังมีรอบให้เลือก)
        if (has20 && has2030) {
          // กรณีนี้จะถูก disable อยู่แล้ว จะใส่อะไรก็ได้
          next[d] = "20:00";
        } else {
          next[d] = "select";
        }
      }

      return next;
    });
  }, [saturdayDates, existingLeaveIndex.byDate]);

  // ✅ disable “วันย้อนหลัง” ในปฏิทินเสมอ (ตามที่คุยล่าสุด: ทำแค่ disable วันย้อนหลัง + วันนี้ 20:00)
  // หมายเหตุ: ถ้าคุณไม่ต้องการกฎเวลา 20:00 ใน component นี้ ให้ลบเงื่อนไข time ได้
  const disabledMatcher = useMemo(() => {
    const byDate = existingLeaveIndex.byDate;

    return (date: Date) => {
      const d = bkkDateOf(date);

      // 1) disable วันย้อนหลังเสมอ
      const today = bkkDateOf(new Date());
      if (d < today) return true;

      const info = byDate.get(d);
      if (!info) return false;

      if (isSaturday(d)) {
        // เสาร์ disable เฉพาะกรณีลาไว้ครบ 2 รอบแล้ว
        return info.has20 && info.has2030;
      }
      // วันธรรมดา disable ถ้ามีลากิจแล้ว
      return info.hasErrand;
    };
  }, [existingLeaveIndex.byDate]);

  const onOpen = () => {
    setRange(undefined);
    setLeaveReason("");
    setSatRoundByDate({});
    setSatErrors({});
    setOpen(true);
  };

  const save = async () => {
    if (!leaveStart || !leaveEnd) return;

    const dates = rangeDatesInclusive(leaveStart, leaveEnd);
    if (!dates.length) return;

    // ✅ validate: เสาร์ทุกวันต้องเลือก round ก่อน (เลือก "select" ไม่ได้)
    const nextErr: Record<string, boolean> = {};
    for (const d of dates) {
      if (!isSaturday(d)) continue;

      const info = existingLeaveIndex.byDate.get(d);
      if (info?.has20 && info?.has2030) continue; // ลาครบแล้ว ไม่ต้อง validate

      const choice = satRoundByDate[d] ?? "select";
      if (choice === "select") nextErr[d] = true;
    }

    if (Object.keys(nextErr).length > 0) {
      setSatErrors(nextErr);
      return; // ❌ ไม่บันทึก
    }
    setSatErrors({});

    const reason = leaveReason.trim() ? leaveReason.trim() : null;

    const rows: LeaveCreateRow[] = [];
    const existing = existingLeaveIndex.keySet;

    for (const d of dates) {
      if (isSaturday(d)) {
        const info = existingLeaveIndex.byDate.get(d);
        if (info?.has20 && info?.has2030) continue;

        const choice = (satRoundByDate[d] ?? "select") as "select" | "20:00" | "20:30" | "both";
        if (choice === "select") continue; // กันพลาด (ควรไม่เกิด)

        const times: Array<"20:00" | "20:30"> = choice === "both" ? ["20:00", "20:30"] : [choice];

        for (const t of times) {
          const key = `${d}#${t}`;
          if (existing.has(key)) continue;
          rows.push({ date_time: toBkkIso(d, t), reason });
        }
      } else {
        const key = `${d}#00:00`;
        if (existing.has(key)) continue;
        rows.push({ date_time: toBkkIso(d, "00:00"), reason });
      }
    }

    if (!rows.length) {
      setOpen(false);
      return;
    }

    setSaving(true);
    try {
      await onCreate(rows);
      setOpen(false);
      await onAfterSave?.();
    } finally {
      setSaving(false);
    }
  };

  if (hidden) return null;

  return (
    <>
      <Button variant="outline" className={className} onClick={onOpen} disabled={disabled}>
        <CalendarDays className="w-4 h-4" />
        {buttonLabel}
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="แจ้งลาวอ">
        <div className="space-y-3">
          <div className="text-sm text-zinc-600 dark:text-zinc-300">
            สมาชิก: <span className="font-semibold">{memberName}</span>
          </div>

          {/* Calendar */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3">
            <div className="text-xs text-zinc-500 mb-2">เลือกช่วงวันที่ (วันที่ลาแล้วจะเลือกไม่ได้)</div>

            <DayPicker
              mode="range"
              selected={range}
              onSelect={setRange}
              disabled={disabledMatcher}
              showOutsideDays
              weekStartsOn={0}
              className="rdp"
            />

            <div className="mt-2 text-xs text-zinc-500">
              ช่วงที่เลือก:{" "}
              <span className="font-semibold text-zinc-700 dark:text-zinc-200">
                {leaveStart || "-"} ถึง {leaveEnd || "-"}
              </span>
            </div>
          </div>

          {/* reason */}
          <Input
            placeholder="เหตุผล (เช่น ลาวอ / ลากิจ / ลาป่วย)"
            value={leaveReason}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLeaveReason(e.target.value)}
          />

          {/* Saturday rounds */}
          {saturdayDates.length > 0 ? (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 space-y-2">
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">เลือกรอบสำหรับวันเสาร์</div>
              <div className="text-xs text-zinc-500">วันเสาร์มี 2 รอบ: 20:00 และ 20:30</div>

              <div className="space-y-2">
                {saturdayDates.map((d) => {
                  const info = existingLeaveIndex.byDate.get(d);
                  const has20 = !!info?.has20;
                  const has2030 = !!info?.has2030;

                  const disable20 = has20;
                  const disable2030 = has2030;
                  const disableBoth = has20 || has2030; // ถ้ามีรอบใดรอบหนึ่งแล้ว ให้ disable "ทั้งสองรอบ"
                  const disableSelect = has20 && has2030;

                  return (
                    <div key={d} className="flex items-center gap-2">
                      <div className="text-sm w-28">{d}</div>

                      <Select
                        value={satRoundByDate[d] ?? "select"}
                        disabled={disableSelect}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                          const v = e.target.value as any;
                          setSatRoundByDate((prev) => ({ ...prev, [d]: v }));

                          // ล้าง error ของวันนั้นเมื่อเลือกแล้ว
                          setSatErrors((prev) => {
                            if (!prev[d]) return prev;
                            const next = { ...prev };
                            delete next[d];
                            return next;
                          });
                        }}
                        className={[satErrors[d] ? "border-rose-500 focus:ring-rose-500/40 focus:border-rose-500" : ""].join(
                          " "
                        )}
                      >
                        <option value="select" disabled>
                          เลือกรอบ...
                        </option>

                        <option value="20:00" disabled={disable20}>
                          รอบ 20:00{disable20 ? " (ลาแล้ว)" : ""}
                        </option>
                        <option value="20:30" disabled={disable2030}>
                          รอบ 20:30{disable2030 ? " (ลาแล้ว)" : ""}
                        </option>
                        <option value="both" disabled={disableBoth}>
                          ทั้งสองรอบ{disableBoth ? " (เลือกไม่ได้)" : ""}
                        </option>
                      </Select>

                      {disableSelect ? <span className="text-xs text-zinc-500">วันเสาร์นี้ลาไว้ครบแล้ว</span> : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setOpen(false)} disabled={saving}>
              <X className="w-4 h-4" />
              ยกเลิก
            </Button>
            <Button className="flex-1" onClick={save} disabled={saving || !leaveStart || !leaveEnd}>
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
