'use client';

// src/app/riders/page.tsx
// Phase 1.4: Passenger (Rider) Directory & Moderation
// Features:
// - Paginated passenger table with wallet balance in ₦, total trips, rating, and status
// - Quick search by passenger name, phone, or email
// - Filtering by suspension status and riders who owe Kero (cancellation fees)
// - Built on HeroUI v3 compound Modal, AppInput, AppTextarea, AppButton, and Satoshi tokens

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  UsersThree,
  MagnifyingGlass,
  Funnel,
  ArrowsClockwise,
  Phone,
  Star,
  Wallet,
  CheckCircle,
  XCircle,
  CaretLeft,
  CaretRight,
  ShieldWarning,
  X,
  CreditCard,
  LockKey,
  Path,
} from '@phosphor-icons/react';
import { Skeleton } from '@heroui/react';
import { AppButton } from '@/components/ui/app-button';
import { AppInput } from '@/components/ui/app-input';
import { AppSelect } from '@/components/ui/app-select';
import { AppRowActions } from '@/components/ui/app-row-actions';
import { DashboardCard, StatDashboardCard } from '@/components/ui/dashboard-card';
import { EmptyState, Page, PageHeader, Segmented, StatusPill, TablePagination } from '@/components/ui/page';
import { UserAvatar } from '@/components/ui/user-avatar';
import { PermissionGuard, Can } from '@/components/auth/can';
import { SortableTh, useTableSort } from '@/components/ui/sortable-th';
import { api } from '@/lib/api';
import { formatKoboToNaira, formatNumber } from '@/lib/utils';
import { AdminRiderListItem } from '@/types/admin';

interface RiderStats {
  total: number;
  suspended: number;
  owing?: number;
  newThisWeek?: number;
  activeThisMonth?: number;
  walletFloatKobo?: number;
}

