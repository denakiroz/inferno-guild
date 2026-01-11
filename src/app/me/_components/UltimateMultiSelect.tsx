"use client";

import { useMemo, useState } from "react";
import { Button, Input, Modal } from "@/app/components/UI";
import type { UltimateSkillRow } from "../_lib/types";

export function UltimateMultiSelect(props: {
  skills: UltimateSkillRow[];
  selectedIds: number[];
  onChange: (next: number[]) => void;
  disabled?: boolean;
  maxSelect?: number; // optional limit
}) {
  const { skills, selectedIds, onChange, disabled, maxSelect } = props;

  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  // working selection inside modal (so user can cancel)
  const [draft, setDraft] = useState<number[]>(selectedIds);

  const selectedSet = useMemo(() => new Set<number>(selectedIds), [selectedIds]);
  const draftSet = useMemo(() => new Set<number>(draft), [draft]);

  const selectedRows = useMemo(
    () => skills.filter((s) => selectedSet.has(s.id)),
    [skills, selectedSet]
  );

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const list = Array.isArray(skills) ? skills : [];
    if (!qq) return list;
    return list.filter((s) => String(s.name ?? "").toLowerCase().includes(qq));
  }, [skills, q]);

  function openPicker() {
    setDraft(selectedIds);
    setQ("");
    setOpen(true);
  }

  function toggleDraft(id: number) {
    const next = new Set<number>(draft);

    if (next.has(id)) {
      next.delete(id);
      setDraft(Array.from(next).sort((a, b) => a - b));
      return;
    }

    // optional max limit
    if (typeof maxSelect === "number" && maxSelect > 0 && next.size >= maxSelect) {
      // คุณจะทำ toast ก็ได้ แต่ตอนนี้ขอเงียบ ๆ
      return;
    }

    next.add(id);
    setDraft(Array.from(next).sort((a, b) => a - b));
  }

  function removeSelected(id: number) {
    onChange(selectedIds.filter((x) => x !== id));
  }

  function clearSelected() {
    onChange([]);
  }

  return (
    <div className="mt-4">
      <div className="text-xs text-zinc-500 mb-1">Ultimate Skill</div>

      {/* Selected preview (chips with image) */}
      {selectedRows.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-950/40 p-3 text-sm text-zinc-500">
          ยังไม่ได้เลือก Ultimate
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-950/40 p-3">
          <div className="flex flex-wrap gap-2">
            {selectedRows.map((s) => (
              <span
                key={s.id}
                className="inline-flex items-center gap-2 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/50 px-3 py-1 text-sm"
              >
                {s.ultimate_skill_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.ultimate_skill_url}
                    alt=""
                    className="h-6 w-6 rounded-md border border-zinc-200 dark:border-zinc-800 object-cover bg-white/70 dark:bg-zinc-950/50"
                  />
                ) : (
                  <span className="h-6 w-6 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900" />
                )}

                <span className="truncate max-w-[220px]">{s.name}</span>

                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => removeSelected(s.id)}
                  className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                  aria-label={`remove ${s.name}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <Button variant="outline" onClick={openPicker} disabled={disabled}>
              เลือก/แก้ไข Ultimate
            </Button>

            <button
              type="button"
              className="text-xs underline text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              onClick={clearSelected}
              disabled={disabled}
            >
              ล้างทั้งหมด
            </button>
          </div>
        </div>
      )}

      {selectedRows.length === 0 ? (
        <div className="mt-3">
          <Button variant="outline" onClick={openPicker} disabled={disabled}>
            เลือก Ultimate
          </Button>
        </div>
      ) : null}

      {/* Modal Picker */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="เลือก Ultimate Skill"
      >
        <div className="space-y-3">
          {/* Search */}
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหาชื่อ Ultimate..."
            disabled={disabled}
          />

          {/* Selected in modal */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 bg-white/60 dark:bg-zinc-950/40">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                เลือกแล้ว {draft.length} รายการ
                {typeof maxSelect === "number" && maxSelect > 0 ? ` (สูงสุด ${maxSelect})` : ""}
              </div>

              <button
                type="button"
                onClick={() => setDraft([])}
                disabled={disabled}
                className="text-xs underline text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                ล้าง
              </button>
            </div>

            {draft.length === 0 ? (
              <div className="mt-2 text-sm text-zinc-500">ยังไม่ได้เลือก</div>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {skills
                  .filter((s) => draftSet.has(s.id))
                  .map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleDraft(s.id)}
                      disabled={disabled}
                      className="inline-flex items-center gap-2 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/50 px-3 py-1 text-sm hover:bg-white dark:hover:bg-zinc-950"
                      title="แตะเพื่อลบ"
                    >
                      {s.ultimate_skill_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={s.ultimate_skill_url}
                          alt=""
                          className="h-5 w-5 rounded-md border border-zinc-200 dark:border-zinc-800 object-cover"
                        />
                      ) : (
                        <span className="h-5 w-5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900" />
                      )}
                      <span className="truncate max-w-[160px]">{s.name}</span>
                      <span className="text-zinc-500">×</span>
                    </button>
                  ))}
              </div>
            )}
          </div>

          {/* Grid list */}
          <div className="max-h-[420px] overflow-auto rounded-xl border border-zinc-200 dark:border-zinc-800 p-3">
            {filtered.length === 0 ? (
              <div className="text-sm text-zinc-500">ไม่พบรายการ</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {filtered.map((s) => {
                  const checked = draftSet.has(s.id);

                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleDraft(s.id)}
                      disabled={disabled}
                      className={
                        "relative rounded-2xl border p-2 text-left transition " +
                        (checked
                          ? "border-zinc-900 dark:border-zinc-100"
                          : "border-zinc-200 dark:border-zinc-800") +
                        " hover:bg-zinc-50 dark:hover:bg-zinc-950/30"
                      }
                    >
                      <div className="aspect-square w-full overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-950/40">
                        {s.ultimate_skill_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={s.ultimate_skill_url}
                            alt={s.name}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-xs text-zinc-500">
                            No Image
                          </div>
                        )}
                      </div>

                      <div className="mt-2">
                        <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-2">
                          {s.name}
                        </div>
                        <div className="text-xs text-zinc-500">#{s.id}</div>
                      </div>

                      {/* check overlay */}
                      {checked ? (
                        <div className="absolute top-2 right-2 rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 px-2 py-1 text-xs font-semibold shadow">
                          ✓ เลือก
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setOpen(false)}
            >
              ยกเลิก
            </Button>

            <Button
              className="flex-1"
              disabled={disabled}
              onClick={() => {
                onChange(draft);
                setOpen(false);
              }}
            >
              ยืนยัน
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
