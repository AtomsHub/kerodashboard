'use client';

// src/app/support/overview/page.tsx
// Help Center + SOS performance: volume, response and resolution times,
// ratings, and each staff member's record.

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ChatCircleDots, Clock, Headset, Siren, Star, Timer, UsersThree } from '@phosphor-icons/react';
import { AreaChart, ChartLegend, RankedBars, type ChartDatum } from '@/components/charts/charts';
import { DashboardCard, StatDashboardCard } from '@/components/ui/dashboard-card';
import { EmptyState, Page, PageHeader, SectionHeader, Segmented } from '@/components/ui/page';
import { UserAvatar } from '@/components/ui/user-avatar';
import { PermissionGuard } from '@/components/auth/can';
import { CATEGORY_LABELS } from '@/components/support/support-meta';
import { api } from '@/lib/api';

interface Overview {
  days: number;
  tickets: {
    created: number;
    resolved: number;
    openNow: number;
    unclaimedNow: number;
    avgResponseMinutes: number | null;
    avgResolutionHours: number | null;
    resolutionRate: number | null;
    avgRating: number | null;
    ratings: number;
    satisfaction: number | null;
  };
  sos: {
    total: number;
    activeNow: number;
    resolved: number;
    falseAlarms: number;
    avgResponseMinutes: number | null;
    avgResolutionMinutes: number | null;
  };
  trend: Array<{ date: string; created: number; resolved: number; sos: number }>;
  categories: Array<{ category: string; count: number }>;
  byRole: { rider: number; driver: number };
  ratingBreakdown: Array<{ stars: number; count: number }>;
  staff: Array<{
    adminId: string;
    name: string;
    claimed: number;
    resolved: number;
    openNow: number;
    sosHandled: number;
    avgResponseMinutes: number | null;
    avgResolutionHours: number | null;
    avgRating: number | null;
    ratings: number;
  }>;
  recentRatings: Array<{
    ticketId: string;
    ticketNumber: string;
    subject: string;
    rating: number;
    comment: string | null;
    adminName: string | null;
    ratedAt: string;
  }>;
}

type Period = '7' | '30' | '90';

