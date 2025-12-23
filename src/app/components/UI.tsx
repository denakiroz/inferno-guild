import React from "react";

/** Utility */
function cn(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

/** Card */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  noPadding?: boolean;
}
export const Card: React.FC<CardProps> = ({ className, noPadding, ...props }) => (
  <div
    className={cn(
      "rounded-2xl border border-zinc-200 bg-white shadow-sm",
      "dark:border-zinc-800 dark:bg-zinc-950",
      noPadding ? "" : "p-6",
      className
    )}
    {...props}
  />
);

/** Badge */
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "danger" | "outline";
}
export const Badge: React.FC<BadgeProps> = ({ variant = "default", className, ...props }) => {
  const variants: Record<string, string> = {
    default:
      "bg-zinc-100 text-zinc-800 border border-zinc-200 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-800",
    success:
      "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900",
    warning:
      "bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900",
    danger:
      "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-900",
    outline:
      "bg-transparent text-zinc-800 border border-zinc-300 dark:text-zinc-100 dark:border-zinc-700",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
        variants[variant],
        className
      )}
      {...props}
    />
  );
};

/** Button */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline" | "default";
  size?: "sm" | "md" | "lg";
}
export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  className,
  ...props
}) => {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 focus-visible:ring-offset-2 " +
    "focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950 " +
    "disabled:opacity-50 disabled:cursor-not-allowed select-none";

  const variants: Record<string, string> = {
    default:
      "bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-sm shadow-red-900/10",
    primary:
      "bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-sm shadow-red-900/10",
    secondary:
      "bg-zinc-900 text-white hover:bg-zinc-800 active:bg-zinc-950 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200",
    danger:
      "bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 shadow-sm shadow-rose-900/10",
    ghost:
      "bg-transparent text-zinc-900 hover:bg-zinc-100 active:bg-zinc-200 dark:text-zinc-100 dark:hover:bg-zinc-900 dark:active:bg-zinc-800",
    outline:
      "bg-transparent border border-zinc-300 text-zinc-900 hover:bg-zinc-50 active:bg-zinc-100 " +
      "dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900 dark:active:bg-zinc-800",
  };

  const sizes: Record<string, string> = {
    sm: "h-9 px-3 text-sm",
    md: "h-11 px-4 text-sm",
    lg: "h-12 px-5 text-base",
  };

  return (
    <button
      suppressHydrationWarning
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    />
  );
};

/** Input */
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      suppressHydrationWarning
      className={cn(
        "h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm",
        "placeholder:text-zinc-400",
        "focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500",
        "dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

/** Select */
export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }
>(({ className, invalid, ...props }, ref) => (
  <select
    ref={ref}
    suppressHydrationWarning
    aria-invalid={invalid ? true : undefined}
    className={cn(
      "h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm",
      "focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500",
      "dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100",
      // ✅ FIX: Tailwind syntax ต้องเป็น focus:!xxx ไม่ใช่ !focus:xxx
      // และต้อง override ทั้ง border + ring ตอน focus
      invalid ? "!border-rose-500 focus:!border-rose-500 focus:!ring-rose-500/30" : "",
      className
    )}
    {...props}
  />
));
Select.displayName = "Select";

/** Modal */
export interface ModalProps {
  open: boolean;
  title?: string;
  children?: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
  className?: string;
}
export const Modal: React.FC<ModalProps> = ({
  open,
  title,
  children,
  onClose,
  footer,
  className,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className={cn(
            "w-full max-w-lg rounded-2xl border border-zinc-200 bg-white shadow-xl",
            "dark:border-zinc-800 dark:bg-zinc-950",
            className
          )}
          role="dialog"
          aria-modal="true"
        >
          {(title || footer) && (
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
              <div className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                {title}
              </div>
              <button
                onClick={onClose}
                className="rounded-lg px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
              >
                ปิด
              </button>
            </div>
          )}

          <div className="px-5 py-4">{children}</div>

          {footer && (
            <div className="flex items-center justify-end gap-2 border-t border-zinc-200 px-5 py-4 dark:border-zinc-800">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
