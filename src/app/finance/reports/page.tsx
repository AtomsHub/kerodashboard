'use client';

// src/app/payments/reports/page.tsx
// Financial report for a period: headline cards, a daily chart of money in
// (top-ups), ride fares and withdrawals, then the breakdowns — Kero's actual
// revenue (commission + fees kept − provider charges − promotions − refunds),
// what Kero owes users right now, top-ups, rides and withdrawals.

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowCircleDown, ArrowCircleUp, ChartLineUp, Path, TrendUp } from '@phosphor-icons/react';
import { AreaChart, ChartLegend, type ChartDatum } from '@/components/charts/charts';
import { DashboardCard, StatDashboardCard } from '@/components/ui/dashboard-card';
import { EmptyState, Page, PageHeader, SectionHeader, Segmented } from '@/components/ui/page';
import { PermissionGuard } from '@/components/auth/can';
import { api } from '@/lib/api';
import { naira } from '@/lib/payments';

interface Sum {
  count: number;
  amountKobo: number;
  userFeesKobo: number;
  providerFeesKobo: number;
  keroSubsidyKobo: number;
  feeMarginKobo: number;
  netKobo: number;
}

interface Report {
  period: { from: string; to: string };
  daily: Array<{ day: string; fundingKobo: number; faresKobo: number; payoutsKobo: number; commissionKobo: number }>;
  funding: Sum & { riders: Sum; drivers: Sum; pending: Sum };
  rides: { grossKobo: number; count: number; driverEarningsKobo: number };
  payouts: Sum & { pending: Sum };
  refunds: Sum;
  cancellationFees: Sum;
  revenue: {
    commissionKobo: number;
    lagosLevyKobo: number;
    feeIncomeKobo: number;
    cancellationFeesKobo: number;
    providerFeesKobo: number;
    promotionsKobo: number;
    refundsKobo: number;
    netRevenueKobo: number;
  };
  liabilities: {
    riderWalletsKobo: number;
    riderDebtKobo: number;
    ridersOwing: number;
    driverWalletsKobo: number;
    driverDebtKobo: number;
    driversOwing: number;
    heldForRidesKobo: number;
    payoutsInFlightKobo: number;
  };
  unmatched: Sum;
}

const PERIODS = { '7d': 7, '30d': 30, '90d': 90 } as const;

const SERIES = [
  { key: 'funding', label: 'Top-ups', color: 'var(--chart-1)' },
  { key: 'fares', label: 'Ride fares', color: 'var(--chart-2)' },
  { key: 'payouts', label: 'Withdrawals', color: 'var(--chart-3)' },
];

