'use client';

// src/app/page.tsx
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Wallet,
  Path,
  SteeringWheel,
  IdentificationCard,
  ArrowClockwise,
  Plus,
  PaperPlaneTilt,
  TrendUp,
  TrendDown,
  Broadcast,
  ShieldCheck,
  Bank,
  ArrowRight,
  MapPin,
  NavigationArrow,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react';
import { Card, Modal, Label, Select, ListBox } from '@heroui/react';
import { AppButton } from '@/components/ui/app-button';
import { AppInput } from '@/components/ui/app-input';
import { DashboardCard, StatDashboardCard } from '@/components/ui/dashboard-card';
import { api } from '@/lib/api';
import { DashboardResponse } from '@/types/admin';
import { formatKoboToNaira, formatNumber } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { DispatchPerformanceChart } from '@/components/dashboard/dispatch-chart';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function Delta({ value }: { value: number }) {
  const positive = value >= 0;
  const DeltaIcon = positive ? TrendUp : TrendDown;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
        positive ? 'bg-success-soft text-success-soft-foreground' : 'bg-danger-soft text-danger-soft-foreground'
      }`}
    >
      <DeltaIcon size={12} weight="bold" />
      {positive ? '+' : ''}
      {value}%
    </span>
  );
}

const QUICK_LINKS: { label: string; description: string; href: string; icon: PhosphorIcon }[] = [
  { label: 'Live Watch', description: 'Real-time map of trips & drivers', href: '/live-watch', icon: Broadcast },
  { label: 'Driver verification', description: 'Review pending KYC submissions', href: '/drivers/review-queue', icon: IdentificationCard },
  { label: 'Lagos Road Tax', description: 'Statutory road tax & remittances', href: '/finance/lagos', icon: Bank },
  { label: 'Permission matrix', description: 'Manage staff roles & access', href: '/roles', icon: ShieldCheck },
];

const VEHICLE_CLASSES = [
  { id: 'standard', label: 'Standard · 4 seats' },
  { id: 'comfort', label: 'Comfort Executive' },
  { id: 'keke', label: 'Kero Keke' },
];

export default function DashboardOverviewPage() {
  const { admin } = useAuthStore();
  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [today, setToday] = useState('');
  const [salutation, setSalutation] = useState('Welcome back');

  useEffect(() => {
    setToday(new Date().toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long' }));
    setSalutation(greeting());
  }, []);

  const { data, isLoading, refetch, isFetching } = useQuery<DashboardResponse>({
    queryKey: ['admin', 'dashboard'],
    queryFn: async () => {
      const res = await api.get('/admin/dashboard');
      return res.data?.data;
    },
    refetchInterval: 30000,
  });

  const overview = data?.overview;
  const revenue = data?.revenue;
  const trips = data?.trips;
  const drivers = data?.drivers;

  const activeDrivers = overview?.activeDrivers ?? drivers?.online ?? 0;
  const totalDrivers = overview?.totalDrivers ?? 0;
  const totalRiders = overview?.totalRiders ?? 0;
  const onTrip = drivers?.onTrip ?? 0;
  const utilisation = activeDrivers > 0 ? Math.round((onTrip / activeDrivers) * 100) : 0;
  const firstName = admin?.fullname?.split(' ')[0];

  return (
    <div className="mx-auto max-w-[1280px] space-y-8">
        {/* ------------------------------------------------------------ Header */}
        <div className="flex flex-col gap-5 pt-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="h-5 text-[13px] font-medium text-muted">{today}</p>
            <h1 className="mt-1 text-[28px] font-bold leading-tight tracking-[-0.03em] text-foreground">
              {salutation}
              {firstName ? `, ${firstName}` : ''}
            </h1>
            <p className="mt-1 text-[14px] text-muted">Here’s what’s happening across Kero today.</p>
          </div>

          <div className="flex items-center gap-2">
            <AppButton
              variant="tertiary"
              startContent={<ArrowClockwise className={isFetching ? 'animate-spin' : ''} />}
              label="Refresh"
              onPress={() => refetch()}
              isDisabled={isFetching}
            />

            {/* Centered HeroUI modal control */}
            <Link href="/trips?dispatch=1">
              <AppButton variant="brand" startContent={<Plus weight="bold" />} label="Create dispatch" />
            </Link>
          </div>
        </div>

        {/* -------------------------------------------------------- Stat cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <StatDashboardCard
            label="Gross revenue · today"
            icon={Wallet}
            variant="wallet"
            loading={isLoading}
            value={formatKoboToNaira(revenue?.today)}
            hint={
              <div className="flex items-center gap-2">
                <Delta value={revenue?.weekChangePercent ?? 0} />
                <span>vs last week</span>
              </div>
            }
          />

          <StatDashboardCard
            label="Active rides"
            icon={Path}
            loading={isLoading}
            value={formatNumber(overview?.activeTrips)}
            hint={`${formatNumber(overview?.completedTripsToday)} completed today`}
          />

          <StatDashboardCard
            label="Active drivers"
            icon={SteeringWheel}
            loading={isLoading}
            value={formatNumber(activeDrivers)}
            hint={`${formatNumber(totalDrivers)} registered drivers · ${formatNumber(onTrip)} in-flight`}
          />

          <StatDashboardCard
            label="KYC review queue"
            icon={IdentificationCard}
            loading={isLoading}
            value={formatNumber(drivers?.pendingKYC)}
            hint={
              <Link href="/drivers/review-queue" className="inline-flex items-center gap-1 font-medium text-link hover:underline">
                Review submissions <ArrowRight size={12} weight="bold" />
              </Link>
            }
          />
        </div>

        {/* --------------------------------------------------- Operations row */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Dispatch performance Chart */}
          <DispatchPerformanceChart
            activeDrivers={activeDrivers}
            onTrip={onTrip}
            cancelRateToday={trips?.cancelRateToday}
            todayRevenue={revenue?.today}
          />

          {/* Quick actions */}
          <DashboardCard>
            <h2 className="text-[16px] font-bold text-foreground">Quick actions</h2>
            <p className="mt-0.5 text-[13px] text-muted">Jump straight into triage</p>

            <ul className="mt-4 -mx-2 space-y-0.5">
              {QUICK_LINKS.map((link) => {
                const LinkIcon = link.icon;
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="group flex items-center gap-3 rounded-2xl px-2 py-2.5 transition-colors hover:bg-surface-secondary"
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-default text-foreground">
                        <LinkIcon size={20} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium text-foreground">{link.label}</span>
                        <span className="block truncate text-xs text-muted">{link.description}</span>
                      </span>
                      <ArrowRight
                        size={16}
                        className="text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </DashboardCard>
        </div>
      </div>
  );
}
