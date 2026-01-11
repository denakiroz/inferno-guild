"use client";

import React from "react";
import { Button, Card, Input, Select } from "@/app/components/UI";
import type { ClassRow, MemberRow, UltimateSkillRow } from "../_lib/types";
import { UltimateMultiSelect } from "./UltimateMultiSelect";

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
}) {
  const {
    member,
    setMember,
    classes,
    classId,
    setClassId,
    saving,
    err,
    onSaveProfile,
    ultimateSkills,
    selectedUltimateIds,
    setSelectedUltimateIds,
  } = props;

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">โปรไฟล์</div>
      </div>

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

      {err && <div className="mt-3 text-sm text-rose-600">Error: {err}</div>}

      <div className="mt-5 flex items-center justify-end gap-2">
        <Button onClick={onSaveProfile} disabled={saving}>
          {saving ? "กำลังบันทึก..." : "บันทึก"}
        </Button>
      </div>
    </Card>
  );
}
