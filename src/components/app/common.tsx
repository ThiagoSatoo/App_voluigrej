import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/format";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";

const toneClass: Record<Tone, string> = {
  muted: "bg-muted text-muted-foreground",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-accent-foreground",
  accent: "bg-accent-soft text-accent-foreground",
  primary: "bg-primary-soft text-primary",
  info: "bg-info-soft text-info",
  destructive: "bg-destructive-soft text-destructive",
};

export function Pill({
  tone = "muted",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        toneClass[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-semibold sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0 rounded-2xl border bg-card p-4 shadow-soft sm:p-5", className)}>
      {children}
    </div>
  );
}

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "primary",
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: Tone;
}) {
  return (
    <Panel className="p-4">
      <div className={cn("mb-3 grid h-9 w-9 place-items-center rounded-xl", toneClass[tone])}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="font-display text-2xl font-semibold leading-none">{value}</div>
      <div className="mt-1.5 text-xs font-medium text-muted-foreground">{label}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground/80">{hint}</div>}
    </Panel>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  text,
  action,
}: {
  icon: LucideIcon;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed bg-card/60 px-6 py-10 text-center">
      <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft text-accent-foreground">
        <Icon className="h-6 w-6" />
      </div>
      <p className="font-display text-lg font-semibold">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Notice({
  tone = "warning",
  icon: Icon,
  children,
}: {
  tone?: Tone;
  icon?: LucideIcon;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-2xl px-4 py-3 text-sm font-medium",
        toneClass[tone],
      )}
    >
      {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0" />}
      <div>{children}</div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display">{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
          <AlertDialogAction className="rounded-xl" onClick={onConfirm}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function LoadingScreen() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-5">
      <Skeleton className="h-10 w-48 rounded-xl" />
      <Skeleton className="h-36 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
      <Skeleton className="h-48 w-full rounded-2xl" />
    </div>
  );
}

export function DateBadge({ date, className }: { date: string; className?: string }) {
  const d = new Date(`${date}T12:00:00`);
  const mon = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase();
  return (
    <div
      className={cn(
        "grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary",
        className,
      )}
    >
      <div className="text-center leading-none">
        <div className="font-display text-xl font-semibold">
          {String(d.getDate()).padStart(2, "0")}
        </div>
        <div className="mt-0.5 text-[10px] font-bold tracking-wider">{mon}</div>
      </div>
    </div>
  );
}
