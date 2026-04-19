"use client";

// Global client-side providers — React Query + Theme
// กอด ThemeProvider เดิมไว้ข้างใน เพื่อ migrate แบบไม่ break ที่อื่น

import React, { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { makeQueryClient } from "@/lib/queryClient";
import { ThemeProvider } from "@/app/theme/ThemeProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  // useState ensures QueryClient ถูกสร้างครั้งเดียวต่อ browser session
  // (ถ้าสร้างใน module scope → แชร์ข้าม request บน server ได้ ไม่ปลอดภัย)
  const [queryClient] = useState(() => makeQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>{children}</ThemeProvider>
      {process.env.NODE_ENV !== "production" && (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-right" />
      )}
    </QueryClientProvider>
  );
}
