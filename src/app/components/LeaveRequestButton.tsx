// src/app/components/LeaveRequestButton.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { CalendarDays, X } from "lucide-react";
import type { DateRange } from "react-day-picker";

import type { DbLeave } from "@/type/db";
import { Button, Input, Modal, Select } from "@/app/components/UI";
import { defineDict, useT } from "@/i18n";

const dict = defineDict({
  loadingCalendar: { th: "กำลังโหลดปฏิทิน…", en: "Loading calendar…" },
  button: { th: "แจ้งลา", en: "Request leave" },
  modalTitle: { th: "แจ้งลาวอ", en: "Request war leave" },
  member: { th: "สมาชิก:", en: "Member:" },
  pickRange: {
    th: "เลือกช่วงวันที่ (วันที่ลาแล้วจะเลือกไม่ได้)",
    en: "Select a date range (dates already on leave cannot be selected)",
  },
  selectedRange: { th: "ช่วงที่เลือก:", en: "Selected range:" },
  to: { th: "ถึง", en: "to" },
  reasonPlaceholder: {
    th: "เหตุผล (เช่น ลาวอ / ลากิจ / ลาป่วย)",
    en: "Reason (e.g. war leave / personal / sick)",
  },
  satTitle: { th: "เลือกรอบสำหรับวันเสาร์", en: "Choose rounds for Saturday" },
  satHint: { th: "วันเสาร์มี 2 รอบ: 20:00 และ 20:30", en: "Saturday has 2 rounds: 20:00 and 20:30" },
  pickRound: { th: "เลือกรอบ...", en: "Select round..." },
  round2000: { th: "รอบ 20:00", en: "Round 20:00" },
  round2030: { th: "รอบ 20:30", en: "Round 20:30" },
  alreadyLeave: { th: " (ลาแล้ว)", en: " (already on leave)" },
  both: { th: "ทั้งสองรอบ", en: "Both rounds" },
  notSelectable: { th: " (เลือกไม่ได้)", en: " (unavailable)" },
  satFull: { th: "วันเสาร์นี้ลาไว้ครบแล้ว", en: "This Saturday is fully booked" },
  cancel: { th: "ยกเลิก", en: "Cancel" },
  saving: { th: "กำลังบันทึก...", en: "Saving..." },
  save: { th: "บันทึก", en: "Save" },
});

function LoadingCalendar() {
  const t = useT(dict);
  return (
    <div className="py-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
      {t("loadingCalendar")}
    </div>
  );
}

// ⚡ react-day-picker + CSS ของมันค่อนข้างใหญ่ — lazy-load เฉพาะตอนเปิด modal แจ้งลา
const DayPicker = dynamic(() => import("@/app/components/DayPickerLazy"), {
  ssr: false,
  loading: () => <LoadingCalendar />,
});

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

  hidden?: boolean;
  disabled?: boolean;
  buttonLabel?: string;
  className?: string;
  isAdmin?: boolean;
};

function toBkkIso(dateStr: string, hhmm: string) {
  return `${dateStr}T${hhmm}:00${BKK_OFFSET}`;
}

/**
 * แปลง Date จาก DayPicker → "YYYY-MM-DD" ตามปฏิทินที่ user เห็น (ไม่ shift TZ)
 * เพราะ DayPicker ส่ง Date ที่เป็น "local midnight ของวันที่ user คลิก"
 * ถ้าเอาไปแปลงผ่าน TZ (เช่น bkkDateOf) จะเลื่อนวันสำหรับ user คนละ TZ กับ BKK
 */
