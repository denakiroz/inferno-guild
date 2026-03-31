"use client";

import React from "react";
import { Button, Card, Select } from "@/app/components/UI";
import type { ClassRow, MemberRow, SpecialSkillRow, UltimateSkillRow } from "../_lib/types";
import { UltimateMultiSelect } from "./UltimateMultiSelect";
import { SpecialSkillMultiSelect } from "./SpecialSkillMultiSelect";
import {
  WeaponStoneSection,
  type EquipmentCreateRow,
  type SelectedByType,
} from "./WeaponStoneSection";

export function ProfileTab(props: {
  member: MemberRow | null;
  setMember: React.Dispatch<React.SetStateAction<MemberRow | null>>;
  classes: ClassRow[];
  classId: string;
  setClassId: React.Dispatch<React.SetStateAction<string>>;

  saving: boolean;
  err: string | null;
  onSaveProfile: () => Promise<void>;

  ultimateSkills: UltimateSkillRow[];
  selectedUltimateIds: number[];
  setSelectedUltimateIds: React.Dispatch<React.SetStateAction<number[]>>;

  specialSkills: SpecialSkillRow[];
  selectedSpecialIds: number[];
  setSelectedSpecialIds: React.Dispatch<React.SetStateAction<number[]>>;

  // weapon stones
  stoneEquipment: EquipmentCreateRow[];
  allStonesByType: SelectedByType;
  setAllStonesByType: React.Dispatch<React.SetStateAction<SelectedByType>>;
  stonesLoading: boolean;
}) {
  const {
    classes,
    classId,
    setClassId,
    saving,
    err,
    onSaveProfile,
    ultimateSkills,
    selectedUltimateIds,
    setSelectedUltimateIds,
    specialSkills,
    selectedSpecialIds,
    setSelectedSpecialIds,
    stoneEquipment,
    allStonesByType,
    setAllStonesByType,
    stonesLoading,
  } = props;

  return (
    <Card>
      <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">โปรไฟล์</div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <div className="text-xs text-zinc-500 mb-1">อาชีพ</div>
          <Select
            value={classId}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setClassId(e.target.value)}
          >
            {classes.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <UltimateMultiSelect
        skills={ultimateSkills}
        selectedIds={selectedUltimateIds}
        onChange={(next) => setSelectedUltimateIds(next)}
        disabled={saving}
      />

      <SpecialSkillMultiSelect
        skills={specialSkills}
        selectedIds={selectedSpecialIds}
        onChange={(next) => setSelectedSpecialIds(next)}
        disabled={saving}
      />

      {/* ── หินสกิลอาวุธ ── */}
      <div className="border-t border-zinc-100 dark:border-zinc-800 mt-5 pt-5">
        <WeaponStoneSection
          equipment={stoneEquipment}
          allStonesByType={allStonesByType}
          setAllStonesByType={setAllStonesByType}
          loading={stonesLoading}
          disabled={saving}
        />
      </div>

      {err && <div className="mt-3 text-sm text-rose-600">Error: {err}</div>}

      <div className="mt-5 flex items-center justify-end gap-2">
        <Button onClick={onSaveProfile} disabled={saving}>
          {saving ? "กำลังบันทึก..." : "บันทึก"}
        </Button>
      </div>
    </Card>
  );
}
