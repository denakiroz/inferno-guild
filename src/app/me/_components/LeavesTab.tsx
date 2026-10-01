// app/me/_components/LeavesTab.tsx
"use client";

import React from "react";
import { CalendarDays, Trash2 } from "lucide-react";
import { Button, Card } from "@/app/components/UI";
import type { DbLeave } from "@/type/db";
import { canCancelLeave, isSaturday, prettyDate } from "@/app/me/_lib/bkkDate";
import { defineDict, useT, useLocale } from "@/i18n";

const dict = defineDict({
  title: { th: "การลาของฉัน", en: "My Leaves" },
  rule: {
    th: "ยกเลิกได้เฉพาะ “วันนี้” ก่อน 20:00 และ “อนาคต” เท่านั้น (ตามเวลาไทย)",
    en: "You can only cancel leaves for “today” before 20:00 and for “future” dates (Thailand time)",
  },
  error: { th: "Error:", en: "Error:" },
  empty: { th: "ยังไม่มีการลาในอนาคต", en: "No upcoming leaves" },
  saturdayWar: { th: "วันวอ (เสาร์)", en: "War day (Saturday)" },
  personalLeave: { th: "ลากิจ", en: "Personal leave" },
  warLeave2000: { th: "ลาวอ 20:00", en: "War leave 20:00" },
  warLeave2030: { th: "ลาวอ 20:30", en: "War leave 20:30" },
  warLeave: { th: "ลาวอ", en: "War leave" },
  reason: { th: "เหตุผล:", en: "Reason:" },
  cancelling: { th: "กำลังยกเลิก...", en: "Cancelling..." },
  cancel: { th: "ยกเลิก", en: "Cancel" },
  cannotCancel: { th: "ยกเลิกไม่ได้แล้ว", en: "Can no longer cancel" },
});

export function LeavesTab(props: {
  leaveErr: string | null;
  upcomingGrouped: Map<string, Array<{ leave: DbLeave; time: string }>>;
  canceling: number | null;
  onAskCancel: (payload: { id: number; date: string; time: string; label: string }) => void;
}) {
  const { leaveErr, upcomingGrouped, canceling, onAskCancel } = props;
  const t = useT(dict);
  const locale = useLocale();

  return (
    <Card>
      <div className="flex items-center gap-2">
        <CalendarDays className="w-5 h-5" />
        <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{t("title")}</div>
      </div>
      <div className="mt-1 text-xs text-zinc-500">
        {t("rule")}
      </div>

      {leaveErr ? <div className="mt-3 text-sm text-rose-600">{t("error")} {leaveErr}</div> : null}

      <div className="mt-4 space-y-3">
        {Array.from(upcomingGrouped.entries()).length === 0 ? (
          <div className="text-sm text-zinc-500">{t("empty")}</div>
        ) : (
          Array.from(upcomingGrouped.entries()).map(([date, items]) => {
            const saturday = isSaturday(date);

            return (
              <div
                key={date}
                className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-950/40 p-3 sm:p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-zinc-900 dark:text-zinc-100">{prettyDate(date, locale)}</div>
                    <div className="text-xs text-zinc-500">{saturday ? t("saturdayWar") : t("personalLeave")}</div>
                  </div>
                  <div className="shrink-0 text-xs text-zinc-500">{date}</div>
                </div>

                <div className="mt-3 space-y-2">
                  {items.map(({ leave, time }) => {
                    const label = saturday
                      ? time === "20:00"
                        ? t("warLeave2000")
                        : time === "20:30"
                        ? t("warLeave2030")
                        : t("warLeave")
                      : t("personalLeave");

                    const isCanceled = String(leave.status ?? "Active") === "Cancel";
                    const canCancel = canCancelLeave(date) && !isCanceled;

                    return (
                      <div
                        key={leave.id}
                        className="flex flex-col gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-950/50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{label}</div>
                          <div className="text-xs text-zinc-500 break-words sm:truncate">
                            {leave.reason ? `${t("reason")} ${leave.reason}` : `${t("reason")} -`}
                          </div>
                        </div>

                        <Button
                          variant="outline"
                          className="w-full sm:w-auto"
                          disabled={canceling === leave.id || !canCancel}
                          onClick={() => {
                            if (!canCancel) return;
                            onAskCancel({ id: leave.id as number, date, time, label });
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                          {canCancel ? (canceling === leave.id ? t("cancelling") : t("cancel")) : t("cannotCancel")}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