/** "4m", "1h 20m", "2d 3h" */
function duration(minutes: number | null): string {
  if (minutes === null) return '—';
  if (minutes < 1) return '<1m';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  if (h < 24) return `${h}h ${Math.round(minutes % 60)}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

const count = (v: number) => v.toLocaleString('en-NG');

function Stars({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted">—</span>;
  return (
    <span className="inline-flex items-center gap-1">
      <Star size={13} weight="fill" className="text-secondary" />
      <span className="tabular font-medium text-foreground">{value.toFixed(1)}</span>
    </span>
  );
}

export default function SupportOverviewPage() {
  const [period, setPeriod] = useState<Period>('30');

  const { data, isLoading } = useQuery<Overview>({
    queryKey: ['admin', 'support', 'overview', period],
    queryFn: async () => (await api.get<{ data: Overview }>(`/admin/support/overview?days=${period}`)).data.data,
    refetchInterval: 30000,
  });

  const t = data?.tickets;
  const sos = data?.sos;
  const chartData: ChartDatum[] = (data?.trend ?? []).map((d) => ({
    label: new Date(d.date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }),
    values: { created: d.created, resolved: d.resolved, sos: d.sos },
  }));
  const series = [
    { key: 'created', label: 'New tickets', color: 'var(--chart-1)' },
    { key: 'resolved', label: 'Resolved', color: 'var(--chart-3)' },
    { key: 'sos', label: 'SOS', color: 'var(--chart-2)' },
  ];
  const totalRatings = data?.ratingBreakdown.reduce((a, r) => a + r.count, 0) ?? 0;

  return (
    <PermissionGuard permission="view_support">
      <Page>
        <PageHeader
          title="Support overview"
          description="How fast the team responds, resolves and how people rate the help."
          actions={
            <Segmented
              size="sm"
              aria-label="Period"
              value={period}
              onChange={setPeriod}
              options={[
                { key: '7', label: '7 days' },
                { key: '30', label: '30 days' },
                { key: '90', label: '90 days' },
              ]}
            />
          }
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <StatDashboardCard
            label="Open tickets"
            icon={Headset}
            variant="wallet"
            loading={isLoading}
            value={count(t?.openNow ?? 0)}
            hint={`${count(t?.unclaimedNow ?? 0)} waiting for an agent`}
          />
          <StatDashboardCard
            label="Avg first response"
            icon={Timer}
            loading={isLoading}
            value={duration(t?.avgResponseMinutes ?? null)}
            hint="From new ticket to claimed"
          />
          <StatDashboardCard
            label="Avg resolution"
            icon={Clock}
            loading={isLoading}
            value={t?.avgResolutionHours != null ? duration(t.avgResolutionHours * 60) : '—'}
            hint={t?.resolutionRate != null ? `${t.resolutionRate}% of new tickets resolved` : 'No resolved tickets yet'}
          />
          <StatDashboardCard
            label="Rating"
            icon={Star}
            loading={isLoading}
            value={t?.avgRating != null ? `${t.avgRating.toFixed(1)} / 5` : '—'}
            hint={t?.ratings ? `${t.satisfaction}% satisfied · ${count(t.ratings)} ratings` : 'No ratings yet'}
          />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <StatDashboardCard
            label="SOS alerts"
            icon={Siren}
            variant={sos?.activeNow ? 'danger' : undefined}
            loading={isLoading}
            value={count(sos?.total ?? 0)}
            hint={sos?.activeNow ? `${sos.activeNow} active now` : 'None active now'}
          />
          <StatDashboardCard
            label="SOS response"
            icon={Timer}
            loading={isLoading}
            value={duration(sos?.avgResponseMinutes ?? null)}
            hint="From alert to a responder claiming it"
          />
          <StatDashboardCard
            label="SOS resolution"
            icon={Clock}
            loading={isLoading}
            value={duration(sos?.avgResolutionMinutes ?? null)}
            hint={`${count(sos?.falseAlarms ?? 0)} false alarms`}
          />
          <StatDashboardCard
            label="New tickets"
            icon={ChatCircleDots}
            loading={isLoading}
            value={count(t?.created ?? 0)}
            hint={`${count(data?.byRole.rider ?? 0)} riders · ${count(data?.byRole.driver ?? 0)} drivers`}
          />
        </div>

        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-3">
          <DashboardCard className="xl:col-span-2">
            <SectionHeader title="Volume" description="New tickets, resolved and SOS per day" actions={<ChartLegend series={series} />} />
            <div className="mt-5">
              {chartData.every((d) => !d.values.created && !d.values.resolved && !d.values.sos) ? (
                <EmptyState icon={ChatCircleDots} title="No activity in this period" className="py-16" />
              ) : (
                <AreaChart data={chartData} series={series} format={count} />
              )}
            </div>
          </DashboardCard>

          <DashboardCard>
            <SectionHeader title="Topics" description="What people contact us about" />
            <div className="mt-5">
              {(data?.categories.length ?? 0) === 0 ? (
                <EmptyState icon={ChatCircleDots} title="No tickets yet" className="py-10" />
              ) : (
                <RankedBars
                  format={count}
                  items={(data?.categories ?? []).map((c) => ({
                    label: CATEGORY_LABELS[c.category] ?? c.category,
                    value: c.count,
                  }))}
                />
              )}
            </div>
          </DashboardCard>
        </div>

        <DashboardCard className="overflow-hidden p-0">
          <div className="p-6 pb-2">
            <SectionHeader title="Staff" description="Tickets handled in this period and how users rated them" />
          </div>
          {(data?.staff.length ?? 0) === 0 ? (
            <div className="pb-6">
              <EmptyState icon={UsersThree} title="No staff activity yet" description="Claim a ticket to start a record." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Staff</th>
                    <th className="text-right">Claimed</th>
                    <th className="text-right">Resolved</th>
                    <th className="text-right">Open now</th>
                    <th className="text-right">SOS</th>
                    <th className="text-right">First response</th>
                    <th className="text-right">Resolution</th>
                    <th className="text-right">Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {data!.staff.map((s) => (
                    <tr key={s.adminId}>
                      <td>
                        <div className="flex items-center gap-3">
                          <UserAvatar name={s.name} size="sm" />
                          <span className="font-medium text-foreground">{s.name}</span>
                        </div>
                      </td>
                      <td className="tabular text-right">{count(s.claimed)}</td>
                      <td className="tabular text-right">{count(s.resolved)}</td>
                      <td className="tabular text-right text-muted">{count(s.openNow)}</td>
                      <td className="tabular text-right text-muted">{count(s.sosHandled)}</td>
                      <td className="tabular text-right">{duration(s.avgResponseMinutes)}</td>
                      <td className="tabular text-right">
                        {s.avgResolutionHours != null ? duration(s.avgResolutionHours * 60) : '—'}
                      </td>
                      <td className="text-right">
                        <Stars value={s.avgRating} />
                        {s.ratings > 0 && <span className="ml-1 text-xs text-muted">({s.ratings})</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DashboardCard>

        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-3">
          <DashboardCard>
            <SectionHeader title="Ratings" description={totalRatings ? `${count(totalRatings)} in this period` : 'None yet'} />
            <ul className="mt-5 space-y-2.5">
              {(data?.ratingBreakdown ?? [5, 4, 3, 2, 1].map((stars) => ({ stars, count: 0 }))).map((r) => (
                <li key={r.stars} className="flex items-center gap-3 text-[13px]">
                  <span className="tabular w-8 shrink-0 text-muted">{r.stars}★</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-default">
                    <span
                      className="block h-full rounded-full bg-secondary"
                      style={{ width: `${totalRatings ? (r.count / totalRatings) * 100 : 0}%` }}
                    />
                  </span>
                  <span className="tabular w-8 shrink-0 text-right text-foreground">{count(r.count)}</span>
                </li>
              ))}
            </ul>
          </DashboardCard>

          <DashboardCard className="xl:col-span-2">
            <SectionHeader title="Latest feedback" />
            {(data?.recentRatings.length ?? 0) === 0 ? (
              <EmptyState icon={Star} title="No ratings yet" description="Users can rate a ticket once it is resolved." className="py-10" />
            ) : (
              <ul className="mt-4 divide-y divide-separator">
                {data!.recentRatings.map((r) => (
                  <li key={r.ticketId} className="flex items-start gap-4 py-3">
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary-soft px-2.5 py-1 text-[12px] font-semibold text-secondary-soft-foreground">
                      <Star size={12} weight="fill" /> {r.rating}
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link href={`/support/${r.ticketId}`} className="block truncate text-[14px] font-medium text-foreground hover:underline">
                        {r.subject}
                      </Link>
                      {r.comment && <p className="mt-0.5 text-[13px] text-muted">“{r.comment}”</p>}
                    </div>
                    <span className="shrink-0 text-right text-[12px] text-muted">
                      {r.adminName ?? 'Unassigned'}
                      <br />
                      {new Date(r.ratedAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </DashboardCard>
        </div>
      </Page>
    </PermissionGuard>
  );
}
