// scripts/update-weights.mjs
// รัน: node scripts/update-weights.mjs

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env.local") });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ──────────────────────────────────────────────
// Weight ใหม่
// ──────────────────────────────────────────────

const IRON_CLAD_CLASS_ID = 1;   // ไอรอนแคลด (หมัด)
const HEALER_CLASS_ID    = 5;   // ชีลดี (พระ)

const ironCladWeights = {
  kill:           1,
  assist:         0.15,
  supply:         0.015,
  damage_player:  0.01,
  damage_fort:    0.02,
  heal:           0.05,
  damage_taken:   0.2,
  death:          -8,
  revive:         2.5,
};

const healerWeights = {
  kill:           0.3,
  assist:         0.14,
  supply:         0.014,
  damage_player:  0.003,
  damage_fort:    0.003,
  heal:           0.22,
  damage_taken:   0.03,
  death:          -4,
  revive:         4,
};

// ──────────────────────────────────────────────
async function updateWeights(classId, weights, label) {
  console.log(`\n📦 อัพเดต ${label} (class_id=${classId})...`);
  let ok = 0, fail = 0;

  for (const [category, weight] of Object.entries(weights)) {
    const { error } = await supabase
      .from("member_potential_weights")
      .update({ weight })
      .eq("class_id", classId)
      .eq("category", category);

    if (error) {
      console.error(`  ❌ ${category}: ${error.message}`);
      fail++;
    } else {
      console.log(`  ✅ ${category.padEnd(18)} → ${weight}`);
      ok++;
    }
  }

  console.log(`  สรุป: ${ok} สำเร็จ, ${fail} ล้มเหลว`);
}

// ──────────────────────────────────────────────
async function preview() {
  console.log("\n🔍 ตรวจสอบค่า top player แต่ละ role หลังปรับ...");

  // ดึง sample จาก leaderboard
  const { data } = await supabase
    .from("member_potential_weights")
    .select("class_id, category, weight")
    .in("class_id", [IRON_CLAD_CLASS_ID, HEALER_CLASS_ID])
    .order("class_id, category");

  if (data) {
    console.log("\n  class_id  category              weight");
    for (const r of data) {
      console.log(`  ${String(r.class_id).padEnd(10)}${r.category.padEnd(22)}${r.weight}`);
    }
  }
}

// ──────────────────────────────────────────────
async function main() {
  console.log("🚀 เริ่มอัพเดต weights...");
  console.log("   เป้าหมาย: top ทุก role ≈ 200 คะแนน\n");

  await updateWeights(IRON_CLAD_CLASS_ID, ironCladWeights, "ไอรอนแคลด (หมัด)");
  await updateWeights(HEALER_CLASS_ID,    healerWeights,    "ชีลดี (พระ)");
  await preview();

  console.log("\n✅ เสร็จแล้ว! refresh หน้า Leaderboard เพื่อดูผล");
}

main().catch(console.error);
