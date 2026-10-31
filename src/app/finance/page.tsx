'use client';

// src/app/finance/page.tsx
// Finance overview. One period switch (today / 7 days / 30 days / 12 months)
// drives every chart: revenue over time, payment methods over time and share,
// trips by vehicle class and trip volume. Custody balances sit alongside.

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowClockwise,
  ArrowRight,
  ArrowsLeftRight,
  Buildings,
  CreditCard,
  Path,
  Receipt,
  SteeringWheel,
  TrendUp,
  Wallet,
} from '@phosphor-icons/react';
import { AppButton } from '@/components/ui/app-button';
import { DashboardCard, StatDashboardCard } from '@/components/ui/dashboard-card';
import { DetailList, EmptyState, Page, PageHeader, SectionHeader, Segmented } from '@/components/ui/page';
import { AreaChart, ChartLegend, DonutChart, RankedBars, StackedBarChart, type ChartDatum } from '@/components/charts/charts';
import { PermissionGuard } from '@/components/auth/can';
import { api } from '@/lib/api';
import { FinanceOverviewData } from '@/types/admin';

type Period = 'today' | 'week' | 'month' | 'year';

interface FinanceBucket {
  key: string;
  grossKobo: number;
  platformKobo: number;
  driverKobo: number;
  lagosKobo: number;
  trips: number;
  cancelled: number;
  byMethod: Record<string, number>;
}

interface FinanceAnalytics {
  period: Period;
  totals: {
    grossKobo: number;
    platformKobo: number;
    driverKobo: number;
    lagosKobo: number;
    trips: number;
    cancelled: number;
    avgFareKobo: number;
  };
  series: FinanceBucket[];
  paymentMethods: { method: string; count: number; volumeKobo: number }[];
  vehicleClasses: { name: string; trips: number; grossKobo: number }[];
}

const PERIOD_LABEL: Record<Period, string> = {
  today: 'today',
  week: 'last 7 days',
  month: 'last 30 days',
  year: 'last 12 months',
};

const METHODS = [
  { key: 'WALLET', label: 'Wallet', color: 'var(--chart-1)' },
  // Kero is cashless; cash appears only for trips before the switch.
  { key: 'CASH', label: 'Cash (old trips)', color: 'var(--chart-2)' },
];

const naira = (kobo: number | null | undefined) =>
  `₦${((kobo ?? 0) / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const compact = (kobo: number | null | undefined) => {
  const n = (kobo ?? 0) / 100;
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₦${(n / 1_000).toFixed(1)}k`;
  return `₦${Math.round(n).toLocaleString('en-NG')}`;
};

function bucketLabel(key: string, period: Period): { label: string; title: string } {
  if (period === 'today') return { label: `${key}:00`, title: `${key}:00 – ${key}:59` };
  if (period === 'year') {
    const d = new Date(`${key}-01T00:00:00`);
    return {
      label: d.toLocaleDateString('en-NG', { month: 'short' }),
      title: d.toLocaleDateString('en-NG', { month: 'long', year: 'numeric' }),
    };
  }
  const d = new Date(`${key}T00:00:00`);
  return {
    label: d.toLocaleDateString('en-NG', period === 'week' ? { weekday: 'short' } : { day: 'numeric', month: 'short' }),
    title: d.toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long' }),
  };
}


