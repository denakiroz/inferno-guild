import type { CharacterClass } from "@/app/types";

export type GuildNo = 1 | 2 | 3;

export interface DbMember {
  id: number;
  name: string;
  class: CharacterClass;
  power: number;

  party: number | null;
  party_2: number | null;
  pos_party: number | null;
  pos_party_2: number | null;

  color: string | null;
  is_special: boolean;
  guild: GuildNo;

  discord_user_id: string | null;
}

export interface DbLeave {
  id: number;
  date_time: string;
  member_id: number;
  reason: string;
}
