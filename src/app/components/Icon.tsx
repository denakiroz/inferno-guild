import React from "react";

/**
 * IMPORTANT:
 * - ถ้าโปรเจกต์คุณมี types อยู่ที่ src/types ให้ใช้ "@/types"
 * - ถ้าอยู่ที่ src/app/types ให้เปลี่ยน path ให้ตรง
 */
import type { CharacterClass } from "../types";

type IconProps = React.SVGProps<SVGSVGElement> & { size?: number };

function IconBase({ size = 20, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

/** Minimal icon set (simple + stable) */
const Home = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 10v10h14V10" />
  </IconBase>
);

const Menu = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M4 6h16" />
    <path d="M4 12h16" />
    <path d="M4 18h16" />
  </IconBase>
);

const ChevronRight = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M9 18l6-6-6-6" />
  </IconBase>
);

const Users = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="3" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a3 3 0 0 1 0 5.74" />
  </IconBase>
);

const Calendar = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M8 2v4" />
    <path d="M16 2v4" />
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M3 10h18" />
  </IconBase>
);

const Activity = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M22 12h-4l-3 9-6-18-3 9H2" />
  </IconBase>
);

const LogOut = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5" />
    <path d="M21 12H9" />
  </IconBase>
);

const CheckCircle = (p: IconProps) => (
  <IconBase {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="M8 12l2.5 2.5L16 9" />
  </IconBase>
);

const XCircle = (p: IconProps) => (
  <IconBase {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="M15 9l-6 6" />
    <path d="M9 9l6 6" />
  </IconBase>
);

const AlertTriangle = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M10.3 3.6 2.2 18a2 2 0 0 0 1.8 3h16a2 2 0 0 0 1.8-3L13.7 3.6a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </IconBase>
);

const Filter = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M22 3H2l8 9v7l4 2v-9l8-9z" />
  </IconBase>
);

const X = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M18 6 6 18" />
    <path d="M6 6l12 12" />
  </IconBase>
);

const Trash2 = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="M19 6l-1 14H6L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </IconBase>
);

const Map = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M9 18l-6 3V6l6-3 6 3 6-3v15l-6 3-6-3z" />
    <path d="M9 3v15" />
    <path d="M15 6v15" />
  </IconBase>
);

const Plus = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </IconBase>
);

const Image = (p: IconProps) => (
  <IconBase {...p}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M8.5 10.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
    <path d="M21 16l-5-5-4 4-2-2-7 7" />
  </IconBase>
);

const Pen = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z" />
  </IconBase>
);

const Redo = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M21 7v6h-6" />
    <path d="M3 17a9 9 0 0 1 15-6l3 2" />
  </IconBase>
);

const ClipboardCopy = (p: IconProps) => (
  <IconBase {...p}>
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    <path d="M8 2h6v4H8z" />
  </IconBase>
);

/** Optional fantasy-ish aliases kept from your old file */
const Sword = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M14 3l7 7-4 1-3 3-3 7-2-2 7-3 3-3 1-4-7-7z" />
    <path d="M3 21l6-6" />
  </IconBase>
);

const Shield = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M12 2l8 4v6c0 5-3.5 9.5-8 10-4.5-.5-8-5-8-10V6l8-4z" />
  </IconBase>
);

const Heart = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 22l7.8-8.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
  </IconBase>
);

const Zap = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" />
  </IconBase>
);

const Crosshair = (p: IconProps) => (
  <IconBase {...p}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 2v4" />
    <path d="M12 18v4" />
    <path d="M2 12h4" />
    <path d="M18 12h4" />
  </IconBase>
);

const Share2 = (p: IconProps) => (
  <IconBase {...p}>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="M8.7 13.4l6.6 3.2" />
    <path d="M15.3 7.4L8.7 10.6" />
  </IconBase>
);

const Coffee = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M3 8h14v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z" />
    <path d="M17 10h2a2 2 0 0 1 0 4h-2" />
    <path d="M7 2v2" />
    <path d="M11 2v2" />
    <path d="M15 2v2" />
  </IconBase>
);

const Trophy = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M8 4h8v3a4 4 0 0 1-8 0V4z" />
    <path d="M6 4H4v3a4 4 0 0 0 4 4" />
    <path d="M18 4h2v3a4 4 0 0 1-4 4" />
    <path d="M12 15v4" />
    <path d="M8 21h8" />
  </IconBase>
);

const Skull = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M12 2a8 8 0 0 0-4 15v3h8v-3a8 8 0 0 0-4-15z" />
    <path d="M9 12h.01" />
    <path d="M15 12h.01" />
    <path d="M10 16h4" />
  </IconBase>
);

/** Export map: keep names your pages likely use */
export const Icons = {
  Home,
  Menu,
  ChevronRight,
  Users,
  Calendar,
  Activity,
  LogOut,
  CheckCircle,
  XCircle,
  Alert: AlertTriangle,
  Share2,
  Filter,
  X,
  Trophy,
  Skull,
  Trash: Trash2,
  Map,
  Plus,
  Edit: Pen,
  Image,
  Redo,
  ClipboardCopy,
  Sword,
  Shield,
  Heart,
  Zap,
  Crosshair,
  Leave: Coffee,
};

/** Class avatar colors/images (เหมือนเดิม) */
export const CLASS_DATA: Record<
  CharacterClass,
  { img: string; color: string }
> = {
  Ironclan: { img: "https://img2.pic.in.th/pic/ironclan.jpg", color: "#ef4444" },
  Spear: { img: "https://img5.pic.in.th/file/secure-sv1/spear.jpg", color: "#3b82f6" },
  Harp: { img: "https://img5.pic.in.th/file/secure-sv1/harp.jpg", color: "#a855f7" },
  // เพิ่มให้ครบตาม CharacterClass ของคุณ
} as any;

export const ClassIcon: React.FC<{ cls: CharacterClass; size?: number; className?: string }> = ({
  cls,
  size = 36,
  className,
}) => {
  const data = (CLASS_DATA as any)[cls] as { img?: string; color?: string } | undefined;

  const ring = data?.color ?? "#ef4444";
  const src = data?.img ? String(data.img).trim() : "";

  // ✅ ถ้าไม่มีรูปจริง ๆ อย่า render <img src="">
  if (!src) {
    return (
      <div
        aria-label={String(cls)}
        title={String(cls)}
        className={
          "rounded-full ring-2 ring-offset-2 ring-offset-white dark:ring-offset-zinc-950 " +
          (className ?? "")
        }
        style={{
          width: size,
          height: size,
          background: ring,
        }}
      />
    );
  }

  return (
    <img
      src={src}
      alt={String(cls)}
      width={size}
      height={size}
      className={
        "rounded-full object-cover ring-2 ring-offset-2 ring-offset-white dark:ring-offset-zinc-950 " +
        (className ?? "")
      }
      // ✅ ringColor ไม่มีใน CSS; ใช้ boxShadow จำลองสี ring แบบชัวร์
      style={{
        boxShadow: `0 0 0 2px ${ring}, 0 0 0 4px rgba(0,0,0,0)`,
      }}
    />
  );
};
