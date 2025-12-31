"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, LogOut, ChevronDown, Moon, Sun, Swords, Settings2, Calendar } from "lucide-react";

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

  useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setMe(j as MeRes))
      .catch(() => setMe({ ok: false }));
  }, []);

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
    [],
  );

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="flex">
        <aside className="w-64 p-4 hidden md:block">
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/50 backdrop-blur p-4 sticky top-4">
            <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Inferno Admin</div>
            <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Manage guild data</div>

            <nav className="mt-4 space-y-1">
              {items.map((it) => {
                const active = pathname === it.href || (it.href !== "/admin" && pathname?.startsWith(it.href));
                const Icon = it.icon;
                return (
                  <Link
                    key={it.href}
                    href={it.href}
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
                      onClick={() => setOpenProfile(false)}
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
        </aside>

        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
