// app/me/_components/LeavesTab.tsx
"use client";

import React from "react";
import { CalendarDays, Trash2 } from "lucide-react";
import { Button, Card } from "@/app/components/UI";
import type { DbLeave } from "@/type/db";
import { canCancelLeave, isSaturday, prettyDate } from "@/app/me/_lib/bkkDate";

export function LeavesTab(props: {
  leaveErr: string | null;
  upcomingGrouped: Map<string, Array<{ leave: DbLeave; time: string }>>;
  canceling: number | null;
  onAskCancel: (payload: { id: number; date: string; time: string; label: string }) => void;
}) {
  const { leaveErr, upcomingGrouped, canceling, onAskCancel } = props;

  return (
    <Card>
      <div className="flex items-center gap-2">
        <CalendarDays className="w-5 h-5" />
        <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">การลาของฉัน</div>
      </div>
      <div className="mt-1 text-xs text-zinc-500">
        ยกเลิกได้เฉพาะ “วันนี้” ก่อน 20:00 และ “อนาคต” เท่านั้น (ตามเวลาไทย)
      </div>

      {leaveErr ? <div className="mt-3 text-sm text-rose-600">Error: {leaveErr}</div> : null}

      <div className="mt-4 space-y-3">
        {Array.from(upcomingGrouped.entries()).length === 0 ? (
          <div className="text-sm text-zinc-500">ยังไม่มีการลาในอนาคต</div>
        ) : (
          Array.from(upcomingGrouped.entries()).map(([date, items]) => {
            const saturday = isSaturday(date);

            return (
              <div
                key={date}
                className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-950/40 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-zinc-900 dark:text-zinc-100">{prettyDate(date)}</div>
                    <div className="text-xs text-zinc-500">{saturday ? "วันวอ (เสาร์)" : "ลากิจ"}</div>
                  </div>
                  <div className="text-xs text-zinc-500">{date}</div>
                </div>

                <div className="mt-3 space-y-2">
                  {items.map(({ leave, time }) => {
                    const label = saturday
                      ? time === "20:00"
                        ? "ลาวอ 20:00"
                        : time === "20:30"
                        ? "ลาวอ 20:30"
                        : "ลาวอ"
                      : "ลากิจ";

                    const isCanceled = String(leave.status ?? "Active") === "Cancel";
                    const canCancel = canCancelLeave(date) && !isCanceled;

                    return (
                      <div
                        key={leave.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-950/50 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{label}</div>
                          <div className="text-xs text-zinc-500 truncate">
                            {leave.reason ? `เหตุผล: ${leave.reason}` : "เหตุผล: -"}
                          </div>
                        </div>

                        <Button
                          variant="outline"
                          disabled={canceling === leave.id || !canCancel}
                          onClick={() => {
                            if (!canCancel) return;
                            onAskCancel({ id: leave.id as number, date, time, label });
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                          {canCancel ? (canceling === leave.id ? "กำลังยกเลิก..." : "ยกเลิก") : "ยกเลิกไม่ได้แล้ว"}
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
