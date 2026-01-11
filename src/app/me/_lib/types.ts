// app/me/_lib/types.ts
import type { DbLeave } from "@/type/db";

export type MeRes = {
  ok: boolean;
  user?: {
    discordUserId: string;
    displayName: string;
    avatarUrl: string;
    guild: number;
    isAdmin: boolean;
    isHead: boolean;
  };
};

export type ClassRow = {
  id: number;
  name: string;
  icon_url: string | null;
};

export type UltimateSkillRow = {
  id: number;
  name: string;
  ultimate_skill_url?: string | null;
  created_at?: string;
};

export type MemberRow = {
  discord_user_id: string;
  name: string;
  power: number;
  is_special: boolean;
  guild: number;
  update_date: string;

  class?: string; // legacy
  class_id?: number; // preferred
};

export type LeaveMeRes = { ok: true; leaves: DbLeave[] } | { ok: false; error?: string };
export type ClassListRes = { ok: true; classes: ClassRow[] } | { ok: false; error?: string };

export type UltimateSkillListRes =
  | { ok: true; skills: UltimateSkillRow[] }
  | { ok: false; error?: string };

export type MyUltimateRes =
  | { ok: true; ultimate_skill_ids: number[] }
  | { ok: false; error?: string };

// --- Skill stones (equipment_create -> member_equipment_create)
export type EquipmentCreateType = 1 | 2 | 3 | 4;

export type EquipmentCreateRow = {
  id: number;
  name: string;
  image_url: string | null;
  type: EquipmentCreateType;
};

export type MySkillStonesRes =
  | {
      ok: true;
      equipment: EquipmentCreateRow[];
      selected_by_type: Record<EquipmentCreateType, number | null>;
    }
  | { ok: false; error?: string };
