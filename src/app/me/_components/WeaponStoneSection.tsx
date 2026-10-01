"use client";

import React, { useMemo, useState } from "react";
import { Gem } from "lucide-react";
import { Button } from "@/app/components/UI";
import { ProfileSection, SelectedTile } from "./ProfileSection";

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

const STONE_DOT: Record<StoneColor, string> = {
  red: "bg-red-500",
  purple: "bg-purple-500",
  gold: "bg-amber-400",
};

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

  const openPicker = () => { setQ(""); setColorPick({}); setModalOpen(true); };

  return (
    <div>
      <ProfileSection
        icon={<Gem className="h-4 w-4" />}
        title="หินสกิลอาวุธ"
        count={weaponSelected.length}
        editLabel={weaponSelected.length ? "เพิ่ม/แก้ไข" : "เพิ่มหินสกิลอาวุธ"}
        onEdit={openPicker}
        onClear={() => setAllStonesByType((prev) => ({ ...prev, 1: [] }))}
        disabled={disabled}
        loading={loading}
        emptyText="ยังไม่ได้เลือกหินสกิลอาวุธ"
      >
        {weaponSelected.map((s) => {
          const e = equipMap.get(s.equipment_create_id) ?? null;
          return (
            <SelectedTile
              key={s.equipment_create_id}
              imageUrl={e?.image_url}
              name={e ? e.name : `ID: ${s.equipment_create_id}`}
              meta={
                <span className="inline-flex items-center gap-1.5">
                  <span className={"h-2 w-2 rounded-full " + STONE_DOT[s.color]} />
                  สี{colorLabel(s.color)}
                </span>
              }
              onRemove={() =>
                setAllStonesByType((prev) => ({
                  ...prev,
                  1: prev[1].filter((x) => x.equipment_create_id !== s.equipment_create_id),
                }))
              }
              disabled={disabled}
            />
          );
        })}
      </ProfileSection>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xl">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 px-4 py-3">
              <div className="font-semibold text-zinc-900 dark:text-zinc-100">เพิ่มหินสกิลอาวุธ</div>
              <Button variant="outline" onClick={() => { setModalOpen(false); setQ(""); setColorPick({}); }}>
                ปิด
              </Button>
            </div>

            <div className="min-h-0 overflow-y-auto p-3 sm:p-4">
              <input
                value={q}
                onChange={(ev) => setQ(ev.target.value)}
                placeholder="ค้นหา..."
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-base sm:text-sm"
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
                        <div key={e.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
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

                          <div className="flex w-full items-center gap-2 sm:w-auto">
                            <select
                              value={picked}
                              onChange={(ev) =>
                                setColorPick((prev) => ({ ...prev, [e.id]: ev.target.value as StoneColor | "" }))
                              }
                              disabled={already}
                              className="min-w-0 flex-1 sm:flex-none rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2.5 sm:py-2 text-base sm:text-sm"
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
