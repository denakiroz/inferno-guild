"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  LogOut,
  ChevronDown,
  Moon,
  Sun,
  Swords,
  Settings2,
  Calendar,
  Menu,
  X,
} from "lucide-react";

import { Button } from "@/app/components/UI";
import { useTheme } from "@/app/theme/ThemeProvider";

type MeRes = {
  ok: boolean;
  user?: {
    discordUserId: string;
    displayName: string;
    avatarUrl: string;
    guild: number;
    isAdmin: boolean;
    isHead: boolean;
  };
};

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  const [me, setMe] = useState<MeRes | null>(null);
  const [openProfile, setOpenProfile] = useState(false);

  // ✅ Hamburger sidebar (ซ้าย) — desktop: push content, mobile: overlay
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setMe(j as MeRes))
      .catch(() => setMe({ ok: false }));
  }, []);

  // ✅ เปลี่ยนหน้าแล้วปิดเมนู/โปรไฟล์ เพื่อไม่ค้าง
  useEffect(() => {
    setMenuOpen(false);
    setOpenProfile(false);
  }, [pathname]);

  // ✅ กด ESC ปิดเมนู
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setOpenProfile(false);
      }
    }
    if (menuOpen) window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  const roleLabel = useMemo(() => {
    if (!me?.ok) return null;
    if (me.user?.isAdmin) return "Admin";
    if (me.user?.isHead) return "Head";
    return "Member";
  }, [me]);

  async function logout() {
    try {
      await fetch("/api/logout", { method: "POST" });
    } finally {
      location.href = "/login";
    }
  }

  const items = useMemo(
    () => [
      { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/admin/admin", label: "Admin", icon: Settings2 },
      { href: "/admin/members", label: "Members", icon: Users },
      { href: "/admin/war-builder", label: "War Builder", icon: Swords },
      { href: "/admin/leaves", label: "Leaves", icon: Calendar },
    ],
    []
  );

  const closeAll = () => {
    setMenuOpen(false);
    setOpenProfile(false);
  };

  const toggleMenu = () => setMenuOpen((v) => !v);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* ✅ Top-left Hamburger */}
      <button
        type="button"
        className={[
          "fixed left-4 top-4 z-[60]",
          "rounded-2xl border border-zinc-200 dark:border-zinc-800",
          "bg-white/70 dark:bg-zinc-950/60 backdrop-blur px-3 py-2 shadow-sm",
          "hover:bg-white/90 dark:hover:bg-zinc-950/80",
        ].join(" ")}
        onClick={toggleMenu}
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        title={menuOpen ? "ปิดเมนู" : "เปิดเมนู"}
      >
        {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* ✅ Mobile overlay backdrop */}
      {menuOpen ? (
        <button
          type="button"
          className="md:hidden fixed inset-0 z-40 bg-black/20"
          onClick={closeAll}
          aria-label="Close menu"
        />
      ) : null}

      {/* ✅ Left Sidebar: desktop = push content, mobile = overlay */}
      <aside
        className={[
          "fixed z-50 left-0 top-0 bottom-0",
          "w-72 md:w-64",
          "bg-white/85 dark:bg-zinc-950/70 backdrop-blur",
          "border-r border-zinc-200 dark:border-zinc-800",
          "transition-transform duration-200 ease-out",
          menuOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <div className="h-full p-4 overflow-auto">
          <div className="pt-14 md:pt-12">
            <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Inferno Admin</div>
            <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Manage guild data</div>

            <nav className="mt-4 space-y-1">
              {items.map((it) => {
                const active =
                  pathname === it.href || (it.href !== "/admin" && pathname?.startsWith(it.href));
                const Icon = it.icon;
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    onClick={() => setMenuOpen(false)}
                    className={[
                      "flex items-center gap-2 px-3 py-2 rounded-xl text-sm border transition",
                      active
                        ? "bg-red-600 text-white border-red-600"
                        : "bg-white/50 dark:bg-zinc-950/40 text-zinc-700 dark:text-zinc-200 border-transparent hover:border-zinc-200 dark:hover:border-zinc-800",
                    ].join(" ")}
                  >
                    <Icon className="w-4 h-4" />
                    {it.label}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-6 border-t border-zinc-200 dark:border-zinc-800 pt-4 space-y-2">
              <Button variant="outline" className="w-full justify-center" onClick={toggleTheme}>
                {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                สลับธีม
              </Button>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenProfile((v) => !v)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-950/40"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={me?.user?.avatarUrl ?? "/favicon.ico"}
                    alt="avatar"
                    className="h-8 w-8 rounded-xl border border-zinc-200 dark:border-zinc-800"
                  />
                  <div className="min-w-0 flex-1 text-left">
                    <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                      {me?.user?.displayName ?? "Guest"}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                      {roleLabel ?? "-"} • Guild {me?.user?.guild ?? "-"}
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-zinc-500" />
                </button>

                {openProfile ? (
                  <div className="absolute left-0 right-0 mt-2 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-lg overflow-hidden z-20">
                    <Link
                      href="/me"
                      className="block px-4 py-3 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                      onClick={() => {
                        setOpenProfile(false);
                        setMenuOpen(false);
                      }}
                    >
                      ไปหน้าโปรไฟล์
                    </Link>
                    <button
                      type="button"
                      onClick={logout}
                      className="w-full text-left px-4 py-3 text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-2"
                    >
                      <LogOut className="w-4 h-4" />
                      ออกจากระบบ
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* ✅ Main: desktop push เมื่อ menuOpen */}
      <div
        className={[
          "transition-[padding-left] duration-200 ease-out",
          // ปุ่ม hamburger วางทับอยู่แล้ว เลยเพิ่ม padding-top กันชนิด content ชน
          "pt-14 md:pt-0",
          menuOpen ? "md:pl-64" : "md:pl-0",
        ].join(" ")}
      >
        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
