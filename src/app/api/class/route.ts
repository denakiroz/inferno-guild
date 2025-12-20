import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("class")
      .select("id, name, icon_url")
      .order("id", { ascending: true });

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, classes: data ?? [] });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e.message ?? e) },
      { status: 500 }
    );
  }
}
