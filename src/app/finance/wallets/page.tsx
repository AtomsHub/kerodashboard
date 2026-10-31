'use client';

// src/app/finance/wallets/page.tsx
// Rider and driver wallets. Riders: balance, money on hold for a ride and what
// they can spend. Drivers: balance and what they can withdraw. Open one for
// its ledger statement and adjustments.

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Coins, Eye, Lock, MagnifyingGlass, Wallet, WarningCircle } from '@phosphor-icons/react';
import { Skeleton } from '@heroui/react';
import { AppInput } from '@/components/ui/app-input';
import { AppSelect } from '@/components/ui/app-select';
import { DashboardCard, StatDashboardCard } from '@/components/ui/dashboard-card';
import { EmptyState, Page, PageHeader, Segmented, StatusPill, TablePagination } from '@/components/ui/page';
import { PermissionGuard } from '@/components/auth/can';
import { api } from '@/lib/api';
import { naira } from '@/lib/payments';

interface WalletRow {
  id: string;
  role: 'rider' | 'driver';
  name: string | null;
  phone: string | null;
  email: string | null;
  walletBalanceKobo: number;
  bonusBalanceKobo: number;
  heldBalanceKobo: number;
  availableKobo: number;
}

interface Liabilities {
  riderWalletsKobo: number;
  riderDebtKobo: number;
  ridersOwing: number;
  driverWalletsKobo: number;
  driverDebtKobo: number;
  driversOwing: number;
  heldForRidesKobo: number;
  payoutsInFlightKobo: number;
}

export default function WalletsPage() {
  const [role, setRole] = useState<'rider' | 'driver'>('rider');
  const [filter, setFilter] = useState<'all' | 'owing' | 'held'>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading } = useQuery<{ wallets: WalletRow[]; total: number }>({
    queryKey: ['admin', 'payments', 'wallets', role, filter, search, page],
    queryFn: async () =>
      (
        await api.get<{ data: { wallets: WalletRow[]; total: number } }>('/admin/payments/wallets', {
          params: { role, filter, page, limit, ...(search.trim() ? { search: search.trim() } : {}) },
        })
      ).data.data,
  });

  // Totals right now (same numbers as Financial Reports → "What Kero owes").
  const stats = useQuery<{ liabilities: Liabilities }>({
    queryKey: ['admin', 'payments', 'reports', 'liabilities'],
    queryFn: async () => (await api.get<{ data: { liabilities: Liabilities } }>('/admin/payments/reports')).data.data,
    retry: false,
  });
  const l = stats.data?.liabilities;
  const rows = data?.wallets ?? [];
  const isRider = role === 'rider';

  return (
    <PermissionGuard permission="view_ledger">
      <Page>
        <PageHeader
          title="Wallets"
          description="Balances are backed by the ledger. Corrections are made with a reason, never by overwriting a balance."
          actions={
            <Segmented
              aria-label="Who"
              value={role}
              onChange={(v) => {
                setRole(v);
                setFilter('all');
                setPage(1);
              }}
              options={[
                { key: 'rider', label: 'Riders' },
                { key: 'driver', label: 'Drivers' },
              ]}
            />
          }
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {isRider ? (
            <>
              <StatDashboardCard label="Rider wallets" icon={Wallet} variant="wallet" loading={stats.isLoading} value={naira(l?.riderWalletsKobo)} hint="Money Kero holds for riders" />
              <StatDashboardCard label="On hold for rides" icon={Lock} loading={stats.isLoading} value={naira(l?.heldForRidesKobo)} hint="Charged when the ride ends" />
              <StatDashboardCard label="Owed by riders" icon={WarningCircle} loading={stats.isLoading} value={naira(l?.riderDebtKobo)} hint={`${l?.ridersOwing ?? 0} riders owing`} />
              <StatDashboardCard label="Riders shown" icon={Coins} loading={isLoading} value={String(data?.total ?? 0)} hint="Matching this view" />
            </>
          ) : (
            <>
              <StatDashboardCard label="Driver wallets" icon={Wallet} variant="wallet" loading={stats.isLoading} value={naira(l?.driverWalletsKobo)} hint="Earnings not yet withdrawn" />
              <StatDashboardCard label="Withdrawals in flight" icon={Lock} loading={stats.isLoading} value={naira(l?.payoutsInFlightKobo)} hint="Waiting for the bank" />
              <StatDashboardCard label="Owed by drivers" icon={WarningCircle} loading={stats.isLoading} value={naira(l?.driverDebtKobo)} hint={`${l?.driversOwing ?? 0} drivers · repaid from earnings`} />
              <StatDashboardCard label="Drivers shown" icon={Coins} loading={isLoading} value={String(data?.total ?? 0)} hint="Matching this view" />
            </>
          )}
        </div>

        <DashboardCard className="overflow-hidden p-0">
          <div className="flex flex-col gap-3 p-6 pb-4 sm:flex-row sm:items-center sm:justify-end">
            <div className="w-full sm:w-44">
              <AppSelect
                size="sm"
                aria-label="Filter"
                selectedKey={filter}
                onSelectionChange={(v) => {
                  setFilter(v as typeof filter);
                  setPage(1);
                }}
                options={[
                  { key: 'all', label: 'All wallets' },
                  { key: 'owing', label: 'Owing Kero' },
                  ...(isRider ? [{ key: 'held', label: 'Money on hold' }] : []),
                ]}
              />
            </div>
            <div className="w-full sm:w-64">
              <AppInput
                size="sm"
                placeholder="Search name, phone or email"
                value={search}
                startContent={<MagnifyingGlass />}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{isRider ? 'Rider' : 'Driver'}</th>
                  <th className="text-right">Wallet</th>
                  {isRider && <th className="text-right">On hold</th>}
                  <th className="text-right">{isRider ? 'Can spend' : 'Can withdraw'}</th>
                  <th className="text-right">Bonus</th>
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
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState icon={Wallet} title="No wallets" description="Try a different search or filter." />
                    </td>
                  </tr>
                ) : (
                  rows.map((w) => (
                    <tr key={w.id}>
                      <td>
                        <Link href={`/finance/wallets/${w.role}/${w.id}`} className="font-medium text-foreground hover:underline">
                          {w.name || (isRider ? 'Rider' : 'Driver')}
                        </Link>
                        <p className="tabular text-xs text-muted">{w.phone ?? w.email ?? w.id}</p>
                      </td>
                      <td className="tabular text-right">
                        {w.walletBalanceKobo < 0 ? <StatusPill tone="danger">Owes {naira(-w.walletBalanceKobo)}</StatusPill> : naira(w.walletBalanceKobo)}
                      </td>
                      {isRider && <td className="tabular text-right text-muted">{w.heldBalanceKobo ? naira(w.heldBalanceKobo) : '—'}</td>}
                      <td className="tabular text-right font-medium">{naira(Math.max(0, w.availableKobo))}</td>
                      <td className="tabular text-right text-muted">{w.bonusBalanceKobo ? naira(w.bonusBalanceKobo) : '—'}</td>
                      <td className="text-right">
                        <Link href={`/finance/wallets/${w.role}/${w.id}`} aria-label="View wallet" className="inline-grid size-8 place-items-center rounded-full text-muted hover:bg-default hover:text-foreground">
                          <Eye size={16} />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <TablePagination
            page={page}
            totalPages={Math.max(1, Math.ceil((data?.total ?? 0) / limit))}
            summary={`${rows.length} of ${data?.total ?? 0} ${isRider ? 'riders' : 'drivers'}`}
            onChange={setPage}
          />
        </DashboardCard>
      </Page>
    </PermissionGuard>
  );
}
