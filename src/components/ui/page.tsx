'use client';

// src/components/ui/page.tsx
// Page-level layout primitives shared by every admin screen so they all follow
// the overview (index) page: no borders, no shadows, one quiet header, generous
// spacing, and short supporting copy.

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CaretLeft, CaretRight, type Icon as PhosphorIcon } from '@phosphor-icons/react';

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

export function Page({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <div className={`mx-auto w-full max-w-[1280px] space-y-8 ${className}`}>{children}</div>;
}

/* -------------------------------------------------------------------------- */
/* PageHeader                                                                  */
/* -------------------------------------------------------------------------- */

export interface PageHeaderProps {
  title: React.ReactNode;
  /** One short sentence. Keep it under ~70 characters. */
  description?: React.ReactNode;
  /** Back link to the parent list. Shown on mobile only; desktop has the sidebar. */
  back?: React.ReactNode;
  /** Inline element shown next to the title, e.g. a StatusPill. */
  badge?: React.ReactNode;
  /** Right-aligned actions. Prefer one primary button plus an overflow menu. */
  actions?: React.ReactNode;
  /** Optional leading visual (avatar on detail pages). */
  leading?: React.ReactNode;
}

export function PageHeader({ title, description, back, badge, actions, leading }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-5 pt-2 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        {leading}
        <div className="min-w-0">
          {back && <div className="mb-1 text-[13px] font-medium text-muted lg:hidden">{back}</div>}
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[28px] font-bold leading-tight tracking-[-0.03em] text-foreground">{title}</h1>
            {badge}
          </div>
          {description && <p className="mt-1 text-[14px] text-muted">{description}</p>}
        </div>
      </div>

      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* SectionHeader — title row inside a DashboardCard                            */
/* -------------------------------------------------------------------------- */

export interface SectionHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function SectionHeader({ title, description, actions, className = '' }: SectionHeaderProps) {
  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${className}`}>
      <div className="min-w-0">
        <h2 className="text-[16px] font-bold text-foreground">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Segmented — quiet pill tabs for page tabs and list filters                  */
/* -------------------------------------------------------------------------- */

export interface SegmentedOption<T extends string> {
  key: T;
  label: React.ReactNode;
  icon?: PhosphorIcon;
  count?: number;
}

export interface SegmentedProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (key: T) => void;
  size?: 'sm' | 'md';
  className?: string;
  'aria-label'?: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  className = '',
  'aria-label': ariaLabel,
}: SegmentedProps<T>) {
  const item = size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-9 px-4 text-[13px]';
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-default p-1 scrollbar-none ${className}`}
    >
      {options.map((opt) => {
        const active = opt.key === value;
        const OptIcon = opt.icon;
        return (
          <button
            key={opt.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.key)}
            className={`inline-flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-full font-medium transition-colors ${item} ${
              active ? 'bg-secondary text-secondary-foreground' : 'text-muted hover:text-foreground'
            }`}
          >
            {OptIcon && <OptIcon size={16} weight={active ? 'fill' : 'regular'} />}
            {opt.label}
            {opt.count !== undefined && (
              <span
                className={`tabular rounded-full px-1.5 text-[11px] ${
                  active ? 'bg-secondary-foreground/15 text-secondary-foreground' : 'bg-surface/60 text-muted'
                }`}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* LinkTabs — Segmented look for sibling routes (Fleet, Pricing, Config…)      */
/* -------------------------------------------------------------------------- */

export function LinkTabs({ tabs }: { tabs: { label: string; href: string; icon?: PhosphorIcon }[] }) {
  const pathname = usePathname();
  return (
    <nav className="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-default p-1 scrollbar-none">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        const TabIcon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 text-[13px] font-medium transition-colors ${
              active ? 'bg-secondary text-secondary-foreground' : 'text-muted hover:text-foreground'
            }`}
          >
            {TabIcon && <TabIcon size={16} weight={active ? 'fill' : 'regular'} />}
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

/* -------------------------------------------------------------------------- */
/* StatusPill                                                                  */
/* -------------------------------------------------------------------------- */

export type StatusTone = 'success' | 'warning' | 'danger' | 'accent' | 'brand' | 'neutral';

const TONE: Record<StatusTone, { pill: string; dot: string }> = {
  success: { pill: 'bg-success-soft text-success-soft-foreground', dot: 'bg-success' },
  warning: { pill: 'bg-warning-soft text-warning-soft-foreground', dot: 'bg-warning' },
  danger: { pill: 'bg-danger-soft text-danger-soft-foreground', dot: 'bg-danger' },
  accent: { pill: 'bg-accent-soft text-accent-soft-foreground', dot: 'bg-accent' },
  brand: { pill: 'bg-secondary-soft text-secondary-soft-foreground', dot: 'bg-secondary' },
  neutral: { pill: 'bg-default text-muted', dot: 'bg-muted' },
};

export function StatusPill({
  tone = 'neutral',
  dot = false,
  pulse = false,
  className = '',
  children,
}: {
  tone?: StatusTone;
  dot?: boolean;
  pulse?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const t = TONE[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-medium ${t.pill} ${className}`}
    >
      {dot && <span className={`size-1.5 rounded-full ${t.dot} ${pulse ? 'animate-pulse' : ''}`} />}
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* TablePagination — footer for paginated tables                               */
/* -------------------------------------------------------------------------- */

export function TablePagination({
  page,
  totalPages,
  summary,
  onChange,
}: {
  page: number;
  totalPages: number;
  summary?: React.ReactNode;
  onChange: (page: number) => void;
}) {
  const btn =
    'grid size-8 cursor-pointer place-items-center rounded-full text-foreground transition-colors hover:bg-default disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent';
  return (
    <div className="flex items-center justify-between gap-4 px-6 py-4 text-[13px] text-muted">
      <span className="tabular">{summary}</span>
      <div className="flex items-center gap-1">
        <button type="button" aria-label="Previous page" className={btn} disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <CaretLeft size={16} />
        </button>
        <span className="tabular px-2 text-foreground">
          {page} <span className="text-muted">of</span> {Math.max(totalPages, 1)}
        </span>
        <button
          type="button"
          aria-label="Next page"
          className={btn}
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          <CaretRight size={16} />
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* SkeletonRows — loading placeholder rows for a .data-table body              */
/* -------------------------------------------------------------------------- */

export function SkeletonRows({ cols, rows = 6 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          <td colSpan={cols}>
            <div className="h-6 w-full animate-pulse rounded-lg bg-default" />
          </td>
        </tr>
      ))}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* DetailList — label / value rows for profile and record details              */
/* -------------------------------------------------------------------------- */

export function DetailList({
  items,
  className = '',
}: {
  items: { label: string; value: React.ReactNode; hidden?: boolean }[];
  className?: string;
}) {
  return (
    <dl className={`space-y-3.5 text-[13px] ${className}`}>
      {items
        .filter((item) => !item.hidden)
        .map((item) => (
          <div key={item.label} className="flex items-start justify-between gap-4">
            <dt className="shrink-0 text-muted">{item.label}</dt>
            <dd className="tabular min-w-0 text-right font-medium text-foreground [overflow-wrap:anywhere]">
              {item.value ?? '—'}
            </dd>
          </div>
        ))}
    </dl>
  );
}

/* -------------------------------------------------------------------------- */
/* EmptyState                                                                  */
/* -------------------------------------------------------------------------- */

export function EmptyState({
  icon: EmptyIcon,
  title,
  description,
  action,
  className = '',
}: {
  icon?: PhosphorIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center gap-2 px-6 py-14 text-center ${className}`}>
      {EmptyIcon && (
        <span className="mb-1 grid size-12 place-items-center rounded-2xl bg-default text-muted">
          <EmptyIcon size={22} />
        </span>
      )}
      <p className="text-[14px] font-medium text-foreground">{title}</p>
      {description && <p className="max-w-sm text-[13px] text-muted">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
