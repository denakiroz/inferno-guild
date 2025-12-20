import { supabase } from "@/lib/supabase";
import type { DbClass } from "@/type/db";

export const classService = {
  async list(): Promise<DbClass[]> {
    const { data, error } = await supabase
      .from("class")
      .select("id,name,icon_url")
      .order("id");

    if (error) throw error;
    return (data || []) as DbClass[];
  },
};
