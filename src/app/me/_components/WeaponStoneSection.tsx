"use client";

import React, { useMemo, useState } from "react";
import { Gem, X } from "lucide-react";
import { Button } from "@/app/components/UI";

/* ── exported types (used by page.tsx too) ── */
export type StoneColor = "red" | "purple" | "gold";
export type EquipmentType = 1 | 2 | 3;

export type EquipmentCreateRow = {
  id: number;
  name: string;
  image_url: string | null;
  type: EquipmentType;
};

export type SelectedStone = {
  equipment_create_id: number;
  color: StoneColor;
};

export type SelectedByType = Record<EquipmentType, SelectedStone[]>;

/* ── helpers ── */
const COLOR_OPTIONS: Array<{ value: StoneColor; label: string }> = [
  { value: "red",    label: "แดง" },
  { value: "purple", label: "ม่วง" },
  { value: "gold",   label: "ทอง" },
];

function colorLabel(c: StoneColor) {
  return COLOR_OPTIONS.find((o) => o.value === c)?.label ?? "-";
}

export function normalizeSelected(input: unknown): SelectedStone[] {
  const raw = Array.isArray(input) ? input : [];
  const list: SelectedStone[] = [];
  for (const r of raw) {
    const id    = Number((r as any)?.equipment_create_id);
    const color = String((r as any)?.color || "") as StoneColor;
    if (!Number.isFinite(id) || id <= 0) continue;
    if (color !== "red" && color !== "purple" && color !== "gold") continue;
    list.push({ equipment_create_id: id, color });
  }
  const seen = new Set<number>();
  const out: SelectedStone[] = [];
  for (const s of list) {
    if (seen.has(s.equipment_create_id)) continue;
    seen.add(s.equipment_create_id);
    out.push(s);
  }
  out.sort((a, b) => a.equipment_create_id - b.equipment_create_id);
  return out;
}

/* ── pure UI component — no fetch / no save button ── */
export function WeaponStoneSection({
  equipment,
  allStonesByType,
  setAllStonesByType,
  loading,
  disabled,
}: {
  equipment: EquipmentCreateRow[];
  allStonesByType: SelectedByType;
  setAllStonesByType: React.Dispatch<React.SetStateAction<SelectedByType>>;
  loading: boolean;
  disabled: boolean;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [q, setQ]                 = useState("");
  const [colorPick, setColorPick] = useState<Record<number, StoneColor | "">>({});

  const weaponSelected  = allStonesByType[1] ?? [];
  const weaponEquipment = useMemo(
    () => (equipment || []).filter((e) => e.type === 1).sort((a, b) => a.id - b.id),
    [equipment]
  );

  const modalList = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return weaponEquipment;
    return weaponEquipment.filter((x) => x.name.toLowerCase().includes(qq));
  }, [q, weaponEquipment]);

  const equipMap = useMemo(() => {
    const m = new Map<number, EquipmentCreateRow>();
    (equipment || []).forEach((e) => m.set(e.id, e));
    return m;
  }, [equipment]);

  return (
    <div className="mt-1">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Gem className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
          <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
            หินสกิลอาวุธ{" "}
            <span className="text-xs font-normal text-zinc-400">({weaponSelected.length})</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          {weaponSelected.length > 0 && (
            <Button
              variant="outline"
              onClick={() => setAllStonesByType((prev) => ({ ...prev, 1: [] }))}
              disabled={disabled}
            >
              <X className="w-3.5 h-3.5" />
              ล้าง
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => { setQ(""); setColorPick({}); setModalOpen(true); }}
            disabled={disabled}
          >
            เพิ่ม
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-zinc-400">กำลังโหลด...</div>
      ) : weaponSelected.length === 0 ? (
        <div className="text-sm text-zinc-400">ยังไม่ได้เลือกหินสกิลอาวุธ</div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {weaponSelected.map((s) => {
            const e = equipMap.get(s.equipment_create_id) ?? null;
            return (
              <div
                key={s.equipment_create_id}
                className="flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-2 py-2"
              >
                {e?.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={e.image_url}
                    alt={e.name}
                    className="w-9 h-9 rounded-lg object-cover border border-zinc-200 dark:border-zinc-800"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700" />
                )}
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 truncate max-w-[140px]">
                    {e ? e.name : `ID: ${s.equipment_create_id}`}
                  </div>
                  <div className="text-xs text-zinc-400">สี: {colorLabel(s.color)}</div>
                </div>
                <Button
                  variant="outline"
                  onClick={() =>
                    setAllStonesByType((prev) => ({
                      ...prev,
                      1: prev[1].filter((x) => x.equipment_create_id !== s.equipment_create_id),
                    }))
                  }
                  disabled={disabled}
                >
                  ลบ
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xl">
            <div className="flex items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 px-4 py-3">
              <div className="font-semibold text-zinc-900 dark:text-zinc-100">เพิ่มหินสกิลอาวุธ</div>
              <Button variant="outline" onClick={() => { setModalOpen(false); setQ(""); setColorPick({}); }}>
                ปิด
              </Button>
            </div>

            <div className="p-4">
              <input
                value={q}
                onChange={(ev) => setQ(ev.target.value)}
                placeholder="ค้นหา..."
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
              />

              <div className="mt-3 max-h-[50vh] overflow-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                {modalList.length === 0 ? (
                  <div className="p-4 text-sm text-zinc-500">ไม่พบรายการ</div>
                ) : (
                  <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {modalList.map((e) => {
                      const already = weaponSelected.some((s) => s.equipment_create_id === e.id);
                      const picked  = colorPick[e.id] ?? "";
                      return (
                        <div key={e.id} className="flex items-center justify-between gap-3 p-3">
                          <div className="flex items-center gap-3 min-w-0">
                            {e.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={e.image_url}
                                alt={e.name}
                                className="w-10 h-10 rounded-xl object-cover border border-zinc-200 dark:border-zinc-800"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800" />
                            )}
                            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                              {e.name}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <select
                              value={picked}
                              onChange={(ev) =>
                                setColorPick((prev) => ({ ...prev, [e.id]: ev.target.value as StoneColor | "" }))
                              }
                              disabled={already}
                              className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
                            >
                              <option value="">เลือกสี</option>
                              {COLOR_OPTIONS.map((c) => (
                                <option key={c.value} value={c.value}>{c.label}</option>
                              ))}
                            </select>
                            <Button
                              variant={already ? "outline" : undefined}
                              disabled={already || !picked}
                              onClick={() => {
                                setAllStonesByType((prev) => ({
                                  ...prev,
                                  1: normalizeSelected([
                                    ...(prev[1] || []),
                                    { equipment_create_id: e.id, color: picked as StoneColor },
                                  ]),
                                }));
                                setColorPick((prev) => ({ ...prev, [e.id]: "" }));
                              }}
                            >
                              {already ? "เลือกแล้ว" : "เพิ่ม"}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="mt-3 flex justify-end">
                <Button variant="outline" onClick={() => { setModalOpen(false); setQ(""); setColorPick({}); }}>
                  เสร็จสิ้น
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
