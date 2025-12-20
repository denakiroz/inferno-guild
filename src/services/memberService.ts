import { supabase } from "@/lib/supabase";
import type { DbMember, GuildNo } from "@/type/db";

const SELECT_MEMBER =
  "id,name,class_id,power,party,party_2,pos_party,pos_party_2,color,is_special,guild,discord_user_id,status";

export const memberService = {
  async list(params: {
    guild?: GuildNo;
    status?: string;
    orderByPowerDesc?: boolean;
  } = {}): Promise<DbMember[]> {
    let q = supabase.from("member").select(SELECT_MEMBER);

    if (params.guild) q = q.eq("guild", params.guild);
    if (params.status) q = q.eq("status", params.status);

    if (params.orderByPowerDesc) q = q.order("power", { ascending: false });
    else q = q.order("id", { ascending: true });

    const { data, error } = await q;
    if (error) throw error;

    // NOTE: ไม่ embed class ใน query เพื่อเลี่ยง relationship ambiguity
    return (data || []) as DbMember[];
  },

  async update(id: number, payload: Partial<DbMember>): Promise<DbMember> {
    const { data, error } = await supabase
      .from("member")
      .update(payload)
      .eq("id", id)
      .select(SELECT_MEMBER)
      .single();

    if (error) throw error;
    return data as DbMember;
  },
};
