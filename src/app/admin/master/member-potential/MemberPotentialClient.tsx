"use client";

import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
// ⚡ xlsx + xlsx-js-style เป็น library ขนาดใหญ่ (~800kB) เลย lazy-load ตอนใช้จริงเท่านั้น
// (ดู handleFileChange และ handleDownloadTemplate ด้านล่าง)
import { useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/queryClient";
import {
  useLeaderboard,
  useBatches,
  useBatchDetail,
  useWeights,
  useImportBatch,
  useUpdateBatch,
  useDeleteBatch,
  useUpdateBatchRecords,
  useUpsertWeight,
  usePlayerHistory,
} from "@/hooks/api/memberPotential";
import { useClasses } from "@/hooks/api/masters";

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
  const historyQuery = usePlayerHistory(row.userdiscordid);
  const loading = historyQuery.isLoading;
  const allBatches: BatchStat[] = (historyQuery.data as any)?.ok
    ? ((historyQuery.data as any).batches as BatchStat[] | undefined) ?? []
    : [];

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate]     = useState("");

  // Set default date range once data arrives
  const initRangeRef = useRef(false);
  useEffect(() => {
    if (initRangeRef.current) return;
    if (allBatches.length === 0) return;
    const dates = allBatches.map((b) => b.imported_at.slice(0, 10)).sort();
    setFromDate(dates[0]);
    setToDate(dates[dates.length - 1]);
    initRangeRef.current = true;
  }, [allBatches]);

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
            <img src={row.class_icon} alt="" className="w-8 h-8 rounded-lg ring-1 ring-zinc-200 dark:ring-zinc-700" loading="lazy" decoding="async" />
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
                        <div className="mt-1 inline-flex items-center gap-1 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 rounded-full px-2 py-0.5 text-[11px] font-semibold max-w-[110px] truncate" title={b.opponent_guild}>
                          ⚔️ {b.opponent_guild}
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
  guild?: number | null;
};

