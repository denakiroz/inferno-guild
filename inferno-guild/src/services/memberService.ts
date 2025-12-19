// src/services/memberService.ts
import { supabase } from "@/lib/supabase/client";
import type { DbMember, GuildNo } from "@/type/db";
import type { CharacterClass } from "@/app/types";

type ListArgs = {
  guild?: GuildNo;
  orderByPowerDesc?: boolean;
};

function normalizeMember(row: any): DbMember {
  return {
    id: Number(row.id),
    name: String(row.name ?? ""),
    class: (row.class ?? "Ironclan") as CharacterClass,
    power: Number(row.power ?? 0),

    party: row.party ?? null,
    party_2: row.party_2 ?? null,
    pos_party: row.pos_party ?? null,
    pos_party_2: row.pos_party_2 ?? null,

    color: row.color ?? null,
    is_special: Boolean(row.is_special),
    guild: Number(row.guild ?? 1) as GuildNo,

    discord_user_id: row.discord_user_id ?? null,
  };
}

export const memberService = {
  async list(args: ListArgs = {}): Promise<DbMember[]> {
    const { guild, orderByPowerDesc = true } = args;

    let q = supabase.from("member").select("*");

    if (guild) q = q.eq("guild", guild);
    if (orderByPowerDesc) q = q.order("power", { ascending: false });
    else q = q.order("id", { ascending: true });

    const { data, error } = await q;
    if (error) throw error;

    return (data ?? []).map(normalizeMember);
  },

  async create(payload: Omit<DbMember, "id">): Promise<DbMember> {
    const { data, error } = await supabase
      .from("member")
      .insert([payload])
      .select("*")
      .single();

    if (error) throw error;
    return normalizeMember(data);
  },

  async createMany(payloads: Array<Omit<DbMember, "id">>): Promise<DbMember[]> {
    if (payloads.length === 0) return [];

    const { data, error } = await supabase
      .from("member")
      .insert(payloads)
      .select("*");

    if (error) throw error;

    // กันลำดับเพี้ยน
    return (data ?? []).map(normalizeMember).sort((a, b) => b.power - a.power);
  },

  async update(payload: DbMember): Promise<DbMember> {
    const { id, ...rest } = payload;

    const { data, error } = await supabase
      .from("member")
      .update(rest)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;
    return normalizeMember(data);
  },

  async delete(id: number): Promise<void> {
    const { error } = await supabase.from("member").delete().eq("id", id);
    if (error) throw error;
  },
};
