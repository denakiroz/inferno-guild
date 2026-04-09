"use client";

import React, { useEffect, useRef, useState } from "react";
import { TrendingUp, TrendingDown, Minus, BarChart2, Trophy } from "lucide-react";

const CATEGORIES = [
  "kill", "assist", "supply", "damage_player",
  "damage_fort", "heal", "damage_taken", "death", "revive",
] as const;
type Category = (typeof CATEGORIES)[number];

const CAT_LABELS: Record<Category, string> = {
  kill: "ฆ่า", assist: "ช่วย", supply: "เสบียง",
  damage_player: "ดาเมจคน", damage_fort: "ดาเมจป้อม",
  heal: "ฮีล", damage_taken: "รับดาเมจ", death: "ตาย", revive: "ชุบ",
};

type BatchData = {
  label: string;
  imported_at: string;
  avgs: Record<Category, number>;
  rawScore: number;
  scoreDps: number;
  scoreTank: number;
  scoreHealer: number;
};

type Props = {
  myDiscordId?: string | null;
  myGuild?: number | null;
};

type RankedRow = {
  rank: number;
  userdiscordid: string;
  name: string;
  class_name: string;
  class_icon: string;
  guild: number | null;
  score: number;
};

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
const MEDAL_TEXT: Record<number, string> = {
  1: "text-amber-500",
  2: "text-zinc-400",
  3: "text-orange-400",
};

function fmtDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function fmtNum(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return n % 1 === 0 ? String(Math.round(n)) : n.toFixed(1);
}

