// src/app/admin/layout.tsx
import AdminShell from "@/app/admin/AdminShell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
