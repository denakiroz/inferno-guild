/** ชื่อที่แสดงของกิลด์ตามเลขกิลด์ (guild 2 = Celestier) */
export function guildName(g: number | string | null | undefined): string {
  const n = Number(g);
  if (!Number.isFinite(n) || n <= 0) return "-";
  if (n === 2) return "Celestier";
  return `Guild ${n}`;
}
