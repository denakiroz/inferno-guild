export type GuildNo = 1 | 2 | 3;

export type MemberStatus = "active" | "inactive";

export type DbClass = {
  id: number;
  name: string;
  icon_url: string | null;
};

export type DbMember = {
  id: number;
  name: string;
  class_id: number | null;
  power: number;
  party: number | null;
  party_2: number | null;
  pos_party: number | null;
  pos_party_2: number | null;
  color: string | null;
  is_special: boolean;
  guild: GuildNo;
  discord_user_id: string | null;
  status: MemberStatus | null;

  class?: DbClass | null;
};

export type DbLeave = {
  id: number;
  member_id: number;
  date_time: string;
  reason: string | null;
  update_date: string| null;
  status: string| null;
};
