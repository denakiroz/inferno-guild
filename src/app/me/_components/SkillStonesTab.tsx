"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Gem, X } from "lucide-react";
import { Button, Card } from "@/app/components/UI";

type EquipmentType = 1 | 2 | 3 | 4;

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

function typeLabel(t: EquipmentType) {
  switch (t) {
    case 1:
      return "อาวุธ";
    case 2:
      return "เสื้อ";
    case 3:
      return "รองเท้า";
    case 4:
      return "สร้อย";
    default:
      return "-";
  }
}

function colorLabel(c: StoneColor) {
  switch (c) {
    case "red":
      return "แดง";
    case "purple":
      return "ม่วง";
    case "gold":
      return "ทอง";
    default:
      return "-";
  }
}

const COLOR_OPTIONS: Array<{ value: StoneColor; label: string }> = [
  { value: "red", label: "แดง" },
  { value: "purple", label: "ม่วง" },
  { value: "gold", label: "ทอง" },
];

const EMPTY_SELECTED: SelectedByType = { 1: [], 2: [], 3: [], 4: [] };

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
        4: normalizeSelected(sbt[4]),
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
        4: normalizeSelected(selectedByType[4]),
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
          <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">หินสกิล</div>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={() => void onSave()} disabled={loading || saving}>
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </Button>
        </div>
      </div>


      {err ? <div className="mt-3 text-sm text-rose-600">Error: {err}</div> : null}

      {loading ? (
        <div className="mt-4 text-sm text-zinc-500">กำลังโหลด...</div>
      ) : (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {([1, 2, 3, 4] as EquipmentType[]).map((t) => {
            const selected = selectedByType[t] || [];

            return (
              <div
                key={t}
                className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-950/40 p-4"
              >
                <div className="flex items-center justify-between gap-2">
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
                        ล้างทั้งหมด
                      </Button>
                    ) : null}

                    <Button variant="outline" onClick={() => openModal(t)} disabled={saving}>
                      เพิ่ม
                    </Button>
                  </div>
                </div>

                {selected.length === 0 ? (
                  <div className="mt-3 text-sm text-zinc-500">ยังไม่ได้เลือก</div>
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
                            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate max-w-[160px]">
                              {e ? e.name : `ID: ${s.equipment_create_id}`}
                            </div>
                            <div className="text-xs text-zinc-500">
                               สี: {colorLabel(s.color)}
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
                            ลบ
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xl">
            <div className="flex items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 px-4 py-3">
              <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                เพิ่มหินสกิล: {typeLabel(openType)}
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setOpenType(null);
                  setQ("");
                  setColorPick({});
                }}
              >
                ปิด
              </Button>
            </div>

            <div className="p-4">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ค้นหา..."
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
              />

              <div className="mt-3 max-h-[55vh] overflow-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                {modalList.length === 0 ? (
                  <div className="p-4 text-sm text-zinc-500">ไม่พบรายการ</div>
                ) : (
                  <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {modalList.map((e) => {
                      const already = (selectedByType[openType] || []).some(
                        (s) => s.equipment_create_id === e.id
                      );

                      const picked = colorPick[e.id] ?? "";

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

                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                                {e.name}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* ✅ ต้องเลือกสีถึงจะเพิ่มได้ */}
                            <select
                              value={picked}
                              onChange={(ev) => {
                                const v = ev.target.value as StoneColor | "";
                                setColorPick((prev) => ({ ...prev, [e.id]: v }));
                              }}
                              className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
                              disabled={already}
                            >
                              <option value="">เลือกสี</option>
                              {COLOR_OPTIONS.map((c) => (
                                <option key={c.value} value={c.value}>
                                  {c.label}
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
                <Button
                  variant="outline"
                  onClick={() => {
                    setOpenType(null);
                    setQ("");
                    setColorPick({});
                  }}
                >
                  เสร็จสิ้น
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
