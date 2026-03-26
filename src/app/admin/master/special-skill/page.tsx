// app/admin/master/special-skill/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button, Card, Input, Modal } from "@/app/components/UI";

type SpecialSkillRow = {
  id: number;
  name: string;
  special_skill_url: string | null;
  created_at?: string;
};

type ApiRes =
  | { ok: true; skills: SpecialSkillRow[] }
  | { ok: false; error?: string };

export default function AdminMasterSpecialSkillPage() {
  const [rows, setRows] = useState<SpecialSkillRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // create form
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [creating, setCreating] = useState(false);

  // search
  const [q, setQ] = useState("");

  // edit modal
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<SpecialSkillRow | null>(null);
  const [saving, setSaving] = useState(false);

  const canSubmitCreate = useMemo(
    () => name.trim().length > 0 && !creating,
    [name, creating]
  );

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch("/api/admin/special-skills", { cache: "no-store" });
      const j = (await r.json()) as ApiRes;
      if (!j.ok) throw new Error((j as any).error ?? "load_failed");
      setRows((j.skills ?? []).slice().sort((a, b) => a.id - b.id));
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
      const res = await fetch("/api/admin/special-skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          special_skill_url: url.trim() || null,
        }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? "create_failed");
      setName("");
      setUrl("");
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
      const res = await fetch("/api/admin/special-skills", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: edit.id,
          name: String(edit.name ?? "").trim(),
          special_skill_url: String(edit.special_skill_url ?? "").trim() || null,
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
      const res = await fetch(`/api/admin/special-skills?id=${id}`, { method: "DELETE" });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? "delete_failed");
      await load();
    } catch (e: any) {
      setErr(String(e.message ?? e));
    }
  }

  const filteredRows = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return rows;
    return rows.filter(
      (r) =>
        String(r.name ?? "").toLowerCase().includes(qq) ||
        String(r.id).includes(qq) ||
        String(r.special_skill_url ?? "").toLowerCase().includes(qq)
    );
  }, [rows, q]);

  return (
    <div className="mx-auto w-full max-w-4xl px-3 sm:px-4 md:px-0 py-2">
      <div className="space-y-6">
        {/* Create form */}
        <Card>
          <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Master Data &bull; ศิษย์พี่
          </div>
          <div className="mt-1 text-sm text-zinc-500">
            เพิ่ม/แก้ไข ศิษย์พี่ (special_skill) สำหรับใช้งานในหน้า /me
          </div>

          {err ? <div className="mt-3 text-sm text-rose-600">Error: {err}</div> : null}

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-zinc-500 mb-1">Name</div>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="เช่น ศิษย์พี่ X"
              />
            </div>

            <div>
              <div className="text-xs text-zinc-500 mb-1">Image URL</div>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>

            {url.trim() ? (
              <div className="md:col-span-2">
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3">
                  <div className="text-xs text-zinc-500 mb-2">Preview</div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url.trim()}
                    alt=""
                    className="h-16 w-16 rounded-xl border border-zinc-200 dark:border-zinc-800 object-cover bg-white/60 dark:bg-zinc-950/40"
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-4 flex justify-end">
            <Button onClick={createRow} disabled={!canSubmitCreate}>
              {creating ? "กำลังเพิ่ม..." : "เพิ่ม ศิษย์พี่"}
            </Button>
          </div>
        </Card>

        {/* List */}
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              รายการทั้งหมด
            </div>
            <Button variant="outline" onClick={load} disabled={loading}>
              {loading ? "กำลังโหลด..." : "รีเฟรช"}
            </Button>
          </div>

          <div className="mt-4">
            <div className="text-xs text-zinc-500 mb-1">Search</div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ค้นหาจากชื่อ / id / url..."
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
            />
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-500">
                  <th className="py-2 pr-3">ID</th>
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Image</th>
                  <th className="py-2 pr-3">Image URL</th>
                  <th className="py-2"></th>
                </tr>
              </thead>

              <tbody className="align-top">
                {loading ? (
                  <tr>
                    <td className="py-3 text-zinc-500" colSpan={5}>
                      Loading...
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td className="py-3 text-zinc-500" colSpan={5}>
                      ไม่มีข้อมูล
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((r) => (
                    <tr key={r.id} className="border-t border-zinc-200 dark:border-zinc-800">
                      <td className="py-3 pr-3 text-zinc-500">#{r.id}</td>
                      <td className="py-3 pr-3 font-semibold text-zinc-900 dark:text-zinc-100">
                        {r.name}
                      </td>
                      <td className="py-3 pr-3">
                        {r.special_skill_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={r.special_skill_url}
                            alt=""
                            className="h-10 w-10 rounded-xl border border-zinc-200 dark:border-zinc-800 object-cover bg-white/60 dark:bg-zinc-950/40"
                            loading="lazy"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900" />
                        )}
                      </td>
                      <td className="py-3 pr-3 text-zinc-500 break-all">
                        {r.special_skill_url ?? "-"}
                      </td>
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
                              if (confirm(`ลบ ศิษย์พี่ #${r.id} "${r.name}" ?`))
                                void deleteRow(r.id);
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

        {/* Edit modal */}
        <Modal
          open={open}
          onClose={() => {
            setOpen(false);
            setEdit(null);
          }}
          title="แก้ไข ศิษย์พี่"
        >
          <div className="space-y-3">
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
                value={edit?.special_skill_url ?? ""}
                onChange={(e) =>
                  setEdit((x) => (x ? { ...x, special_skill_url: e.target.value } : x))
                }
              />
            </div>

            {String(edit?.special_skill_url ?? "").trim() ? (
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3">
                <div className="text-xs text-zinc-500 mb-2">Preview</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={String(edit?.special_skill_url ?? "").trim()}
                  alt=""
                  className="h-16 w-16 rounded-xl border border-zinc-200 dark:border-zinc-800 object-cover bg-white/60 dark:bg-zinc-950/40"
                />
              </div>
            ) : null}

            <div className="flex gap-2 pt-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setOpen(false);
                  setEdit(null);
                }}
              >
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
          </div>
        </Modal>
      </div>
    </div>
  );
}
