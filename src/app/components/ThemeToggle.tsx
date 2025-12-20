"use client";

import React from "react";
import { useTheme } from "@/app/theme/ThemeProvider";
import { Icons } from "@/app/components/Icon";

export function ThemeToggle() {
  const { resolvedTheme, toggle, mounted } = useTheme();

  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex items-center justify-center h-10 w-10 rounded-xl border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50 active:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-200 dark:hover:bg-zinc-900 dark:active:bg-zinc-800"
      aria-label="Toggle theme"
      title={mounted && resolvedTheme === "dark" ? "Switch to light" : "Switch to dark"}
    >
      {!mounted ? null : resolvedTheme === "dark" ? (
        <Icons.Sword className="h-5 w-5" />
      ) : (
        <Icons.Shield className="h-5 w-5" />
      )}
    </button>
  );
}