// ── Area + Bar + Line combo chart ─────────────────────────────────
function ComboChart({
  batches,
  animated,
  selectedIdx,
  onSelect,
}: {
  batches: BatchData[];
  animated: boolean;
  selectedIdx: number | null;
  onSelect: (i: number | null) => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const W = 300;
  const H = 160;
  const PAD_L = 12;
  const PAD_R = 12;
  const PAD_T = 36;  // ให้ score labels อยู่ใน viewBox สบายๆ
  const PAD_B = 28;  // ให้ date labels อยู่ใน viewBox สบายๆ
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const count = batches.length;
  const maxScore = Math.max(...batches.map((b) => b.rawScore), 1);

  // x/y helpers
  const cx = (i: number) => PAD_L + (i / (count - 1 || 1)) * innerW;
  const cy = (score: number) => PAD_T + innerH - (score / maxScore) * innerH;

  // Build smooth path (catmull-rom → bezier)
  function smoothPath(pts: Array<[number, number]>) {
    if (pts.length === 0) return "";
    if (pts.length === 1) return `M ${pts[0][0]} ${pts[0][1]}`;
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      const mx = (x0 + x1) / 2;
      d += ` C ${mx} ${y0}, ${mx} ${y1}, ${x1} ${y1}`;
    }
    return d;
  }

  const pts = batches.map((b, i): [number, number] => [cx(i), cy(b.rawScore)]);
  const linePath = smoothPath(pts);

  // Area = line path + down to baseline + back
  const first = pts[0];
  const last  = pts[pts.length - 1];
  const areaPath = linePath
    + ` L ${last[0]} ${PAD_T + innerH}`
    + ` L ${first[0]} ${PAD_T + innerH}`
    + " Z";

  // Bar width
  const barW = Math.min(36, innerW / count - 12);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ display: "block" }}
    >
      <defs>
        {/* Line gradient */}
        <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#f97316" />
          <stop offset="100%" stopColor="#ef4444" />
        </linearGradient>

        {/* Area gradient (vertical) */}
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#ef4444" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0.01" />
        </linearGradient>

        {/* Bar gradient */}
        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#ef4444" />
          <stop offset="100%" stopColor="#f97316" />
        </linearGradient>
        <linearGradient id="barGradDim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#fca5a5" />
          <stop offset="100%" stopColor="#fed7aa" />
        </linearGradient>
        <linearGradient id="barGradHover" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#dc2626" />
          <stop offset="100%" stopColor="#ea580c" />
        </linearGradient>

        {/* Glow */}
        <filter id="dotGlow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Horizontal grid lines (3 levels) */}
      {[0.25, 0.5, 0.75].map((t) => {
        const y = PAD_T + innerH * (1 - t);
        return (
          <line key={t}
            x1={PAD_L} y1={y} x2={W - PAD_R} y2={y}
            stroke="#f4f4f5" strokeWidth={1}
            className="dark:stroke-zinc-800"
          />
        );
      })}

      {/* Area fill */}
      <path d={areaPath} fill="url(#areaGrad)" />

      {/* Bars */}
      {batches.map((b, i) => {
        const x = cx(i);
        const barH = animated ? (b.rawScore / maxScore) * innerH : 0;
        const isHov     = hovered === i;
        const isSel     = selectedIdx === i;
        const hasSelect = selectedIdx !== null;
        // default: ทุกแท่งเข้มเท่ากัน (barGrad) / เลือกแล้ว: เฉพาะที่เลือกสว่าง
        const fill = isHov || isSel
          ? "url(#barGradHover)"
          : "url(#barGrad)";
        const baseY = PAD_T + innerH;

        return (
          <g key={i}>
            {/* Clickable hit area (wider than bar) */}
            <rect
              x={x - barW / 2 - 6}
              y={PAD_T}
              width={barW + 12}
              height={innerH}
              fill="transparent"
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onSelect(isSel ? null : i)}
            />
            <rect
              x={x - barW / 2}
              y={baseY - barH}
              width={barW}
              height={barH}
              rx={6} ry={6}
              fill={fill}
              opacity={isSel || isHov ? 1 : hasSelect ? 0.25 : 1}
              style={{
                transition: `height 0.55s cubic-bezier(0.34,1.4,0.64,1) ${i * 0.12}s,
                             y      0.55s cubic-bezier(0.34,1.4,0.64,1) ${i * 0.12}s,
                             opacity 0.25s`,
                cursor: "pointer",
                pointerEvents: "none",
              }}
            />
            {/* Selected ring */}
            {isSel && (
              <rect
                x={x - barW / 2 - 2}
                y={baseY - barH - 2}
                width={barW + 4}
                height={barH + 4}
                rx={8} ry={8}
                fill="none"
                stroke="#ef4444"
                strokeWidth={2}
                strokeDasharray="4 2"
                opacity={0.8}
                style={{ pointerEvents: "none" }}
              />
            )}
          </g>
        );
      })}

      {/* Area line */}
      <path
        d={linePath}
        fill="none"
        stroke="url(#lineGrad)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Dots */}
      {pts.map(([x, y], i) => {
        const isHov     = hovered === i;
        const isSel     = selectedIdx === i;
        const hasSelect = selectedIdx !== null;
        const active    = isHov || isSel;
        return (
          <g key={i} filter={active ? "url(#dotGlow)" : undefined}
             style={{ cursor: "pointer" }}
             onMouseEnter={() => setHovered(i)}
             onMouseLeave={() => setHovered(null)}
             onClick={() => onSelect(isSel ? null : i)}
          >
            <circle cx={x} cy={y} r={active ? 6 : 4}
              fill={active ? "#ef4444" : "#f97316"}
              stroke="white" strokeWidth={2}
              opacity={hasSelect && !isSel ? 0.25 : 1}
              style={{ transition: "r 0.15s, opacity 0.25s" }}
            />
          </g>
        );
      })}

      {/* Hover tooltip */}
      {hovered !== null && (() => {
        const b = batches[hovered];
        const [tx, ty] = pts[hovered];
        const boxW = 72;
        const boxH = 28;
        const bx = Math.min(Math.max(tx - boxW / 2, PAD_L), W - PAD_R - boxW);
        const by = ty - boxH - 10;
        return (
          <g>
            <rect x={bx} y={by} width={boxW} height={boxH} rx={6} ry={6}
              fill="#18181b" opacity={0.92} />
            <text x={bx + boxW / 2} y={by + 11} textAnchor="middle"
              fontSize={9} fill="#a1a1aa" fontWeight={500}>
              {b.label || fmtDate(b.imported_at)}
            </text>
            <text x={bx + boxW / 2} y={by + 22} textAnchor="middle"
              fontSize={11} fill="white" fontWeight={700}>
              {fmtNum(b.rawScore)}
            </text>
          </g>
        );
      })()}

      {/* Score labels above bars (when not hovered) */}
      {hovered === null && batches.map((b, i) => {
        const [x] = pts[i];
        const isLast    = i === count - 1;
        const isSel     = selectedIdx === i;
        const hasSelect = selectedIdx !== null;
        // default: ทุก label เท่ากัน (สุดท้ายใหญ่กว่าหน่อย) / เลือกแล้ว: highlight เฉพาะที่เลือก
        const active = hasSelect ? isSel : isLast;
        return (
          <text key={i}
            x={x} y={PAD_T - 10}
            textAnchor="middle"
            fontSize={active ? 11 : 9.5}
            fontWeight={active ? 700 : 500}
            fill={active ? "#ef4444" : "#6b7280"}
            opacity={hasSelect && !isSel ? 0.3 : 1}
          >
            {b.rawScore > 0 ? fmtNum(b.rawScore) : "—"}
          </text>
        );
      })}

      {/* Date labels */}
      {batches.map((b, i) => {
        const [x] = pts[i];
        return (
          <text key={i}
            x={x} y={H - 8}
            textAnchor="middle"
            fontSize={9}
            fill="#9ca3af"
          >
            {fmtDate(b.imported_at) || `#${i + 1}`}
          </text>
        );
      })}
    </svg>
  );
}

