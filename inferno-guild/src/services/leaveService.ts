// src/services/leaveService.ts
import { supabase } from "@/lib/supabase/client";
import type { DbLeave } from "@/type/db";

type ListArgs = {
  memberIds?: number[];
  // ค่าเริ่มต้นจะดึงช่วง "เมื่อวาน-พรุ่งนี้" กัน timezone เพี้ยน
};

function normalizeLeave(row: any): DbLeave {
  return {
    id: Number(row.id),
    date_time: String(row.date_time),
    member_id: Number(row.member_id),
    reason: String(row.reason ?? ""),
  };
}

function rangeAroundTodayISO() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 1);

  const end = new Date();
  end.setHours(23, 59, 59, 999);
  end.setDate(end.getDate() + 1);

  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

export const leaveService = {
  async list(args: ListArgs = {}): Promise<DbLeave[]> {
    const { memberIds } = args;
    const { startISO, endISO } = rangeAroundTodayISO();

    let q = supabase
      .from("leave")
      .select("*")
      .gte("date_time", startISO)
      .lte("date_time", endISO)
      .order("date_time", { ascending: false });

    if (memberIds && memberIds.length > 0) {
      q = q.in("member_id", memberIds);
    }

    const { data, error } = await q;
    if (error) throw error;

    return (data ?? []).map(normalizeLeave);
  },

  async create(payload: Omit<DbLeave, "id">): Promise<DbLeave> {
    const { data, error } = await supabase
      .from("leave")
      .insert([payload])
      .select("*")
      .single();

    if (error) throw error;
    return normalizeLeave(data);
  },

  async deleteByMember(memberId: number): Promise<void> {
    const { error } = await supabase.from("leave").delete().eq("member_id", memberId);
    if (error) throw error;
  },
};
