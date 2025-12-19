// src/constants.ts
import type {
  Branch,
  LeaveRequest,
  WarEvent,
  SubParty,
  CharacterClass,
  GameEvent,
  WarPlan,
} from "@/app/types";

export const BRANCHES = ["Inferno-1", "Inferno-2", "Inferno-3"] as const satisfies readonly Branch[];

export const CLASSES: CharacterClass[] = [
  "Ironclan",
  "Bloodstorm",
  "Celestune",
  "Sylph",
  "Numina",
  "Nightwalker",
];

export const CLASS_CONFIG: Record<CharacterClass, { display: string; en: string; th: string }> = {
  Ironclan: { display: "Ironclan", en: "Ironclan", th: "ไอรอนแคลด" },
  Bloodstorm: { display: "Bloodstorm", en: "Bloodstorm", th: "บลัดสตรอม" },
  Celestune: { display: "Celestune", en: "Celestune", th: "เซเลสทูน" },
  Sylph: { display: "Sylph", en: "Sylph", th: "ซิลฟ์" },
  Numina: { display: "Numina", en: "Numina", th: "นูมินา" },
  Nightwalker: { display: "Nightwalker", en: "Nightwalker", th: "ไนท์เวคเกอร์" },
};

export const GROUP_COLORS = [
  { name: "เทา", bg: "bg-zinc-100", text: "text-zinc-800", border: "border-zinc-200" },
  { name: "แดง", bg: "bg-red-50", text: "text-red-800", border: "border-red-200" },
  { name: "ฟ้า", bg: "bg-blue-50", text: "text-blue-800", border: "border-blue-200" },
  { name: "เขียว", bg: "bg-emerald-50", text: "text-emerald-800", border: "border-emerald-200" },
  { name: "เหลือง", bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-200" },
  { name: "ม่วง", bg: "bg-purple-50", text: "text-purple-800", border: "border-purple-200" },
  { name: "ฟ้าคราม", bg: "bg-cyan-50", text: "text-cyan-800", border: "border-cyan-200" },
] as const;
