'use client';

// src/app/finance/bank-accounts/page.tsx
// Permanent bank accounts riders and drivers can transfer into to top up.
// Not live yet: the table stays empty until the integration is switched on.

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowsDownUp, Bank, SteeringWheel, UsersThree } from '@phosphor-icons/react';
import { DashboardCard, StatDashboardCard } from '@/components/ui/dashboard-card';
import { EmptyState, Page, PageHeader, StatusPill } from '@/components/ui/page';
import { PermissionGuard } from '@/components/auth/can';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { humanise } from '@/lib/payments';

interface VirtualAccount {
  id: string;
  gateway: string;
  ownerType: string;
  accountNumber: string;
  bankName: string;
  accountName: string;
  status: string;
  createdAt: string;
}

export default function BankAccountsPage() {
  const { data, isLoading } = useQuery<{ count: number; accounts: VirtualAccount[] }>({
    queryKey: ['admin', 'payments', 'virtual-accounts'],
    queryFn: async () => (await api.get<{ data: { count: number; accounts: VirtualAccount[] } }>('/admin/payments/virtual-accounts')).data.data,
  });
  const accounts = data?.accounts ?? [];
  const riders = accounts.filter((a) => a.ownerType === 'rider').length;

  return (
    <PermissionGuard permission="view_payment_settings">
      <Page>
        <PageHeader title="Bank accounts" description="Account numbers riders and drivers can transfer into to top up their wallet." />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <StatDashboardCard label="Accounts" icon={Bank} variant="wallet" loading={isLoading} value={String(data?.count ?? 0)} hint="Issued in total" />
          <StatDashboardCard label="Riders" icon={UsersThree} loading={isLoading} value={String(riders)} hint="With an account" />
          <StatDashboardCard label="Drivers" icon={SteeringWheel} loading={isLoading} value={String(accounts.length - riders)} hint="With an account" />
          <StatDashboardCard label="Transfers received" icon={ArrowsDownUp} loading={isLoading} value="0" hint="Top-ups by transfer" />
        </div>

        <DashboardCard className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Owner</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {accounts.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      <EmptyState icon={Bank} title="No accounts yet" description="Bank transfer top-ups aren’t switched on yet." />
                    </td>
                  </tr>
                ) : (
                  accounts.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <p className="tabular font-medium text-foreground">{a.accountNumber}</p>
                        <p className="text-xs text-muted">{a.bankName}</p>
                      </td>
                      <td>
                        {a.accountName}
                        <p className="text-xs text-muted">{humanise(a.ownerType)}</p>
                      </td>
                      <td>
                        <StatusPill>{humanise(a.status)}</StatusPill>
                      </td>
                      <td className="tabular text-muted">{formatDateTime(a.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </DashboardCard>
      </Page>
    </PermissionGuard>
  );
}