export default function FinanceOverviewPage() {
  const [period, setPeriod] = useState<Period>('week');

  const { data: overview, refetch: refetchOverview, isFetching: fetchingOverview } = useQuery<FinanceOverviewData>({
    queryKey: ['admin', 'finance', 'overview'],
    queryFn: async () => (await api.get<{ data: FinanceOverviewData }>('/admin/finance/overview')).data?.data,
    refetchInterval: 60000,
  });

  const {
    data: analyticsRaw,
    isLoading,
    isError: analyticsMissing,
    refetch: refetchAnalytics,
    isFetching: fetchingAnalytics,
  } = useQuery<FinanceAnalytics>({
    queryKey: ['admin', 'finance', 'analytics', period],
    queryFn: async () => (await api.get<{ data: FinanceAnalytics }>(`/admin/finance/analytics?period=${period}`)).data.data,
    retry: false,
  });

  const analytics = analyticsRaw ?? null;
  const metrics = overview?.metrics;
  const cashflow = overview?.cashflow;
  const isFetching = fetchingOverview || fetchingAnalytics;

  const chartData: ChartDatum[] = useMemo(
    () =>
      (analytics?.series ?? []).map((b) => {
        const { label, title } = bucketLabel(b.key, analytics?.period ?? period);
        return {
          label,
          title,
          values: {
            gross: b.grossKobo,
            commission: b.platformKobo,
            trips: b.trips,
            cancelled: b.cancelled,
            ...b.byMethod,
          },
        };
      }),
    [analytics, period],
  );

  const hasMethodSeries = (analytics?.series ?? []).some((b) => Object.values(b.byMethod).some((v) => v > 0));
  const totals = analytics?.totals;

  return (
    <PermissionGuard permission="view_transactions">
      <Page>
        <PageHeader
          title="Finance"
          description={`Revenue and payments, ${PERIOD_LABEL[period]}.`}
          actions={
            <>
              <Segmented
                size="sm"
                aria-label="Period"
                value={period}
                onChange={setPeriod}
                options={[
                  { key: 'today', label: 'Today' },
                  { key: 'week', label: '7 days' },
                  { key: 'month', label: '30 days' },
                  { key: 'year', label: '12 months' },
                ]}
              />
              <AppButton
                variant="tertiary"
                isIconOnly
                aria-label="Refresh"
                startContent={<ArrowClockwise className={isFetching ? 'animate-spin' : ''} />}
                onPress={() => {
                  refetchOverview();
                  refetchAnalytics();
                }}
              />
            </>
          }
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <StatDashboardCard
            label="Gross fares"
            icon={TrendUp}
            variant="wallet"
            loading={isLoading && !analytics}
            value={compact(totals?.grossKobo)}
            hint={`${(totals?.trips ?? 0).toLocaleString()} trips · avg ${compact(totals?.avgFareKobo)}`}
          />
          <StatDashboardCard
            label="Kero commission"
            icon={Wallet}
            loading={isLoading && !analytics}
            value={compact(totals?.platformKobo)}
            hint={
              totals?.grossKobo
                ? `${Math.round((totals.platformKobo / totals.grossKobo) * 100)}% take rate`
                : 'Retained revenue'
            }
          />
          <StatDashboardCard
            label="Driver earnings"
            icon={SteeringWheel}
            loading={isLoading && !analytics}
            value={compact(totals?.driverKobo)}
            hint="Credited to drivers"
          />
          <StatDashboardCard
            label="Lagos road tax"
            icon={Buildings}
            loading={isLoading && !analytics}
            value={compact(totals?.lagosKobo)}
            hint={`${totals?.cancelled ?? 0} trips cancelled`}
          />
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <DashboardCard className="lg:col-span-2">
            <SectionHeader
              title="Revenue"
              description="Gross fares and Kero commission"
              actions={
                <ChartLegend
                  series={[
                    { key: 'gross', label: 'Gross', color: 'var(--chart-1)' },
                    { key: 'commission', label: 'Commission', color: 'var(--chart-2)' },
                  ]}
                />
              }
            />
            <div className="mt-5">
              {chartData.length === 0 ? (
                <EmptyState icon={TrendUp} title="No revenue yet" className="py-16" />
              ) : (
                <AreaChart
                  data={chartData}
                  format={compact}
                  series={[
                    { key: 'gross', label: 'Gross', color: 'var(--chart-1)' },
                    { key: 'commission', label: 'Commission', color: 'var(--chart-2)' },
                  ]}
                />
              )}
            </div>
          </DashboardCard>

          <DashboardCard>
            <SectionHeader title="Payment methods" description="Share of gross fares" />
            <div className="mt-5">
              <DonutChart
                format={compact}
                centerLabel="Total"
                segments={METHODS.map((m) => {
                  const row = analytics?.paymentMethods.find((p) => p.method === m.key);
                  return {
                    key: m.key,
                    label: m.label,
                    color: m.color,
                    value: row?.volumeKobo ?? 0,
                    detail: `${row?.count ?? 0} trips`,
                  };
                })}
              />
            </div>
          </DashboardCard>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <DashboardCard className="lg:col-span-2">
            <SectionHeader
              title="Payment methods over time"
              description="Gross fares by how riders paid"
              actions={<ChartLegend series={METHODS} />}
            />
            <div className="mt-5">
              {hasMethodSeries ? (
                <StackedBarChart data={chartData} series={METHODS} format={compact} />
              ) : (
                <EmptyState
                  icon={CreditCard}
                  title="No payments in this period"
                  
                  className="py-16"
                />
              )}
            </div>
          </DashboardCard>

          <DashboardCard>
            <SectionHeader title="By vehicle class" description="Gross fares per class" />
            <div className="mt-5">
              {(analytics?.vehicleClasses.length ?? 0) === 0 ? (
                <EmptyState icon={Path} title="No trips in this period" className="py-10" />
              ) : (
                <RankedBars
                  format={compact}
                  items={(analytics?.vehicleClasses ?? []).map((c) => ({
                    label: c.name,
                    value: c.grossKobo,
                    detail: `${c.trips} trips`,
                  }))}
                />
              )}
            </div>
          </DashboardCard>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <DashboardCard className="lg:col-span-2">
            <SectionHeader
              title="Trips"
              description="Completed and cancelled"
              actions={
                <ChartLegend
                  series={[
                    { key: 'trips', label: 'Completed', color: 'var(--chart-2)' },
                    { key: 'cancelled', label: 'Cancelled', color: 'var(--chart-3)' },
                  ]}
                />
              }
            />
            <div className="mt-5">
              <StackedBarChart
                data={chartData}
                format={(v) => Math.round(v).toLocaleString()}
                height={220}
                series={[
                  { key: 'trips', label: 'Completed', color: 'var(--chart-2)' },
                  { key: 'cancelled', label: 'Cancelled', color: 'var(--chart-3)' },
                ]}
              />
            </div>
          </DashboardCard>

          <DashboardCard>
            <SectionHeader title="Balances held" description="Right now, all time" />
            <DetailList
              className="mt-5"
              items={[
                { label: 'Rider wallets', value: naira(metrics?.riderWalletHoldingsKobo) },
                { label: 'Driver wallets', value: naira(metrics?.driverWalletHoldingsKobo) },
                { label: 'Lagos road fund', value: naira(metrics?.lagosWalletBalanceKobo) },
                { label: 'Owed to Kero by drivers', value: naira(metrics?.driverOutstandingDebtKobo) },
                { label: 'Money in', value: naira(cashflow?.inflowKobo) },
                { label: 'Money out', value: naira(cashflow?.outflowKobo) },
              ]}
            />
            <ul className="-mx-2 mt-6 space-y-0.5">
              {[
                { label: 'Payments', href: '/finance/payments', icon: CreditCard },
                { label: 'Settlements', href: '/finance/settlements', icon: ArrowsLeftRight },
                { label: 'Lagos road tax', href: '/finance/lagos', icon: Receipt },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="group flex items-center gap-3 rounded-2xl px-2 py-2 transition-colors hover:bg-surface-secondary"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-default text-foreground">
                      <link.icon size={16} />
                    </span>
                    <span className="flex-1 text-[14px] font-medium text-foreground">{link.label}</span>
                    <ArrowRight size={14} className="text-muted transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              ))}
            </ul>
          </DashboardCard>
        </div>
      </Page>
    </PermissionGuard>
  );
}
