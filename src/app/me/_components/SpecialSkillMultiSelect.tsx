"use client";

import { useMemo, useState } from "react";
import { Button, Input, Modal } from "@/app/components/UI";
import type { SpecialSkillRow } from "../_lib/types";
import { Users } from "lucide-react";
import { ProfileSection, SelectedTile } from "./ProfileSection";
import { defineDict, useT } from "@/i18n";

const dict = defineDict({
  title: { th: "ศิษย์พี่", en: "Senior Disciples" },
  subtitle: { th: "สกิลพิเศษที่ขั้นเต็ม", en: "Special skills at max level" },
  edit: { th: "เลือก/แก้ไข", en: "Select/Edit" },
  pick: { th: "เลือก ศิษย์พี่", en: "Select Senior Disciples" },
  empty: { th: "ยังไม่ได้เลือก ศิษย์พี่", en: "No Senior Disciples selected" },
  modalTitle: { th: "เลือก ศิษย์พี่ (ที่ขั้นเต็ม)", en: "Select Senior Disciples (max level)" },
  search: { th: "ค้นหาชื่อ ศิษย์พี่...", en: "Search Senior Disciple name..." },
  selectedCount: { th: "เลือกแล้ว {n} รายการ", en: "{n} selected" },
  clear: { th: "ล้าง", en: "Clear" },
  none: { th: "ยังไม่ได้เลือก", en: "Nothing selected" },
  tapRemove: { th: "แตะเพื่อลบ", en: "Tap to remove" },
  notFound: { th: "ไม่พบรายการ", en: "No items found" },
  checked: { th: "เลือก", en: "Selected" },
  cancel: { th: "ยกเลิก", en: "Cancel" },
  confirm: { th: "ยืนยัน", en: "Confirm" },
});

export function SpecialSkillMultiSelect(props: {
  skills: SpecialSkillRow[];
  selectedIds: number[];
  onChange: (next: number[]) => void;
  disabled?: boolean;
}) {
  const { skills, selectedIds, onChange, disabled } = props;
  const t = useT(dict);

  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
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
    } else {
      next.add(id);
    }
    setDraft(Array.from(next).sort((a, b) => a - b));
  }

  function removeSelected(id: number) {
    onChange(selectedIds.filter((x) => x !== id));
  }

  return (
    <div className="mt-4">
      <ProfileSection
        icon={<Users className="h-4 w-4" />}
        title={t("title")}
        subtitle={t("subtitle")}
        count={selectedRows.length}
        editLabel={selectedRows.length ? t("edit") : t("pick")}
        onEdit={openPicker}
        onClear={() => onChange([])}
        disabled={disabled}
        emptyText={t("empty")}
      >
        {selectedRows.map((s) => (
          <SelectedTile
            key={s.id}
            imageUrl={s.special_skill_url}
            name={s.name}
            onRemove={() => removeSelected(s.id)}
            disabled={disabled}
          />
        ))}
      </ProfileSection>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("modalTitle")}
      >
        <div className="space-y-3">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("search")}
            disabled={disabled}
          />

          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 bg-white/60 dark:bg-zinc-950/40">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {t("selectedCount", { n: draft.length })}
              </div>
              <button
                type="button"
                onClick={() => setDraft([])}
                disabled={disabled}
                className="text-xs underline text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                {t("clear")}
              </button>
            </div>

            {draft.length === 0 ? (
              <div className="mt-2 text-sm text-zinc-500">{t("none")}</div>
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
                      title={t("tapRemove")}
                    >
                      {s.special_skill_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={s.special_skill_url}
                          alt=""
                          className="h-5 w-5 rounded-md border border-zinc-200 dark:border-zinc-800 object-cover"
                        />
                      ) : (
                        <span className="h-5 w-5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 inline-block" />
                      )}
                      <span className="truncate max-w-[40vw] sm:max-w-[160px]">{s.name}</span>
                      <span className="text-zinc-500">&times;</span>
                    </button>
                  ))}
              </div>
            )}
          </div>

          <div className="max-h-[50vh] sm:max-h-[420px] overflow-auto rounded-xl border border-zinc-200 dark:border-zinc-800 p-2 sm:p-3">
            {filtered.length === 0 ? (
              <div className="text-sm text-zinc-500">{t("notFound")}</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
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
                        {s.special_skill_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={s.special_skill_url}
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

                      {checked ? (
                        <div className="absolute top-2 right-2 rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 px-2 py-1 text-xs font-semibold shadow">
                          &checkmark; {t("checked")}
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setOpen(false)}
            >
              {t("cancel")}
            </Button>
            <Button
              className="flex-1"
              disabled={disabled}
              onClick={() => {
                onChange(draft);
                setOpen(false);
              }}
            >
              {t("confirm")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
