"use client";

import React from "react";
import dynamic from "next/dynamic";

// ⚡ MemberPotentialClient ใหญ่ (~2.2k บรรทัด + xlsx lazy) — แยกเป็น chunk ของตัวเอง
// และใช้ skeleton ระหว่างรอโหลด เพื่อให้ผู้ใช้เห็นหน้าไวขึ้น
const MemberPotentialClient = dynamic(() => import("./MemberPotentialClient"), {
  ssr: false,
  loading: () => (
    <div className="mx-auto w-full max-w-[1700px] px-4 md:px-6 py-6 space-y-3">
      <div className="h-8 w-48 rounded-md bg-zinc-100 dark:bg-zinc-900 animate-pulse" />
      <div className="h-10 w-full rounded-md bg-zinc-100 dark:bg-zinc-900 animate-pulse" />
      <div className="h-10 w-full rounded-md bg-zinc-100 dark:bg-zinc-900 animate-pulse" />
      <div className="h-96 w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 animate-pulse" />
    </div>
  ),
});

export default function MemberPotentialLoader() {
  return <MemberPotentialClient />;
}
