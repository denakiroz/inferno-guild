"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Trash2, Plus, Save } from "lucide-react";
import { Button, Card } from "@/app/components/UI";
import type { EquipmentSetRow, ElementKey, ElementLevels } from "../_lib/internalPowerTypes";
import { defaultLevels, sumLevels, validateLevels } from "../_lib/internalPowerTypes";

const ELEMENTS: Array<{ key: ElementKey; label: string }> = [
  { key: "gold", label: "ทอง" },
  { key: "wood", label: "ไม้" },
  { key: "water", label: "น้ำ" },
  { key: "fire", label: "ไฟ" },
  { key: "earth", label: "ดิน" },
];

type DraftSet = EquipmentSetRow & {
  pendingFile?: File | null;
  pendingPreviewUrl?: string | null;
  saving?: boolean;
  err?: string | null;
};

function createEmptyDraft(): DraftSet {
  return {
    id: null,
    element: { ...defaultLevels },
    image: null,
    created_at: null,
    pendingFile: null,
    pendingPreviewUrl: null,
    saving: false,
    err: null,
  };
}

async function uploadToBucket(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch("/api/member/me/equipment/upload", {
    method: "POST",
    body: fd,
  });

  const j = await res.json().catch(() => null);
  if (!j?.ok) throw new Error(j?.error ?? "upload_failed");
  if (!j.url) throw new Error("upload_failed");

  return String(j.url);
}