// ── Stat mini-bar row ──────────────────────────────────────────────
function StatMiniBar({
  label,
  values,
  selectedIdx,
}: {
  label: string;
  values: number[];
  selectedIdx: number | null;
}) {
  const max = Math.max(...values, 1);
  const hasSelect = selectedIdx !== null;

  // default → เฉลี่ยทั้งหมด / เลือก batch → ค่าของ batch นั้น
  const avgVal     = values.reduce((s, v) => s + v, 0) / (values.length || 1);
  const displayVal = hasSelect ? (values[selectedIdx] ?? 0) : avgVal;

  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-[11px] text-zinc-500 dark:text-zinc-400 truncate">{label}</span>
      <div className="flex-1 flex items-end gap-0.5 h-4">
        {values.map((v, i) => {
          const h        = Math.max(2, (v / max) * 16);
          const isActive = hasSelect ? i === selectedIdx : true; // default ทุกแถบเข้ม
          return (
            <div
              key={i}
              title={fmtNum(v)}
              className="flex-1 rounded-sm"
              style={{
                height: h,
                background: isActive
                  ? "linear-gradient(to top, #f97316, #ef4444)"
                  : "#e4e4e7",
                opacity: hasSelect && !isActive ? 0.25 : 1,
                transition: "height 0.4s ease, opacity 0.25s",
              }}
            />
          );
        })}
      </div>
      <span className={[
        "w-10 shrink-0 text-right text-[11px] font-semibold tabular-nums",
        hasSelect ? "text-red-600 dark:text-red-400" : "text-zinc-700 dark:text-zinc-300",
      ].join(" ")}>
        {fmtNum(displayVal)}
      </span>
    </div>
  );
}

