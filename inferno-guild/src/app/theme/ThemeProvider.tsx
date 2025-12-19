"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type ThemeMode = "light" | "dark";

type ThemeCtx = {
  theme: ThemeMode;
  resolvedTheme: ThemeMode;     // alias
  setTheme: (t: ThemeMode) => void;
  toggleTheme: () => void;
  toggle: () => void;           // alias
  mounted: boolean;
};

const ThemeContext = createContext<ThemeCtx | null>(null);

const STORAGE_KEY = "inferno_theme";

function getInitialTheme(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  const saved = window.localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => getInitialTheme());
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // sync class บน <html> ทุกครั้งที่ theme เปลี่ยน
  useEffect(() => {
  const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
    localStorage.setItem("inferno_theme", theme);
  }, [theme]);


  const setTheme = useCallback((t: ThemeMode) => setThemeState(t), []);
  const toggleTheme = useCallback(() => setThemeState((p) => (p === "dark" ? "light" : "dark")), []);

  const value = useMemo(
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
