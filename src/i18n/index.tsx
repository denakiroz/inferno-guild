"use client";

/**
 * Lightweight i18n (TH / EN) — ไม่พึ่ง library
 *
 * ใช้งาน:
 *   // 1) ประกาศ dictionary ใกล้ component (th/en อยู่คู่กันในแต่ละ key)
 *   const dict = defineDict({
 *     title:   { th: "โปรไฟล์", en: "Profile" },
 *     saved:   { th: "บันทึก {n} รายการ", en: "Saved {n} items" },
 *   });
 *   // 2) ใน component
 *   const t = useT(dict);
 *   t("title");              // "โปรไฟล์" | "Profile"
 *   t("saved", { n: 3 });    // แทนค่า {n}
 *
 * ภาษาที่เลือกเก็บใน localStorage ("inferno_lang") — ค่าเริ่มต้น th
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Lang = "th" | "en";
export type Dict = Record<string, { th: string; en: string }>;

const STORAGE_KEY = "inferno_lang";

type LangCtx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggleLang: () => void;
};

const LangContext = createContext<LangCtx | null>(null);

export function LangProvider({ children }: { children: React.ReactNode }) {
  // first render = th (ตรงกับ SSR) แล้วค่อย sync จาก localStorage หลัง mount
  const [lang, setLangState] = useState<Lang>("th");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "th" || saved === "en") setLangState(saved);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleLang = useCallback(() => setLang(lang === "th" ? "en" : "th"), [lang, setLang]);

  const value = useMemo(() => ({ lang, setLang, toggleLang }), [lang, setLang, toggleLang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangCtx {
  const ctx = useContext(LangContext);
  // นอก provider -> fallback เป็นไทย (ไม่ throw เพื่อไม่ให้หน้าอื่นพัง)
  return ctx ?? { lang: "th", setLang: () => {}, toggleLang: () => {} };
}

/** helper ให้ TS รู้ key ของ dictionary */
export function defineDict<D extends Dict>(d: D): D {
  return d;
}

function interpolate(s: string, vars?: Record<string, string | number>) {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

/** translate function ผูกกับ dictionary ที่ส่งมา */
export function useT<D extends Dict>(dict: D) {
  const { lang } = useLang();
  return useCallback(
    (key: keyof D & string, vars?: Record<string, string | number>) => interpolate(dict[key]?.[lang] ?? String(key), vars),
    [dict, lang]
  );
}

/** locale สำหรับ toLocaleDateString / Intl */
export function useLocale(): string {
  const { lang } = useLang();
  return lang === "th" ? "th-TH" : "en-US";
}

/** ปุ่มสลับภาษา TH | EN */
export function LangToggle({ className = "" }: { className?: string }) {
  const { lang, setLang } = useLang();
  const base = "px-2.5 py-1.5 text-xs font-bold transition-colors";
  const on = "bg-red-600 text-white";
  const off = "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800";
  return (
    <div
      className={["inline-flex overflow-hidden rounded-xl border border-zinc-300 dark:border-zinc-700", className].join(" ")}
      role="group"
      aria-label="Language"
    >
      <button type="button" className={`${base} ${lang === "th" ? on : off}`} onClick={() => setLang("th")}>
        TH
      </button>
      <button type="button" className={`${base} ${lang === "en" ? on : off}`} onClick={() => setLang("en")}>
        EN
      </button>
    </div>
  );
}