type BatchRecordRow = {
  userdiscordid: string;
  discordname: string;
  class_id: number | null;
  class_name: string;
  class_icon: string;
  kill: number;
  assist: number;
  supply: number;
  damage_player: number;
  damage_fort: number;
  heal: number;
  damage_taken: number;
  death: number;
  revive: number;
  score: number; // per-batch score = Σ(stat × weight_for_class)
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

// Stat input cell with local state to keep typing responsive.
// Only commits to parent state on blur/Enter to avoid re-rendering the whole modal on every keystroke.
type EditableStatCellProps = {
  uid: string;
  cat: Category;
  original: number;
  initialDraft: number | undefined;
  resetKey: number; // bumped when parent wants to reset local state (cancel / save)
  onCommit: (uid: string, cat: Category, value: number) => void;
};
const EditableStatCell = React.memo(function EditableStatCell({
  uid, cat, original, initialDraft, resetKey, onCommit,
}: EditableStatCellProps) {
  const baseline = initialDraft !== undefined ? initialDraft : original;
  const [val, setVal] = useState<string>(String(baseline));

  // Re-sync local state when parent bumps the reset key (e.g. after save/cancel)
  useEffect(() => {
    setVal(String(initialDraft !== undefined ? initialDraft : original));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const numVal = val === "" ? 0 : Math.max(0, Math.floor(Number(val) || 0));
  const isEdited = numVal !== original;

  const commit = () => {
    // Normalize displayed text (e.g. "05" -> "5")
    if (String(numVal) !== val) setVal(String(numVal));
    onCommit(uid, cat, numVal);
  };

  return (
    <td className="px-2 py-1 text-right">
      <input
        type="number"
        min={0}
        step={1}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className={`h-7 w-20 rounded-md border px-1.5 text-right tabular-nums text-xs focus:outline-none focus:ring-1 focus:ring-red-400 ${
          isEdited
            ? "border-amber-400 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 font-semibold"
            : cat === "death" && numVal > 0
            ? "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-red-500"
            : numVal > 0
            ? "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200"
            : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500"
        }`}
      />
    </td>
  );
});

// Weight input cell — same pattern as EditableStatCell. Commits on blur to avoid lag
// when typing because there are 9 cats × N classes of inputs rendered at once.
type EditableWeightCellProps = {
  wKey: string;
  cat: Category;
  initialValue: number;
  defaultValue: number; // default column's value (for class cols, used for override highlight)
  isDefaultCol: boolean;
  isDeath: boolean;
  resetKey: number;
  onCommit: (wKey: string, value: number) => void;
};
const EditableWeightCell = React.memo(function EditableWeightCell({
  wKey, cat, initialValue, defaultValue, isDefaultCol, isDeath, resetKey, onCommit,
}: EditableWeightCellProps) {
  const [val, setVal] = useState<string>(String(initialValue));

  useEffect(() => {
    setVal(String(initialValue));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const numVal = val === "" ? 0 : Number(val) || 0;
  const isOverride = !isDefaultCol && numVal !== defaultValue;
  const expectedPts = Math.round(CAT_AVG[cat] * numVal * 10) / 10;

  const commit = () => onCommit(wKey, numVal);

  return (
    <td className="px-4 py-2">
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
          onChange={(e) => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
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
});

export default function MemberPotentialClient() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("leaderboard");

  // Leaderboard — React Query
  const leaderboardQuery = useLeaderboard();
  const rows: LeaderboardRow[] = (leaderboardQuery.data as LeaderboardRow[] | undefined) ?? [];
  const loadingLB = leaderboardQuery.isLoading;

  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortAsc, setSortAsc] = useState(false);
  const [playerModal, setPlayerModal] = useState<LeaderboardRow | null>(null);
  const [search, setSearch] = useState("");
  const [guildFilter, setGuildFilter] = useState<number | null>(null);
  const [roleFilter, setRoleFilter] = useState<string | null>(null);

  // Batches — React Query (lazy: only when batches tab is active)
  const batchesQuery = useBatches({ enabled: tab === "batches" });
  const batches: BatchRow[] = (batchesQuery.data as BatchRow[] | undefined) ?? [];
  const loadingBatches = batchesQuery.isLoading && tab === "batches";

  const [importing, setImporting] = useState(false);
  const [batchLabel, setBatchLabel] = useState("");
  const [deletingBatch, setDeletingBatch] = useState<string | null>(null);
  const [deleteToast, setDeleteToast] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Import modal
  const [pendingImport, setPendingImport] = useState<{ records: any[]; defaultLabel: string } | null>(null);
  const [importLabel, setImportLabel] = useState("");
  const [importOpponentGuild, setImportOpponentGuild] = useState("");
  const [importClassFilter, setImportClassFilter] = useState<string | null>(null);
  // Sort preview table
  type ImportSortField = "name" | "class" | Category;
  const [importSortField, setImportSortField] = useState<ImportSortField | null>(null);
  const [importSortDir, setImportSortDir] = useState<"asc" | "desc">("desc");
  const toggleImportSort = (field: ImportSortField) => {
    if (importSortField === field) {
      setImportSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setImportSortField(field);
      // numeric cols default desc (เยอะ → น้อย), string cols default asc
      setImportSortDir(field === "name" || field === "class" ? "asc" : "desc");
    }
  };

  // Batch edit modal
  const [editingBatch, setEditingBatch] = useState<BatchRow | null>(null);
  const [editBatchLabel, setEditBatchLabel] = useState("");
  const [editBatchOpponent, setEditBatchOpponent] = useState("");
  const [editBatchGuild, setEditBatchGuild] = useState<number | null>(null);
  const [savingBatch, setSavingBatch] = useState(false);

  // Batch details modal (view records) — React Query (enabled when a batch is selected)
  const [viewingBatch, setViewingBatch] = useState<BatchRow | null>(null);
  const batchDetailQuery = useBatchDetail(viewingBatch?.id ?? null);
  const viewingBatchRecords: BatchRecordRow[] =
    (batchDetailQuery.data as { items?: BatchRecordRow[] } | undefined)?.items ?? [];
  const loadingBatchDetail = !!viewingBatch && batchDetailQuery.isLoading;
  const [batchDetailSearch, setBatchDetailSearch] = useState("");
  // "default" = sort by class name then discord name (matches Download Template order)
  const [batchDetailSortKey, setBatchDetailSortKey] = useState<SortKey | "default">("default");
  const [batchDetailSortAsc, setBatchDetailSortAsc] = useState(true);
  const [batchDetailClassFilter, setBatchDetailClassFilter] = useState<string | null>(null);
  // Edit mode toggle — "ดู" opens in view-only, must press "แก้ไข" to enable editing
  const [batchEditMode, setBatchEditMode] = useState(false);
  // Draft edits: Map<userdiscordid, Record<Category, number>> — only contains rows that user touched
  const [batchEdits, setBatchEdits] = useState<Map<string, Partial<Record<Category, number>>>>(new Map());
  // Bumped on cancel / save so EditableStatCell can re-sync its local state
  const [editsResetKey, setEditsResetKey] = useState(0);
  const [savingBatchRecords, setSavingBatchRecords] = useState(false);

  // Batch guild filter
  const [batchGuildFilter, setBatchGuildFilter] = useState<number | null>(null);

  // Weights — React Query (lazy: only when weights tab is active)
  const weightsQuery = useWeights({ enabled: tab === "weights" });
  const weights: WeightRow[] = ((weightsQuery.data as unknown as WeightRow[] | undefined) ?? []);
  const loadingW = weightsQuery.isLoading && tab === "weights";
  const [savingW, setSavingW] = useState(false);
  const [editWeights, setEditWeights] = useState<Record<string, number>>({});
  // Bumped after load/save so EditableWeightCell can re-sync local state
  const [weightsResetKey, setWeightsResetKey] = useState(0);

  // Classes — React Query (always loaded for icons in filters/preview)
  const classesQuery = useClasses();
  const classes = (classesQuery.data as { id: number; name: string; icon_url: string | null }[] | undefined) ?? [];

  // Stable onCommit for EditableWeightCell — keeps React.memo effective
  const onCommitWeight = useCallback((wKey: string, value: number) => {
    setEditWeights((prev) => ({ ...prev, [wKey]: value }));
  }, []);

  // Toast
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  // Initialize edit draft when weights data arrives/changes
  useEffect(() => {
    if (!weightsQuery.data) return;
    const init: Record<string, number> = {};
    for (const w of weightsQuery.data as unknown as WeightRow[]) {
      init[`${w.class_id ?? "null"}:${w.category}`] = w.weight;
    }
    setEditWeights(init);
    setWeightsResetKey((k) => k + 1);
  }, [weightsQuery.data]);

  // ---------- Import: parse file → open confirm modal ----------
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try {
      // ⚡ lazy-load xlsx เมื่อผู้ใช้เลือกไฟล์จริง ๆ เท่านั้น
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
      if (raw.length < 2) { showToast("ไฟล์ว่าง หรือไม่มีข้อมูล", false); return; }

      const headerRow: string[] = (raw[0] as string[]).map((c) => String(c ?? "").trim());
      const idxDiscordId = headerRow.indexOf("userdiscordid");
      const idxDiscordName = headerRow.indexOf("discordname");
      const idxClassName = headerRow.indexOf("อาชีพ");

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
          class_name: idxClassName >= 0 ? String(r[idxClassName] ?? "").trim() : "",
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

      // Sort: by class name (Thai locale), then by discord name (with leading icons stripped)
      records.sort((a, b) => {
        const ca = String(a.class_name ?? "").localeCompare(String(b.class_name ?? ""), "th");
        if (ca !== 0) return ca;
        return stripLeadingIcon(String(a.discordname ?? "")).localeCompare(
          stripLeadingIcon(String(b.discordname ?? "")),
          "th"
        );
      });

      // Open confirm modal instead of immediately POSTing
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      setImportLabel(today);
      setImportOpponentGuild("");
      setImportClassFilter(null);
      setPendingImport({ records, defaultLabel: today });
    } catch (err: any) {
      showToast(`เกิดข้อผิดพลาด: ${err?.message ?? "unknown"}`, false);
    }
  };

  // ---------- Import: confirm POST ----------
  const importMutation = useImportBatch();
  const handleConfirmImport = async () => {
    if (!pendingImport) return;
    const { records } = pendingImport;   // capture before clearing
    setImporting(true);
    setPendingImport(null);
    try {
      const json = await importMutation.mutateAsync({
        // format YYYY-MM-DD → d/m/yy (Thai-friendly short date)
        label: importLabel
          ? (() => { const [y, m, d] = importLabel.split("-"); return `${+d}/${+m}/${String(+y).slice(2)}`; })()
          : undefined,
        opponent_guild: importOpponentGuild.trim() || undefined,
        guild: guildFilter,
        rows: records,
      });
      if (!json.ok) { showToast(`Import ไม่สำเร็จ: ${json.error ?? "unknown"}`, false); return; }

      showToast(`Import สำเร็จ ${json.count} คน ✓`);
      setBatchLabel("");
      setImportLabel("");
      setImportOpponentGuild("");
      // useImportBatch.onSuccess invalidates leaderboard + batches
    } catch (err: any) {
      showToast(`เกิดข้อผิดพลาด: ${err?.message ?? "unknown"}`, false);
    } finally { setImporting(false); }
  };

  // ---------- View batch detail ----------
  const openViewBatch = (b: BatchRow) => {
    setViewingBatch(b);
    setBatchDetailSearch("");
    setBatchDetailSortKey("default");
    setBatchDetailSortAsc(true);
    setBatchDetailClassFilter(null);
    setBatchEditMode(false);
    setBatchEdits(new Map());
    // Data fetched via useBatchDetail(viewingBatch?.id) — see query hook above
  };

  // Show error toast if batch detail query fails
  useEffect(() => {
    if (batchDetailQuery.isError && viewingBatch) {
      showToast(`โหลดข้อมูลไม่สำเร็จ: ${(batchDetailQuery.error as Error)?.message ?? "unknown"}`, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchDetailQuery.isError]);

  // Get effective value for a record+category (edits take precedence)
  const getRecValue = (uid: string, original: number, cat: Category): number => {
    const edits = batchEdits.get(uid);
    if (edits && cat in edits) return edits[cat] as number;
    return original;
  };

  // Stable onCommit ref for EditableStatCell.
  // Keeping this stable prevents React.memo'd cells from re-rendering when the parent re-renders.
  const setRecValueRef = useRef<(uid: string, cat: Category, value: number) => void>(() => {});
  setRecValueRef.current = (uid: string, cat: Category, value: number) => {
    const originalRec = viewingBatchRecords.find((r) => r.userdiscordid === uid);
    const original = originalRec ? originalRec[cat] : 0;
    setBatchEdits((prev) => {
      const next = new Map(prev);
      const curr = { ...(next.get(uid) ?? {}) } as Partial<Record<Category, number>>;
      if (value === original) {
        // Value reverted to original → drop this field from drafts
        delete curr[cat];
        if (Object.keys(curr).length === 0) next.delete(uid);
        else next.set(uid, curr);
      } else {
        curr[cat] = value;
        next.set(uid, curr);
      }
      return next;
    });
  };
  const onCommitStat = useCallback((uid: string, cat: Category, value: number) => {
    setRecValueRef.current(uid, cat, value);
  }, []);

  const cancelBatchEdits = () => {
    setBatchEdits(new Map());
    setEditsResetKey((k) => k + 1);
    setBatchEditMode(false);
  };

  const updateRecordsMutation = useUpdateBatchRecords();
  const saveBatchEdits = async () => {
    if (!viewingBatch) return;
    // Build updates from edits, only sending rows/fields that actually changed
    const updates: Array<{ userdiscordid: string } & Partial<Record<Category, number>>> = [];
    for (const [uid, edits] of batchEdits) {
      const original = viewingBatchRecords.find((r) => r.userdiscordid === uid);
      if (!original) continue;
      const diff: Partial<Record<Category, number>> = {};
      let changed = false;
      for (const c of CATEGORIES) {
        if (c in edits && edits[c] !== original[c]) {
          diff[c] = edits[c];
          changed = true;
        }
      }
      if (changed) updates.push({ userdiscordid: uid, ...diff });
    }

    if (updates.length === 0) {
      showToast("ไม่มีข้อมูลที่เปลี่ยนแปลง", false);
      return;
    }

    setSavingBatchRecords(true);
    try {
      const json = await updateRecordsMutation.mutateAsync({ id: viewingBatch.id, updates });
      if (!json.ok) {
        showToast(`บันทึกไม่สำเร็จ: ${json.error ?? "unknown"}`, false);
        return;
      }
      showToast(`บันทึกสำเร็จ ${json.updated} แถว ✓`);
      // Apply changes to cached batch detail so the table updates immediately
      qc.setQueryData(qk.batchDetail(viewingBatch.id), (prev: unknown) => {
        const data = (prev ?? {}) as { items?: BatchRecordRow[] };
        const items = data.items ?? [];
        return {
          ...(data as object),
          items: items.map((r) => {
            const edits = batchEdits.get(r.userdiscordid);
            return edits ? { ...r, ...edits } : r;
          }),
        };
      });
      setBatchEdits(new Map());
      setEditsResetKey((k) => k + 1);
      setBatchEditMode(false);
      // Mutation.onSuccess invalidates leaderboard + batchDetail
    } catch (err: any) {
      showToast(`เกิดข้อผิดพลาด: ${err?.message ?? "unknown"}`, false);
    } finally {
      setSavingBatchRecords(false);
    }
  };

  const toggleBatchDetailSort = (key: SortKey) => {
    // Cycle 3 states: default → first dir → second dir → default
    // discordname: asc → desc, อื่นๆ: desc → asc (highest first ก่อน)
    const firstDirAsc = key === "discordname";
    if (batchDetailSortKey !== key) {
      setBatchDetailSortKey(key);
      setBatchDetailSortAsc(firstDirAsc);
      return;
    }
    if (batchDetailSortAsc === firstDirAsc) {
      // first → second
      setBatchDetailSortAsc(!batchDetailSortAsc);
    } else {
      // second → default (no sort)
      setBatchDetailSortKey("default");
      setBatchDetailSortAsc(true);
    }
  };
  const batchDetailSortIcon = (key: SortKey) => {
    if (batchDetailSortKey === key) {
      return <span>{batchDetailSortAsc ? " ▲" : " ▼"}</span>;
    }
    return <span className="text-zinc-300 dark:text-zinc-600"> ⇅</span>;
  };

  // ---------- Edit batch ----------
  const openEditBatch = (b: BatchRow) => {
    // convert label "d/m/yy" back to YYYY-MM-DD for date input if possible
    const toDateInput = (label: string) => {
      const m = label.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
      if (!m) return "";
      const [, d, mo, y] = m;
      const year = +y < 100 ? 2500 + +y - 543 : +y > 2400 ? +y - 543 : +y;
      return `${year}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    };
    setEditingBatch(b);
    setEditBatchLabel(toDateInput(b.label) || "");
    setEditBatchOpponent(b.opponent_guild ?? "");
    setEditBatchGuild(b.guild ?? null);
  };

  const updateBatchMutation = useUpdateBatch();
  const saveBatchEdit = async () => {
    if (!editingBatch) return;
    setSavingBatch(true);
    try {
      const label = editBatchLabel
        ? (() => { const [y, m, d] = editBatchLabel.split("-"); return `${+d}/${+m}/${String(+y).slice(2)}`; })()
        : editingBatch.label;
      const json = await updateBatchMutation.mutateAsync({
        id: editingBatch.id,
        label,
        opponent_guild: editBatchOpponent.trim() || undefined,
        guild: editBatchGuild,
      });
      if (!json.ok) { showToast("บันทึกไม่สำเร็จ", false); return; }
      showToast("บันทึกสำเร็จ ✓");
      setEditingBatch(null);
      // Mutation.onSuccess handles invalidation
    } finally { setSavingBatch(false); }
  };

  // ---------- Delete batch ----------
  const deleteBatchMutation = useDeleteBatch();
  const deleteBatch = async (id: string) => {
    setDeletingBatch(null);
    try {
      const json = await deleteBatchMutation.mutateAsync(id);
      if (!json.ok) { showToast("ลบไม่สำเร็จ", false); return; }
      setDeleteToast(true);
      setTimeout(() => setDeleteToast(false), 2500);
      // Mutation.onSuccess invalidates leaderboard + batches
    } catch {
      showToast("ลบไม่สำเร็จ", false);
    }
  };

  // ---------- Save weights ----------
  const upsertWeightMutation = useUpsertWeight();
  const saveAllWeights = async () => {
    setSavingW(true);
    try {
      await Promise.all(
        weights.map((w) => {
          const key = `${w.class_id ?? "null"}:${w.category}`;
          return upsertWeightMutation.mutateAsync({
            class_id: w.class_id,
            category: w.category,
            label: w.label,
            weight: Number(editWeights[key] ?? w.weight),
            enabled: w.enabled,
            sort_order: w.sort_order,
          });
        })
      );
      showToast(`บันทึกสำเร็จ ${weights.length} รายการ ✓`);
      // Optimistically update the cached weights so the override-highlight logic sees the saved values immediately
      qc.setQueryData(qk.weights(), (prev: unknown) => {
        const list = Array.isArray(prev) ? prev : weights;
        return list.map((w: any) => {
          const key = `${w.class_id ?? "null"}:${w.category}`;
          const newW = editWeights[key];
          return newW !== undefined ? { ...w, weight: Number(newW) } : w;
        });
      });
      setWeightsResetKey((k) => k + 1);
      // Leaderboard is already invalidated by the mutation's onSuccess
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
      // ใช้ qc.fetchQuery → ถ้ามีข้อมูลใน cache (และยัง fresh) จะ reuse ทันที
      const data = await qc.fetchQuery({
        queryKey: qk.members(guildFilter),
        queryFn: async () => {
          const { jsonFetch } = await import("@/hooks/api/fetcher");
          return jsonFetch<{ members?: unknown[] }>(`/api/admin/members?guild=${guildFilter}`);
        },
        staleTime: 2 * 60 * 1000,
      });
      const members: {
        discord_user_id: string;
        name: string;
        status: string;
        guild: number;
        class?: { id: number; name: string; icon_url?: string } | null;
      }[] = Array.isArray(data) ? (data as any) : ((data as any)?.members ?? []);

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

      // ⚡ lazy-load xlsx-js-style เฉพาะตอนกดดาวน์โหลด template
      const XLSXStyle = await import("xlsx-js-style");
      const ws = XLSXStyle.utils.aoa_to_sheet([headers, ...dataRows]);
      ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 4, 18) }));

      // Style header row: yellow fill, red bold text, centered
      const headerStyle = {
        fill: { patternType: "solid", fgColor: { rgb: "FFFF00" } }, // yellow
        font: { color: { rgb: "FF0000" }, bold: true },             // red bold
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border: {
          top: { style: "thin", color: { rgb: "999999" } },
          bottom: { style: "thin", color: { rgb: "999999" } },
          left: { style: "thin", color: { rgb: "999999" } },
          right: { style: "thin", color: { rgb: "999999" } },
        },
      };
      for (let col = 0; col < headers.length; col++) {
        const addr = XLSXStyle.utils.encode_cell({ r: 0, c: col });
        if (!ws[addr]) ws[addr] = { t: "s", v: headers[col] };
        ws[addr].s = headerStyle;
      }
      // Set header row height
      ws["!rows"] = [{ hpt: 24 }];

      const wb = XLSXStyle.utils.book_new();
      XLSXStyle.utils.book_append_sheet(wb, ws, "Member Potential");
      XLSXStyle.writeFile(wb, `member_potential_template_guild${guildFilter}.xlsx`);
    } catch (err: any) {
      showToast(`ดาวน์โหลด Template ไม่สำเร็จ: ${err?.message ?? "unknown"}`, false);
    }
  };

  // ---------- Sort + filter ----------
  // ⚡ useDeferredValue + useMemo — ลดการ recompute ทุก render
  //    พิมพ์ใน search box ไม่กระตุก, filter/sort รอ idle frame ค่อยรัน
  const deferredSearch = useDeferredValue(search);

  const filtered = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    return rows.filter((r) => {
      if (guildFilter !== null && r.guild !== guildFilter) return false;
      if (roleFilter !== null) {
        if (roleFilter === "dps" && r.role !== "dps") return false;
        if (roleFilter === "tank" && r.role !== "tank") return false;
        if (roleFilter === "healer" && r.role !== "healer") return false;
        if (roleFilter.startsWith("dps:") && !(r.role === "dps" && r.class_name === roleFilter.slice(4))) return false;
      }
      if (q && !r.discordname.toLowerCase().includes(q) && !r.userdiscordid.includes(q)) return false;
      return true;
    });
  }, [rows, guildFilter, roleFilter, deferredSearch]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      let va: number | string, vb: number | string;
      if (sortKey === "score") { va = a.score; vb = b.score; }
      else if (sortKey === "discordname") { va = a.discordname; vb = b.discordname; }
      else { va = a.avgs[sortKey as Category]; vb = b.avgs[sortKey as Category]; }
      if (typeof va === "string") return sortAsc ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
      return sortAsc ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
    return copy;
  }, [filtered, sortKey, sortAsc]);

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
          {(() => {
            const baseRows = guildFilter !== null ? rows.filter((x) => x.guild === guildFilter) : rows;

            // derive DPS classes
            const dpsClassMap = new Map<string, { class_name: string; class_icon: string; count: number }>();
            for (const r of baseRows) {
              if (r.role !== "dps") continue;
              const k = r.class_name;
              const e = dpsClassMap.get(k);
              if (e) e.count++; else dpsClassMap.set(k, { class_name: k, class_icon: r.class_icon, count: 1 });
            }
            const dpsClasses = Array.from(dpsClassMap.values()).sort((a, b) => b.count - a.count);

            // derive tank/healer class info
            const tankEntry   = baseRows.find((r) => r.role === "tank");
            const healerEntry = baseRows.find((r) => r.role === "healer");
            const tankCls   = tankEntry   ? { class_name: tankEntry.class_name,   class_icon: tankEntry.class_icon   } : { class_name: "ไอรอนแคลด", class_icon: "" };
            const healerCls = healerEntry ? { class_name: healerEntry.class_name, class_icon: healerEntry.class_icon } : { class_name: "ซิลฟ์",     class_icon: "" };

            const countFor = (f: string | null) => {
              if (f === null) return baseRows.length;
              if (f === "dps") return baseRows.filter((x) => x.role === "dps").length;
              if (f === "tank") return baseRows.filter((x) => x.role === "tank").length;
              if (f === "healer") return baseRows.filter((x) => x.role === "healer").length;
              if (f.startsWith("dps:")) return baseRows.filter((x) => x.role === "dps" && x.class_name === f.slice(4)).length;
              return 0;
            };

            const btnCls = (key: string | null) => `h-7 rounded-lg text-xs border transition flex items-center gap-1.5 px-2.5 ${
              roleFilter === key
                ? "bg-zinc-800 text-white border-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100"
                : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            }`;
            const countSpan = (key: string | null) => (
              <span className={`text-[11px] ${roleFilter === key ? "opacity-70" : "text-zinc-400"}`}>
                {countFor(key)}
              </span>
            );

            return (
              <div className="flex gap-1.5 flex-wrap items-center">
                <span className="text-xs text-zinc-400 mr-1">โหมด:</span>

                {/* ทุกโหมด */}
                <button onClick={() => setRoleFilter(null)} className={btnCls(null)}>
                  ทุกโหมด {countSpan(null)}
                </button>

                {/* DPS รวม */}
                <button onClick={() => setRoleFilter("dps")} className={btnCls("dps")}>
                  DPS {countSpan("dps")}
                </button>

                {/* แต่ละอาชีพ DPS */}
                {dpsClasses.map(({ class_name, class_icon }) => {
                  const key = `dps:${class_name}`;
                  return (
                    <button key={key} onClick={() => setRoleFilter(key)} className={btnCls(key)}>
                      {class_icon && <img src={class_icon} alt="" className="w-3.5 h-3.5 rounded-sm object-cover" loading="lazy" decoding="async" />}
                      {class_name} {countSpan(key)}
                    </button>
                  );
                })}

                {/* divider */}
                {dpsClasses.length > 0 && <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-700" />}

                {/* ไอรอนแคลด (tank) */}
                <button onClick={() => setRoleFilter("tank")} className={btnCls("tank")}>
                  {tankCls.class_icon && <img src={tankCls.class_icon} alt="" className="w-3.5 h-3.5 rounded-sm object-cover" loading="lazy" decoding="async" />}
                  {tankCls.class_name} {countSpan("tank")}
                </button>

                {/* ซิลฟ์ (healer) */}
                <button onClick={() => setRoleFilter("healer")} className={btnCls("healer")}>
                  {healerCls.class_icon && <img src={healerCls.class_icon} alt="" className="w-3.5 h-3.5 rounded-sm object-cover" loading="lazy" decoding="async" />}
                  {healerCls.class_name} {countSpan("healer")}
                </button>
              </div>
            );
          })()}

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
                          <img src={r.class_icon} alt="" className="inline w-4 h-4 rounded mr-1 align-middle" loading="lazy" decoding="async" />
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
        <div className="space-y-3">
          {/* Guild filter tabs */}
          <div className="flex flex-wrap gap-1.5">
            {([null, 1, 2, 3] as (number | null)[]).map((g) => (
              <button
                key={g ?? "all"}
                onClick={() => setBatchGuildFilter(g)}
                className={`h-8 px-3 rounded-xl text-xs font-semibold transition border ${
                  batchGuildFilter === g
                    ? "bg-red-600 text-white border-red-600 shadow-sm"
                    : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-red-400"
                }`}
              >
                {g === null ? "ทั้งหมด" : `Guild ${g}`}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">ชื่อ Batch</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">กิล</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">กิลที่เจอ</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">วันที่ Import</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-zinc-500">จำนวนคน</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {loadingBatches ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-zinc-400">กำลังโหลด...</td></tr>
                ) : batches.filter((b) => batchGuildFilter === null || b.guild === batchGuildFilter).length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-zinc-400">ยังไม่มี Batch</td></tr>
                ) : batches
                    .filter((b) => batchGuildFilter === null || b.guild === batchGuildFilter)
                    .map((b) => (
                  <tr key={b.id} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition">
                    <td className="px-4 py-3 font-medium text-zinc-800 dark:text-zinc-200">
                      {b.label || "-"}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">{b.guild ? `Guild ${b.guild}` : <span className="text-zinc-400">-</span>}</td>
                    <td className="px-4 py-3 text-xs text-amber-600 dark:text-amber-400">{b.opponent_guild || <span className="text-zinc-400">-</span>}</td>
                    <td className="px-4 py-3 text-xs text-zinc-500">{new Date(b.imported_at).toLocaleString("th-TH")}</td>
                    <td className="px-4 py-3 text-center text-xs text-zinc-600">{b.record_count} คน</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openViewBatch(b)}
                          className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:underline"
                        >👁️ ดู</button>
                        <button
                          onClick={() => openEditBatch(b)}
                          className="text-xs text-blue-500 hover:underline"
                        >✏️ แก้ไข</button>
                        <button
                          onClick={() => setDeletingBatch(b.id)}
                          className="text-xs text-red-500 hover:underline"
                        >ลบ</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== EDIT BATCH MODAL ===== */}
      {editingBatch && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setEditingBatch(null)}
        >
          <div
            className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-zinc-100 dark:border-zinc-800 px-5 py-4 flex items-center justify-between">
              <h3 className="font-bold text-zinc-900 dark:text-zinc-100">✏️ แก้ไข Batch</h3>
              <button
                onClick={() => setEditingBatch(null)}
                className="h-8 w-8 flex items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition text-sm"
              >✕</button>
            </div>
            <div className="px-5 py-4 space-y-4">
              {/* Label (date picker) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400">วันที่ war</label>
                <input
                  type="date"
                  value={editBatchLabel}
                  onChange={(e) => setEditBatchLabel(e.target.value)}
                  className="w-full h-10 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-red-400"
                />
              </div>
              {/* Opponent guild */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400">ชื่อกิลที่เจอ</label>
                <input
                  type="text"
                  placeholder="ชื่อกิลฝ่ายตรงข้าม..."
                  value={editBatchOpponent}
                  onChange={(e) => setEditBatchOpponent(e.target.value)}
                  className="w-full h-10 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-400"
                />
              </div>
              {/* Guild selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400">กิลของเรา</label>
                <div className="flex gap-2">
                  {([null, 1, 2, 3] as (number | null)[]).map((g) => (
                    <button
                      key={g ?? "none"}
                      onClick={() => setEditBatchGuild(g)}
                      className={`flex-1 h-9 rounded-xl text-xs font-semibold transition border ${
                        editBatchGuild === g
                          ? "bg-red-600 text-white border-red-600"
                          : "bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-red-400"
                      }`}
                    >
                      {g === null ? "-" : `Guild ${g}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="border-t border-zinc-100 dark:border-zinc-800 px-5 py-4 flex justify-end gap-2">
              <button
                onClick={() => setEditingBatch(null)}
                className="h-9 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
              >ยกเลิก</button>
              <button
                onClick={saveBatchEdit}
                disabled={savingBatch}
                className="h-9 px-5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-50 transition"
              >{savingBatch ? "กำลังบันทึก..." : "💾 บันทึก"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== VIEW BATCH DETAIL MODAL ===== */}
      {viewingBatch && (() => {
        // Derive class filter options from records (with counts)
        const bdClassCounts = new Map<string, number>();
        for (const r of viewingBatchRecords) {
          const k = (r.class_name ?? "").trim() || "-";
          bdClassCounts.set(k, (bdClassCounts.get(k) ?? 0) + 1);
        }
        const bdClassOptions = Array.from(bdClassCounts.entries())
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "th"));

        const bdClassIconMap = new Map<string, string | undefined>();
        for (const c of classes) bdClassIconMap.set(c.name, c.icon_url ?? undefined);

        const filteredRecs = viewingBatchRecords.filter((r) => {
          // class filter
          if (batchDetailClassFilter !== null) {
            const k = (r.class_name ?? "").trim() || "-";
            if (k !== batchDetailClassFilter) return false;
          }
          // search
          if (!batchDetailSearch) return true;
          const q = batchDetailSearch.toLowerCase();
          return (
            r.discordname.toLowerCase().includes(q) ||
            r.userdiscordid.includes(batchDetailSearch) ||
            (r.class_name ?? "").toLowerCase().includes(q)
          );
        });
        const sortedRecs = [...filteredRecs].sort((a, b) => {
          if (batchDetailSortKey === "default") {
            // Match Download Template order: class name → stripped discord name
            const ca = String(a.class_name ?? "").localeCompare(String(b.class_name ?? ""), "th");
            if (ca !== 0) return ca;
            return stripLeadingIcon(a.discordname ?? "").localeCompare(
              stripLeadingIcon(b.discordname ?? ""),
              "th"
            );
          }
          if (batchDetailSortKey === "discordname") {
            return batchDetailSortAsc
              ? a.discordname.localeCompare(b.discordname, "th")
              : b.discordname.localeCompare(a.discordname, "th");
          }
          if (batchDetailSortKey === "score") {
            return batchDetailSortAsc ? a.score - b.score : b.score - a.score;
          }
          const va = a[batchDetailSortKey as Category];
          const vb = b[batchDetailSortKey as Category];
          return batchDetailSortAsc ? va - vb : vb - va;
        });

        // totals (respect class filter so they represent what's shown)
        const totalsBaseRecs = batchDetailClassFilter === null
          ? viewingBatchRecords
          : viewingBatchRecords.filter((r) => ((r.class_name ?? "").trim() || "-") === batchDetailClassFilter);
        const totals = CATEGORIES.reduce((acc, c) => {
          acc[c] = totalsBaseRecs.reduce(
            (s, r) => s + (getRecValue(r.userdiscordid, r[c], c) || 0),
            0
          );
          return acc;
        }, {} as Record<Category, number>);
        const totalScore = totalsBaseRecs.reduce((s, r) => s + (r.score || 0), 0);

        const hasUnsavedChanges = Array.from(batchEdits.values()).some((edits) =>
          Object.keys(edits).length > 0
        );

        const safeClose = () => {
          setViewingBatch(null);
          setBatchEditMode(false);
          setBatchEdits(new Map());
        };

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={safeClose}
          >
            <div
              className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-6xl h-[92vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="shrink-0 border-b border-zinc-100 dark:border-zinc-800 px-6 py-4 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-zinc-900 dark:text-zinc-100 text-lg">
                      📦 {viewingBatch.label || "Batch"}
                    </span>
                    {viewingBatch.guild ? (
                      <span className="inline-flex items-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 px-2 py-0.5 text-[11px] font-semibold">
                        Guild {viewingBatch.guild}
                      </span>
                    ) : null}
                    {viewingBatch.opponent_guild ? (
                      <span className="inline-flex items-center gap-1 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 rounded-full px-2 py-0.5 text-[11px] font-semibold">
                        ⚔️ {viewingBatch.opponent_guild}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">
                    Import เมื่อ {new Date(viewingBatch.imported_at).toLocaleString("th-TH")} · {viewingBatch.record_count} คน
                  </div>
                </div>
                <button
                  onClick={safeClose}
                  className="h-8 w-8 flex items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition text-sm"
                >✕</button>
              </div>

              {/* Class filter pills */}
              {bdClassOptions.length > 0 && (
                <div className="shrink-0 border-b border-zinc-100 dark:border-zinc-800 px-6 py-3 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-zinc-400 mr-1">กรองอาชีพ:</span>
                  <button
                    type="button"
                    onClick={() => setBatchDetailClassFilter(null)}
                    className={`h-7 px-2.5 rounded-lg text-xs border transition flex items-center gap-1.5 ${
                      batchDetailClassFilter === null
                        ? "bg-zinc-800 text-white border-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100"
                        : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    }`}
                  >
                    ทั้งหมด
                    <span className={`text-[11px] ${batchDetailClassFilter === null ? "opacity-70" : "text-zinc-400"}`}>
                      {viewingBatchRecords.length}
                    </span>
                  </button>
                  {bdClassOptions.map(([name, count]) => {
                    const active = batchDetailClassFilter === name;
                    const icon = bdClassIconMap.get(name);
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => setBatchDetailClassFilter(name)}
                        className={`h-7 px-2.5 rounded-lg text-xs border transition flex items-center gap-1.5 ${
                          active
                            ? "bg-zinc-800 text-white border-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100"
                            : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                        }`}
                      >
                        {icon && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={icon} alt="" className="w-3.5 h-3.5 rounded-sm object-cover" loading="lazy" decoding="async" />
                        )}
                        {name || "-"}
                        <span className={`text-[11px] ${active ? "opacity-70" : "text-zinc-400"}`}>{count}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Search bar */}
              <div className="shrink-0 border-b border-zinc-100 dark:border-zinc-800 px-6 py-3 flex items-center gap-2">
                <input
                  value={batchDetailSearch}
                  onChange={(e) => setBatchDetailSearch(e.target.value)}
                  placeholder="ค้นหาชื่อ / อาชีพ..."
                  className="h-9 w-72 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-red-400"
                />
                <span className="text-xs text-zinc-500">
                  แสดง {sortedRecs.length} / {viewingBatchRecords.length} คน
                </span>
              </div>

              {/* Records table */}
              <div className="flex-1 overflow-auto">
                {loadingBatchDetail ? (
                  <div className="py-16 text-center text-sm text-zinc-400">กำลังโหลด...</div>
                ) : viewingBatchRecords.length === 0 ? (
                  <div className="py-16 text-center text-sm text-zinc-400">ไม่มีข้อมูลใน batch นี้</div>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="sticky top-0 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 z-10">
                        <th className="px-3 py-2.5 text-left font-semibold text-zinc-400 w-10">#</th>
                        <th
                          onClick={() => toggleBatchDetailSort("discordname")}
                          className="px-3 py-2.5 text-left font-semibold text-zinc-500 cursor-pointer whitespace-nowrap hover:text-zinc-800"
                        >
                          ชื่อ{batchDetailSortIcon("discordname")}
                        </th>
                        <th className="px-3 py-2.5 text-left font-semibold text-zinc-500 whitespace-nowrap">อาชีพ</th>
                        {CATEGORIES.map((c) => (
                          <th
                            key={c}
                            onClick={() => toggleBatchDetailSort(c)}
                            className={`px-3 py-2.5 text-right font-semibold cursor-pointer whitespace-nowrap hover:text-zinc-800 transition ${c === "death" ? "text-red-400" : "text-zinc-500"}`}
                          >
                            {CAT_LABELS[c]}{batchDetailSortIcon(c)}
                          </th>
                        ))}
                        <th
                          onClick={() => toggleBatchDetailSort("score")}
                          className="px-3 py-2.5 text-right font-semibold text-red-500 cursor-pointer whitespace-nowrap hover:text-red-600 transition border-l border-zinc-200 dark:border-zinc-700"
                        >
                          คะแนน{batchDetailSortIcon("score")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedRecs.map((r, i) => (
                        <tr
                          key={r.userdiscordid}
                          className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition"
                        >
                          <td className="px-3 py-2 text-zinc-400">{i + 1}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-zinc-800 dark:text-zinc-200 font-medium">
                            {r.discordname || <span className="text-zinc-400 italic">(ไม่มีชื่อ)</span>}
                          </td>
                          <td className="px-3 py-2 text-zinc-500 whitespace-nowrap">
                            {r.class_icon && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={r.class_icon} alt="" className="inline w-4 h-4 rounded mr-1 align-middle" loading="lazy" decoding="async" />
                            )}
                            {r.class_name || <span className="text-zinc-400">-</span>}
                          </td>
                          {CATEGORIES.map((c) => {
                            if (!batchEditMode) {
                              // view-only
                              return (
                                <td
                                  key={c}
                                  className={`px-3 py-2 text-right tabular-nums ${
                                    c === "death"
                                      ? r[c] > 0
                                        ? "text-red-500"
                                        : "text-zinc-300"
                                      : r[c] > 0
                                      ? "text-zinc-700 dark:text-zinc-300"
                                      : "text-zinc-300 dark:text-zinc-600"
                                  }`}
                                >
                                  {r[c].toLocaleString()}
                                </td>
                              );
                            }
                            const edits = batchEdits.get(r.userdiscordid);
                            const initialDraft = edits && c in edits ? (edits[c] as number) : undefined;
                            return (
                              <EditableStatCell
                                key={`${r.userdiscordid}-${c}`}
                                uid={r.userdiscordid}
                                cat={c}
                                original={r[c]}
                                initialDraft={initialDraft}
                                resetKey={editsResetKey}
                                onCommit={onCommitStat}
                              />
                            );
                          })}
                          <td className="px-3 py-2 text-right tabular-nums font-bold text-red-600 dark:text-red-400 border-l border-zinc-100 dark:border-zinc-800">
                            {fmtScore(r.score)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {viewingBatchRecords.length > 0 && (
                      <tfoot>
                        <tr className="bg-zinc-100 dark:bg-zinc-900 border-t-2 border-zinc-300 dark:border-zinc-700 font-semibold sticky bottom-8 z-10">
                          <td className="px-3 py-2.5 bg-zinc-100 dark:bg-zinc-900" colSpan={3}>
                            <span className="text-xs text-zinc-700 dark:text-zinc-200">
                              รวม{batchDetailClassFilter !== null ? ` (${batchDetailClassFilter})` : ""} ({totalsBaseRecs.length} คน)
                            </span>
                          </td>
                          {CATEGORIES.map((c) => (
                            <td
                              key={c}
                              className={`px-3 py-2.5 text-right tabular-nums bg-zinc-100 dark:bg-zinc-900 ${c === "death" ? "text-red-500" : "text-zinc-700 dark:text-zinc-200"}`}
                            >
                              {totals[c].toLocaleString()}
                            </td>
                          ))}
                          <td className="px-3 py-2.5 text-right tabular-nums text-red-600 dark:text-red-400 font-bold bg-zinc-100 dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-700">
                            {fmtScore(Math.round(totalScore * 10) / 10)}
                          </td>
                        </tr>
                        <tr className="bg-zinc-50 dark:bg-zinc-900/80 border-t border-zinc-200 dark:border-zinc-700 sticky bottom-0 z-10">
                          <td className="px-3 py-2 bg-zinc-50 dark:bg-zinc-900/80" colSpan={3}>
                            <span className="text-xs text-zinc-500">เฉลี่ย/คน</span>
                          </td>
                          {CATEGORIES.map((c) => {
                            const avg = totalsBaseRecs.length > 0
                              ? Math.round((totals[c] / totalsBaseRecs.length) * 10) / 10
                              : 0;
                            return (
                              <td
                                key={c}
                                className={`px-3 py-2 text-right tabular-nums text-xs bg-zinc-50 dark:bg-zinc-900/80 ${c === "death" ? "text-red-400" : "text-zinc-500"}`}
                              >
                                {fmtAvg(avg)}
                              </td>
                            );
                          })}
                          <td className="px-3 py-2 text-right tabular-nums text-xs text-red-500 font-semibold bg-zinc-50 dark:bg-zinc-900/80 border-l border-zinc-200 dark:border-zinc-700">
                            {totalsBaseRecs.length > 0
                              ? fmtScore(Math.round((totalScore / totalsBaseRecs.length) * 10) / 10)
                              : "0"}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                )}
              </div>

              {/* Footer */}
              <div className="shrink-0 border-t border-zinc-100 dark:border-zinc-800 px-6 py-3 flex items-center gap-2">
                {batchEditMode && hasUnsavedChanges && (
                  <span className="text-xs text-amber-600 dark:text-amber-400">
                    ✏️ Draft <span className="font-semibold">{batchEdits.size} คน</span> · ยังไม่ได้บันทึก
                  </span>
                )}
                {batchEditMode && !hasUnsavedChanges && (
                  <span className="text-xs text-zinc-500">
                    โหมดแก้ไข — คลิกที่ตัวเลขเพื่อพิมพ์แก้
                  </span>
                )}
                <div className="ml-auto flex gap-2">
                  {batchEditMode ? (
                    <>
                      <button
                        onClick={cancelBatchEdits}
                        disabled={savingBatchRecords}
                        className="h-9 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 transition"
                      >
                        ยกเลิก
                      </button>
                      <button
                        onClick={saveBatchEdits}
                        disabled={savingBatchRecords || !hasUnsavedChanges}
                        className="h-9 px-5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-50 transition"
                      >
                        {savingBatchRecords ? "กำลังบันทึก..." : "💾 บันทึก"}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setBatchEditMode(true)}
                        disabled={viewingBatchRecords.length === 0}
                        className="h-9 px-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 text-sm hover:bg-blue-100 dark:hover:bg-blue-950/60 disabled:opacity-50 transition"
                      >
                        ✏️ แก้ไข
                      </button>
                      <button
                        onClick={safeClose}
                        className="h-9 px-5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition"
                      >
                        ปิด
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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
              <button
                onClick={saveAllWeights}
                disabled={savingW}
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
                                  <img src={cls.icon_url} alt="" className="w-6 h-6 rounded-lg" loading="lazy" decoding="async" />
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
                            return (
                              <EditableWeightCell
                                key={class_id ?? "default"}
                                wKey={wKey}
                                cat={cat}
                                initialValue={Number(val)}
                                defaultValue={Number(defaultW)}
                                isDefaultCol={class_id == null}
                                isDeath={isDeath}
                                resetKey={weightsResetKey}
                                onCommit={onCommitWeight}
                              />
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

      {/* Import confirm modal — with preview */}
      {pendingImport && (() => {
        // Derive class filter options from records (with counts)
        const classCounts = new Map<string, number>();
        for (const r of pendingImport.records) {
          const k = (r.class_name ?? "").trim() || "-";
          classCounts.set(k, (classCounts.get(k) ?? 0) + 1);
        }
        const classOptions = Array.from(classCounts.entries())
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "th"));

        const baseFiltered = importClassFilter === null
          ? pendingImport.records
          : pendingImport.records.filter((r) => {
              const k = (r.class_name ?? "").trim() || "-";
              return k === importClassFilter;
            });

        // Sort ตาม importSortField/importSortDir (null = คงลำดับเดิม)
        const filteredRecords = importSortField === null
          ? baseFiltered
          : [...baseFiltered].sort((a, b) => {
              const dir = importSortDir === "asc" ? 1 : -1;
              if (importSortField === "name") {
                return (a.discordname ?? "").localeCompare(b.discordname ?? "", "th") * dir;
              }
              if (importSortField === "class") {
                return ((a.class_name ?? "").localeCompare(b.class_name ?? "", "th")) * dir;
              }
              // numeric categories
              const av = Number(a[importSortField]) || 0;
              const bv = Number(b[importSortField]) || 0;
              return (av - bv) * dir;
            });

        const classIconMap = new Map<string, string | undefined>();
        for (const c of classes) {
          classIconMap.set(c.name, c.icon_url ?? undefined);
        }

        // Helper: icon ↑/↓ ของ header ปัจจุบัน
        const sortIcon = (field: ImportSortField) => {
          if (importSortField !== field) return <span className="opacity-20 ml-0.5">↕</span>;
          return (
            <span className="text-red-500 ml-0.5">
              {importSortDir === "asc" ? "↑" : "↓"}
            </span>
          );
        };

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setPendingImport(null)}
          >
            <div
              className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-5xl h-[92vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="shrink-0 border-b border-zinc-100 dark:border-zinc-800 px-6 py-4 flex items-center justify-between">
                <div>
                  <div className="font-bold text-zinc-900 dark:text-zinc-100 text-lg">📥 ยืนยัน Import</div>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    ตรวจสอบข้อมูลก่อนนำเข้า — พบข้อมูลทั้งหมด <span className="font-semibold text-red-600 dark:text-red-400">{pendingImport.records.length}</span> คน
                    {guildFilter !== null && <span className="ml-2 text-zinc-400">· นำเข้าเข้า Guild {guildFilter}</span>}
                  </p>
                </div>
                <button
                  onClick={() => setPendingImport(null)}
                  className="h-8 w-8 flex items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition text-sm"
                >✕</button>
              </div>

              {/* Meta inputs */}
              <div className="shrink-0 border-b border-zinc-100 dark:border-zinc-800 px-6 py-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    วันที่ war
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
                    className="w-full h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-red-400"
                  />
                </div>
              </div>

              {/* Class filter pills */}
              {classOptions.length > 0 && (
                <div className="shrink-0 border-b border-zinc-100 dark:border-zinc-800 px-6 py-3 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-zinc-400 mr-1">กรองอาชีพ:</span>
                  <button
                    type="button"
                    onClick={() => setImportClassFilter(null)}
                    className={`h-7 px-2.5 rounded-lg text-xs border transition flex items-center gap-1.5 ${
                      importClassFilter === null
                        ? "bg-zinc-800 text-white border-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100"
                        : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    }`}
                  >
                    ทั้งหมด
                    <span className={`text-[11px] ${importClassFilter === null ? "opacity-70" : "text-zinc-400"}`}>
                      {pendingImport.records.length}
                    </span>
                  </button>
                  {classOptions.map(([name, count]) => {
                    const active = importClassFilter === name;
                    const icon = classIconMap.get(name);
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => setImportClassFilter(name)}
                        className={`h-7 px-2.5 rounded-lg text-xs border transition flex items-center gap-1.5 ${
                          active
                            ? "bg-zinc-800 text-white border-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100"
                            : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                        }`}
                      >
                        {icon && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={icon} alt="" className="w-3.5 h-3.5 rounded-sm object-cover" loading="lazy" decoding="async" />
                        )}
                        {name || "-"}
                        <span className={`text-[11px] ${active ? "opacity-70" : "text-zinc-400"}`}>{count}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Preview table */}
              <div className="flex-1 overflow-auto">
                <div className="px-6 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 sticky top-0 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 z-10 flex items-center justify-between">
                  <span>👁️ Preview ข้อมูลที่จะนำเข้า</span>
                  <span className="font-normal text-zinc-400">
                    แสดง {filteredRecords.length} / {pendingImport.records.length} คน
                  </span>
                </div>
                <div className="px-6 pb-4">
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-200 dark:border-zinc-800">
                          <th className="px-2 py-2 text-left font-semibold text-zinc-400 w-10">#</th>
                          <th
                            onClick={() => toggleImportSort("name")}
                            className={`px-2 py-2 text-left font-semibold whitespace-nowrap cursor-pointer select-none hover:bg-zinc-100 dark:hover:bg-zinc-800 transition ${
                              importSortField === "name" ? "text-red-500" : "text-zinc-500"
                            }`}
                          >
                            ชื่อ{sortIcon("name")}
                          </th>
                          <th
                            onClick={() => toggleImportSort("class")}
                            className={`px-2 py-2 text-left font-semibold whitespace-nowrap cursor-pointer select-none hover:bg-zinc-100 dark:hover:bg-zinc-800 transition ${
                              importSortField === "class" ? "text-red-500" : "text-zinc-500"
                            }`}
                          >
                            อาชีพ{sortIcon("class")}
                          </th>
                          {CATEGORIES.map((c) => {
                            const isActive = importSortField === c;
                            return (
                              <th
                                key={c}
                                onClick={() => toggleImportSort(c)}
                                className={`px-2 py-2 text-right font-semibold whitespace-nowrap cursor-pointer select-none hover:bg-zinc-100 dark:hover:bg-zinc-800 transition ${
                                  isActive
                                    ? "text-red-500"
                                    : c === "death"
                                    ? "text-red-400"
                                    : "text-zinc-500"
                                }`}
                              >
                                {CAT_LABELS[c]}{sortIcon(c)}
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRecords.length === 0 ? (
                          <tr>
                            <td colSpan={CATEGORIES.length + 3} className="px-3 py-6 text-center text-zinc-400 text-xs">
                              ไม่มีข้อมูลตาม filter ที่เลือก
                            </td>
                          </tr>
                        ) : filteredRecords.map((r, i) => {
                          const icon = classIconMap.get(r.class_name);
                          return (
                            <tr
                              key={`${r.userdiscordid}-${i}`}
                              className="border-b border-zinc-100 dark:border-zinc-800/70 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition"
                            >
                              <td className="px-2 py-1.5 text-zinc-400">{i + 1}</td>
                              <td className="px-2 py-1.5 text-zinc-800 dark:text-zinc-200 whitespace-nowrap">
                                {r.discordname || <span className="text-zinc-400 italic">(ไม่มีชื่อ)</span>}
                              </td>
                              <td className="px-2 py-1.5 text-zinc-500 whitespace-nowrap">
                                {icon && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={icon} alt="" className="inline w-3.5 h-3.5 rounded mr-1 align-middle" loading="lazy" decoding="async" />
                                )}
                                {r.class_name || <span className="text-zinc-400">-</span>}
                              </td>
                              {CATEGORIES.map((c) => (
                                <td
                                  key={c}
                                  className={`px-2 py-1.5 text-right tabular-nums ${
                                    c === "death"
                                      ? Number(r[c]) > 0
                                        ? "text-red-500"
                                        : "text-zinc-300"
                                      : Number(r[c]) > 0
                                      ? "text-zinc-700 dark:text-zinc-300"
                                      : "text-zinc-300 dark:text-zinc-600"
                                  }`}
                                >
                                  {Number(r[c]).toLocaleString()}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                      {/* Totals row */}
                      {filteredRecords.length > 0 && (
                        <tfoot>
                          <tr className="bg-zinc-50 dark:bg-zinc-900/60 border-t-2 border-zinc-200 dark:border-zinc-700 font-semibold">
                            <td className="px-2 py-2" colSpan={3}>
                              <span className="text-xs text-zinc-600 dark:text-zinc-300">
                                รวม{importClassFilter !== null ? ` (${importClassFilter})` : "ทั้งหมด"}
                              </span>
                            </td>
                            {CATEGORIES.map((c) => {
                              const total = filteredRecords.reduce((s, r) => s + (Number(r[c]) || 0), 0);
                              return (
                                <td
                                  key={c}
                                  className={`px-2 py-2 text-right tabular-nums ${c === "death" ? "text-red-500" : "text-zinc-700 dark:text-zinc-200"}`}
                                >
                                  {total.toLocaleString()}
                                </td>
                              );
                            })}
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              </div>

              {/* Footer actions */}
              <div className="shrink-0 border-t border-zinc-100 dark:border-zinc-800 px-6 py-4 flex items-center gap-2">
                <span className="text-xs text-zinc-400">
                  ตรวจสอบข้อมูลให้ถูกต้องก่อนกด Import (จะ import ทั้งหมด {pendingImport.records.length} คน ไม่ว่าเลือก filter อะไร)
                </span>
                <div className="ml-auto flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPendingImport(null)}
                    className="h-10 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmImport}
                    disabled={importing}
                    className="h-10 px-6 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium disabled:opacity-50 transition"
                  >
                    {importing ? "กำลัง Import..." : `✓ ยืนยัน Import ${pendingImport.records.length} คน`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
