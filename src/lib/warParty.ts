import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * War party assignments live in `war_party_member` (member_id, round, party, position).
 *   round 1 = 20:00, round 2 = 20:30  — 10 parties, 6 slots each.
 *
 * API responses keep the legacy flat shape (party / party_2 / pos_party / pos_party_2)
 * so the UI does not need to know about the table split.
 */

export type WarRound = 1 | 2;
export type WarTime = "20:00" | "20:30";

export const WAR_PARTY_COUNT = 10;
export const WAR_PARTY_SLOTS = 6;

export function warTimeToRound(t: WarTime): WarRound {
  return t === "20:00" ? 1 : 2;
}

type WarPartyRow = {
  member_id: number;
  round: number;
  party: number;
  position: number | null;
};

const CHUNK = 500;

/** ใส่ party/party_2/pos_party/pos_party_2 กลับเข้า member rows จากตาราง war_party_member */
export async function attachWarParty<T extends { id?: any }>(
  members: T[]
): Promise<Array<T & { party: number | null; party_2: number | null; pos_party: number | null; pos_party_2: number | null }>> {
  const list = members ?? [];
  const ids = list.map((m) => Number(m?.id)).filter((n) => Number.isFinite(n) && n > 0);

  const byMember = new Map<number, { 1?: WarPartyRow; 2?: WarPartyRow }>();

  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    const { data, error } = await supabaseAdmin
      .from("war_party_member")
      .select("member_id, round, party, position")
      .in("member_id", slice);
    if (error) throw new Error(error.message);

    for (const r of (data ?? []) as WarPartyRow[]) {
      const cur = byMember.get(Number(r.member_id)) ?? {};
      if (r.round === 1) cur[1] = r;
      else if (r.round === 2) cur[2] = r;
      byMember.set(Number(r.member_id), cur);
    }
  }

  return list.map((m) => {
    const a = byMember.get(Number(m?.id));
    return {
      ...m,
      party: a?.[1]?.party ?? null,
      pos_party: a?.[1]?.position ?? null,
      party_2: a?.[2]?.party ?? null,
      pos_party_2: a?.[2]?.position ?? null,
    };
  });
}

export type WarPartyAssignment = {
  memberId: number;
  party: number | null; // null = เอาออกจากปาร์ตี้ของรอบนี้
  pos: number | null;
};

/** บันทึกการจัดปาร์ตี้ของ 1 รอบ: party != null -> upsert, party == null -> ลบ */
export async function saveWarPartyRound(round: WarRound, rows: WarPartyAssignment[]) {
  const upserts: Array<{ member_id: number; round: number; party: number; position: number | null; updated_at: string }> = [];
  const removeIds: number[] = [];
  const now = new Date().toISOString();

  for (const r of rows) {
    const memberId = Number(r.memberId);
    if (!Number.isFinite(memberId) || memberId <= 0) continue;

    const party = r.party == null ? null : Number(r.party);
    if (party == null || !Number.isInteger(party) || party < 1 || party > WAR_PARTY_COUNT) {
      removeIds.push(memberId);
      continue;
    }

    const pos = r.pos == null ? null : Number(r.pos);
    upserts.push({
      member_id: memberId,
      round,
      party,
      position: pos != null && Number.isInteger(pos) && pos >= 1 && pos <= WAR_PARTY_SLOTS ? pos : null,
      updated_at: now,
    });
  }

  for (let i = 0; i < removeIds.length; i += CHUNK) {
    const { error } = await supabaseAdmin
      .from("war_party_member")
      .delete()
      .eq("round", round)
      .in("member_id", removeIds.slice(i, i + CHUNK));
    if (error) throw new Error(error.message);
  }

  for (let i = 0; i < upserts.length; i += CHUNK) {
    const { error } = await supabaseAdmin
      .from("war_party_member")
      .upsert(upserts.slice(i, i + CHUNK), { onConflict: "member_id,round" });
    if (error) throw new Error(error.message);
  }

  return { upserted: upserts.length, removed: removeIds.length };
}
