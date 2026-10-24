'use client';

// src/components/ui/dashboard-card.tsx
// Standardized reusable Dashboard Card component matching Kero design guidelines:
// - borderless, shadowless, rounded-3xl, bg-surface
// - Consistent typography, metric hierarchy, and iconography

import React from 'react';
import { Card } from '@heroui/react';
import { type Icon as PhosphorIcon } from '@phosphor-icons/react';

export interface DashboardCardProps extends React.ComponentProps<typeof Card> {
  className?: string;
  children: React.ReactNode;
}

export function DashboardCard({ className = '', children, ...props }: DashboardCardProps) {
  return (
    <Card
      className={`gap-0 rounded-3xl border-0 bg-surface p-6 shadow-none transition-all ${className}`}
      {...props}
    >
      {children}
    </Card>
  );
}

export interface StatDashboardCardProps {
  label: string;
  value: React.ReactNode;
  icon: PhosphorIcon;
  hint?: React.ReactNode;
  loading?: boolean;
  variant?: 'surface' | 'wallet' | 'danger' | 'warning' | 'success';
  className?: string;
  badge?: React.ReactNode;
  onClick?: () => void;
}

export function StatDashboardCard({
  label,
  value,
  icon: StatIcon,
  hint,
  loading,
  variant = 'surface',
  className = '',
  badge,
  onClick,
}: StatDashboardCardProps) {
  const isWallet = variant === 'wallet';

  const iconBgMap = {
    surface: 'bg-default text-foreground',
    wallet: 'bg-wallet-card-icon text-secondary',
    danger: 'bg-danger-soft text-danger',
    warning: 'bg-warning-soft text-warning',
    success: 'bg-success-soft text-success',
  };

  const cardBgMap = {
    surface: 'bg-surface text-foreground',
    wallet: 'bg-wallet-card text-wallet-card-foreground',
    danger: 'bg-surface text-foreground',
    warning: 'bg-surface text-foreground',
    success: 'bg-surface text-foreground',
  };

  return (
    <Card
      className={`gap-0 rounded-3xl border-0 p-6 shadow-none ${cardBgMap[variant]} ${
        onClick ? 'cursor-pointer hover:opacity-95' : ''
      } ${className}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <span
          className={`text-[13px] font-medium ${
            isWallet ? 'text-wallet-card-muted' : 'text-muted'
          }`}
        >
          {label}
        </span>
        <div className="flex items-center gap-2">
          {badge}
          <span className={`grid size-10 place-items-center rounded-2xl ${iconBgMap[variant]}`}>
            <StatIcon size={20} weight={variant === 'danger' ? 'fill' : 'regular'} />
          </span>
        </div>
      </div>

      <p className="tabular mt-5 text-[30px] font-bold leading-none tracking-[-0.03em]">
        {loading ? (
          <span
            className={`inline-block h-7 w-24 animate-pulse rounded-lg ${
              isWallet ? 'bg-wallet-card-icon' : 'bg-default'
            }`}
          />
        ) : (
          value
        )}
      </p>

      {hint && (
        <div
          className={`mt-3 text-xs ${
            isWallet ? 'text-wallet-card-muted' : 'text-muted'
          }`}
        >
          {hint}
        </div>
      )}
    </Card>
  );
}