const compact = (kobo: number) => {
  const n = kobo / 100;
  if (Math.abs(n) >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `₦${(n / 1_000).toFixed(1)}k`;
  return `₦${Math.round(n)}`;
};

function Line({ label, value, hint, strong }: { label: string; value: string; hint?: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <div>
        <p className={`text-[13.5px] ${strong ? 'font-semibold' : ''} text-foreground`}>{label}</p>
        {hint && <p className="text-[12px] text-muted">{hint}</p>}
      </div>
      <p className={`tabular shrink-0 text-[14px] ${strong ? 'font-bold' : 'font-medium'}`}>{value}</p>
    </div>
  );
}

export default function FinancialReportsPage() {
  const [period, setPeriod] = useState<keyof typeof PERIODS>('30d');
  const { data, isLoading } = useQuery<Report>({
    queryKey: ['admin', 'payments', 'reports', period],
    queryFn: async () => {
      const to = new Date();
      const from = new Date(to.getTime() - PERIODS[period] * 86_400_000);
      return (await api.get<{ data: Report }>('/admin/payments/reports', { params: { from: from.toISOString(), to: to.toISOString() } })).data.data;
    },
  });

  // One point per day, including days with nothing, so the line is honest.
  const chart = useMemo<ChartDatum[]>(() => {
    if (!data) return [];
    const byDay = new Map(data.daily.map((d) => [d.day, d]));
    const days = PERIODS[period];
    const end = new Date(data.period.to).getTime();
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(end - (days - 1 - i) * 86_400_000);
      const key = d.toISOString().slice(0, 10);
      const row = byDay.get(key);
      return {
        label: d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }),
        title: d.toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short' }),
        values: { funding: row?.fundingKobo ?? 0, fares: row?.faresKobo ?? 0, payouts: row?.payoutsKobo ?? 0 },
      };
    });
  }, [data, period]);
  const hasActivity = chart.some((d) => d.values['funding'] || d.values['fares'] || d.values['payouts']);

  return (
    <PermissionGuard permission="view_financial_reports">
      <Page>
        <PageHeader
          title="Financial reports"
          description="Money moved, what reached people, and what Kero actually earned. Wallet balances are money Kero owes users, not revenue."
          actions={
            <Segmented
              aria-label="Period"
              value={period}
              onChange={setPeriod}
              options={[
                { key: '7d', label: '7 days' },
                { key: '30d', label: '30 days' },
                { key: '90d', label: '90 days' },
              ]}
            />
          }
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <StatDashboardCard label="Net revenue" icon={TrendUp} variant="wallet" loading={isLoading} value={naira(data?.revenue.netRevenueKobo)} hint="Kero's own money after costs" />
          <StatDashboardCard label="Money in" icon={ArrowCircleDown} loading={isLoading} value={naira(data?.funding.amountKobo)} hint={`${data?.funding.count ?? 0} top-ups`} />
          <StatDashboardCard label="Ride fares" icon={Path} loading={isLoading} value={naira(data?.rides.grossKobo)} hint={`${data?.rides.count ?? 0} paid rides`} />
          <StatDashboardCard label="Withdrawals paid" icon={ArrowCircleUp} loading={isLoading} value={naira(data?.payouts.netKobo)} hint={`${data?.payouts.count ?? 0} to driver banks`} />
        </div>

        <DashboardCard>
          <SectionHeader title="Daily activity" description="Completed payments per day (Lagos time)" actions={<ChartLegend series={SERIES} />} />
          <div className="mt-5">
            {isLoading ? (
              <div className="h-[260px] animate-pulse rounded-2xl bg-surface-secondary" />
            ) : !hasActivity ? (
              <EmptyState icon={ChartLineUp} title="No payments in this period" className="py-16" />
            ) : (
              <AreaChart data={chart} series={SERIES} format={compact} />
            )}
          </div>
        </DashboardCard>

        {data && (
          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
            <DashboardCard>
              <SectionHeader title="Kero revenue" description="Money that is actually Kero's" />
              <div className="mt-2 divide-y divide-border">
                <Line label="Ride commission" value={naira(data.revenue.commissionKobo)} />
                <Line label="Fees kept" hint="Top-up and withdrawal fees users paid" value={naira(data.revenue.feeIncomeKobo)} />
                <Line label="Cancellation fees" value={naira(data.revenue.cancellationFeesKobo)} />
                <Line label="Provider charges" hint="What Paystack charged Kero" value={naira(-data.revenue.providerFeesKobo)} />
                <Line label="Promotions & rewards" value={naira(-data.revenue.promotionsKobo)} />
                <Line label="Refunds" value={naira(-data.revenue.refundsKobo)} />
                <Line label="Net revenue" value={naira(data.revenue.netRevenueKobo)} strong />
                <Line label="Lagos levy collected" hint="Owed to Lagos State, not Kero's" value={naira(data.revenue.lagosLevyKobo)} />
              </div>
            </DashboardCard>

            <DashboardCard>
              <SectionHeader title="What Kero owes right now" description="Not affected by the period" />
              <div className="mt-2 divide-y divide-border">
                <Line label="Rider wallets" value={naira(data.liabilities.riderWalletsKobo)} />
                <Line label="Driver wallets" value={naira(data.liabilities.driverWalletsKobo)} />
                <Line label="Withdrawals in flight" value={naira(data.liabilities.payoutsInFlightKobo)} />
                <Line label="Of rider wallets: on hold for rides" value={naira(data.liabilities.heldForRidesKobo)} />
                <Line label={`Owed to Kero by riders (${data.liabilities.ridersOwing})`} value={naira(data.liabilities.riderDebtKobo)} />
                <Line label={`Owed to Kero by drivers (${data.liabilities.driversOwing})`} value={naira(data.liabilities.driverDebtKobo)} />
              </div>
            </DashboardCard>

            <DashboardCard>
              <SectionHeader title="Top-ups" description={`${data.funding.count} completed`} />
              <div className="mt-2 divide-y divide-border">
                <Line label="Credited to wallets" value={naira(data.funding.amountKobo)} strong />
                <Line label="Fees paid by riders" value={naira(data.funding.userFeesKobo)} />
                <Line label="Provider charges" value={naira(data.funding.providerFeesKobo)} />
                <Line label="Absorbed by Kero" value={naira(data.funding.keroSubsidyKobo)} />
                <Line label={`Still pending (${data.funding.pending.count})`} value={naira(data.funding.pending.amountKobo)} />
                <Line label={`Unmatched payments (${data.unmatched.count})`} hint="Paid to Kero with an unknown reference" value={naira(data.unmatched.amountKobo)} />
              </div>
            </DashboardCard>

            <DashboardCard>
              <SectionHeader title="Rides & withdrawals" />
              <div className="mt-2 divide-y divide-border">
                <Line label="Fares charged" value={naira(data.rides.grossKobo)} strong />
                <Line label="Paid to drivers" value={naira(data.rides.driverEarningsKobo)} />
                <Line label="Withdrawn from driver wallets" value={naira(data.payouts.amountKobo)} />
                <Line label="Sent to banks" value={naira(data.payouts.netKobo)} />
                <Line label="Withdrawal fees paid by drivers" value={naira(data.payouts.userFeesKobo)} />
                <Line label="Withdrawal charges absorbed by Kero" value={naira(data.payouts.keroSubsidyKobo)} />
                <Line label={`Refunds (${data.refunds.count})`} value={naira(data.refunds.amountKobo)} />
              </div>
            </DashboardCard>
          </div>
        )}
      </Page>
    </PermissionGuard>
  );
}