function dateOnlyYmd(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** day-of-week จาก "YYYY-MM-DD" แบบ TZ-stable (คำนวณผ่าน UTC) */
function isSaturday(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return false;
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 6;
}

/** ไล่วันแบบ string-only (UTC arithmetic) — ไม่พึ่ง local TZ ของ browser */
function rangeDatesInclusive(start: string, end: string) {
  const out: string[] = [];
  if (!start || !end) return out;

  const parse = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    if (!y || !m || !d) return null;
    return new Date(Date.UTC(y, m - 1, d));
  };
  const s = parse(start);
  const e = parse(end);
  if (!s || !e) return out;

  const dir = s.getTime() <= e.getTime() ? 1 : -1;
  const cur = new Date(s);

  for (;;) {
    const yyyy = cur.getUTCFullYear();
    const mm = String(cur.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(cur.getUTCDate()).padStart(2, "0");
    out.push(`${yyyy}-${mm}-${dd}`);

    if (cur.getTime() === e.getTime()) break;
    cur.setUTCDate(cur.getUTCDate() + dir);
  }
  return out;
}

const bkkDateFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: BKK_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
/** "วันนี้ตามเวลาไทย" (BKK) — ใช้สำหรับ disable past เท่านั้น เพราะระบบใช้ deadline BKK */
function bkkDateOf(date: Date) {
  return bkkDateFmt.format(date);
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
function bkkDateTimeParts(dt: string) {
  const parts = bkkDateTimeFmt.formatToParts(new Date(dt));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  const time = `${get("hour")}:${get("minute")}`;
  return { date, time };
}

type LeaveIndex = {
  byDate: Map<string, { hasErrand: boolean; has20: boolean; has2030: boolean }>;
  keySet: Set<string>;
};

function isCancelledLeave(l: any) {
  const s = String(l?.status ?? "").trim().toLowerCase();
  return s === "cancel";
}

function buildExistingLeaveIndex(existingLeaves: DbLeave[]): LeaveIndex {
  const byDate = new Map<string, { hasErrand: boolean; has20: boolean; has2030: boolean }>();
  const keySet = new Set<string>();

  for (const l of existingLeaves) {
    if (isCancelledLeave(l as any)) continue;

    const dt = String((l as any).date_time ?? "");
    if (!dt) continue;

    const { date, time } = bkkDateTimeParts(dt);
    if (!date || !time) continue;

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
  buttonLabel,
  className,
}: Props) {
  const t = useT(dict);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const [leaveReason, setLeaveReason] = useState<string>("");

  const [satRoundByDate, setSatRoundByDate] = useState<
    Record<string, "select" | "20:00" | "20:30" | "both">
  >({});
  const [satErrors, setSatErrors] = useState<Record<string, boolean>>({});

  const existingLeaveIndex = useMemo(
    () => buildExistingLeaveIndex(existingLeaves),
    [existingLeaves]
  );

  // ใช้ dateOnlyYmd: เลขที่ user คลิกบนปฏิทิน = เลขที่บันทึก (ไม่ shift TZ)
  const leaveStart = useMemo(() => (range?.from ? dateOnlyYmd(range.from) : ""), [range?.from]);
  const leaveEnd = useMemo(() => (range?.to ? dateOnlyYmd(range.to) : ""), [range?.to]);

  const saturdayDates = useMemo(() => {
    const dates = rangeDatesInclusive(leaveStart, leaveEnd);
    return dates.filter((d) => isSaturday(d));
  }, [leaveStart, leaveEnd]);

  useEffect(() => {
    if (!saturdayDates.length) return;

    setSatRoundByDate((prev) => {
      const next = { ...prev };

      for (const d of saturdayDates) {
        if (next[d]) continue;

        const info = existingLeaveIndex.byDate.get(d);
        const has20 = !!info?.has20;
        const has2030 = !!info?.has2030;

        if (has20 && has2030) {
          next[d] = "20:00";
        } else {
          next[d] = "select";
        }
      }

      return next;
    });
  }, [saturdayDates, existingLeaveIndex.byDate]);

  const disabledMatcher = useMemo(() => {
    const byDate = existingLeaveIndex.byDate;

    return (date: Date) => {
      // ใช้เลขที่ user เห็นบนปฏิทินตรง ๆ (ไม่ shift TZ)
      const d = dateOnlyYmd(date);

      // "วันนี้" ใช้ BKK เพราะ deadline ของระบบอิง BKK 20:00
      const today = bkkDateOf(new Date());
      if (d < today) return true;

      const info = byDate.get(d);
      if (!info) return false;

      if (isSaturday(d)) {
        return info.has20 && info.has2030;
      }
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

    const nextErr: Record<string, boolean> = {};
    for (const d of dates) {
      if (!isSaturday(d)) continue;

      const info = existingLeaveIndex.byDate.get(d);
      if (info?.has20 && info?.has2030) continue;

      const choice = satRoundByDate[d] ?? "select";
      if (choice === "select") nextErr[d] = true;
    }

    if (Object.keys(nextErr).length > 0) {
      setSatErrors(nextErr);
      return;
    }
    setSatErrors({});

    const reason = leaveReason.trim() ? leaveReason.trim() : null;

    const rows: LeaveCreateRow[] = [];
    const existing = existingLeaveIndex.keySet;

    for (const d of dates) {
      if (isSaturday(d)) {
        const info = existingLeaveIndex.byDate.get(d);
        if (info?.has20 && info?.has2030) continue;

        const choice = (satRoundByDate[d] ?? "select") as
          | "select"
          | "20:00"
          | "20:30"
          | "both";
        if (choice === "select") continue;

        const times: Array<"20:00" | "20:30"> =
          choice === "both" ? ["20:00", "20:30"] : [choice];

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
        {buttonLabel ?? t("button")}
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title={t("modalTitle")}>
        <div className="space-y-3">
          <div className="text-sm text-zinc-600 dark:text-zinc-300">
            {t("member")} <span className="font-semibold">{memberName}</span>
          </div>

          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3">
            <div className="text-xs text-zinc-500 mb-2">{t("pickRange")}</div>

            <div className="flex justify-center overflow-x-auto">
              <DayPicker
                mode="range"
                selected={range}
                onSelect={setRange}
                disabled={disabledMatcher}
                showOutsideDays
                weekStartsOn={0}
                className="rdp"
              />
            </div>

            <div className="mt-2 text-xs text-zinc-500">
              {t("selectedRange")}{" "}
              <span className="font-semibold text-zinc-700 dark:text-zinc-200">
                {leaveStart || "-"} {t("to")} {leaveEnd || "-"}
              </span>
            </div>
          </div>

          <Input
            placeholder={t("reasonPlaceholder")}
            value={leaveReason}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLeaveReason(e.target.value)}
          />

          {saturdayDates.length > 0 ? (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 space-y-2">
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {t("satTitle")}
              </div>
              <div className="text-xs text-zinc-500">{t("satHint")}</div>

              <div className="space-y-2">
                {saturdayDates.map((d) => {
                  const info = existingLeaveIndex.byDate.get(d);
                  const has20 = !!info?.has20;
                  const has2030 = !!info?.has2030;

                  const disable20 = has20;
                  const disable2030 = has2030;
                  const disableBoth = has20 || has2030;
                  const disableSelect = has20 && has2030;

                  return (
                    <div key={d} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                      <div className="text-sm w-full sm:w-28">{d}</div>

                      <Select
                        value={satRoundByDate[d] ?? "select"}
                        disabled={disableSelect}
                        invalid={!!satErrors[d]} // ✅ FIX: ให้ Select แดงผ่าน invalid prop
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                          const v = e.target.value as any;
                          setSatRoundByDate((prev) => ({ ...prev, [d]: v }));

                          setSatErrors((prev) => {
                            if (!prev[d]) return prev;
                            const next = { ...prev };
                            delete next[d];
                            return next;
                          });
                        }}
                      >
                        <option value="select" disabled>
                          {t("pickRound")}
                        </option>

                        <option value="20:00" disabled={disable20}>
                          {t("round2000")}{disable20 ? t("alreadyLeave") : ""}
                        </option>
                        <option value="20:30" disabled={disable2030}>
                          {t("round2030")}{disable2030 ? t("alreadyLeave") : ""}
                        </option>
                        <option value="both" disabled={disableBoth}>
                          {t("both")}{disableBoth ? t("notSelectable") : ""}
                        </option>
                      </Select>

                      {disableSelect ? (
                        <span className="text-xs text-zinc-500">{t("satFull")}</span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row">
            <Button variant="secondary" className="flex-1" onClick={() => setOpen(false)} disabled={saving}>
              <X className="w-4 h-4" />
              {t("cancel")}
            </Button>
            <Button className="flex-1" onClick={save} disabled={saving || !leaveStart || !leaveEnd}>
              {saving ? t("saving") : t("save")}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
