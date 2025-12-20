import { supabase } from "@/lib/supabase";
import type { DbLeave } from "@/type/db";

const SELECT_LEAVE = "id,member_id,date_time,reason";

export const leaveService = {
  async list(params: { memberIds: number[] }): Promise<DbLeave[]> {
    if (!params.memberIds?.length) return [];
    const { data, error } = await supabase
      .from("leave")
      .select(SELECT_LEAVE)
      .in("member_id", params.memberIds)
      .order("date_time", { ascending: false });

    if (error) throw error;
    return (data || []) as DbLeave[];
  },

  async createMany(rows: Array<Omit<DbLeave, "id">>): Promise<void> {
    if (!rows.length) return;

    const payload = rows.map((r) => ({
      member_id: r.member_id,
      date_time: r.date_time,
      reason: r.reason ?? null,
    }));

    const { error } = await supabase.from("leave").insert(payload);
    if (error) throw error;
  },
};
