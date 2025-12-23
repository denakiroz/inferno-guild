// src/services/leaveService.ts
import { supabase } from "@/lib/supabase";
import type { DbLeave } from "@/type/db";

// ✅ ต้องดึง status, update_date มาด้วย ไม่งั้น Cancel จะเช็คไม่ได้
const SELECT_LEAVE = "id,member_id,date_time,reason,update_date,status";

/**
 * สร้าง type สำหรับ insert โดย "ไม่บังคับ" status/update_date
 * เพราะปกติควรให้ DB default หรือให้ service ใส่ให้
 */
export type LeaveInsert = {
  member_id: number;
  date_time: string;
  reason: string | null;
  status?: string; // default "Active"
  update_date?: string; // default now()
};

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

  /**
   * ✅ กัน 2 เรื่อง:
   * 1) เติม status/update_date ให้ครบ (แก้ type error แบบไม่ต้อง any)
   * 2) กัน duplicate key (unique member_id + date_time) โดยเช็คก่อน insert
   */
  async createMany(rows: LeaveInsert[]): Promise<void> {
    if (!rows.length) return;

    // normalize + trim
    const normalized = rows
      .map((r) => ({
        member_id: Number(r.member_id),
        date_time: String(r.date_time ?? "").trim(),
        reason: r.reason ?? null,
      }))
      .filter((r) => Number.isFinite(r.member_id) && !!r.date_time);

    if (!normalized.length) return;

    // de-dupe ใน payload ก่อน (กันส่งซ้ำในรอบเดียวกัน)
    const uniqMap = new Map<string, (typeof normalized)[number]>();
    for (const r of normalized) {
      uniqMap.set(`${r.member_id}#${r.date_time}`, r);
    }
    const uniq = Array.from(uniqMap.values());

    const nowIso = new Date().toISOString();

    // ✅ upsert เพื่อ "อัปเดต status แทน" เมื่อชน unique (member_id,date_time)
    // - ถ้าเคย Cancel อยู่ จะถูกอัปเดตเป็น Active
    // - update_date จะถูกอัปเดตเสมอ
    // - reason จะถูกอัปเดตด้วย (ถ้าคุณไม่ต้องการให้ทับ reason เดิม บอกผม เดี๋ยวปรับให้)
    const upsertRows = uniq.map((r) => ({
      member_id: r.member_id,
      date_time: r.date_time,
      reason: r.reason,
      status: "Active",
      update_date: nowIso,
    }));

    const { error } = await supabase
      .from("leave")
      .upsert(upsertRows, { onConflict: "member_id,date_time" });

    if (error) throw error;
  },
};
