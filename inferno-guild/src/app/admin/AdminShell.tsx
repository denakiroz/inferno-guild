"use client";

// src/app/admin/AdminShell.tsx
import React, { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/app/theme/ThemeProvider";
import {
  Home,
  Users,
  Sword,
  CalendarDays,
  ClipboardList,
  Menu,
  Sun,
  Moon,
  ChevronRight,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { theme, resolvedTheme, toggleTheme, mounted } = useTheme();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarLocked, setSidebarLocked] = useState(true);
  const [sidebarHover, setSidebarHover] = useState(false);

  const isDesktopExpanded = sidebarLocked || sidebarHover;

  const nav: NavItem[] = useMemo(
    () => [
      { href: "/admin/dashboard", label: "แดชบอร์ด", icon: Home },
      { href: "/admin/members", label: "สมาชิก", icon: Users },
      { href: "/admin/war-builder", label: "จัดทัพวอ", icon: Sword },
      { href: "/admin/leaves", label: "จัดการการลา", icon: ClipboardList },
      { href: "/admin/history", label: "คลังข้อมูลสงคราม", icon: CalendarDays },
      { href: "/admin/regular-wars", label: "ประวัติวอ-ธรรมดา", icon: CalendarDays },
    ],
    []
  );

  const title = useMemo(() => {
    const hit = nav.find((n) => pathname?.startsWith(n.href));
    return hit?.label ?? "Admin";
  }, [pathname, nav]);

  return (
    <div className="flex h-screen overflow-hidden bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 w-full h-16 z-50 flex items-center justify-between px-4 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900"
            aria-label="Toggle menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-lg font-bold text-red-700 dark:text-red-400 rpg-font">
            INFERNO
          </span>
        </div>

        <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900"
            aria-label="Toggle theme"
            >
            {!mounted ? null : resolvedTheme === "dark" ? (
                <Sun className="w-5 h-5" />
            ) : (
                <Moon className="w-5 h-5" />
            )}
            </button>
      </div>

      {/* Sidebar */}
      <aside
        className={[
          "fixed inset-y-0 left-0 z-40",
          "border-r shadow-xl md:shadow-none",
          "bg-white dark:bg-zinc-950",
          "border-zinc-200 dark:border-zinc-800",
          "transform transition-all duration-300 ease-in-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "md:relative md:translate-x-0",
          isDesktopExpanded ? "md:w-64" : "md:w-20",
        ].join(" ")}
        onMouseEnter={() => setSidebarHover(true)}
        onMouseLeave={() => setSidebarHover(false)}
      >
        {/* Sidebar top */}
        <div className="p-4 h-16 flex items-center gap-3 overflow-hidden whitespace-nowrap border-b border-zinc-100 dark:border-zinc-900">
          <button
            onClick={() => setSidebarLocked((v) => !v)}
            className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-200 transition-colors"
            aria-label="Lock sidebar"
            title="ขยาย/ย่อเมนู"
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className={`transition-all duration-300 ${isDesktopExpanded ? "opacity-100 w-auto" : "opacity-0 w-0"}`}>
            <h1 className="text-xl font-bold rpg-font tracking-wider">INFERNO</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 -mt-1">
              Guild Manager
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="mt-4 space-y-1 px-2">
          {nav.map((item) => {
            const active = pathname?.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={[
                  "relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg",
                  "text-sm font-medium transition-all overflow-hidden whitespace-nowrap",
                  active
                    ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                    : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:text-zinc-100 dark:hover:bg-zinc-900/60",
                ].join(" ")}
                title={!isDesktopExpanded ? item.label : ""}
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-zinc-100 dark:bg-zinc-900">
                  <Icon className={active ? "w-5 h-5 text-red-600 dark:text-red-300" : "w-5 h-5"} />
                </div>

                <span className={`transition-all duration-300 ${isDesktopExpanded ? "opacity-100" : "opacity-0 w-0"}`}>
                  {item.label}
                </span>

                <ChevronRight
                  className={[
                    "ml-auto w-4 h-4 transition-all",
                    isDesktopExpanded ? "opacity-60" : "opacity-0",
                  ].join(" ")}
                />
              </Link>
            );
          })}
        </nav>

        {/* Sidebar footer */}
        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-zinc-100 dark:border-zinc-900">
          <button
            onClick={toggleTheme}
            className={[
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg",
              "hover:bg-zinc-50 dark:hover:bg-zinc-900/60",
              "text-sm text-zinc-700 dark:text-zinc-200",
            ].join(" ")}
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-zinc-100 dark:bg-zinc-900">
            {!mounted ? null : resolvedTheme === "dark" ? (
                <Sun className="w-5 h-5" />
            ) : (
                <Moon className="w-5 h-5" />
            )}
            </div>

            <span className={`${isDesktopExpanded ? "opacity-100" : "opacity-0 w-0"} transition-all duration-300`}>
            สลับโหมด {mounted ? (resolvedTheme === "dark" ? "สว่าง" : "มืด") : ""}
            </span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto h-full pt-16 md:pt-0 bg-white dark:bg-zinc-950 relative">
        <div className="min-h-full w-full p-4 md:p-8 max-w-7xl mx-auto">
          <header className="mb-6 flex items-end justify-between">
            <div>
              <h2 className="text-3xl font-bold rpg-font">{title}</h2>
              <p className="text-zinc-500 dark:text-zinc-400">
                จัดการกิลด์ของคุณอย่างมีประสิทธิภาพ
              </p>
            </div>
          </header>

          {children}
        </div>
      </main>
    </div>
  );
}
