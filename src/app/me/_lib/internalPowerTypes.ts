// app/me/_lib/internalPowerTypes.ts

export type ElementKey = "gold" | "wood" | "water" | "fire" | "earth";

export type ElementLevels = Record<ElementKey, number>;

export type EquipmentSetRow = {
  id: number | null;
  element: ElementLevels;
  image: string | null;
  created_at: string | null;
};

export const defaultLevels: ElementLevels = {
  gold: 0,
  wood: 0,
  water: 0,
  fire: 0,
  earth: 0,
};

export function sumLevels(levels: ElementLevels): number {
  const l = levels ?? defaultLevels;
  return (
    (Number(l.gold) || 0) +
    (Number(l.wood) || 0) +
    (Number(l.water) || 0) +
    (Number(l.fire) || 0) +
    (Number(l.earth) || 0)
  );
}

export function normalizeLevels(raw: any): ElementLevels {
  const obj = typeof raw === "object" && raw ? raw : {};
  const next: ElementLevels = { ...defaultLevels };
  (Object.keys(defaultLevels) as ElementKey[]).forEach((k) => {
    const v = Number(obj[k] ?? 0);
    next[k] = Number.isFinite(v) ? Math.max(0, Math.min(3, v)) : 0;
  });
  return next;
}

export function validateLevels(levels: ElementLevels): { ok: true } | { ok: false; error: string } {
  const n = normalizeLevels(levels);
  const total = sumLevels(n);
  if (total > 7) return { ok: false, error: "sum_steps_exceed_7" };
  return { ok: true };
}