export function InternalPowerTab() {
  const [loading, setLoading] = useState(true);
  const [sets, setSets] = useState<DraftSet[]>([]);
  const [globalErr, setGlobalErr] = useState<string | null>(null);

  async function load() {
    setGlobalErr(null);
    setLoading(true);
    try {
      const r = await fetch("/api/member/me/equipment", { cache: "no-store" });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error ?? "load_failed");

      const rows: EquipmentSetRow[] = Array.isArray(j.sets) ? j.sets : [];
      setSets(
        rows.map((x) => ({
          ...x,
          pendingFile: null,
          pendingPreviewUrl: null,
          saving: false,
          err: null,
        }))
      );
    } catch (e: any) {
      setGlobalErr(String(e.message ?? e));
      setSets([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function addSet() {
    if (sets.length >= 2) return;
    setSets((prev) => [...prev, createEmptyDraft()]);
  }

  function removeDraftAt(i: number) {
    setSets((prev) => {
      const copy = [...prev];
      const it = copy[i];
      if (it?.pendingPreviewUrl) URL.revokeObjectURL(it.pendingPreviewUrl);
      copy.splice(i, 1);
      return copy;
    });
  }

  async function deleteSet(id: number) {
    setGlobalErr(null);
    try {
      const res = await fetch("/api/member/me/equipment", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? "delete_failed");
      await load();
    } catch (e: any) {
      setGlobalErr(String(e.message ?? e));
    }
  }

  async function saveSet(i: number) {
    setSets((prev) => prev.map((x, idx) => (idx === i ? { ...x, saving: true, err: null } : x)));

    try {
      const current = sets[i];
      if (!current) return;

      const v = validateLevels(current.element);
      if (!v.ok) throw new Error(v.error);

      let imageUrl = current.image ?? null;
      if (current.pendingFile) {
        imageUrl = await uploadToBucket(current.pendingFile);
      }

      const payload = {
        id: current.id,
        element: current.element,
        image: imageUrl,
      };

      const method = current.id ? "PUT" : "POST";

      const res = await fetch("/api/member/me/equipment", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? "save_failed");

      await load();
    } catch (e: any) {
      setSets((prev) =>
        prev.map((x, idx) =>
          idx === i ? { ...x, err: String(e.message ?? e) } : x
        )
      );
    } finally {
      setSets((prev) => prev.map((x, idx) => (idx === i ? { ...x, saving: false } : x)));
    }
  }

  function setElementLevel(i: number, key: ElementKey, level: number) {
    setSets((prev) =>
      prev.map((s, idx) => {
        if (idx !== i) return s;
        return { ...s, element: { ...s.element, [key]: level } };
      })
    );
  }

  function onPickFile(i: number, file: File | null) {
    setSets((prev) =>
      prev.map((s, idx) => {
        if (idx !== i) return s;

        if (s.pendingPreviewUrl) URL.revokeObjectURL(s.pendingPreviewUrl);

        const nextPreview = file ? URL.createObjectURL(file) : null;
        return { ...s, pendingFile: file, pendingPreviewUrl: nextPreview };
      })
    );
  }

  const canAdd = sets.length < 2;

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">กำลังภายใน</div>
          <div className="mt-1 text-xs text-zinc-500">
            เพิ่มได้สูงสุด 2 เซ็ต • แต่ละเซ็ตเลือกธาตุ (0–3 ขั้น) รวมกันต้องไม่เกิน 7 ขั้น • อัปโหลดรูปได้ 1 รูปต่อเซ็ต
          </div>
        </div>

        <Button variant="outline" onClick={addSet} disabled={!canAdd || loading}>
          <Plus className="w-4 h-4" />
          เพิ่มเซ็ต
        </Button>
      </div>

      {globalErr ? <div className="mt-3 text-sm text-rose-600">Error: {globalErr}</div> : null}

      {loading ? (
        <div className="mt-4 text-sm text-zinc-500">Loading...</div>
      ) : sets.length === 0 ? (
        <div className="mt-4 text-sm text-zinc-500">ยังไม่มีเซ็ตกำลังภายใน</div>
      ) : (
        <div className="mt-4 space-y-4">
          {sets.map((s, idx) => {
            const total = sumLevels(s.element);
            const over = total > 7;

            const preview = s.pendingPreviewUrl || s.image || null;

            return (
              <div
                key={String(s.id ?? `draft-${idx}`)}
                className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-950/40 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold text-zinc-900 dark:text-zinc-100">เซ็ต {idx + 1}</div>

                  <div className="flex items-center gap-2">
                    {s.id ? (
                      <Button
                        variant="outline"
                        onClick={() => deleteSet(s.id as number)}
                        disabled={s.saving}
                      >
                        <Trash2 className="w-4 h-4 text-rose-600" />
                        ลบ
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={() => removeDraftAt(idx)}
                        disabled={s.saving}
                      >
                        <Trash2 className="w-4 h-4 text-rose-600" />
                        ลบ
                      </Button>
                    )}
                  </div>
                </div>

                {/* Image */}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-4">
                  <div>
                    <div className="text-xs text-zinc-500 mb-1">รูป (1 รูป)</div>
                    <div className="h-40 w-40 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/50">
                      {preview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={preview} alt="equipment" className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-xs text-zinc-500">
                          No Image
                        </div>
                      )}
                    </div>

                    <input
                      type="file"
                      accept="image/*"
                      className="mt-2 block w-full text-xs text-zinc-500"
                      onChange={(e) => onPickFile(idx, e.target.files?.[0] ?? null)}
                      disabled={s.saving}
                    />
                  </div>

                  {/* Elements */}
                  <div className="min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-zinc-500">ธาตุ</div>
                      <div className={`text-xs ${over ? "text-rose-600" : "text-zinc-500"}`}>
                        รวมขั้น: <span className="font-semibold">{total}</span>/7
                      </div>
                    </div>

                    <div className="mt-2 space-y-3">
                      {ELEMENTS.map((el) => {
                        const val = Number(s.element?.[el.key] ?? 0);

                        return (
                          <div key={el.key} className="flex items-center justify-between gap-3">
                            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 w-24">
                              {el.label}
                            </div>

                            <div className="flex items-center gap-2">
                              {[0, 1, 2, 3].map((lvl) => {
                                const active = lvl === val;
                                return (
                                  <button
                                    key={lvl}
                                    type="button"
                                    onClick={() => setElementLevel(idx, el.key, lvl)}
                                    disabled={s.saving}
                                    className={
                                      "px-3 py-1 text-sm rounded-xl border transition " +
                                      (active
                                        ? "border-zinc-900 dark:border-zinc-100 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                                        : "border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/50 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-950/30")
                                    }
                                    aria-pressed={active}
                                  >
                                    {lvl === 0 ? "-" : `${lvl}`}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {over ? (
                      <div className="mt-3 text-sm text-rose-600">
                        รวมขั้นเกิน 7 ขั้น กรุณาลดระดับธาตุในเซ็ตนี้
                      </div>
                    ) : null}

                    {s.err ? <div className="mt-3 text-sm text-rose-600">Error: {s.err}</div> : null}

                    <div className="mt-4 flex items-center justify-end">
                      <Button onClick={() => saveSet(idx)} disabled={s.saving || over}>
                        <Save className="w-4 h-4" />
                        {s.saving ? "กำลังบันทึก..." : "บันทึกเซ็ต"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