export default function RidersPage() {
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended' | 'owing'>('all');
  // Online first, then most recently seen.
  const { sort, toggle: toggleSort } = useTableSort<'activity' | 'name' | 'wallet' | 'createdAt'>(
    { key: 'activity', order: 'desc' },
    () => setPage(1),
  );

  // ── Query: Riders List ─────────────────────────────────────────────
  const {
    data,
    isLoading,
    refetch,
    isFetching,
  } = useQuery<{ total: number; page: number; riders: AdminRiderListItem[] }>({
    queryKey: ['admin', 'riders', page, limit, search, statusFilter, sort],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sortBy: sort.key,
        sortOrder: sort.order,
      });
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter === 'suspended') params.set('isSuspended', 'true');
      if (statusFilter === 'active') params.set('isSuspended', 'false');
      if (statusFilter === 'owing') params.set('hasOutstandingDebt', 'true');

      const res = await api.get<{ data: { total: number; page: number; riders: AdminRiderListItem[] } }>(
        `/admin/riders?${params.toString()}`,
      );
      return res.data?.data ?? { total: 0, page: 1, riders: [] };
    },
  });

  const riders = useMemo(() => {
    const list = [...(data?.riders ?? [])];
    return list.sort((a, b) => {
      // 1. Online always at the top
      if (a.isOnline && !b.isOnline) return -1;
      if (!a.isOnline && b.isOnline) return 1;

      // 2. Sort by lastSeenAt (most recent first)
      const aTime = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0;
      const bTime = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0;
      if (aTime !== bTime) return bTime - aTime;

      // 3. Fallback to createdAt (newest first)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [data?.riders]);
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit) || 1;

  // ── Query: Headline stats ───────────────────────────────────────────
  const { data: stats, isLoading: statsLoading } = useQuery<RiderStats>({
    queryKey: ['admin', 'riders', 'stats'],
    queryFn: async () => (await api.get<{ data: RiderStats }>('/admin/riders/stats')).data.data,
    refetchInterval: 60000,
  });

  return (
    <PermissionGuard permission="view_riders">
        <Page>
          <PageHeader
            title="Riders"
            description="Passenger accounts and wallets. Kero is cashless: every ride is paid from the wallet."
            actions={
              <AppButton
                variant="tertiary"
                startContent={<ArrowsClockwise className={isFetching ? 'animate-spin' : ''} />}
                label="Refresh"
                onPress={() => refetch()}
                isDisabled={isFetching}
              />
            }
          />

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <StatDashboardCard
              label="Total riders"
              icon={UsersThree}
              variant="wallet"
              loading={statsLoading}
              value={formatNumber(stats?.total)}
              hint={stats?.newThisWeek !== undefined ? `+${formatNumber(stats.newThisWeek)} this week` : 'Registered accounts'}
            />
            <StatDashboardCard
              label="Active this month"
              icon={Path}
              loading={statsLoading}
              value={stats?.activeThisMonth !== undefined ? formatNumber(stats.activeThisMonth) : '—'}
              hint="Booked at least one trip"
            />
            <StatDashboardCard
              label="Wallet balances"
              icon={Wallet}
              loading={statsLoading}
              value={stats?.walletFloatKobo !== undefined ? formatKoboToNaira(stats.walletFloatKobo) : '—'}
              hint="Held across all riders"
            />
            <StatDashboardCard
              label="Restricted"
              icon={ShieldWarning}
              loading={statsLoading}
              value={formatNumber((stats?.suspended ?? 0) + (stats?.owing ?? 0))}
              hint={`${formatNumber(stats?.suspended)} suspended · ${formatNumber(stats?.owing ?? 0)} owing Kero`}
            />
          </div>

          <DashboardCard className="overflow-hidden p-0">
            <div className="flex flex-col gap-4 p-6 pb-4 lg:flex-row lg:items-center lg:justify-between">
              <Segmented
                size="sm"
                aria-label="Account status"
                value={statusFilter}
                onChange={(key) => {
                  setStatusFilter(key);
                  setPage(1);
                }}
                options={[
                  { key: 'all', label: 'All' },
                  { key: 'active', label: 'Active' },
                  { key: 'owing', label: 'Owing Kero' },
                  { key: 'suspended', label: 'Suspended' },
                ]}
              />

              <div className="flex flex-wrap items-center gap-2">
                <div className="w-56">
                  <AppInput
                    size="sm"
                    placeholder="Search riders"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    startContent={<MagnifyingGlass />}
                    endContent={
                      search ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSearch('');
                            setPage(1);
                          }}
                          className="cursor-pointer text-muted hover:text-foreground"
                        >
                          <X size={12} />
                        </button>
                      ) : null
                    }
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <SortableTh label="Rider" sortKey="name" firstOrder="asc" sort={sort} onSort={toggleSort} />
                    <SortableTh label="Last seen" sortKey="activity" sort={sort} onSort={toggleSort} />
                    <SortableTh label="Wallet" sortKey="wallet" sort={sort} onSort={toggleSort} />
                    <th>Rating</th>
                    <th>Status</th>
                    <th className="w-12" />
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={6}>
                          <Skeleton className="h-6 w-full rounded-lg" />
                        </td>
                      </tr>
                    ))
                  ) : riders.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <EmptyState icon={UsersThree} title="No riders found" description="Try a different filter or search." />
                      </td>
                    </tr>
                  ) : (
                    riders.map((rider) => {
                      const isLive = Boolean(rider.isOnline);
                      const formatLastActive = (dateStr?: string | Date | null) => {
                        if (!dateStr) return 'Never';
                        const d = new Date(dateStr);
                        if (isNaN(d.getTime())) return 'Never';
                        const diffMins = Math.floor((Date.now() - d.getTime()) / 60000);
                        if (diffMins < 1) return 'Just now';
                        if (diffMins < 60) return `${diffMins}m ago`;
                        const diffHours = Math.floor(diffMins / 60);
                        if (diffHours < 24) return `${diffHours}h ago`;
                        return `${Math.floor(diffHours / 24)}d ago`;
                      };

                      return (
                        <tr key={rider.id}>
                          <td>
                            <div className="flex items-center gap-3">
                              <UserAvatar src={rider.avatarUrl || rider.profileImage} name={rider.fullname} size="sm" />
                              <div className="min-w-0">
                                <Link
                                  href={`/riders/${rider.id}`}
                                  className="block truncate font-medium text-foreground hover:underline"
                                >
                                  {rider.fullname ?? 'Passenger'}
                                </Link>
                                <p className="tabular truncate text-xs text-muted">{rider.phone ?? rider.email}</p>
                              </div>
                            </div>
                          </td>

                          <td>
                            {isLive ? (
                              <StatusPill tone="success" dot pulse>
                                Online
                              </StatusPill>
                            ) : (
                              <span className="tabular text-muted">{formatLastActive(rider.lastSeenAt)}</span>
                            )}
                          </td>

                          <td>
                            <p className="tabular font-medium text-foreground">{formatKoboToNaira(rider.walletBalance)}</p>
                            {rider.bonusBalance > 0 && (
                              <p className="tabular text-xs text-muted">+{formatKoboToNaira(rider.bonusBalance)} bonus</p>
                            )}
                          </td>

                          <td>
                            <div className="flex items-center gap-1 font-medium text-foreground">
                              <Star size={14} weight="fill" className="text-secondary" />
                              <span className="tabular">{Number(rider.riderRating).toFixed(1)}</span>
                            </div>
                            <span className="tabular text-xs text-muted">{rider.totalTrips} trips</span>
                          </td>

                          <td>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <StatusPill tone={rider.isSuspended ? 'danger' : 'success'} dot>
                                {rider.isSuspended ? 'Suspended' : 'Active'}
                              </StatusPill>
                              {rider.walletBalance < 0 && <StatusPill tone="warning">Owes {formatKoboToNaira(-rider.walletBalance)}</StatusPill>}
                            </div>
                          </td>

                          <td className="text-right">
                            <AppRowActions
                              items={[
                                {
                                  key: 'profile',
                                  label: 'View profile',
                                  icon: <UsersThree size={14} />,
                                  href: `/riders/${rider.id}`,
                                },
                                {
                                  key: 'wallet',
                                  label: 'Open wallet',
                                  icon: <Wallet size={14} />,
                                  href: `/finance/wallets/rider/${rider.id}`,
                                },
                              ]}
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <TablePagination
              page={page}
              totalPages={totalPages}
              summary={`${riders.length} of ${total} riders`}
              onChange={setPage}
            />
          </DashboardCard>

        </Page>
      </PermissionGuard>
  );
}
