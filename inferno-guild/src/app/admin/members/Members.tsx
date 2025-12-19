"use client";

// src/app/admin/members/Members.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Card, Button, Badge, Input, Select, Modal } from "@/app/components/UI";
import { Icons, ClassIcon, CLASS_DATA } from "@/app/components/Icon";
import { CLASSES, CLASS_CONFIG } from "@/constants";
import type { CharacterClass } from "@/app/types";
import type { DbMember, DbLeave, GuildNo } from "@/type/db";

interface MembersProps {
  members: DbMember[];
  leaves: DbLeave[];
  isLoading?: boolean;

  onAddMember: (member: Omit<DbMember, "id">) => void | Promise<void>;
  onUpdateMember: (member: DbMember) => void | Promise<void>;
  onDeleteMember: (id: number) => void | Promise<void>;
  onReportLeave: (payload: Omit<DbLeave, "id">) => void | Promise<void>;
  onImportMembers: (members: Omit<DbMember, "id">[]) => void | Promise<void>;

  // ✅ ควบคุมสิทธิ์เห็นกิลด์
  lockedGuild?: GuildNo | null; // HEAD => 1/2/3
  canViewAllGuilds?: boolean; // ADMIN => true
}

const toDateKey = (iso: string) => {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const nowDatetimeLocal = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const Members: React.FC<MembersProps> = ({
  members,
  leaves,
  isLoading = false,
  onAddMember,
  onUpdateMember,
  onDeleteMember,
  onReportLeave,
  onImportMembers,
  lockedGuild = null,
  canViewAllGuilds = false,
}) => {
  // -------------------- Filters --------------------
  const [selectedGuild, setSelectedGuild] = useState<GuildNo | "All">("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterClass, setFilterClass] = useState<CharacterClass | "All">("All");
  const [filterParty, setFilterParty] = useState<number | "All">("All");
  const [onlySpecial, setOnlySpecial] = useState(false);

  // ✅ HEAD: บังคับให้เลือกกิลด์ของตัวเองเสมอ
  useEffect(() => {
    if (!canViewAllGuilds && lockedGuild) {
      setSelectedGuild(lockedGuild);
    }
  }, [canViewAllGuilds, lockedGuild]);

  const effectiveGuild: GuildNo | "All" = canViewAllGuilds ? selectedGuild : (lockedGuild ?? 1);

  // -------------------- Avoid SSR hydration mismatch for "today" --------------------
  const [todayKey, setTodayKey] = useState<string | null>(null);
  useEffect(() => {
    setTodayKey(toDateKey(new Date().toISOString()));
  }, []);

  // -------------------- Modals --------------------
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<DbMember | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteTargetMember, setDeleteTargetMember] = useState<DbMember | null>(null);

  const [leaveModalMember, setLeaveModalMember] = useState<DbMember | null>(null);
  const [leaveDateTime, setLeaveDateTime] = useState(nowDatetimeLocal());
  const [leaveReason, setLeaveReason] = useState<"War" | "Personal" | "Other">("War");
  const [leaveNote, setLeaveNote] = useState("");

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importText, setImportText] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  // -------------------- Form State --------------------
  const [formData, setFormData] = useState<Partial<DbMember>>({
    name: "",
    class: "Ironclan",
    power: 0,
    guild: 1,

    party: null,
    pos_party: null,
    party_2: null,
    pos_party_2: null,

    is_special: false,
    color: null,
    discord_user_id: null,
  });

  // -------------------- Derived: leave status by member --------------------
  const leaveByMemberToday = useMemo(() => {
    const map = new Map<number, DbLeave[]>();
    if (!todayKey) return map;

    for (const l of leaves) {
      if (toDateKey(l.date_time) !== todayKey) continue;
      const arr = map.get(l.member_id) || [];
      arr.push(l);
      map.set(l.member_id, arr);
    }
    return map;
  }, [leaves, todayKey]);

  // -------------------- Filtering --------------------
  const filteredMembers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();

    return members.filter((m) => {
      const matchGuild = effectiveGuild === "All" || m.guild === effectiveGuild;
      const matchClass = filterClass === "All" || m.class === filterClass;
      const matchParty =
        filterParty === "All" ||
        (m.party ?? null) === filterParty ||
        (m.party_2 ?? null) === filterParty;
      const matchSpecial = !onlySpecial || !!m.is_special;

      const matchSearch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        (CLASS_CONFIG[m.class]?.display || "").toLowerCase().includes(q) ||
        (CLASS_CONFIG[m.class]?.th || "").toLowerCase().includes(q);

      return matchGuild && matchClass && matchParty && matchSpecial && matchSearch;
    });
  }, [members, effectiveGuild, filterClass, filterParty, onlySpecial, searchTerm]);

  const clearFilters = () => {
    setSearchTerm("");
    setFilterClass("All");
    setFilterParty("All");
    setOnlySpecial(false);
  };

  // -------------------- Actions --------------------
  const handleOpenModal = (member?: DbMember) => {
    if (member) {
      setEditingMember(member);
      setFormData({ ...member });
    } else {
      setEditingMember(null);

      const defaultGuild = canViewAllGuilds
        ? (effectiveGuild === "All" ? 1 : effectiveGuild)
        : (lockedGuild ?? 1);

      setFormData({
        name: "",
        class: "Ironclan",
        power: 0,
        guild: defaultGuild,

        party: null,
        pos_party: null,
        party_2: null,
        pos_party_2: null,

        is_special: false,
        color: null,
        discord_user_id: null,
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload: DbMember = {
      id: editingMember?.id ?? -1,
      name: String(formData.name || "").trim(),
      class: (formData.class as CharacterClass) || "Ironclan",
      power: Number(formData.power || 0),

      guild: (Number(formData.guild || 1) as GuildNo) || 1,

      party: formData.party ?? null,
      pos_party: formData.pos_party ?? null,
      party_2: formData.party_2 ?? null,
      pos_party_2: formData.pos_party_2 ?? null,

      is_special: !!formData.is_special,
      color: formData.color ?? null,
      discord_user_id: formData.discord_user_id ?? null,
    };

    if (!payload.name) return;

    // ✅ HEAD: กันแก้ guild ข้ามกิลด์
    if (!canViewAllGuilds && lockedGuild) {
      payload.guild = lockedGuild;
    }

    if (editingMember) {
      await onUpdateMember(payload);
    } else {
      const { id, ...createPayload } = payload;
      await onAddMember(createPayload);
    }

    setIsModalOpen(false);
  };

  const initiateDelete = (member: DbMember) => {
    setDeleteTargetMember(member);
    setIsDeleteModalOpen(true);
    setIsModalOpen(false);
  };

  const confirmDelete = async () => {
    if (!deleteTargetMember) return;
    await onDeleteMember(deleteTargetMember.id);
    setIsDeleteModalOpen(false);
    setDeleteTargetMember(null);
  };

  const openLeaveModal = (member: DbMember) => {
    setLeaveModalMember(member);
    setLeaveDateTime(nowDatetimeLocal());
    setLeaveReason("War");
    setLeaveNote("");
  };

  const confirmLeave = async () => {
    if (!leaveModalMember) return;

    const reasonText =
      leaveReason === "Other"
        ? leaveNote.trim()
          ? `Other: ${leaveNote.trim()}`
          : "Other"
        : leaveNote.trim()
          ? `${leaveReason}: ${leaveNote.trim()}`
          : leaveReason;

    await onReportLeave({
      member_id: leaveModalMember.id,
      date_time: new Date(leaveDateTime).toISOString(),
      reason: reasonText,
    });

    setLeaveModalMember(null);
  };

  // -------------------- Export / Import (xlsx dynamic only) --------------------
  const handleExport = async () => {
    if (filteredMembers.length === 0) return;

    const exportData = filteredMembers.map((m) => ({
      id: m.id,
      name: m.name,
      class: m.class,
      power: m.power,
      guild: m.guild,
      party: m.party ?? "",
      pos_party: m.pos_party ?? "",
      party_2: m.party_2 ?? "",
      pos_party_2: m.pos_party_2 ?? "",
      is_special: m.is_special ? "Y" : "N",
      color: m.color ?? "",
      discord_user_id: m.discord_user_id ?? "",
    }));

    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Members");

    const dateStr = new Date().toISOString().split("T")[0];
    const guildStr = effectiveGuild === "All" ? "All" : `G${effectiveGuild}`;
    XLSX.writeFile(wb, `Inferno_Members_${guildStr}_${dateStr}.xlsx`);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportErrors([]);

    try {
      const XLSX = await import("xlsx");
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const textData = XLSX.utils.sheet_to_csv(worksheet, { FS: "\t" });
      setImportText(textData);
    } catch {
      setImportErrors(["ไม่สามารถอ่านไฟล์ได้ กรุณาตรวจสอบว่าเป็นไฟล์ Excel หรือ CSV ที่ถูกต้อง"]);
      setIsErrorModalOpen(true);
    } finally {
      setIsImporting(false);
      e.target.value = "";
    }
  };

  const handleImportSubmit = async () => {
    setIsImporting(true);
    setImportErrors([]);

    setTimeout(async () => {
      try {
        const rows = importText.trim().split("\n");
        const newMembers: Omit<DbMember, "id">[] = [];
        const errors: string[] = [];

        rows.forEach((row, index) => {
          const trimmedRow = row.trim();
          if (!trimmedRow) return;

          const cols = trimmedRow.split(/[\t,]+/).map((c) => c.trim());
          if (cols[0].toLowerCase() === "name" || cols[0].toLowerCase() === "id") return;

          const name = cols[0];
          const rawClass = (cols[1] || "").toLowerCase();
          const powerStr = (cols[2] || "").replace(/[^0-9]/g, "");
          const guildStr = cols[3] || "";

          if (!name) {
            errors.push(`Row ${index + 1}: ไม่พบชื่อ`);
            return;
          }
          if (!powerStr || isNaN(parseInt(powerStr))) {
            errors.push(`${name}: พลังไม่ถูกต้อง`);
            return;
          }

          let matched: CharacterClass | null = null;

          if (rawClass === "1") matched = "Ironclan";
          else if (rawClass === "2") matched = "Bloodstorm";
          else if (rawClass === "3") matched = "Celestune";
          else if (rawClass === "4") matched = "Sylph";
          else if (rawClass === "5") matched = "Numina";
          else if (rawClass === "6") matched = "Nightwalker";
          else {
            for (const key of CLASSES) {
              const cfg = CLASS_CONFIG[key];
              if (
                rawClass.includes(cfg.en.toLowerCase()) ||
                rawClass.includes(cfg.th) ||
                rawClass.includes(cfg.display)
              ) {
                matched = key;
                break;
              }
            }
          }

          if (!matched) {
            errors.push(`${name}: ไม่รู้จักอาชีพ '${cols[1] || ""}'`);
            return;
          }

          // ✅ HEAD: ยึด lockedGuild เสมอ
          const resolvedGuild: GuildNo =
            !canViewAllGuilds && lockedGuild
              ? lockedGuild
              : ((effectiveGuild !== "All" ? effectiveGuild : (Number(guildStr) as GuildNo)) || 1);

          const party = cols[4] ? Number(cols[4]) : null;
          const pos_party = cols[5] ? Number(cols[5]) : null;
          const party_2 = cols[6] ? Number(cols[6]) : null;
          const pos_party_2 = cols[7] ? Number(cols[7]) : null;
          const is_special = (cols[8] || "").toUpperCase() === "Y";
          const color = cols[9] || null;
          const discord_user_id = cols[10] || null;

          newMembers.push({
            name,
            class: matched,
            power: parseInt(powerStr),
            guild: resolvedGuild,

            party: Number.isFinite(party as number) ? party : null,
            pos_party: Number.isFinite(pos_party as number) ? pos_party : null,
            party_2: Number.isFinite(party_2 as number) ? party_2 : null,
            pos_party_2: Number.isFinite(pos_party_2 as number) ? pos_party_2 : null,

            is_special,
            color,
            discord_user_id,
          });
        });

        if (errors.length) {
          setImportErrors(errors);
          setIsErrorModalOpen(true);
        } else if (newMembers.length) {
          await onImportMembers(newMembers);
          setIsImportModalOpen(false);
          setImportText("");
        }
      } catch {
        setImportErrors(["เกิดข้อผิดพลาดในการอ่านข้อมูล"]);
        setIsErrorModalOpen(true);
      } finally {
        setIsImporting(false);
      }
    }, 250);
  };

  // -------------------- UI helpers --------------------
  const guildLabel = (g: GuildNo) => `Inferno-${g}`;

  const partyLabel = (m: DbMember) => {
    const p1 = m.party ? `P${m.party}${m.pos_party ? `-${m.pos_party}` : ""}` : "";
    const p2 = m.party_2 ? `P${m.party_2}${m.pos_party_2 ? `-${m.pos_party_2}` : ""}` : "";
    if (p1 && p2) return `${p1} • ${p2}`;
    return p1 || p2 || "-";
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <Card noPadding className="sticky top-0 z-10 shadow-sm transition-all border border-zinc-200 dark:border-zinc-800">
        <div className="flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center p-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 rounded-t-lg">
          <div className="w-full xl:w-auto overflow-x-auto pb-2 xl:pb-0 hide-scrollbar">
            <div className="flex gap-2 min-w-max">
              {canViewAllGuilds ? (
                <>
                  <Button
                    variant={effectiveGuild === "All" ? "primary" : "ghost"}
                    onClick={() => setSelectedGuild("All")}
                    size="sm"
                  >
                    ทุกกิลด์
                  </Button>
                  {[1, 2, 3].map((g) => (
                    <Button
                      key={g}
                      variant={effectiveGuild === g ? "primary" : "ghost"}
                      onClick={() => setSelectedGuild(g as GuildNo)}
                      size="sm"
                    >
                      {guildLabel(g as GuildNo)}
                    </Button>
                  ))}
                </>
              ) : (
                <Button variant="primary" size="sm" disabled>
                  {guildLabel((lockedGuild ?? 1) as GuildNo)}
                </Button>
              )}
            </div>
          </div>

          <div className="flex gap-2 w-full xl:w-auto justify-end">
            <Button
              onClick={handleExport}
              variant="secondary"
              className="flex-1 md:flex-none whitespace-nowrap bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/15 dark:border-emerald-500/30"
            >
              <Icons.Share2 className="w-4 h-4 mr-2" /> นำออก
            </Button>
            <Button
              onClick={() => setIsImportModalOpen(true)}
              variant="secondary"
              className="flex-1 md:flex-none whitespace-nowrap"
            >
              <Icons.Activity className="w-4 h-4 mr-2" /> นำเข้า
            </Button>
            <Button onClick={() => handleOpenModal()} className="flex-1 md:flex-none whitespace-nowrap">
              <Icons.Users className="w-4 h-4 mr-2" /> เพิ่มสมาชิก
            </Button>
          </div>
        </div>

        <div className="p-4 bg-zinc-50/80 dark:bg-zinc-900/30 rounded-b-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
            <div className="lg:col-span-4 relative group">
              <Icons.Crosshair className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400 dark:text-zinc-500 group-focus-within:text-red-500 transition-colors" />
              <Input
                placeholder="ค้นหาชื่อ/อาชีพ..."
                className="pl-9 w-full shadow-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="lg:col-span-3">
              <Select
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value as CharacterClass | "All")}
                className="w-full shadow-sm text-sm"
              >
                <option value="All">ทุกอาชีพ</option>
                {CLASSES.map((c) => (
                  <option key={c} value={c}>
                    {CLASS_CONFIG[c].th}
                  </option>
                ))}
              </Select>
            </div>

            <div className="lg:col-span-2">
              <Select
                value={filterParty}
                onChange={(e) => setFilterParty(e.target.value === "All" ? "All" : Number(e.target.value))}
                className="w-full shadow-sm text-sm"
              >
                <option value="All">ทุกปาร์ตี้</option>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((p) => (
                  <option key={p} value={p}>
                    Party {p}
                  </option>
                ))}
              </Select>
            </div>

            <div className="lg:col-span-2 flex items-center gap-2">
              <Button
                variant={onlySpecial ? "primary" : "secondary"}
                size="sm"
                className="w-full h-10"
                onClick={() => setOnlySpecial((v) => !v)}
              >
                <Icons.Activity className="w-4 h-4 mr-1" /> เฉพาะศิษย์เอก
              </Button>
            </div>

            <div className="lg:col-span-1 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="w-full md:w-auto h-10 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-500 dark:text-zinc-400"
              >
                <Icons.X className="w-4 h-4 mr-1" /> ล้าง
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <div className="flex justify-end px-1">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          แสดง <span className="font-bold text-zinc-900 dark:text-zinc-100">{filteredMembers.length}</span> สมาชิก
        </p>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div
              key={i}
              className="rounded-lg h-44 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 animate-pulse p-4"
            />
          ))}
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="text-center py-16 px-4 bg-white dark:bg-zinc-950 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-900 mb-4">
            <Icons.Users className="w-8 h-8 text-zinc-400 dark:text-zinc-500" />
          </div>
          <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">ไม่พบข้อมูลสมาชิก</h3>
          <p className="text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto mb-6">
            ยังไม่มีสมาชิกในรายการ หรือไม่พบตามเงื่อนไขการค้นหา
          </p>
          <Button variant="outline" onClick={clearFilters}>
            ล้างตัวกรอง
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredMembers.map((m) => {
            const todayLeaves = leaveByMemberToday.get(m.id) || [];
            const hasLeaveToday = todayLeaves.length > 0;

            const classBgColor = (CLASS_DATA[m.class]?.color || "border-zinc-300")
              .split(" ")[0]
              .replace("border-", "bg-");

            return (
              <Card
                key={m.id}
                noPadding
                className={`relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${
                  hasLeaveToday
                    ? "border-amber-200 dark:border-amber-900/60"
                    : "border-zinc-200 dark:border-zinc-800 hover:border-red-300 dark:hover:border-red-700"
                }`}
              >
                <div className={`h-1.5 w-full ${classBgColor}`} />

                <div className="p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative">
                        <ClassIcon cls={m.class} size={52} />
                        <div className="absolute -bottom-1 -right-1 bg-zinc-800 text-white text-[9px] px-1.5 py-0.5 rounded-full border border-white dark:bg-zinc-200 dark:text-zinc-900 dark:border-zinc-950 font-bold shadow-sm">
                          {m.guild}
                        </div>
                      </div>

                      <div className="min-w-0">
                        <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-base leading-tight truncate" title={m.name}>
                          {m.name}
                        </h4>
                        <p className="text-xs font-bold text-zinc-400 dark:text-zinc-400 uppercase tracking-wide mt-0.5">
                          {CLASS_CONFIG[m.class]?.th || m.class}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      {m.is_special && <Badge variant="warning">ศิษย์เอก</Badge>}
                      {hasLeaveToday ? (
                        <Badge variant="danger">ลา</Badge>
                      ) : (
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-green-50 text-green-700 rounded-full text-[10px] font-bold border border-green-100 dark:bg-green-500/10 dark:text-green-300 dark:border-green-500/20">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                          พร้อม
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-zinc-50 dark:bg-zinc-900/40 rounded p-2 border border-zinc-100 dark:border-zinc-800">
                      <div className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase font-bold tracking-wider">Power</div>
                      <div className="text-sm font-bold text-zinc-800 dark:text-zinc-100 font-sans-num">
                        {(m.power || 0).toLocaleString()}
                      </div>
                    </div>

                    <div className="bg-zinc-50 dark:bg-zinc-900/40 rounded p-2 border border-zinc-100 dark:border-zinc-800">
                      <div className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase font-bold tracking-wider">Party</div>
                      <div className="text-sm font-bold text-zinc-800 dark:text-zinc-100">{partyLabel(m)}</div>
                    </div>
                  </div>

                  {m.discord_user_id && (
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                      Discord: <span className="font-mono text-zinc-700 dark:text-zinc-200">{m.discord_user_id}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs h-8"
                      onClick={() => handleOpenModal(m)}
                    >
                      <Icons.Edit className="w-3 h-3 mr-1.5" /> แก้ไข
                    </Button>
                    <Button
                      variant={hasLeaveToday ? "secondary" : "danger"}
                      size="sm"
                      className="w-full text-xs h-8"
                      onClick={() => openLeaveModal(m)}
                    >
                      {hasLeaveToday ? "มีรายการลา" : "แจ้งลา"}
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingMember ? "แก้ไขข้อมูลสมาชิก" : "ลงทะเบียนสมาชิกใหม่"}>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase mb-1">ชื่อตัวละคร</label>
              <Input
                required
                value={formData.name || ""}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="ชื่อในเกม"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase mb-1">อาชีพ</label>
              <Select value={(formData.class as any) ?? "Ironclan"} onChange={(e) => setFormData({ ...formData, class: e.target.value as CharacterClass })}>
                {CLASSES.map((c) => (
                  <option key={c} value={c}>
                    {CLASS_CONFIG[c].th}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase mb-1">พลัง</label>
              <Input
                type="number"
                required
                value={Number(formData.power || 0)}
                onChange={(e) => setFormData({ ...formData, power: Number(e.target.value) })}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase mb-1">กิลด์</label>
              <Select
                value={String(formData.guild ?? 1)}
                onChange={(e) => setFormData({ ...formData, guild: Number(e.target.value) as GuildNo })}
                disabled={!canViewAllGuilds && !!lockedGuild}
              >
                <option value="1">Inferno-1</option>
                <option value="2">Inferno-2</option>
                <option value="3">Inferno-3</option>
              </Select>
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200 select-none">
                <input
                  type="checkbox"
                  checked={!!formData.is_special}
                  onChange={(e) => setFormData({ ...formData, is_special: e.target.checked })}
                />
                ศิษย์เอก (is_special)
              </label>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase mb-1">Party 1</label>
              <Input type="number" value={formData.party ?? ""} onChange={(e) => setFormData({ ...formData, party: e.target.value === "" ? null : Number(e.target.value) })} />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase mb-1">Pos 1</label>
              <Input type="number" value={formData.pos_party ?? ""} onChange={(e) => setFormData({ ...formData, pos_party: e.target.value === "" ? null : Number(e.target.value) })} />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase mb-1">Party 2</label>
              <Input type="number" value={formData.party_2 ?? ""} onChange={(e) => setFormData({ ...formData, party_2: e.target.value === "" ? null : Number(e.target.value) })} />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase mb-1">Pos 2</label>
              <Input type="number" value={formData.pos_party_2 ?? ""} onChange={(e) => setFormData({ ...formData, pos_party_2: e.target.value === "" ? null : Number(e.target.value) })} />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase mb-1">Color</label>
              <Input value={formData.color ?? ""} onChange={(e) => setFormData({ ...formData, color: e.target.value })} placeholder="เช่น #FF0000 หรือชื่อสี" />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase mb-1">Discord User ID</label>
              <Input value={formData.discord_user_id ?? ""} onChange={(e) => setFormData({ ...formData, discord_user_id: e.target.value })} placeholder="เช่น 123456789012345678" />
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            {editingMember && (
              <Button type="button" variant="danger" className="mr-auto" onClick={() => initiateDelete(editingMember)}>
                ลบสมาชิก
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
              ยกเลิก
            </Button>
            <Button type="submit">บันทึก</Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="ยืนยันการลบสมาชิก">
        <div className="space-y-4">
          <div className="flex flex-col items-center justify-center p-4 text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-500/10 rounded-full flex items-center justify-center mb-4">
              <Icons.Trash className="w-8 h-8 text-red-600 dark:text-red-300" />
            </div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">ลบสมาชิก {deleteTargetMember?.name}?</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              การกระทำนี้จะลบข้อมูลสมาชิก และอาจต้องลบ leave ที่เกี่ยวข้องด้วย (ถ้าคุณตั้ง FK แบบ cascade)
            </p>
          </div>

          <div className="flex gap-3 justify-center pt-2">
            <Button variant="ghost" onClick={() => setIsDeleteModalOpen(false)} className="flex-1">
              ยกเลิก
            </Button>
            <Button variant="danger" onClick={confirmDelete} className="flex-1 bg-red-600 text-white hover:bg-red-700 border-transparent shadow-lg shadow-red-500/30">
              ยืนยันการลบ
            </Button>
          </div>
        </div>
      </Modal>

      {/* Leave Modal */}
      <Modal open={!!leaveModalMember} onClose={() => setLeaveModalMember(null)} title="บันทึกการลา">
        <div className="space-y-4">
          <div className="bg-zinc-50 dark:bg-zinc-900/40 p-3 rounded border border-zinc-200 dark:border-zinc-800">
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              กำลังทำรายการให้: <strong className="text-zinc-900 dark:text-zinc-100">{leaveModalMember?.name}</strong>
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase">วันเวลา</label>
            <Input type="datetime-local" value={leaveDateTime} onChange={(e) => setLeaveDateTime(e.target.value)} />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase">เหตุผล</label>
            <Select value={leaveReason} onChange={(e) => setLeaveReason(e.target.value as any)}>
              <option value="War">War</option>
              <option value="Personal">Personal</option>
              <option value="Other">Other</option>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase">หมายเหตุ (ถ้ามี)</label>
            <Input value={leaveNote} onChange={(e) => setLeaveNote(e.target.value)} placeholder="เช่น ติดงาน / ไม่สบาย / เดินทาง" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setLeaveModalMember(null)}>
              ยกเลิก
            </Button>
            <Button onClick={confirmLeave}>บันทึก</Button>
          </div>
        </div>
      </Modal>

      {/* Import Modal */}
      <Modal open={isImportModalOpen} onClose={() => !isImporting && setIsImportModalOpen(false)} title="นำเข้าสมาชิก">
        <div className="space-y-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            รูปแบบขั้นต่ำ: <strong>name\tclass\tpower\tguild</strong>
            <br />
            Optional ต่อท้าย: party, pos_party, party_2, pos_party_2, is_special(Y/N), color, discord_user_id
          </p>

          <div className="relative group">
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center ${
                isImporting
                  ? "bg-zinc-100 border-zinc-300 dark:bg-zinc-900/40 dark:border-zinc-700"
                  : "bg-white border-zinc-300 dark:bg-zinc-950 dark:border-zinc-700"
              }`}
            >
              <input
                type="file"
                accept=".csv, .xlsx, .xls"
                onChange={handleFileUpload}
                disabled={isImporting}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center justify-center">
                {isImporting ? (
                  <div className="w-8 h-8 border-4 border-zinc-400 border-t-transparent rounded-full animate-spin mb-2" />
                ) : (
                  <Icons.Share2 className="w-8 h-8 text-zinc-400 dark:text-zinc-500 mb-2 rotate-180" />
                )}
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  {isImporting ? "กำลังอ่านไฟล์..." : "คลิกเพื่ออัปโหลด"}
                </p>
              </div>
            </div>
          </div>

          <textarea
            className="w-full h-48 p-3 text-sm font-mono bg-zinc-50 dark:bg-zinc-900/40 text-zinc-900 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-700 rounded-lg"
            placeholder={`name\tclass\tpower\tguild\tparty\tpos_party\tparty_2\tpos_party_2\tis_special\tcolor\tdiscord_user_id\nHero1\t1\t55000\t1\t1\t1\t\t\tY\t#FF0000\t1234567890`}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            disabled={isImporting}
          />

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsImportModalOpen(false)} disabled={isImporting}>
              ยกเลิก
            </Button>
            <Button onClick={handleImportSubmit} disabled={isImporting || !importText} className="min-w-[140px]">
              {isImporting ? "กำลังประมวลผล..." : "ประมวลผล"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={isErrorModalOpen} onClose={() => setIsErrorModalOpen(false)} title="นำเข้าข้อมูลล้มเหลว">
        <div className="space-y-4">
          <div className="bg-red-50 dark:bg-red-500/10 border-l-4 border-red-500 p-4">
            <h3 className="text-sm font-medium text-red-800 dark:text-red-200">พบ {importErrors.length} ข้อผิดพลาด</h3>
          </div>
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-inner max-h-60 overflow-y-auto">
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {importErrors.map((error, idx) => (
                <li key={idx} className="p-3 text-sm text-zinc-700 dark:text-zinc-200 flex items-start gap-2">
                  <span className="font-mono text-red-500 font-bold">•</span>
                  {error}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={() => setIsErrorModalOpen(false)} variant="secondary">
              ปิดและแก้ไข
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
