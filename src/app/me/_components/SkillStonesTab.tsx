"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Gem, X } from "lucide-react";
import { Button, Card } from "@/app/components/UI";
import { defineDict, useT } from "@/i18n";

const dict = defineDict({
  typeWeapon: { th: "อาวุธ", en: "Weapon" },
  typeArmor: { th: "เสื้อ", en: "Armor" },
  typeShoes: { th: "รองเท้า", en: "Shoes" },
  colorRed: { th: "แดง", en: "Red" },
  colorPurple: { th: "ม่วง", en: "Purple" },
  colorGold: { th: "ทอง", en: "Gold" },
  title: { th: "หินสกิล", en: "Skill stones" },
  saving: { th: "กำลังบันทึก...", en: "Saving..." },
  save: { th: "บันทึก", en: "Save" },
  error: { th: "Error:", en: "Error:" },
  loading: { th: "กำลังโหลด...", en: "Loading..." },
  clearAll: { th: "ล้างทั้งหมด", en: "Clear all" },
  add: { th: "เพิ่ม", en: "Add" },
  none: { th: "ยังไม่ได้เลือก", en: "Nothing selected" },
  colorLine: { th: "สี: {c}", en: "Color: {c}" },
  remove: { th: "ลบ", en: "Remove" },
  addTitle: { th: "เพิ่มหินสกิล: {type}", en: "Add skill stones: {type}" },
  close: { th: "ปิด", en: "Close" },
  searchPlaceholder: { th: "ค้นหา...", en: "Search..." },
  notFound: { th: "ไม่พบรายการ", en: "No items found" },
  pickColor: { th: "เลือกสี", en: "Pick color" },
  selected: { th: "เลือกแล้ว", en: "Selected" },
  done: { th: "เสร็จสิ้น", en: "Done" },
});

type DictKey = keyof typeof dict;

type EquipmentType = 1 | 2 | 3;

type StoneColor = "red" | "purple" | "gold";

type EquipmentCreateRow = {
  id: number;
  name: string;
  image_url: string | null;
  type: EquipmentType;
};

type SelectedStone = {
  equipment_create_id: number;
  color: StoneColor;
};

type SelectedByType = Record<EquipmentType, SelectedStone[]>;

type SkillStonesRes =
  | {
      ok: true;
      equipment: EquipmentCreateRow[];
      selected_by_type: SelectedByType;
    }
  | { ok: false; error?: string };

const TYPE_KEYS: Record<EquipmentType, DictKey> = {
  1: "typeWeapon",
  2: "typeArmor",
  3: "typeShoes",
};

const COLOR_KEYS: Record<StoneColor, DictKey> = {
  red: "colorRed",
  purple: "colorPurple",
  gold: "colorGold",
};

const COLOR_OPTIONS: Array<{ value: StoneColor; labelKey: DictKey }> = [
  { value: "red", labelKey: "colorRed" },
  { value: "purple", labelKey: "colorPurple" },
  { value: "gold", labelKey: "colorGold" },
];

const EMPTY_SELECTED: SelectedByType = { 1: [], 2: [], 3: [] };

