// app/admin/master/skill-stones/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button, Card, Input, Modal } from "@/app/components/UI";

type EquipmentType = 1 | 2 | 3 | 4;

type SkillStoneRow = {
  id: number;
  name: string;
  image_url: string | null;
  type: EquipmentType;
};

type ApiRes =
  | { ok: true; skill_stones: SkillStoneRow[] }
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

function parseType(v: string): EquipmentType {
  const n = Number(v);
  if (n === 1 || n === 2 || n === 3 || n === 4) return n;
  return 1;
}

export default function AdminMasterSkillStonesPage() {
  const [rows, setRows] = useState<SkillStoneRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // create form
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [type, setType] = useState<EquipmentType>(1);
  const [creating, setCreating] = useState(false);

  // list filter
  const [filterType, setFilterType] = useState<EquipmentType | "all">("all");
  const [q, setQ] = useState("");

  // edit modal
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<SkillStoneRow | null>(null);
  const [saving, setSaving] = useState(false);

  const canSubmitCreate = useMemo(() => {
    return name.trim().length > 0 && !creating;
  }, [name, creating]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch("/api/admin/skill-stones", { cache: "no-store" });
      const j = (await r.json()) as ApiRes;
      if (!j.ok) throw new Error(j.error ?? "load_failed");
      const list = (j.skill_stones ?? []).slice().sort((a, b) => a.id - b.id);
      setRows(list);
    } catch (e: any) {
      setErr(String(e.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createRow() {
    setCreating(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/skill-stones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          image_url: imageUrl.trim() || null,
          type,
        }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? "create_failed");
      setName("");
      setImageUrl("");
      setType(1);
      await load();
    } catch (e: any) {
      setErr(String(e.message ?? e));
    } finally {
      setCreating(false);
    }
  }

  async function saveEdit() {
    if (!edit) return;
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/skill-stones", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: edit.id,
          name: String(edit.name ?? "").trim(),
          image_url: String(edit.image_url ?? "").trim() || null,
          type: edit.type,
        }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? "update_failed");
      setOpen(false);
      setEdit(null);
      await load();
    } catch (e: any) {
      setErr(String(e.message ?? e));
    } finally {
      setSaving(false);
    }
  }

  async function deleteRow(id: number) {
    setErr(null);
    try {
      const res = await fetch(`/api/admin/skill-stones?id=${id}`, { method: "DELETE" });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? "delete_failed");
      await load();
    } catch (e: any) {
      setErr(String(e.message ?? e));
    }
  }

  const filteredRows = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return (rows || []).filter((r) => {
      if (filterType !== "all" && r.type !== filterType) return false;
      if (!qq) return true;
      return (
        String(r.name || "").toLowerCase().includes(qq) ||
        String(r.id).includes(qq) ||
        String(r.image_url || "").toLowerCase().includes(qq)
      );
    });
  }, [rows, filterType, q]);

  return (
    <div className="mx-auto w-full max-w-4xl px-3 sm:px-4 md:px-0 py-2">
      <div className="space-y-6">
        <Card>
          <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Master Data • Skill Stones
          </div>
          <div className="mt-1 text-sm text-zinc-500">
            เพิ่ม/แก้ไขหินสกิล (equipment_create) สำหรับใช้งานในหน้า /me
          </div>

          {err ? <div className="mt-3 text-sm text-rose-600">Error: {err}</div> : null}

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-zinc-500 mb-1">Name</div>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น หินสกิล X" />
            </div>

            <div>
              <div className="text-xs text-zinc-500 mb-1">Image URL</div>
              <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
            </div>

            <div>
              <div className="text-xs text-zinc-500 mb-1">Type</div>
              <select
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
                value={String(type)}
                onChange={(e) => setType(parseType(e.target.value))}
              >
                <option value="1">1 • อาวุธ</option>
                <option value="2">2 • เสื้อ</option>
                <option value="3">3 • รองเท้า</option>
                <option value="4">4 • สร้อย</option>
              </select>
            </div>

            <div className="md:col-span-2">
              {imageUrl.trim() ? (
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3">
                  <div className="text-xs text-zinc-500 mb-2">Preview</div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl.trim()}
                    alt=""
                    className="h-16 w-16 rounded-xl border border-zinc-200 dark:border-zinc-800 object-cover bg-white/60 dark:bg-zinc-950/40"
                  />
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <Button onClick={createRow} disabled={!canSubmitCreate}>
              {creating ? "กำลังเพิ่ม..." : "เพิ่ม Skill Stone"}
            </Button>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3">
            <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">รายการทั้งหมด</div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={load} disabled={loading}>
                {loading ? "กำลังโหลด..." : "รีเฟรช"}
              </Button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <div className="text-xs text-zinc-500 mb-1">Filter Type</div>
              <select
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
                value={filterType === "all" ? "all" : String(filterType)}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "all") setFilterType("all");
                  else setFilterType(parseType(v));
                }}
              >
                <option value="all">ทั้งหมด</option>
                <option value="1">อาวุธ</option>
                <option value="2">เสื้อ</option>
                <option value="3">รองเท้า</option>
                <option value="4">สร้อย</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <div className="text-xs text-zinc-500 mb-1">Search</div>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ค้นหาจากชื่อ / id / url..."
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-500">
                  <th className="py-2 pr-3">ID</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Image</th>
                  <th className="py-2 pr-3">Image URL</th>
                  <th className="py-2"></th>
                </tr>
              </thead>

              <tbody className="align-top">
                {loading ? (
                  <tr>
                    <td className="py-3 text-zinc-500" colSpan={6}>
                      Loading...
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td className="py-3 text-zinc-500" colSpan={6}>
                      ไม่มีข้อมูล
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((r) => (
                    <tr key={r.id} className="border-t border-zinc-200 dark:border-zinc-800">
                      <td className="py-3 pr-3 text-zinc-500">#{r.id}</td>
                      <td className="py-3 pr-3">
                        <span className="inline-flex items-center rounded-lg border border-zinc-200 dark:border-zinc-800 px-2 py-1 text-xs text-zinc-700 dark:text-zinc-200">
                          {r.type} • {typeLabel(r.type)}
                        </span>
                      </td>
                      <td className="py-3 pr-3 font-semibold text-zinc-900 dark:text-zinc-100">{r.name}</td>
                      <td className="py-3 pr-3">
                        {r.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={r.image_url}
                            alt=""
                            className="h-8 w-8 rounded-lg border border-zinc-200 dark:border-zinc-800 object-cover bg-white/60 dark:bg-zinc-950/40"
                            loading="lazy"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900" />
                        )}
                      </td>
                      <td className="py-3 pr-3 text-zinc-500 break-all">{r.image_url ?? "-"}</td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setEdit({ ...r });
                              setOpen(true);
                            }}
                          >
                            แก้ไข
                          </Button>
                          <Button
                            variant="danger"
                            onClick={() => {
                              if (confirm(`ลบ Skill Stone #${r.id} ?`)) void deleteRow(r.id);
                            }}
                          >
                            ลบ
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Modal
          open={open}
          onClose={() => {
            setOpen(false);
            setEdit(null);
          }}
          title="แก้ไข Skill Stone"
        >
          <div className="space-y-3">
            <div>
              <div className="text-xs text-zinc-500 mb-1">Type</div>
              <select
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
                value={String(edit?.type ?? 1)}
                onChange={(e) => setEdit((x) => (x ? { ...x, type: parseType(e.target.value) } : x))}
              >
                <option value="1">1 • อาวุธ</option>
                <option value="2">2 • เสื้อ</option>
                <option value="3">3 • รองเท้า</option>
                <option value="4">4 • สร้อย</option>
              </select>
            </div>

            <div>
              <div className="text-xs text-zinc-500 mb-1">Name</div>
              <Input
                value={edit?.name ?? ""}
                onChange={(e) => setEdit((x) => (x ? { ...x, name: e.target.value } : x))}
              />
            </div>

            <div>
              <div className="text-xs text-zinc-500 mb-1">Image URL</div>
              <Input
                value={edit?.image_url ?? ""}
                onChange={(e) => setEdit((x) => (x ? { ...x, image_url: e.target.value } : x))}
              />
            </div>

            {String(edit?.image_url ?? "").trim() ? (
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3">
                <div className="text-xs text-zinc-500 mb-2">Preview</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={String(edit?.image_url ?? "").trim()}
                  alt=""
                  className="h-16 w-16 rounded-xl border border-zinc-200 dark:border-zinc-800 object-cover bg-white/60 dark:bg-zinc-950/40"
                />
              </div>
            ) : null}

            <div className="flex gap-2 pt-2">
              <Button variant="secondary" className="flex-1" onClick={() => setOpen(false)}>
                ยกเลิก
              </Button>
              <Button
                className="flex-1"
                onClick={saveEdit}
                disabled={saving || !String(edit?.name ?? "").trim()}
              >
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}