// ── Main widget ────────────────────────────────────────────────────
export function PotentialLeaderboardWidget({ myDiscordId, myGuild }: Props) {
  const [batches, setBatches] = useState<BatchData[]>([]);
  const [classId, setClassId] = useState<number | null>(null);
  const [lbItems, setLbItems] = useState<RankedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleTab, setRoleTab] = useState<"dps" | "tank" | "healer">("dps");
  const [animated, setAnimated] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/member-potential/my-stats", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/member-potential/leaderboard", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([stats, lb]) => {
        if (stats.ok && Array.isArray(stats.batches) && stats.batches.length > 0) {
          setBatches(stats.batches);
        }
        if (stats.ok && stats.class_id != null) {
          const cid = Number(stats.class_id);
          setClassId(cid);
          setRoleTab(cid === 1 ? "tank" : cid === 5 ? "healer" : "dps");
        }
        if (lb.ok && Array.isArray(lb.items)) {
          // กรองเฉพาะ guild เดียวกัน แล้ว re-rank
          const filtered: RankedRow[] = myGuild
            ? lb.items
                .filter((r: RankedRow) => r.guild === myGuild)
                .map((r: RankedRow, i: number) => ({ ...r, rank: i + 1 }))
            : lb.items.map((r: RankedRow, i: number) => ({ ...r, rank: i + 1 }));
          setLbItems(filtered);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [myGuild]);

  // Mock data when no real data
  const MOCK: BatchData[] = [
    { label: "ตัวอย่าง 1", imported_at: "2025-01-11", avgs: { kill:15, assist:180, supply:1200, damage_player:2000, damage_fort:1500, heal:200, damage_taken:300, death:8, revive:6 }, rawScore:3200, scoreDps:3200, scoreTank:2800, scoreHealer:2400 },
    { label: "ตัวอย่าง 2", imported_at: "2025-01-18", avgs: { kill:22, assist:210, supply:1800, damage_player:2800, damage_fort:2100, heal:280, damage_taken:420, death:6, revive:9 }, rawScore:5100, scoreDps:5100, scoreTank:4600, scoreHealer:4200 },
    { label: "ตัวอย่าง 3", imported_at: "2025-01-25", avgs: { kill:30, assist:270, supply:2400, damage_player:3500, damage_fort:2800, heal:350, damage_taken:510, death:5, revive:12 }, rawScore:7400, scoreDps:7400, scoreTank:6800, scoreHealer:6100 },
  ];

  const isMock = !loading && batches.length === 0;
  const displayBatches = isMock ? MOCK : batches;

  useEffect(() => {
    if (displayBatches.length > 0) {
      timerRef.current = setTimeout(() => setAnimated(true), 100);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [isMock, batches.length]);

  if (loading) return null;

  // chart ใช้ score ตาม role ที่เลือก
  const scoredBatches = displayBatches.map((b) => ({
    ...b,
    rawScore: roleTab === "tank" ? b.scoreTank : roleTab === "healer" ? b.scoreHealer : b.scoreDps,
  }));

  const latest = scoredBatches[scoredBatches.length - 1]!;
  const prev   = scoredBatches[scoredBatches.length - 2];

  // คะแนนรวมที่แสดงใน header: เฉลี่ยทั้งหมด (default) หรือ batch ที่เลือก
  const avgScore     = scoredBatches.reduce((s, b) => s + b.rawScore, 0) / (scoredBatches.length || 1);
  const displayScore = selectedIdx !== null ? (scoredBatches[selectedIdx]?.rawScore ?? 0) : avgScore;

  // trend: เลือก batch → เทียบกับ batch ก่อนหน้า / default → batch ล่าสุด vs ก่อนหน้า
  const trendCur  = selectedIdx !== null ? scoredBatches[selectedIdx]?.rawScore ?? 0 : latest.rawScore;
  const trendBase = selectedIdx !== null
    ? (scoredBatches[selectedIdx - 1]?.rawScore ?? null)
    : (prev?.rawScore ?? null);

  const trend = trendBase !== null
    ? trendCur > trendBase * 1.01 ? "up"
    : trendCur < trendBase * 0.99 ? "down"
    : "flat"
    : null;
  const trendDelta = trendBase !== null ? trendCur - trendBase : 0;

  // stat bars คงที่ (ไม่เปลี่ยนตาม role)
  const topCats: Category[] = ["kill", "assist", "supply", "damage_player", "damage_fort", "heal", "damage_taken", "death", "revive"];

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">

      {/* ── Header ── */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center gap-2 mb-0.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 dark:bg-red-950/40">
            <BarChart2 className="h-3.5 w-3.5 text-red-500" />
          </div>
          <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">สถิติของฉัน</span>
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            {isMock
              ? "ตัวอย่าง"
              : selectedIdx !== null
              ? displayBatches[selectedIdx]?.label || fmtDate(displayBatches[selectedIdx]?.imported_at ?? "")
              : `เฉลี่ย ${displayBatches.length} batch`}
          </span>

          {trend && (
            <div className="ml-auto">
              {trend === "up" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                  <TrendingUp className="h-3 w-3" />+{fmtNum(trendDelta)}
                </span>
              )}
              {trend === "down" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 dark:bg-red-950/40 px-2.5 py-1 text-[11px] font-bold text-red-500 dark:text-red-400">
                  <TrendingDown className="h-3 w-3" />{fmtNum(trendDelta)}
                </span>
              )}
              {trend === "flat" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 text-[11px] font-semibold text-zinc-500">
                  <Minus className="h-3 w-3" />เท่าเดิม
                </span>
              )}
            </div>
          )}
        </div>

        {/* คะแนนรวม */}
        <div className="flex items-baseline gap-2 pl-9">
          <span className="text-2xl font-black tabular-nums text-red-600 dark:text-red-400">
            {fmtNum(displayScore)}
          </span>
          <span className="text-xs text-zinc-400 dark:text-zinc-500">คะแนน</span>
        </div>
      </div>

      {/* ── Role tab selector ── */}
      <div className="flex items-center gap-1.5 px-4 pb-3">
        {([
          { key: "dps",    label: "DPS" },
          { key: "tank",   label: "หมัด" },
          { key: "healer", label: "พระ" },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setRoleTab(key)}
            className={[
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all border",
              roleTab === key
                ? "bg-red-600 text-white border-red-600 shadow-sm"
                : "bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-red-300 hover:text-red-500",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Top 3 Leaderboard ── */}
      {lbItems.length > 0 && (
        <div className="px-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-1.5 mb-2">
            <Trophy className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Top 3 · {myGuild ? `Inferno-${myGuild}` : "ทั้งหมด"}
            </span>
          </div>
          <div className="space-y-1.5">
            {lbItems.slice(0, 3).map((row) => {
              const isMe = row.userdiscordid === myDiscordId;
              const maxScore = lbItems[0]?.score ?? 1;
              const pct = maxScore > 0 ? (row.score / maxScore) * 100 : 0;
              return (
                <div
                  key={row.userdiscordid}
                  className={[
                    "flex items-center gap-2.5 rounded-xl px-3 py-2 transition-colors",
                    isMe
                      ? "bg-red-50 dark:bg-red-950/20 ring-1 ring-red-200 dark:ring-red-900/40"
                      : "bg-zinc-50 dark:bg-zinc-800/50",
                  ].join(" ")}
                >
                  {/* Medal */}
                  <span className="w-5 text-center text-base leading-none shrink-0 select-none">
                    {MEDAL[row.rank] ?? `#${row.rank}`}
                  </span>

                  {/* Class icon */}
                  {row.class_icon ? (
                    <img src={row.class_icon} alt={row.class_name}
                      className="h-6 w-6 rounded-md object-cover shrink-0 ring-1 ring-zinc-200 dark:ring-zinc-700" />
                  ) : (
                    <div className="h-6 w-6 rounded-md bg-zinc-200 dark:bg-zinc-700 shrink-0" />
                  )}

                  {/* Name + bar */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                        {row.name}
                      </span>
                      {isMe && (
                        <span className="shrink-0 rounded-full bg-red-100 dark:bg-red-900/40 px-1.5 py-px text-[9px] font-bold text-red-600 dark:text-red-300">
                          ฉัน
                        </span>
                      )}
                    </div>
                    <div className="h-1 w-full rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                      <div
                        className={`h-1 rounded-full ${isMe ? "bg-red-500" : "bg-gradient-to-r from-orange-400 to-red-500"}`}
                        style={{ width: `${pct.toFixed(1)}%` }}
                      />
                    </div>
                  </div>

                  {/* Score */}
                  <span className={`text-xs font-bold tabular-nums shrink-0 ${isMe ? "text-red-600 dark:text-red-400" : MEDAL_TEXT[row.rank] ?? "text-zinc-500"}`}>
                    {row.score.toFixed(1)}
                  </span>
                </div>
              );
            })}

            {/* My rank if outside top 3 */}
            {(() => {
              const myIdx = lbItems.findIndex((r) => r.userdiscordid === myDiscordId);
              if (myIdx < 3 || myIdx === -1) return null;
              const myRow = lbItems[myIdx];
              const maxScore = lbItems[0]?.score ?? 1;
              const pct = maxScore > 0 ? (myRow.score / maxScore) * 100 : 0;
              return (
                <>
                  <div className="flex items-center gap-1 py-0.5">
                    <div className="flex-1 border-t border-dashed border-zinc-200 dark:border-zinc-700" />
                    <span className="text-[10px] text-zinc-400 px-1">อันดับของฉัน</span>
                    <div className="flex-1 border-t border-dashed border-zinc-200 dark:border-zinc-700" />
                  </div>
                  <div className="flex items-center gap-2.5 rounded-xl px-3 py-2 bg-red-50 dark:bg-red-950/20 ring-1 ring-red-200 dark:ring-red-900/40">
                    <span className="w-5 text-center text-xs font-bold text-zinc-500 shrink-0">#{myRow.rank}</span>
                    {myRow.class_icon ? (
                      <img src={myRow.class_icon} alt={myRow.class_name}
                        className="h-6 w-6 rounded-md object-cover shrink-0 ring-1 ring-zinc-200 dark:ring-zinc-700" />
                    ) : (
                      <div className="h-6 w-6 rounded-md bg-zinc-200 dark:bg-zinc-700 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">{myRow.name}</span>
                        <span className="shrink-0 rounded-full bg-red-100 dark:bg-red-900/40 px-1.5 py-px text-[9px] font-bold text-red-600 dark:text-red-300">ฉัน</span>
                      </div>
                      <div className="h-1 w-full rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                        <div className="h-1 rounded-full bg-red-500" style={{ width: `${pct.toFixed(1)}%` }} />
                      </div>
                    </div>
                    <span className="text-xs font-bold tabular-nums text-red-600 dark:text-red-400 shrink-0">
                      {myRow.score.toFixed(1)}
                    </span>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Mock banner */}
      {isMock && (
        <div className="mx-4 mb-1 rounded-lg bg-amber-50 dark:bg-amber-950/30 px-3 py-1.5 text-[11px] text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-900/40">
          ยังไม่มีข้อมูล — Import batch แล้วจะแสดงข้อมูลจริง
        </div>
      )}

      {/* ── Chart ── */}
      <div className="px-3 pb-1 overflow-hidden">
        <ComboChart
          batches={scoredBatches}
          animated={animated}
          selectedIdx={selectedIdx}
          onSelect={setSelectedIdx}
        />
      </div>

      {/* ── Stat bars ── */}
      <div className="mx-4 mb-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 px-3 py-3 space-y-2">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            {selectedIdx !== null
              ? `สถิติ · ${displayBatches[selectedIdx]?.label || fmtDate(displayBatches[selectedIdx]?.imported_at ?? "")}`
              : `เฉลี่ย ${displayBatches.length} batch`}
          </div>
          {selectedIdx !== null && (
            <button
              type="button"
              onClick={() => setSelectedIdx(null)}
              className="text-[10px] text-zinc-400 hover:text-red-500 transition-colors"
            >
              ✕ ล้าง
            </button>
          )}
        </div>

        {topCats.map((cat) => (
          <StatMiniBar
            key={cat}
            label={CAT_LABELS[cat]}
            values={displayBatches.map((b) => b.avgs[cat] ?? 0)}
            selectedIdx={selectedIdx}
          />
        ))}
      </div>
    </div>
  );
}