function normalizeSelected(input: unknown): SelectedStone[] {
  const raw = Array.isArray(input) ? input : [];
  const list: SelectedStone[] = [];
  for (const r of raw) {
    const id = Number((r as any)?.equipment_create_id);
    const color = String((r as any)?.color || "") as StoneColor;
    if (!Number.isFinite(id) || id <= 0) continue;
    if (color !== "red" && color !== "purple" && color !== "gold") continue;
    list.push({ equipment_create_id: id, color });
  }
  // dedupe by equipment_create_id (keep first)
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

export function SkillStonesTab() {
  const tr = useT(dict);
  const typeLabel = (ty: EquipmentType) => (TYPE_KEYS[ty] ? tr(TYPE_KEYS[ty]) : "-");
  const colorLabel = (c: StoneColor) => (COLOR_KEYS[c] ? tr(COLOR_KEYS[c]) : "-");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [equipment, setEquipment] = useState<EquipmentCreateRow[]>([]);
  const [selectedByType, setSelectedByType] = useState<SelectedByType>({ ...EMPTY_SELECTED });

  // picker modal
  const [openType, setOpenType] = useState<EquipmentType | null>(null);
  const [q, setQ] = useState("");

  // ✅ สีที่เลือก “ต่อแต่ละรายการ” ใน modal (ต้องเลือกก่อนกดเพิ่ม)
  const [colorPick, setColorPick] = useState<Record<number, StoneColor | "">>({});

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/member/me/skill-stones", { cache: "no-store" });
      const data = (await res.json()) as SkillStonesRes;
      if (!res.ok || !data.ok) throw new Error((data as any)?.error || "Failed to load");

      setEquipment(data.equipment || []);
      const sbt = (data as any).selected_by_type || {};

      setSelectedByType({
        1: normalizeSelected(sbt[1]),
        2: normalizeSelected(sbt[2]),
        3: normalizeSelected(sbt[3]),
      });
    } catch (e: any) {
      setErr(e?.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function onSave() {
    setSaving(true);
    setErr(null);
    try {
      const payload: SelectedByType = {
        1: normalizeSelected(selectedByType[1]),
        2: normalizeSelected(selectedByType[2]),
        3: normalizeSelected(selectedByType[3]),
      };

      const res = await fetch("/api/member/me/skill-stones", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ selected_by_type: payload }),
      });

      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data?.error || "Save failed");

      await load();
    } catch (e: any) {
      setErr(e?.message || "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const equipmentByType = useMemo(() => {
    const map = new Map<EquipmentType, EquipmentCreateRow[]>();
    (equipment || []).forEach((e) => {
      const arr = map.get(e.type) || [];
      arr.push(e);
      map.set(e.type, arr);
    });
    (Array.from(map.keys()) as EquipmentType[]).forEach((t) => {
      const arr = map.get(t) || [];
      arr.sort((a, b) => a.id - b.id);
      map.set(t, arr);
    });
    return map;
  }, [equipment]);

  const modalList = useMemo(() => {
    if (!openType) return [];
    const list = equipmentByType.get(openType) || [];
    const qq = q.trim().toLowerCase();
    if (!qq) return list;
    return list.filter((x) => String(x.name || "").toLowerCase().includes(qq));
  }, [openType, q, equipmentByType]);

  const selectedMap = useMemo(() => {
    const m = new Map<number, EquipmentCreateRow>();
    (equipment || []).forEach((e) => m.set(e.id, e));
    return m;
  }, [equipment]);

  function openModal(t: EquipmentType) {
    setQ("");
    setOpenType(t);
    setColorPick({});
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Gem className="w-5 h-5" />
          <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{tr("title")}</div>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={() => void onSave()} disabled={loading || saving}>
            {saving ? tr("saving") : tr("save")}
          </Button>
        </div>
      </div>


      {err ? <div className="mt-3 text-sm text-rose-600">{tr("error")} {err}</div> : null}

      {loading ? (
        <div className="mt-4 text-sm text-zinc-500">{tr("loading")}</div>
      ) : (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {([1, 2, 3] as EquipmentType[]).map((t) => {
            const selected = selectedByType[t] || [];

            return (
              <div
                key={t}
                className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-950/40 p-3 sm:p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {typeLabel(t)}{" "}
                    <span className="text-xs text-zinc-500 font-normal">({selected.length})</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {selected.length > 0 ? (
                      <Button
                        variant="outline"
                        onClick={() => setSelectedByType((prev) => ({ ...prev, [t]: [] }))}
                        disabled={saving}
                      >
                        <X className="w-4 h-4" />
                        {tr("clearAll")}
                      </Button>
                    ) : null}

                    <Button variant="outline" onClick={() => openModal(t)} disabled={saving}>
                      {tr("add")}
                    </Button>
                  </div>
                </div>

                {selected.length === 0 ? (
                  <div className="mt-3 text-sm text-zinc-500">{tr("none")}</div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selected.map((s) => {
                      const e = selectedMap.get(s.equipment_create_id) || null;
                      return (
                        <div
                          key={`${s.equipment_create_id}:${s.color}`}
                          className="flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/50 px-2 py-2"
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
                            <div className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800" />
                          )}

                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate max-w-[40vw] sm:max-w-[160px]">
                              {e ? e.name : `ID: ${s.equipment_create_id}`}
                            </div>
                            <div className="text-xs text-zinc-500">
                               {tr("colorLine", { c: colorLabel(s.color) })}
                            </div>
                          </div>

                          <Button
                            variant="outline"
                            onClick={() => {
                              setSelectedByType((prev) => ({
                                ...prev,
                                [t]: prev[t].filter((x) => x.equipment_create_id !== s.equipment_create_id),
                              }));
                            }}
                            disabled={saving}
                          >
                            {tr("remove")}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {openType ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xl">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 px-4 py-3">
              <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                {tr("addTitle", { type: typeLabel(openType) })}
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setOpenType(null);
                  setQ("");
                  setColorPick({});
                }}
              >
                {tr("close")}
              </Button>
            </div>

            <div className="min-h-0 overflow-y-auto p-3 sm:p-4">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={tr("searchPlaceholder")}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-base sm:text-sm"
              />

              <div className="mt-3 max-h-[55vh] overflow-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                {modalList.length === 0 ? (
                  <div className="p-4 text-sm text-zinc-500">{tr("notFound")}</div>
                ) : (
                  <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {modalList.map((e) => {
                      const already = (selectedByType[openType] || []).some(
                        (s) => s.equipment_create_id === e.id
                      );

                      const picked = colorPick[e.id] ?? "";

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

                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                                {e.name}
                              </div>
                            </div>
                          </div>

                          <div className="flex w-full items-center gap-2 sm:w-auto">
                            {/* ✅ ต้องเลือกสีถึงจะเพิ่มได้ */}
                            <select
                              value={picked}
                              onChange={(ev) => {
                                const v = ev.target.value as StoneColor | "";
                                setColorPick((prev) => ({ ...prev, [e.id]: v }));
                              }}
                              className="min-w-0 flex-1 sm:flex-none rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2.5 sm:py-2 text-base sm:text-sm"
                              disabled={already}
                            >
                              <option value="">{tr("pickColor")}</option>
                              {COLOR_OPTIONS.map((c) => (
                                <option key={c.value} value={c.value}>
                                  {tr(c.labelKey)}
                                </option>
                              ))}
                            </select>

                            <Button
                              variant={already ? "outline" : undefined}
                              disabled={already || !picked}
                              onClick={() => {
                                const color = picked as StoneColor;
                                setSelectedByType((prev) => ({
                                  ...prev,
                                  [openType]: normalizeSelected([
                                    ...(prev[openType] || []),
                                    { equipment_create_id: e.id, color },
                                  ]),
                                }));
                                // reset pick color for this id after added
                                setColorPick((prev) => ({ ...prev, [e.id]: "" }));
                              }}
                            >
                              {already ? tr("selected") : tr("add")}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="mt-3 flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setOpenType(null);
                    setQ("");
                    setColorPick({});
                  }}
                >
                  {tr("done")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
