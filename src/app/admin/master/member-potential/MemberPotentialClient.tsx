"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";

// ── Player History Modal ───────────────────────────────────────────
type BatchStat = {
  batch_id: string;
  label: string;
  imported_at: string;
  opponent_guild?: string | null;
  class_id: number | null;
  avgs: Record<string, number>;
  score: number;
};

function fmtDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear().toString().slice(2)}`;
}

function PlayerModal({
  row,
  onClose,
}: {
  row: LeaderboardRow;
  onClose: () => void;
}) {
  const [allBatches, setAllBatches] = useState<BatchStat[]>([]);
  const [loading, setLoading]       = useState(true);
  const [fromDate, setFromDate]     = useState("");
  const [toDate, setToDate]         = useState("");

  useEffect(() => {
    fetch(`/api/admin/member-potential/player?uid=${encodeURIComponent(row.userdiscordid)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok && Array.isArray(j.batches) && j.batches.length > 0) {
          setAllBatches(j.batches);
          // default range: batch เก่าสุด → ใหม่สุด (sorted desc แล้ว)
          const dates = j.batches.map((b: BatchStat) => b.imported_at.slice(0, 10)).sort();
          setFromDate(dates[0]);
          setToDate(dates[dates.length - 1]);
        }
      })
      .finally(() => setLoading(false));
  }, [row.userdiscordid]);

  // filter by range แล้วเรียง newest → oldest
  const batches = allBatches
    .filter((b) => {
      const d = b.imported_at.slice(0, 10);
      return (!fromDate || d >= fromDate) && (!toDate || d <= toDate);
    })
    .sort((a, b) => b.imported_at.localeCompare(a.imported_at));

  const cats: (keyof typeof CAT_LABELS)[] = [
    "kill", "assist", "supply", "damage_player", "damage_fort",
    "heal", "damage_taken", "death", "revive",
  ];

  const maxPerCat = Object.fromEntries(
    cats.map((c) => [c, Math.max(...batches.map((b) => b.avgs[c] ?? 0), 1)])
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 border-b border-zinc-100 dark:border-zinc-800 px-5 py-4 flex items-center gap-3">
          {row.class_icon && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={row.class_icon} alt="" className="w-8 h-8 rounded-lg ring-1 ring-zinc-200 dark:ring-zinc-700" />
          )}
          <div className="flex-1 min-w-0">
            <div className="font-bold text-zinc-900 dark:text-zinc-100 truncate">{row.discordname}</div>
            <div className="text-xs text-zinc-400">{row.class_name} · {ROLE_LABEL[row.role]} · คะแนน {fmtScore(row.score)}</div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition text-sm"
          >✕</button>
        </div>

        {/* Date range picker */}
        <div className="shrink-0 border-b border-zinc-100 dark:border-zinc-800 px-5 py-3 flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium text-zinc-500">ช่วงวันที่:</span>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={fromDate}
              max={toDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-8 px-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-red-400"
            />
            <span className="text-xs text-zinc-400">ถึง</span>
            <input
              type="date"
              value={toDate}
              min={fromDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-8 px-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-red-400"
            />
          </div>

          {/* Batch quick-select pills */}
          {allBatches.length > 0 && (
            <div className="flex flex-wrap gap-1.5 ml-2">
              {/* Quick: 3 batch / 6 batch / ทั้งหมด — dedup based on actual count */}
              {((): { n: number; label: string }[] => {
                const opts: { n: number; label: string }[] = [];
                if (allBatches.length > 3) opts.push({ n: 3, label: "3 batch" });
                if (allBatches.length > 6) opts.push({ n: 6, label: "6 batch" });
                opts.push({ n: allBatches.length, label: "ทั้งหมด" });
                return opts;
              })().map(({ n, label: pillLabel }) => {
                const sorted = [...allBatches].sort((a, b) => b.imported_at.localeCompare(a.imported_at));
                const targetFrom = sorted[Math.min(n, sorted.length) - 1]?.imported_at.slice(0, 10) ?? "";
                const targetTo   = sorted[0]?.imported_at.slice(0, 10) ?? "";
                const active = fromDate === targetFrom && toDate === targetTo;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => { setFromDate(targetFrom); setToDate(targetTo); }}
                    className={`h-7 px-2.5 rounded-lg text-xs border transition ${
                      active
                        ? "bg-red-600 text-white border-red-600"
                        : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-red-300 hover:text-red-500"
                    }`}
                  >
                    {pillLabel}
                  </button>
                );
              })}
            </div>
          )}

          <span className="ml-auto text-xs text-zinc-400">
            {batches.length} batch
          </span>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto p-5">
          {loading ? (
            <div className="py-12 text-center text-sm text-zinc-400">กำลังโหลด...</div>
          ) : batches.length === 0 ? (
            <div className="py-12 text-center text-sm text-zinc-400">ไม่มีข้อมูลในช่วงวันที่เลือก</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  <th className="py-2 pr-4 text-left font-semibold text-zinc-500 w-28">หมวด</th>
                  {batches.map((b, i) => (
                    <th key={b.batch_id} className="py-2 px-2 text-center font-semibold whitespace-nowrap min-w-[90px]">
                      <div className={i === 0 ? "text-red-600 dark:text-red-400" : "text-zinc-500"}>
                        {b.label || fmtDate(b.imported_at)}
                      </div>
                      <div className="text-[10px] font-normal text-zinc-400">{fmtDate(b.imported_at)}</div>
                      {b.opponent_guild && (
                        <div className="text-[10px] font-normal text-amber-500 truncate max-w-[90px]" title={b.opponent_guild}>
                          vs {b.opponent_guild}
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Score row */}
                <tr className="border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/40">
                  <td className="py-2 pr-4 font-bold text-red-600 dark:text-red-400 whitespace-nowrap text-xs">⭐ คะแนน</td>
                  {batches.map((b, i) => (
                    <td key={b.batch_id} className="py-2 px-2 text-center">
                      <span className={`tabular-nums font-bold text-sm ${
                        i === 0 ? "text-red-600 dark:text-red-400" : "text-zinc-500 dark:text-zinc-400"
                      }`}>
                        {fmtScore(b.score)}
                      </span>
                    </td>
                  ))}
                </tr>
                {cats.map((cat) => {
                  const max = maxPerCat[cat];
                  return (
                    <tr key={cat} className="border-b border-zinc-50 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition">
                      <td className={`py-2 pr-4 font-medium whitespace-nowrap ${cat === "death" ? "text-red-500" : "text-zinc-600 dark:text-zinc-400"}`}>
                        {CAT_LABELS[cat as Category]}
                      </td>
                      {batches.map((b, i) => {
                        const val    = b.avgs[cat] ?? 0;
                        const pct    = max > 0 ? (val / max) * 100 : 0;
                        const isLatest = i === 0;
                        return (
                          <td key={b.batch_id} className="py-2 px-2">
                            <div className="flex flex-col items-center gap-1">
                              <div className="w-full h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                                <div
                                  className={`h-1.5 rounded-full ${
                                    cat === "death" ? "bg-red-400"
                                    : isLatest ? "bg-gradient-to-r from-orange-400 to-red-500"
                                    : "bg-zinc-300 dark:bg-zinc-600"
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className={`tabular-nums font-semibold ${
                                isLatest
                                  ? cat === "death" ? "text-red-500" : "text-zinc-900 dark:text-zinc-100"
                                  : "text-zinc-400"
                              }`}>
                                {fmtAvg(val)}
                              </span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Types ----------
const CATEGORIES = [
  "kill", "assist", "supply", "damage_player",
  "damage_fort", "heal", "damage_taken", "death", "revive",
] as const;
type Category = (typeof CATEGORIES)[number];

const CAT_LABELS: Record<Category, string> = {
  kill: "ฆ่า", assist: "ช่วยเหลือ", supply: "เสบียง",
  damage_player: "ดาเมจตีคน", damage_fort: "ดาเมจตีป้อม",
  heal: "ฮีล", damage_taken: "รับดาเมจ", death: "ตาย", revive: "ชุบ",
};

// Excel header → category mapping (supports Thai headers from export)
const EXCEL_COL_MAP: Record<string, Category> = {
  userdiscordid: "kill", // handled separately
  ฆ่า: "kill", ช่วยเหลือ: "assist", เสบียง: "supply",
  ดาเมจตีคน: "damage_player", ดาเมจตีป้อม: "damage_fort",
  ฮีล: "heal", รับดาเมจ: "damage_taken", ตาย: "death", ชุบ: "revive",
};

type Role = "dps" | "tank" | "healer";
const ROLE_LABEL: Record<Role, string> = { dps: "DPS", tank: "หมัด", healer: "พระ" };

type LeaderboardRow = {
  userdiscordid: string;
  discordname: string;
  class_id: number | null;
  class_name: string;
  class_icon: string;
  guild: number | null;
  batch_count: number;
  avgs: Record<Category, number>;
  score: number;
  role: Role;
};

type BatchRow = {
  id: string;
  label: string;
  imported_at: string;
  record_count: number;
  opponent_guild?: string | null;
};

type WeightRow = {
  id: string;
  class_id: number | null;
  category: Category;
  label: string;
  weight: number;
  enabled: boolean;
  sort_order: number;
};

type Tab = "leaderboard" | "batches" | "weights";
type SortKey = "score" | Category | "discordname";

const CAT_SCALE: Record<Category, string> = {
  kill: "×สิบ", assist: "×ร้อย", supply: "×พัน",
  damage_player: "×พัน", damage_fort: "×พัน",
  heal: "×ร้อย", damage_taken: "×ร้อย", death: "×สิบ", revive: "×สิบ",
};
const CAT_AVG: Record<Category, number> = {
  kill: 30, assist: 300, supply: 3000,
  damage_player: 4000, damage_fort: 3000,
  heal: 300, damage_taken: 400, death: 15, revive: 15,
};

// ---------- Helpers ----------
function fmtAvg(n: number) {
  if (n === 0) return "0";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}
function fmtScore(n: number) { return n.toLocaleString(undefined, { maximumFractionDigits: 1 }); }

export default function MemberPotentialClient() {
  const [tab, setTab] = useState<Tab>("leaderboard");

  // Leaderboard
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loadingLB, setLoadingLB] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortAsc, setSortAsc] = useState(false);
  const [playerModal, setPlayerModal] = useState<LeaderboardRow | null>(null);
  const [search, setSearch] = useState("");
  const [guildFilter, setGuildFilter] = useState<number | null>(null);
  const [roleFilter, setRoleFilter] = useState<Role | null>(null);

  // Batches
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [importing, setImporting] = useState(false);
  const [batchLabel, setBatchLabel] = useState("");
  const [deletingBatch, setDeletingBatch] = useState<string | null>(null);
  const [deleteToast, setDeleteToast] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Import modal
  const [pendingImport, setPendingImport] = useState<{ records: any[]; defaultLabel: string } | null>(null);
  const [importLabel, setImportLabel] = useState("");
  const [importOpponentGuild, setImportOpponentGuild] = useState("");

  // Weights
  const [weights, setWeights] = useState<WeightRow[]>([]);
  const [loadingW, setLoadingW] = useState(false);
  const [savingW, setSavingW] = useState(false);
  const [editWeights, setEditWeights] = useState<Record<string, number>>({});
  const [dirtyWeights, setDirtyWeights] = useState<Set<string>>(new Set());
  const [classes, setClasses] = useState<{ id: number; name: string; icon_url?: string }[]>([]);

  // Toast
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  // ---------- Load leaderboard ----------
  const loadLeaderboard = useCallback(async () => {
    setLoadingLB(true);
    try {
      const res = await fetch("/api/admin/member-potential", { cache: "no-store" });
      const json = await res.json();
      if (json.ok) setRows(json.items ?? []);
    } finally { setLoadingLB(false); }
  }, []);

  // ---------- Load batches ----------
  const loadBatches = useCallback(async () => {
    setLoadingBatches(true);
    try {
      const res = await fetch("/api/admin/member-potential/batches", { cache: "no-store" });
      const json = await res.json();
      if (json.ok) setBatches(json.items ?? []);
    } finally { setLoadingBatches(false); }
  }, []);

  // ---------- Load weights ----------
  const loadWeights = useCallback(async () => {
    setLoadingW(true);
    try {
      const [wRes, cRes] = await Promise.all([
        fetch("/api/admin/member-potential/weights", { cache: "no-store" }),
        fetch("/api/admin/classes", { cache: "no-store" }),
      ]);
      const wJson = await wRes.json();
      const cJson = await cRes.json();
      if (wJson.ok) {
        setWeights(wJson.items ?? []);
        const init: Record<string, number> = {};
        for (const w of wJson.items ?? []) {
          init[`${w.class_id ?? "null"}:${w.category}`] = w.weight;
        }
        setEditWeights(init);
        setDirtyWeights(new Set());
      }
      if (cJson.ok) setClasses(cJson.classes ?? []);
    } finally { setLoadingW(false); }
  }, []);

  useEffect(() => { loadLeaderboard(); }, [loadLeaderboard]);
  useEffect(() => {
    if (tab === "batches") loadBatches();
    if (tab === "weights") loadWeights();
  }, [tab, loadBatches, loadWeights]);

  // ---------- Import: parse file → open confirm modal ----------
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
      if (raw.length < 2) { showToast("ไฟล์ว่าง หรือไม่มีข้อมูล", false); return; }

      const headerRow: string[] = (raw[0] as string[]).map((c) => String(c ?? "").trim());
      const idxDiscordId = headerRow.indexOf("userdiscordid");
      const idxDiscordName = headerRow.indexOf("discordname");

      if (idxDiscordId === -1) { showToast("ไม่พบ column 'userdiscordid'", false); return; }

      const catIndices: Partial<Record<Category, number>> = {};
      for (const [hdr, cat] of Object.entries(EXCEL_COL_MAP)) {
        const idx = headerRow.indexOf(hdr);
        if (idx >= 0 && cat !== "kill") catIndices[cat] = idx;
      }
      const killIdx = headerRow.indexOf("ฆ่า");
      if (killIdx >= 0) catIndices["kill"] = killIdx;

      const records: any[] = [];
      for (let i = 1; i < raw.length; i++) {
        const r = raw[i] as any[];
        const uid = String(r[idxDiscordId] ?? "").trim();
        if (!uid) continue;
        const rec: any = {
          userdiscordid: uid,
          discordname: idxDiscordName >= 0 ? String(r[idxDiscordName] ?? "").trim() : "",
        };
        for (const cat of CATEGORIES) {
          const idx = catIndices[cat];
          rec[cat] = idx !== undefined ? (Number(r[idx]) || 0) : 0;
        }
        const allZero = CATEGORIES.every((cat) => rec[cat] === 0);
        if (allZero) continue;
        records.push(rec);
      }

      if (records.length === 0) { showToast("ไม่พบข้อมูลในไฟล์", false); return; }

      // Open confirm modal instead of immediately POSTing
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      setImportLabel(today);
      setImportOpponentGuild("");
      setPendingImport({ records, defaultLabel: today });
    } catch (err: any) {
      showToast(`เกิดข้อผิดพลาด: ${err?.message ?? "unknown"}`, false);
    }
  };

  // ---------- Import: confirm POST ----------
  const handleConfirmImport = async () => {
    if (!pendingImport) return;
    const { records } = pendingImport;   // capture before clearing
    setImporting(true);
    setPendingImport(null);
    try {
      const res = await fetch("/api/admin/member-potential", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          // format YYYY-MM-DD → d/m/yy (Thai-friendly short date)
          label: importLabel
            ? (() => { const [y, m, d] = importLabel.split("-"); return `${+d}/${+m}/${String(+y).slice(2)}`; })()
            : undefined,
          opponent_guild: importOpponentGuild.trim() || undefined,
          rows: records,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) { showToast(`Import ไม่สำเร็จ: ${json.error ?? "unknown"}`, false); return; }

      showToast(`Import สำเร็จ ${json.count} คน ✓`);
      setBatchLabel("");
      setImportLabel("");
      setImportOpponentGuild("");
      await loadLeaderboard();
      if (tab === "batches") await loadBatches();
    } catch (err: any) {
      showToast(`เกิดข้อผิดพลาด: ${err?.message ?? "unknown"}`, false);
    } finally { setImporting(false); }
  };

  // ---------- Delete batch ----------
  const deleteBatch = async (id: string) => {
    setDeletingBatch(null);
    const res = await fetch(`/api/admin/member-potential/batches/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok || !json.ok) { showToast("ลบไม่สำเร็จ", false); return; }
    setDeleteToast(true);
    setTimeout(() => setDeleteToast(false), 2500);
    await loadBatches();
    await loadLeaderboard();
  };

  // ---------- Save weights ----------
  const saveAllWeights = async () => {
    if (dirtyWeights.size === 0) return;
    setSavingW(true);
    try {
      const toSave = weights.filter((w) => {
        const key = `${w.class_id ?? "null"}:${w.category}`;
        return dirtyWeights.has(key);
      });
      await Promise.all(
        toSave.map((w) => {
          const key = `${w.class_id ?? "null"}:${w.category}`;
          return fetch("/api/admin/member-potential/weights", {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ ...w, weight: editWeights[key] }),
          });
        })
      );
      setDirtyWeights(new Set());
      showToast(`บันทึกสำเร็จ ${toSave.length} รายการ ✓`);
      await loadLeaderboard();
    } catch {
      showToast("บันทึกไม่สำเร็จ", false);
    } finally { setSavingW(false); }
  };

  // Strip leading emoji / symbols from Discord display names
  const stripLeadingIcon = (name: string) =>
    name.replace(/^[\p{Extended_Pictographic}\p{Symbol}\p{So}\s]+/u, "").trim();

  // ---------- Download Template ----------
  const handleDownloadTemplate = async () => {
    if (guildFilter === null) return;
    try {
      const res = await fetch(`/api/admin/members?guild=${guildFilter}`, { cache: "no-store" });
      const json = await res.json();
      const members: {
        discord_user_id: string;
        name: string;
        status: string;
        guild: number;
        class?: { id: number; name: string; icon_url?: string } | null;
      }[] = Array.isArray(json) ? json : (json?.members ?? []);

      const active = members
        .filter((m) => m.discord_user_id && String(m.status ?? "").toLowerCase() === "active")
        .sort((a, b) => {
          const ca = (a.class?.name ?? "").localeCompare(b.class?.name ?? "", "th");
          if (ca !== 0) return ca;
          return stripLeadingIcon(a.name ?? "").localeCompare(stripLeadingIcon(b.name ?? ""), "th");
        });

      const headers = ["userdiscordid", "discordname", "อาชีพ", ...CATEGORIES.map((c) => CAT_LABELS[c])];
      const dataRows = active.map((m) => [
        m.discord_user_id,
        stripLeadingIcon(m.name ?? ""),
        m.class?.name ?? "",
        ...CATEGORIES.map(() => 0),
      ]);

      const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
      ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 4, 18) }));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Member Potential");
      XLSX.writeFile(wb, `member_potential_template_guild${guildFilter}.xlsx`);
    } catch (err: any) {
      showToast(`ดาวน์โหลด Template ไม่สำเร็จ: ${err?.message ?? "unknown"}`, false);
    }
  };

  // ---------- Sort + filter ----------
  const filtered = rows.filter((r) => {
    if (guildFilter !== null && r.guild !== guildFilter) return false;
    if (roleFilter !== null && r.role !== roleFilter) return false;
    if (search && !r.discordname.toLowerCase().includes(search.toLowerCase()) && !r.userdiscordid.includes(search)) return false;
    return true;
  });
  const sorted = [...filtered].sort((a, b) => {
    let va: number | string, vb: number | string;
    if (sortKey === "score") { va = a.score; vb = b.score; }
    else if (sortKey === "discordname") { va = a.discordname; vb = b.discordname; }
    else { va = a.avgs[sortKey as Category]; vb = b.avgs[sortKey as Category]; }
    if (typeof va === "string") return sortAsc ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
    return sortAsc ? (va as number) - (vb as number) : (vb as number) - (va as number);
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else { setSortKey(key); setSortAsc(false); }
  };
  const sortIcon = (key: SortKey) => sortKey === key ? (sortAsc ? " ▲" : " ▼") : "";

  // Group weights by class_id for weights tab
  const classGroups = Array.from(
    weights.reduce((m, w) => {
      const k = w.class_id == null ? "null" : String(w.class_id);
      if (!m.has(k)) m.set(k, { class_id: w.class_id, rows: [] });
      m.get(k)!.rows.push(w);
      return m;
    }, new Map<string, { class_id: number | null; rows: WeightRow[] }>())
      .values()
  ).sort((a, b) => (a.class_id ?? -1) - (b.class_id ?? -1));

  // ---------- Render ----------
  const tabCls = (t: Tab) =>
    `px-4 py-2 text-sm rounded-xl border transition ${tab === t
      ? "bg-red-600 text-white border-red-600"
      : "border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"}`;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Member Potential</h1>
        <p className="text-xs text-zinc-500 mt-0.5">คะแนนศักยภาพผู้เล่น — คำนวณจากค่าเฉลี่ยหลาย batch × น้ำหนักตามอาชีพ</p>
      </div>

      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />

      {/* Tabs */}
      <div className="flex gap-2">
        <button className={tabCls("leaderboard")} onClick={() => setTab("leaderboard")}>🏆 Leaderboard</button>
        <button className={tabCls("batches")} onClick={() => setTab("batches")}>📦 Batches</button>
        <button className={tabCls("weights")} onClick={() => setTab("weights")}>⚖️ Weights</button>
      </div>

      {/* ===== LEADERBOARD ===== */}
      {tab === "leaderboard" && (
        <div className="space-y-3">
          {/* Guild tabs */}
          <div className="flex gap-1.5 flex-wrap">
            {([null, 1, 2, 3] as (number | null)[]).map((g) => {
              const count = rows.filter((r) => g === null ? true : r.guild === g).length;
              const active = guildFilter === g;
              return (
                <button
                  key={g ?? "all"}
                  onClick={() => setGuildFilter(g)}
                  className={`h-8 px-3 rounded-xl text-sm border transition ${active
                    ? "bg-red-600 text-white border-red-600"
                    : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}
                >
                  {g === null ? "ทั้งหมด" : `Guild ${g}`}
                  <span className={`ml-1.5 text-xs ${active ? "text-red-200" : "text-zinc-400"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Role tabs */}
          <div className="flex gap-1.5 flex-wrap items-center">
            <span className="text-xs text-zinc-400 mr-1">โหมด:</span>
            {([null, "dps", "tank", "healer"] as (Role | null)[]).map((r) => {
              const baseRows = guildFilter !== null ? rows.filter((x) => x.guild === guildFilter) : rows;
              const count = r === null ? baseRows.length : baseRows.filter((x) => x.role === r).length;
              const active = roleFilter === r;
              return (
                <button
                  key={r ?? "all"}
                  onClick={() => setRoleFilter(r)}
                  className={`h-7 px-3 rounded-lg text-xs border transition ${active
                    ? "bg-zinc-800 text-white border-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100"
                    : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}
                >
                  {r === null ? "ทุกโหมด" : ROLE_LABEL[r]}
                  <span className={`ml-1 text-[11px] ${active ? "opacity-70" : "text-zinc-400"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Import / Template — เฉพาะเมื่อเลือก guild */}
          <div className="flex flex-wrap items-center gap-2">
            {guildFilter === null ? (
              <p className="text-xs text-zinc-400 italic">เลือก Guild ก่อนเพื่อ Import หรือดาวน์โหลด Template</p>
            ) : (
              <>
                <button onClick={() => fileRef.current?.click()} disabled={importing}
                  className="h-8 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 transition">
                  {importing ? "กำลัง Import..." : "📥 Import Excel"}
                </button>
                <button onClick={handleDownloadTemplate}
                  className="h-8 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm transition">
                  📋 Download Template
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาชื่อ / Discord ID..."
              className="h-9 w-64 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-sm" />
            <span className="text-xs text-zinc-500">{sorted.length} คน</span>
          </div>

          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-zinc-400">#</th>
                    <th onClick={() => toggleSort("discordname")} className="px-3 py-2.5 text-left text-xs font-semibold text-zinc-500 cursor-pointer whitespace-nowrap hover:text-zinc-800">
                      ชื่อ{sortIcon("discordname")}
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-zinc-500 whitespace-nowrap">อาชีพ</th>
                    <th className="px-3 py-2.5 text-center text-xs font-semibold text-zinc-400 whitespace-nowrap">
                      จำนวนวอ
                    </th>
                    {CATEGORIES.map((c) => (
                      <th key={c} onClick={() => toggleSort(c)}
                        className={`px-3 py-2.5 text-right text-xs font-semibold cursor-pointer whitespace-nowrap hover:text-zinc-800 transition ${c === "death" ? "text-red-400" : "text-zinc-500"}`}>
                        {CAT_LABELS[c]}{sortIcon(c)}
                      </th>
                    ))}
                    <th onClick={() => toggleSort("score")}
                      className="px-3 py-2.5 text-right text-xs font-semibold text-red-600 cursor-pointer whitespace-nowrap">
                      คะแนนรวม{sortIcon("score")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loadingLB ? (
                    <tr><td colSpan={CATEGORIES.length + 6} className="px-3 py-8 text-center text-sm text-zinc-400">กำลังโหลด...</td></tr>
                  ) : sorted.length === 0 ? (
                    <tr><td colSpan={CATEGORIES.length + 6} className="px-3 py-8 text-center text-sm text-zinc-400">ยังไม่มีข้อมูล — กด Import Excel เพื่อนำเข้า</td></tr>
                  ) : sorted.map((r, i) => (
                    <tr key={r.userdiscordid} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition">
                      <td className="px-3 py-2 text-xs text-zinc-400">{i + 1}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setPlayerModal(r)}
                          className="font-medium text-zinc-800 dark:text-zinc-200 hover:text-red-600 dark:hover:text-red-400 hover:underline transition-colors text-left"
                        >
                          {r.discordname}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-xs text-zinc-500 whitespace-nowrap">
                        {r.class_icon && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.class_icon} alt="" className="inline w-4 h-4 rounded mr-1 align-middle" />
                        )}
                        {r.class_name || "-"}
                        <span className={`ml-1.5 rounded px-1 py-px text-[10px] font-semibold ${
                          r.role === "healer" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                          : r.role === "tank" ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
                          : "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400"
                        }`}>
                          {ROLE_LABEL[r.role]}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center tabular-nums text-xs text-zinc-400">
                        {r.batch_count}
                      </td>
                      {CATEGORIES.map((c) => (
                        <td key={c} className={`px-3 py-2 text-right tabular-nums text-xs ${c === "death" ? "text-red-500" : "text-zinc-700 dark:text-zinc-300"}`}>
                          {fmtAvg(r.avgs[c])}
                        </td>
                      ))}
                      <td className={`px-3 py-2 text-right tabular-nums font-bold ${r.score >= 0 ? "text-red-600" : "text-zinc-400"}`}>
                        {fmtScore(r.score)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===== BATCHES ===== */}
      {tab === "batches" && (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">ชื่อ Batch</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">กิลที่เจอ</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">วันที่ Import</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-zinc-500">จำนวนคน</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loadingBatches ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-zinc-400">กำลังโหลด...</td></tr>
              ) : batches.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-zinc-400">ยังไม่มี Batch</td></tr>
              ) : batches.map((b) => (
                <tr key={b.id} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition">
                  <td className="px-4 py-3 font-medium text-zinc-800 dark:text-zinc-200">{b.label || "-"}</td>
                  <td className="px-4 py-3 text-xs text-amber-600 dark:text-amber-400">{b.opponent_guild || <span className="text-zinc-400">-</span>}</td>
                  <td className="px-4 py-3 text-xs text-zinc-500">{new Date(b.imported_at).toLocaleString("th-TH")}</td>
                  <td className="px-4 py-3 text-center text-xs text-zinc-600">{b.record_count} คน</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setDeletingBatch(b.id)} className="text-xs text-red-500 hover:underline">ลบ</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ===== WEIGHTS ===== */}
      {tab === "weights" && (
        <div className="space-y-4">
          {/* Legend + Save button */}
          <div className="flex flex-wrap items-center gap-4 px-1 text-xs text-zinc-500">
            <span>คะแนน = Σ(ค่าเฉลี่ย × weight)</span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-red-100 dark:bg-red-950 border border-red-300 dark:border-red-800" />
              หมวดที่หักคะแนน
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800" />
              Override จาก Default
            </span>
            <div className="ml-auto flex items-center gap-2">
              {dirtyWeights.size > 0 && (
                <span className="text-amber-500 font-medium">มีการแก้ไข {dirtyWeights.size} รายการ</span>
              )}
              <button
                onClick={saveAllWeights}
                disabled={savingW || dirtyWeights.size === 0}
                className="h-8 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                {savingW ? "กำลังบันทึก..." : "💾 บันทึก"}
              </button>
            </div>
          </div>

          {loadingW ? (
            <div className="text-sm text-zinc-400 py-8 text-center">กำลังโหลด...</div>
          ) : (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800">
                      {/* Category col */}
                      <th className="bg-zinc-50 dark:bg-zinc-900 px-4 py-3 text-left text-xs font-semibold text-zinc-500 w-36 sticky left-0 z-10">
                        หมวด
                      </th>
                      <th className="bg-zinc-50 dark:bg-zinc-900 px-3 py-3 text-center text-xs font-semibold text-zinc-400 w-16">
                        สเกล
                      </th>
                      <th className="bg-zinc-50 dark:bg-zinc-900 px-3 py-3 text-center text-xs font-semibold text-zinc-400 w-20">
                        avg
                      </th>
                      {/* Class group cols */}
                      {classGroups.map(({ class_id }) => {
                        const cls = classes.find((c) => c.id === class_id);
                        return (
                          <th key={class_id ?? "default"}
                            className="bg-zinc-50 dark:bg-zinc-900 px-4 py-3 text-center text-xs font-semibold text-zinc-600 dark:text-zinc-300 min-w-[120px]">
                            {class_id == null ? (
                              <span className="text-zinc-500">Default</span>
                            ) : (
                              <span className="flex flex-col items-center gap-1">
                                {cls?.icon_url && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={cls.icon_url} alt="" className="w-6 h-6 rounded-lg" />
                                )}
                                <span>{cls?.name ?? `Class ${class_id}`}</span>
                              </span>
                            )}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {CATEGORIES.map((cat) => {
                      const isDeath = cat === "death";
                      const rowBg = isDeath
                        ? "bg-red-50/60 dark:bg-red-950/20"
                        : "bg-white dark:bg-zinc-950";
                      return (
                        <tr key={cat}
                          className={`border-b border-zinc-100 dark:border-zinc-800/60 ${rowBg}`}>
                          {/* Category label */}
                          <td className={`px-4 py-3 sticky left-0 z-10 ${rowBg}`}>
                            <div className="flex items-center gap-2">
                              {isDeath && <span className="text-red-500 text-base">⚠️</span>}
                              <span className={`font-semibold text-sm ${isDeath ? "text-red-600 dark:text-red-400" : "text-zinc-700 dark:text-zinc-200"}`}>
                                {CAT_LABELS[cat]}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className="text-xs text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                              {CAT_SCALE[cat]}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center text-xs text-zinc-400 tabular-nums">
                            ~{CAT_AVG[cat].toLocaleString()}
                          </td>
                          {/* Weight inputs per class */}
                          {classGroups.map(({ class_id, rows: wrows }) => {
                            const w = wrows.find((x) => x.category === cat);
                            if (!w) return <td key={class_id ?? "default"} className="px-4 py-3 text-center text-zinc-300">—</td>;
                            const wKey = `${w.class_id ?? "null"}:${w.category}`;
                            const val = editWeights[wKey] ?? w.weight;
                            const defaultW = editWeights[`null:${cat}`] ?? weights.find((x) => x.class_id == null && x.category === cat)?.weight ?? 0;
                            const isOverride = class_id != null && Number(val) !== Number(defaultW);
                            const expectedPts = Math.round(CAT_AVG[cat] * Number(val) * 10) / 10;
                            return (
                              <td key={class_id ?? "default"} className="px-4 py-2">
                                <div className={`rounded-xl border p-2 flex flex-col gap-1 ${
                                  isDeath
                                    ? "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30"
                                    : isOverride
                                    ? "border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/20"
                                    : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                                }`}>
                                  <input
                                    type="number"
                                    step="0.001"
                                    value={val}
                                    onChange={(e) => {
                                      const newVal = Number(e.target.value);
                                      setEditWeights((prev) => ({ ...prev, [wKey]: newVal }));
                                      setDirtyWeights((prev) => {
                                        const next = new Set(prev);
                                        if (newVal !== w.weight) next.add(wKey); else next.delete(wKey);
                                        return next;
                                      });
                                    }}
                                    className={`h-7 w-full rounded-lg border-0 bg-transparent px-1 text-sm text-right tabular-nums font-semibold focus:outline-none focus:ring-1 focus:ring-red-400 ${
                                      isDeath ? "text-red-600 dark:text-red-400" : "text-zinc-800 dark:text-zinc-100"
                                    }`}
                                  />
                                  <div className={`text-[10px] text-right tabular-nums ${isDeath ? "text-red-400" : "text-zinc-400"}`}>
                                    ≈ {expectedPts > 0 ? "+" : ""}{expectedPts} pts
                                  </div>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                    {/* Total row */}
                    <tr className="border-t-2 border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900">
                      <td className="px-4 py-3 text-xs font-bold text-zinc-600 dark:text-zinc-300 sticky left-0 bg-zinc-50 dark:bg-zinc-900" colSpan={3}>
                        คะแนนรวม (avg)
                      </td>
                      {classGroups.map(({ class_id, rows: wrows }) => {
                        const total = CATEGORIES.reduce((sum, cat) => {
                          const w = wrows.find((x) => x.category === cat);
                          const wKey = `${class_id ?? "null"}:${cat}`;
                          const val = editWeights[wKey] ?? w?.weight ?? 0;
                          return sum + CAT_AVG[cat] * Number(val);
                        }, 0);
                        return (
                          <td key={class_id ?? "default"} className="px-4 py-3 text-center">
                            <span className={`text-sm font-bold tabular-nums ${total >= 0 ? "text-red-600" : "text-zinc-400"}`}>
                              {Math.round(total)}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== Delete confirm modal ===== */}
      {deletingBatch ? (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeletingBatch(null)} />
          <div className="relative w-full max-w-xs rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 text-center shadow-xl">
            <p className="text-sm font-semibold mb-1">ลบ Batch นี้?</p>
            <p className="text-xs text-zinc-500 mb-5">ข้อมูลสถิติใน batch นี้จะถูกลบทั้งหมด</p>
            <div className="flex gap-2 justify-center">
              <button onClick={() => setDeletingBatch(null)} className="h-9 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm">ยกเลิก</button>
              <button onClick={() => deleteBatch(deletingBatch)} className="h-9 px-4 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm">ลบ</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Delete success toast */}
      {deleteToast ? (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[1100] bg-green-500 text-white px-6 py-3 rounded-xl text-sm shadow-lg pointer-events-none">
          ลบ Batch สำเร็จ ✓
        </div>
      ) : null}

      {/* General toast */}
      {toast ? (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[1100] px-6 py-3 rounded-xl text-sm shadow-lg pointer-events-none ${toast.ok ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
          {toast.msg}
        </div>
      ) : null}

      {/* Player history modal */}
      {playerModal && (
        <PlayerModal row={playerModal} onClose={() => setPlayerModal(null)} />
      )}

      {/* Import confirm modal */}
      {pendingImport && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setPendingImport(null)}
        >
          <div
            className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-bold text-zinc-900 dark:text-zinc-100 text-lg">📥 ยืนยัน Import</div>
            <p className="text-xs text-zinc-500">พบข้อมูล {pendingImport.records.length} คน</p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  วันที่ Batch
                </label>
                <input
                  type="date"
                  value={importLabel}
                  onChange={(e) => setImportLabel(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-red-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  ชื่อกิลที่เจอ <span className="text-zinc-400">(ใส่หรือปล่อยว่าง)</span>
                </label>
                <input
                  type="text"
                  value={importOpponentGuild}
                  onChange={(e) => setImportOpponentGuild(e.target.value)}
                  placeholder="เช่น Guild XYZ"
                  autoFocus
                  className="w-full h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-red-400"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={importing}
                className="flex-1 h-10 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium disabled:opacity-50 transition"
              >
                {importing ? "กำลัง Import..." : "✓ Import"}
              </button>
              <button
                type="button"
                onClick={() => setPendingImport(null)}
                className="h-10 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
