"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type ThemeMode = "light" | "dark";

type ThemeCtx = {
  /** Raw theme state used by the app */
  theme: ThemeMode;
  /** Alias for compatibility with next-themes style naming */
  resolvedTheme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  /** Canonical toggle */
  toggleTheme: () => void;
  /** Alias for compatibility with existing UI (ThemeToggle) */
  toggle: () => void;
  /** True after first client mount */
  mounted: boolean;
};

const ThemeContext = createContext<ThemeCtx | null>(null);

const STORAGE_KEY = "inferno_theme";

function readInitialTheme(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  const saved = window.localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
  if (saved === "light" || saved === "dark") return saved;
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
  return prefersDark ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Keep SSR/first render stable (dark) then reconcile on mount.
  const [theme, setThemeState] = useState<ThemeMode>("dark");
  const [mounted, setMounted] = useState(false);

  const setTheme = useCallback((t: ThemeMode) => {
    setThemeState(t);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  // 1) Resolve theme on first mount from localStorage / system preference.
  useEffect(() => {
    setThemeState(readInitialTheme());
    setMounted(true);
  }, []);

  // 2) Apply theme to <html> and persist.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = window.document.documentElement;
    const isDark = theme === "dark";
    root.classList.toggle("dark", isDark);
    // Optional, but helps native controls follow theme.
    root.style.colorScheme = isDark ? "dark" : "light";
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const value = useMemo<ThemeCtx>(
    () => ({
      theme,
      resolvedTheme: theme,
      setTheme,
      toggleTheme,
      toggle: toggleTheme,
      mounted,
    }),
    [theme, setTheme, toggleTheme, mounted]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
