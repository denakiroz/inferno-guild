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
  opponent_guild?: string | null;
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

type Role = "dps" | "tank" | "healer";

type RankedRow = {
  rank: number;
  userdiscordid: string;
  name: string;
  class_name: string;
  class_icon: string;
  guild: number | null;
  score: number;
  role: Role;
  avgs?: Record<Category, number>;
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

// Label format: "<date> <opponent_guild>" ทุก batch
// ถ้าไม่มี opponent_guild → fallback เป็น #N เมื่อ base ซ้ำกัน (กันกรณีวันเดียวกันไม่ได้กรอกกิล)
function buildBatchLabels(
  batches: Array<{ label?: string; imported_at: string; opponent_guild?: string | null }>
): {
  short: string[];
  full: string[];
} {
  const shortBase = batches.map((b) => fmtDate(b.imported_at) || "—");
  const fullBase  = batches.map((b) => b.label || fmtDate(b.imported_at) || "—");
  const suffixes  = batches.map((b) => b.opponent_guild?.trim() || null);

  // ถ้าไม่มีชื่อกิล + base ซ้ำ ให้ใส่ #N fallback
  const shortCounts = new Map<string, number>();
  for (const s of shortBase) shortCounts.set(s, (shortCounts.get(s) ?? 0) + 1);
  const fullCounts = new Map<string, number>();
  for (const s of fullBase) fullCounts.set(s, (fullCounts.get(s) ?? 0) + 1);

  const shortSeen = new Map<string, number>();
  const fullSeen  = new Map<string, number>();

  const short = shortBase.map((s, i) => {
    const suffix = suffixes[i];
    if (suffix) return `${s} ${suffix}`;
    if ((shortCounts.get(s) ?? 0) > 1) {
      const idx = (shortSeen.get(s) ?? 0) + 1;
      shortSeen.set(s, idx);
      return `${s} #${idx}`;
    }
    return s;
  });
  const full = fullBase.map((s, i) => {
    const suffix = suffixes[i];
    if (suffix) return `${s} ${suffix}`;
    if ((fullCounts.get(s) ?? 0) > 1) {
      const idx = (fullSeen.get(s) ?? 0) + 1;
      fullSeen.set(s, idx);
      return `${s} #${idx}`;
    }
    return s;
  });

  return { short, full };
}

// ── Area + Bar + Line combo chart ─────────────────────────────────
function ComboChart({
  batches,
  animated,
  selectedIdx,
  onSelect,
  dateLabels,
  guildLabels,
  fullLabels,
}: {
  batches: BatchData[];
  animated: boolean;
  selectedIdx: number | null;
  onSelect: (i: number | null) => void;
  dateLabels: string[];
  guildLabels: string[];
  fullLabels: string[];
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const W = 300;
  const H = 172;
  const PAD_L = 16;
  const PAD_R = 16;
  const PAD_T = 32;  // ให้ score labels อยู่ใน viewBox สบายๆ
  const PAD_B = 42;  // 2 บรรทัด (date + guild)
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const count = batches.length;
  const maxScore = Math.max(...batches.map((b) => b.rawScore), 1);

  // x/y helpers
  const cx = (i: number) => PAD_L + (i / (count - 1 || 1)) * innerW;
  const cy = (score: number) => PAD_T + innerH - (score / maxScore) * innerH;

  // Edge anchor: label ตัวซ้ายสุด/ขวาสุด ไม่ให้ตัดขอบ
  const anchorAt = (i: number): "start" | "end" | "middle" => {
    if (i === 0) return "start";
    if (i === count - 1) return "end";
    return "middle";
  };
  const labelXAt = (i: number): number => {
    if (i === 0) return PAD_L;
    if (i === count - 1) return W - PAD_R;
    return cx(i);
  };

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
        const boxW = 84;
        const boxH = 28;
        const bx = Math.min(Math.max(tx - boxW / 2, PAD_L), W - PAD_R - boxW);
        const by = ty - boxH - 10;
        return (
          <g>
            <rect x={bx} y={by} width={boxW} height={boxH} rx={6} ry={6}
              fill="#18181b" opacity={0.92} />
            <text x={bx + boxW / 2} y={by + 11} textAnchor="middle"
              fontSize={9} fill="#a1a1aa" fontWeight={500}>
              {fullLabels[hovered] ?? fmtDate(b.imported_at)}
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
        const isLast    = i === count - 1;
        const isSel     = selectedIdx === i;
        const hasSelect = selectedIdx !== null;
        // default: ทุก label เท่ากัน (สุดท้ายใหญ่กว่าหน่อย) / เลือกแล้ว: highlight เฉพาะที่เลือก
        const active = hasSelect ? isSel : isLast;
        return (
          <text key={i}
            x={labelXAt(i)} y={PAD_T - 10}
            textAnchor={anchorAt(i)}
            fontSize={active ? 11 : 9.5}
            fontWeight={active ? 700 : 500}
            fill={active ? "#ef4444" : "#6b7280"}
            opacity={hasSelect && !isSel ? 0.3 : 1}
          >
            {b.rawScore > 0 ? fmtNum(b.rawScore) : "—"}
          </text>
        );
      })}

      {/* X-axis labels: 2 บรรทัด (date บน, guild ล่าง) */}
      {batches.map((_b, i) => {
        const tx = labelXAt(i);
        const anchor = anchorAt(i);
        const isSel = selectedIdx === i;
        const hasSelect = selectedIdx !== null;
        const dim = hasSelect && !isSel;
        return (
          <g key={i} opacity={dim ? 0.35 : 1} style={{ transition: "opacity 0.25s" }}>
            {/* Date — บรรทัดบน เด่น */}
            <text
              x={tx} y={H - 24}
              textAnchor={anchor}
              fontSize={10}
              fontWeight={isSel ? 700 : 600}
              fill={isSel ? "#ef4444" : "#9ca3af"}
            >
              {dateLabels[i] || `#${i + 1}`}
            </text>
            {/* Guild — บรรทัดล่าง สีส้ม */}
            {guildLabels[i] && (
              <text
                x={tx} y={H - 10}
                textAnchor={anchor}
                fontSize={9}
                fontWeight={500}
                fill={isSel ? "#f97316" : "#fb923c"}
                opacity={isSel ? 1 : 0.9}
              >
                {guildLabels[i]}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── Radar chart (me vs team avg) ───────────────────────────────────
// สถิติที่ยิ่งน้อย = ยิ่งดี (จะแสดงสัญลักษณ์ ↓ กำกับ)
const INVERTED_CATS: Set<Category> = new Set(["death", "damage_taken"]);

function RadarChart({
  myAvgs,
  teamAvgs,
  teamSize,
}: {
  myAvgs: Record<Category, number>;
  teamAvgs: Record<Category, number> | null;
  teamSize: number;
}) {
  const W = 320;
  const H = 230;
  const cx = W / 2;
  const cy = H / 2 + 4;
  const R = 78;

  const cats: Category[] = [...CATEGORIES];
  const n = cats.length;

  // max per cat = max(me, team) × 1.15 (gives 15% headroom) — min 1 กัน div0
  const maxByCat = Object.fromEntries(
    cats.map((c) => [
      c,
      Math.max(myAvgs[c] ?? 0, teamAvgs?.[c] ?? 0, 1) * 1.15,
    ])
  ) as Record<Category, number>;

  const angleAt = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;

  const pointFor = (vals: Record<Category, number>): [number, number][] =>
    cats.map((c, i) => {
      const r = (Math.max(0, vals[c] ?? 0) / maxByCat[c]) * R;
      const a = angleAt(i);
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    });

  const myPts = pointFor(myAvgs);
  const teamPts = teamAvgs ? pointFor(teamAvgs) : null;

  const toPath = (pts: [number, number][]) =>
    pts.map(([x, y], i) => (i === 0 ? "M" : "L") + x + "," + y).join(" ") + "Z";

  const gridLevels = [0.25, 0.5, 0.75, 1.0];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
      <defs>
        <radialGradient id="meFill" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#fb923c" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0.2" />
        </radialGradient>
      </defs>

      {/* Grid polygons */}
      {gridLevels.map((lvl) => {
        const pts = cats.map((_c, i): [number, number] => {
          const a = angleAt(i);
          return [cx + lvl * R * Math.cos(a), cy + lvl * R * Math.sin(a)];
        });
        return (
          <path
            key={lvl}
            d={toPath(pts)}
            fill="none"
            stroke="#e4e4e7"
            strokeWidth={lvl === 1 ? 1.25 : 1}
            className="dark:stroke-zinc-800"
          />
        );
      })}

      {/* Axis spokes */}
      {cats.map((_c, i) => {
        const a = angleAt(i);
        const ex = cx + R * Math.cos(a);
        const ey = cy + R * Math.sin(a);
        return (
          <line
            key={i}
            x1={cx} y1={cy} x2={ex} y2={ey}
            stroke="#e4e4e7"
            strokeWidth={1}
            className="dark:stroke-zinc-800"
          />
        );
      })}

      {/* Team polygon (background) */}
      {teamPts && (
        <>
          <path
            d={toPath(teamPts)}
            fill="#9ca3af"
            fillOpacity={0.15}
            stroke="#9ca3af"
            strokeWidth={1.5}
            strokeDasharray="3 3"
            strokeLinejoin="round"
          />
          {teamPts.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={2.25} fill="#9ca3af" />
          ))}
        </>
      )}

      {/* Me polygon (foreground) */}
      <path
        d={toPath(myPts)}
        fill="url(#meFill)"
        stroke="#ef4444"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {myPts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={3.25}
          fill="#ef4444" stroke="white" strokeWidth={1.5} />
      ))}

      {/* Category labels */}
      {cats.map((c, i) => {
        const a = angleAt(i);
        const lr = R + 14;
        const lx = cx + lr * Math.cos(a);
        const ly = cy + lr * Math.sin(a);
        const cosA = Math.cos(a);
        const anchor: "start" | "end" | "middle" =
          cosA > 0.3 ? "start" : cosA < -0.3 ? "end" : "middle";
        const isInv = INVERTED_CATS.has(c);
        return (
          <g key={c}>
            <text
              x={lx} y={ly + 3}
              textAnchor={anchor}
              fontSize={10}
              fontWeight={600}
              fill="#6b7280"
              className="dark:fill-zinc-400"
            >
              {CAT_LABELS[c]}
              {isInv && (
                <tspan fontSize={8} fill="#10b981" dx={2} fontWeight={700}>
                  ↓ดี
                </tspan>
              )}
            </text>
          </g>
        );
      })}

      {/* Empty state hint (no team data) */}
      {!teamAvgs && (
        <text x={cx} y={H - 6} textAnchor="middle"
          fontSize={9} fill="#9ca3af" fontStyle="italic"
        >
          (ยังไม่มีข้อมูลทีมให้เปรียบเทียบ)
        </text>
      )}

      {/* Team size hint */}
      {teamAvgs && teamSize > 0 && (
        <text x={cx} y={H - 6} textAnchor="middle"
          fontSize={9} fill="#9ca3af"
        >
          เทียบกับค่าเฉลี่ยทีม ({teamSize} คน)
        </text>
      )}
    </svg>
  );
}

// ── Main widget ────────────────────────────────────────────────────
export function PotentialLeaderboardWidget({ myDiscordId, myGuild }: Props) {
  const [batches, setBatches] = useState<BatchData[]>([]);
  const [classId, setClassId] = useState<number | null>(null);
  const [lbItems, setLbItems] = useState<RankedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleTab, setRoleTab] = useState<string>("dps");
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
          // filter ตามกิล แล้ว re-rank ภายในกิลนั้น
          const guildFiltered: RankedRow[] = myGuild
            ? lb.items.filter((r: RankedRow) => r.guild === myGuild)
            : lb.items;
          // re-assign rank per role within the filtered set (sorted by score desc already)
          const roleRanks: Record<string, number> = {};
          const reRanked = guildFiltered.map((r: RankedRow) => {
            roleRanks[r.role] = (roleRanks[r.role] ?? 0) + 1;
            return { ...r, rank: roleRanks[r.role] };
          });
          setLbItems(reRanked);

          // ตั้ง default tab ให้ตรงกับอาชีพของ user จาก lbItems
          if (myDiscordId) {
            const myRow = reRanked.find((r: RankedRow) => r.userdiscordid === myDiscordId);
            if (myRow) {
              if (myRow.role === "tank") setRoleTab("tank");
              else if (myRow.role === "healer") setRoleTab("healer");
              else setRoleTab(`dps:${myRow.class_name}`);
            }
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [myGuild, myDiscordId]);

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

  // Disambiguated labels — ถ้ามี 2 batch วันเดียวกัน (หรือ label ซ้ำ) ใช้ชื่อกิลต่อท้าย fallback #N
  const { full: fullLabels } = buildBatchLabels(displayBatches);

  // แยก date / guild เพื่อ render 2 บรรทัดในกราฟ (สวยกว่าเอามาต่อกัน)
  const dateParts  = displayBatches.map((b) => fmtDate(b.imported_at) || "—");
  const guildParts = displayBatches.map((b) => b.opponent_guild?.trim() || "");

  // #N fallback เฉพาะ date ที่ซ้ำ + ไม่มีชื่อกิล
  const dateCounts = new Map<string, number>();
  for (const d of dateParts) dateCounts.set(d, (dateCounts.get(d) ?? 0) + 1);
  const dateSeen = new Map<string, number>();
  const dateLabels = dateParts.map((d, i) => {
    if (!guildParts[i] && (dateCounts.get(d) ?? 0) > 1) {
      const idx = (dateSeen.get(d) ?? 0) + 1;
      dateSeen.set(d, idx);
      return `${d} #${idx}`;
    }
    return d;
  });

  // derive unique DPS classes from lbItems (sorted by count desc)
  // filter ออกกรณียังไม่ได้เลือกอาชีพ (class_id=0 → class_name="ยังไม่เลือกอาชีพ")
  const dpsClassMap = new Map<string, { class_name: string; class_icon: string; count: number }>();
  for (const r of lbItems) {
    if (r.role !== "dps") continue;
    if (r.class_name === "ยังไม่เลือกอาชีพ") continue;
    const k = r.class_name;
    const entry = dpsClassMap.get(k);
    if (entry) entry.count++;
    else dpsClassMap.set(k, { class_name: k, class_icon: r.class_icon, count: 1 });
  }
  const dpsClasses = Array.from(dpsClassMap.values()).sort((a, b) => b.count - a.count);

  // derive tank / healer class info from lbItems
  const tankEntry   = lbItems.find((r) => r.role === "tank");
  const healerEntry = lbItems.find((r) => r.role === "healer");
  const tankClass   = tankEntry   ? { class_name: tankEntry.class_name,   class_icon: tankEntry.class_icon }   : { class_name: "หมัด",  class_icon: "" };
  const healerClass = healerEntry ? { class_name: healerEntry.class_name, class_icon: healerEntry.class_icon } : { class_name: "พระ",   class_icon: "" };

  // helper: filter lbItems by current tab and re-rank
  const getTabItems = (tab: string): RankedRow[] => {
    let filtered: RankedRow[];
    if (tab === "tank") filtered = lbItems.filter((r) => r.role === "tank");
    else if (tab === "healer") filtered = lbItems.filter((r) => r.role === "healer");
    else if (tab === "dps") filtered = lbItems.filter((r) => r.role === "dps");
    else if (tab.startsWith("dps:")) {
      const cn = tab.slice(4);
      filtered = lbItems.filter((r) => r.role === "dps" && r.class_name === cn);
    } else filtered = [];
    return filtered.map((r, i) => ({ ...r, rank: i + 1 }));
  };

  const tabLabel = (tab: string): string => {
    if (tab === "dps") return "DPS";
    if (tab === "tank") return tankClass.class_name;
    if (tab === "healer") return healerClass.class_name;
    if (tab.startsWith("dps:")) return tab.slice(4);
    return tab;
  };

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

  // ── Radar chart data: ค่าฉัน vs ค่าเฉลี่ยทีม ──
  // ฉัน: ถ้าเลือก batch แสดงเฉพาะ batch นั้น / ไม่งั้นเฉลี่ยจาก displayBatches
  const myAvgs: Record<Category, number> = (() => {
    if (selectedIdx !== null && displayBatches[selectedIdx]) {
      return displayBatches[selectedIdx].avgs;
    }
    const out = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>;
    if (displayBatches.length === 0) return out;
    for (const b of displayBatches) {
      for (const c of CATEGORIES) out[c] += b.avgs[c] ?? 0;
    }
    for (const c of CATEGORIES) out[c] /= displayBatches.length;
    return out;
  })();

  // ทีม: เฉลี่ยจาก lbItems ที่อยู่ guild เดียวกัน + role เดียวกัน (ไม่รวมตัวเอง)
  const teamMates = lbItems.filter((r) => {
    if (r.userdiscordid === myDiscordId) return false;
    if (myGuild != null && r.guild !== myGuild) return false;
    if (!r.avgs) return false;
    // role match: ใช้ class_name จาก my own row เพื่อ peer group ที่แม่นกว่า
    const myRow = lbItems.find((x) => x.userdiscordid === myDiscordId);
    if (myRow) {
      // ถ้าฉันเป็น dps แยกกลุ่มตาม class_name; tank/healer ตาม role
      if (myRow.role === "dps")    return r.role === "dps" && r.class_name === myRow.class_name;
      if (myRow.role === "tank")   return r.role === "tank";
      if (myRow.role === "healer") return r.role === "healer";
    }
    return r.role === "dps";
  });
  const teamAvgs: Record<Category, number> | null = teamMates.length > 0
    ? (() => {
        const out = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>;
        for (const r of teamMates) {
          for (const c of CATEGORIES) out[c] += r.avgs?.[c] ?? 0;
        }
        for (const c of CATEGORIES) out[c] /= teamMates.length;
        return out;
      })()
    : null;

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">

      {/* ── Top 3 Leaderboard (filtered by role + re-ranked) ── */}
      {(() => {
        const roleItems = getTabItems(roleTab);
        return (
        <div className="px-4 pt-3 pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-1.5 mb-2">
            <Trophy className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Top 3 · {tabLabel(roleTab)} · {myGuild ? `Inferno-${myGuild}` : "ทั้งหมด"}
            </span>
          </div>

          {/* ── Role tab selector (ใต้ label Top 3) ── */}
          <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
            {/* DPS รวม */}
            <button
              type="button"
              onClick={() => setRoleTab("dps")}
              className={[
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all border",
                roleTab === "dps"
                  ? "bg-red-600 text-white border-red-600 shadow-sm"
                  : "bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-red-300 hover:text-red-500",
              ].join(" ")}
            >
              DPS
            </button>

            {/* แยกแต่ละอาชีพ DPS */}
            {dpsClasses.map(({ class_name, class_icon }) => {
              const key = `dps:${class_name}`;
              const active = roleTab === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setRoleTab(key)}
                  className={[
                    "rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all border flex items-center gap-1.5",
                    active
                      ? "bg-red-600 text-white border-red-600 shadow-sm"
                      : "bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-red-300 hover:text-red-500",
                  ].join(" ")}
                >
                  {class_icon && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={class_icon} alt="" className="w-3.5 h-3.5 rounded-sm object-cover" />
                  )}
                  {class_name}
                </button>
              );
            })}

            {/* Divider */}
            {dpsClasses.length > 0 && (
              <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-700 mx-0.5" />
            )}

            {/* ไอรอนแคลด (tank) + ซิลฟ์ (healer) — ใช้ชื่อจริงจาก data */}
            {([
              { key: "tank",   info: tankClass },
              { key: "healer", info: healerClass },
            ] as const).map(({ key, info }) => (
              <button
                key={key}
                type="button"
                onClick={() => setRoleTab(key)}
                className={[
                  "rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all border flex items-center gap-1.5",
                  roleTab === key
                    ? "bg-red-600 text-white border-red-600 shadow-sm"
                    : "bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-red-300 hover:text-red-500",
                ].join(" ")}
              >
                {info.class_icon && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={info.class_icon} alt="" className="w-3.5 h-3.5 rounded-sm object-cover" />
                )}
                {info.class_name}
              </button>
            ))}
          </div>

          {roleItems.length === 0 && (
            <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/50 px-3 py-4 text-center text-[11px] text-zinc-400">
              ไม่มีข้อมูลในหมวดนี้
            </div>
          )}
          <div className="space-y-1.5">
            {roleItems.slice(0, 3).map((row) => {
              const isMe = row.userdiscordid === myDiscordId;
              const maxScore = roleItems[0]?.score ?? 1;
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
              const myIdx = roleItems.findIndex((r) => r.userdiscordid === myDiscordId);
              if (myIdx < 3 || myIdx === -1) return null;
              const myRow = roleItems[myIdx];
              const maxScore = roleItems[0]?.score ?? 1;
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
        );
      })()}

      {/* ── Header (สถิติของฉัน + คะแนน + trend) — วางใต้ Top 3 ── */}
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
              ? fullLabels[selectedIdx] ?? ""
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
          dateLabels={dateLabels}
          guildLabels={guildParts}
          fullLabels={fullLabels}
        />
      </div>

      {/* ── Radar: ฉัน vs ค่าเฉลี่ยทีม ── */}
      <div className="mx-4 mb-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 px-3 pt-3 pb-2">
        <div className="flex items-center justify-between mb-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            {selectedIdx !== null
              ? `โปรไฟล์ · ${fullLabels[selectedIdx] ?? ""}`
              : `โปรไฟล์เฉลี่ย ${displayBatches.length} batch`}
          </div>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
              <span className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-300">ฉัน</span>
            </div>
            {teamAvgs && (
              <div className="flex items-center gap-1">
                <span className="inline-block h-[2px] w-3 bg-zinc-400" style={{ borderTop: "2px dashed #9ca3af", background: "transparent" }} />
                <span className="text-[10px] text-zinc-400">เฉลี่ยทีม</span>
              </div>
            )}
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
        </div>
        <RadarChart
          myAvgs={myAvgs}
          teamAvgs={teamAvgs}
          teamSize={teamMates.length}
        />
      </div>
    </div>
  );
}
