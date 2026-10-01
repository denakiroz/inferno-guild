"use client";

import React from "react";
import { Plus, X } from "lucide-react";

/** กล่องหัวข้อ + รายการที่เลือก ใช้ร่วมกันใน ProfileTab */
export function ProfileSection(props: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  count: number;
  editLabel: string;
  onEdit: () => void;
  onClear: () => void;
  disabled?: boolean;
  loading?: boolean;
  emptyText: string;
  children?: React.ReactNode;
}) {
  const { icon, title, subtitle, count, editLabel, onEdit, onClear, disabled, loading, emptyText, children } = props;

  return (
    <section className="mt-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 ring-1 ring-red-500/20">
            {icon}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
              <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-semibold text-red-600 dark:text-red-400">
                {count}
              </span>
            </div>
            {subtitle && <div className="text-xs text-zinc-500">{subtitle}</div>}
          </div>
        </div>

        <div className="flex w-full items-center justify-end gap-1.5 sm:w-auto">
          {count > 0 && (
            <button
              type="button"
              onClick={onClear}
              disabled={disabled}
              className="rounded-lg px-3 py-2.5 sm:px-2.5 sm:py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 disabled:opacity-50"
            >
              ล้างทั้งหมด
            </button>
          )}
          <button
            type="button"
            onClick={onEdit}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-2.5 sm:px-3 sm:py-1.5 text-xs font-semibold text-white shadow-sm shadow-red-900/10 transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            {editLabel}
          </button>
        </div>
      </div>

      <div className="mt-3">
        {loading || count === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 px-4 py-5 text-center text-sm text-zinc-500">
            {loading ? "กำลังโหลด..." : emptyText}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{children}</div>
        )}
      </div>
    </section>
  );
}

/** ไทล์รายการที่เลือก: รูป + ชื่อ + ปุ่มลบ */
export function SelectedTile(props: {
  imageUrl?: string | null;
  name: string;
  meta?: React.ReactNode;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const { imageUrl, name, meta, onRemove, disabled } = props;

  return (
    <div className="group flex items-center gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2 pr-2.5 shadow-sm transition-colors hover:border-red-300 dark:hover:border-red-900">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          className="h-11 w-11 shrink-0 rounded-lg object-cover ring-1 ring-zinc-200 dark:ring-zinc-800"
        />
      ) : (
        <div className="h-11 w-11 shrink-0 rounded-lg bg-zinc-100 dark:bg-zinc-900 ring-1 ring-zinc-200 dark:ring-zinc-800" />
      )}

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{name}</div>
        {meta && <div className="text-xs text-zinc-500">{meta}</div>}
      </div>

      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label={`remove ${name}`}
        className="flex h-9 w-9 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-red-500/10 hover:text-red-600 disabled:opacity-50"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
