"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button, Card, Input, Modal } from "@/app/components/UI";

type ClassRow = { id: number; name: string; icon_url: string | null };
type ApiRes =
  | { ok: true; classes: ClassRow[] }
  | { ok: false; error?: string };

export default function AdminMasterClassesPage() {
  const [rows, setRows] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // create form
  const [name, setName] = useState("");
  const [iconUrl, setIconUrl] = useState("");
  const [creating, setCreating] = useState(false);

  // edit modal
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<ClassRow | null>(null);
  const [saving, setSaving] = useState(false);

  const canSubmitCreate = useMemo(() => name.trim().length > 0 && !creating, [name, creating]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch("/api/admin/classes", { cache: "no-store" });
      const j = (await r.json()) as ApiRes;
      if (!j.ok) throw new Error(j.error ?? "load_failed");
      setRows(j.classes ?? []);
    } catch (e: any) {
      setErr(String(e.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createRow() {
    setCreating(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), icon_url: iconUrl.trim() }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? "create_failed");
      setName("");
      setIconUrl("");
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
      const res = await fetch("/api/admin/classes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: edit.id,
          name: String(edit.name ?? "").trim(),
          icon_url: String(edit.icon_url ?? "").trim(),
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

  return (
    <div className="mx-auto w-full max-w-4xl px-3 sm:px-4 md:px-0 py-2">
        <div className="space-y-6">
        <Card>
            <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Master Data • Classes</div>
            <div className="mt-1 text-sm text-zinc-500">เพิ่ม/แก้ไขอาชีพ (name, icon_url)</div>

            {err ? <div className="mt-3 text-sm text-rose-600">Error: {err}</div> : null}

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
                <div className="text-xs text-zinc-500 mb-1">Name</div>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น Ironclan" />
            </div>
            <div>
                <div className="text-xs text-zinc-500 mb-1">Icon URL</div>
                <Input value={iconUrl} onChange={(e) => setIconUrl(e.target.value)} placeholder="https://..." />
            </div>
            </div>

            <div className="mt-4 flex justify-end">
            <Button onClick={createRow} disabled={!canSubmitCreate}>
                {creating ? "กำลังเพิ่ม..." : "เพิ่ม Class"}
            </Button>
            </div>
        </Card>

        <Card>
            <div className="flex items-center justify-between">
            <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">รายการทั้งหมด</div>
            <Button variant="outline" onClick={load} disabled={loading}>
                {loading ? "กำลังโหลด..." : "รีเฟรช"}
            </Button>
            </div>

            <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                <tr className="text-left text-zinc-500">
                    <th className="py-2 pr-3">ID</th>
                    <th className="py-2 pr-3">Name</th>
                    <th className="py-2 pr-3">Icon</th>
                    <th className="py-2 pr-3">Icon URL</th>
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
                ) : rows.length === 0 ? (
                    <tr>
                    <td className="py-3 text-zinc-500" colSpan={5}>
                        ไม่มีข้อมูล
                    </td>
                    </tr>
                ) : (
                    rows.map((r) => (
                    <tr key={r.id} className="border-t border-zinc-200 dark:border-zinc-800">
                        <td className="py-3 pr-3 text-zinc-500">#{r.id}</td>
                        <td className="py-3 pr-3 font-semibold text-zinc-900 dark:text-zinc-100">{r.name}</td>
                        <td className="py-3 pr-3">
                        {r.icon_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                            src={r.icon_url}
                            alt=""
                            className="h-8 w-8 rounded-lg border border-zinc-200 dark:border-zinc-800 object-contain bg-white/60 dark:bg-zinc-950/40"
                            />
                        ) : (
                            <div className="h-8 w-8 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900" />
                        )}
                        </td>
                        <td className="py-3 pr-3 text-zinc-500 break-all">{r.icon_url ?? "-"}</td>
                        <td className="py-3 text-right">
                        <Button
                            variant="outline"
                            onClick={() => {
                            setEdit({ ...r });
                            setOpen(true);
                            }}
                        >
                            แก้ไข
                        </Button>
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
            title="แก้ไข Class"
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
                <div className="text-xs text-zinc-500 mb-1">Icon URL</div>
                <Input
                value={edit?.icon_url ?? ""}
                onChange={(e) => setEdit((x) => (x ? { ...x, icon_url: e.target.value } : x))}
                />
            </div>

            {edit?.icon_url ? (
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3">
                <div className="text-xs text-zinc-500 mb-2">Preview</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={edit.icon_url}
                    alt=""
                    className="h-16 w-16 rounded-xl border border-zinc-200 dark:border-zinc-800 object-contain bg-white/60 dark:bg-zinc-950/40"
                />
                </div>
            ) : null}

            <div className="flex gap-2 pt-2">
                <Button variant="secondary" className="flex-1" onClick={() => setOpen(false)}>
                ยกเลิก
                </Button>
                <Button className="flex-1" onClick={saveEdit} disabled={saving || !String(edit?.name ?? "").trim()}>
                {saving ? "กำลังบันทึก..." : "บันทึก"}
                </Button>
            </div>
            </div>
        </Modal>
        </div>
    </div>
  );
}
