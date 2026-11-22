import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        outline: "border border-border bg-card hover:bg-muted",
        secondary: "bg-muted text-foreground hover:bg-muted/70",
        success: "bg-emerald-600 text-white hover:bg-emerald-700",
        destructive: "bg-destructive text-white hover:bg-destructive/90",
        ghost: "hover:bg-muted",
      },
      size: { default: "h-9 px-4 py-2", sm: "h-8 px-3 text-xs", icon: "h-9 w-9" },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> { asChild?: boolean }
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild, ...p }, ref) => {
  const C = asChild ? Slot : "button";
  return <C ref={ref as any} className={cn(buttonVariants({ variant, size }), className)} {...(p as any)} />;
});

export const Card = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("rounded-lg border border-border bg-card shadow-sm", className)} {...p} />;
export const CardHeader = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("flex flex-col gap-1 p-5 pb-3", className)} {...p} />;
export const CardTitle = ({ className, ...p }: React.HTMLAttributes<HTMLHeadingElement>) => <h3 className={cn("font-semibold leading-none", className)} {...p} />;
export const CardContent = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("p-5 pt-2", className)} {...p} />;

const field = "w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60";
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => <input ref={ref} className={cn(field, className)} {...p} />);
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => <textarea ref={ref} rows={3} className={cn(field, className)} {...p} />);
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...p }, ref) => <select ref={ref} className={cn(field, className)} {...p} />);
export const Label = ({ className, ...p }: React.LabelHTMLAttributes<HTMLLabelElement>) => <label className={cn("text-sm font-medium", className)} {...p} />;

export function Progress({ value, className }: { value: number; className?: string }) {
  return <div className={cn("h-3 w-full overflow-hidden rounded-full bg-muted", className)}><div className="h-full bg-primary transition-all" style={{ width: `${value}%` }} /></div>;
}

const badgeColors: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700", MENUNGGU_VALIDASI: "bg-amber-100 text-amber-800", DISETUJUI: "bg-emerald-100 text-emerald-800",
  PERLU_REVISI: "bg-rose-100 text-rose-800", DIBATALKAN: "bg-slate-200 text-slate-500 line-through",
};
export const StatusBadge = ({ status, label }: { status: string; label: string }) =>
  <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", badgeColors[status] ?? "bg-muted")}>{label}</span>;

export const FieldError = ({ errors }: { errors: unknown[] }) => {
  const msg = errors.map((e) => (typeof e === "string" ? e : (e as any)?.message)).filter(Boolean)[0];
  return msg ? <p className="mt-1 text-xs text-destructive">{msg}</p> : null;
};
