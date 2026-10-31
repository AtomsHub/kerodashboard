'use client';

// src/app/finance/wallets/[role]/[id]/page.tsx
// One wallet: balances, its ledger statement (every movement, newest first),
// receipts, ride holds and refunds/adjustments made from a payment.

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, Coins, Eye, Lock, Scales, Wallet } from '@phosphor-icons/react';
import { AppButton } from '@/components/ui/app-button';
import { DashboardCard, StatDashboardCard } from '@/components/ui/dashboard-card';
import { EmptyState, Page, PageHeader, Segmented, StatusPill, TablePagination } from '@/components/ui/page';
import { PermissionGuard } from '@/components/auth/can';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { humanise, naira, SERVICE_LABELS, STATUS_TONES, type LedgerEntry, type PaymentTransaction } from '@/lib/payments';

interface WalletDetail {
  role: 'rider' | 'driver';
  id: string;
  name: string | null;
  phone: string | null;
  walletBalanceKobo: number;
  bonusBalanceKobo: number;
  heldBalanceKobo: number;
  ledgerBalanceKobo: number;
  inBalance: boolean;
  statement: { entries: LedgerEntry[]; total: number; page: number; limit: number };
  transactions: PaymentTransaction[];
  holds: Array<{ id: string; tripId: string; amountKobo: number; status: string; createdAt: string }>;
  adjustments: Array<{ id: string; amountKobo: number; kind: string; reason: string; status: string; requestedByName: string | null; reviewedByName: string | null; createdAt: string }>;
}

type Tab = 'statement' | 'receipts' | 'holds' | 'adjustments';

export default function WalletDetailPage() {
  const { role, id } = useParams<{ role: 'rider' | 'driver'; id: string }>();
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<Tab>('statement');

  const { data, isLoading } = useQuery<WalletDetail>({
    queryKey: ['admin', 'payments', 'wallet', role, id, page],
    queryFn: async () => (await api.get<{ data: WalletDetail }>(`/admin/payments/wallets/${role}/${id}`, { params: { page } })).data.data,
  });

  const isRider = role === 'rider';
  const profile = isRider ? `/riders/${id}` : `/drivers/${id}`;

  return (
    <PermissionGuard permission="view_ledger">
      <Page>
        <PageHeader
          back={
            <Link href="/finance/wallets" className="inline-flex items-center gap-1 hover:text-foreground">
              <ArrowLeft size={14} /> Wallets
            </Link>
          }
          title={data?.name || (isRider ? 'Rider wallet' : 'Driver wallet')}
          description={data?.phone ?? undefined}
          badge={data && !data.inBalance ? <StatusPill tone="danger">Out of balance</StatusPill> : undefined}
          actions={
            <>
              <AppButton variant="tertiary" label="Profile" onPress={() => (window.location.href = profile)} />
            </>
          }
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <StatDashboardCard icon={Wallet} variant="wallet" loading={isLoading} label="Wallet" value={naira(data?.walletBalanceKobo)} hint={data && data.walletBalanceKobo < 0 ? 'Owes Kero' : 'Current balance'} />
          {isRider ? (
            <StatDashboardCard icon={Lock} loading={isLoading} label="On hold for rides" value={naira(data?.heldBalanceKobo)} hint="Charged when the ride ends" />
          ) : (
            <StatDashboardCard icon={Coins} loading={isLoading} label="Bonus" value={naira(data?.bonusBalanceKobo)} hint="Referral and reward credits" />
          )}
          <StatDashboardCard
            icon={Coins}
            loading={isLoading}
            label={isRider ? 'Can spend' : 'Can withdraw'}
            value={naira(Math.max(0, (data?.walletBalanceKobo ?? 0) - (data?.heldBalanceKobo ?? 0)))}
            hint={isRider ? 'Wallet minus money on hold' : 'Available for withdrawal'}
          />
          <StatDashboardCard icon={BookOpen} loading={isLoading} label="Ledger" value={naira(data?.ledgerBalanceKobo)} hint={data?.inBalance === false ? 'Does not match the wallet' : 'Matches the wallet'} />
        </div>

        <DashboardCard className="overflow-hidden p-0">
          <div className="flex justify-end p-6 pb-4">
            <Segmented
              size="sm"
              aria-label="History"
              value={tab}
              onChange={setTab}
              options={[
                { key: 'statement', label: 'Statement' },
                { key: 'receipts', label: 'Receipts' },
                ...(isRider ? [{ key: 'holds' as const, label: 'Ride holds' }] : []),
                { key: 'adjustments', label: 'Adjustments' },
              ]}
            />
          </div>

          {isLoading || !data ? (
            <div className="mx-6 mb-6 h-40 animate-pulse rounded-2xl bg-surface-secondary" />
          ) : (
            <div className="overflow-x-auto">
              {tab === 'statement' && (
                <>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Movement</th>
                        <th>Type</th>
                        <th>When</th>
                        <th className="text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.statement.entries.length === 0 ? (
                        <tr>
                          <td colSpan={4}>
                            <EmptyState icon={BookOpen} title="No movements yet" />
                          </td>
                        </tr>
                      ) : (
                        data.statement.entries.map((e) => (
                          <tr key={e.id}>
                            <td className="text-foreground">{e.description || humanise(e.kind)}</td>
                            <td className="text-muted">{humanise(e.kind)}</td>
                            <td className="tabular text-muted">{formatDateTime(e.createdAt)}</td>
                            <td className={`tabular text-right font-medium ${e.amountKobo >= 0 ? 'text-success' : ''}`}>{naira(e.amountKobo, { sign: true })}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                  <TablePagination page={page} totalPages={Math.max(1, Math.ceil(data.statement.total / data.statement.limit))} onChange={setPage} />
                </>
              )}
              {tab === 'receipts' && (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Payment</th>
                      <th>Status</th>
                      <th>When</th>
                      <th className="text-right">Amount</th>
                      <th className="w-12" />
                    </tr>
                  </thead>
                  <tbody>
                    {data.transactions.length === 0 ? (
                      <tr>
                        <td colSpan={5}>
                          <EmptyState icon={Wallet} title="No payments yet" />
                        </td>
                      </tr>
                    ) : (
                      data.transactions.map((t) => (
                        <tr key={t.id}>
                          <td>
                            <p className="text-foreground">{SERVICE_LABELS[t.transactionServices] ?? humanise(t.transactionServices)}</p>
                            <p className="tabular truncate text-xs text-muted">{t.reference}</p>
                          </td>
                          <td>
                            <StatusPill tone={STATUS_TONES[t.status] ?? 'neutral'}>{humanise(t.status)}</StatusPill>
                          </td>
                          <td className="tabular text-muted">{formatDateTime(t.createdAt)}</td>
                          <td className="tabular text-right font-medium">{naira(t.amountKobo)}</td>
                          <td className="text-right">
                            <Link href={`/finance/payments/${t.id}`} aria-label="View payment" className="inline-grid size-8 place-items-center rounded-full text-muted hover:bg-default hover:text-foreground">
                              <Eye size={16} />
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
              {tab === 'holds' && (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Trip</th>
                      <th>Status</th>
                      <th>When</th>
                      <th className="text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.holds.length === 0 ? (
                      <tr>
                        <td colSpan={4}>
                          <EmptyState icon={Lock} title="No ride holds" />
                        </td>
                      </tr>
                    ) : (
                      data.holds.map((h) => (
                        <tr key={h.id}>
                          <td>
                            <Link href={`/trips/${h.tripId}`} className="text-link hover:underline">
                              Trip {h.tripId.slice(-8)}
                            </Link>
                          </td>
                          <td>
                            <StatusPill tone={h.status === 'HELD' ? 'warning' : h.status === 'CAPTURED' ? 'success' : 'neutral'}>{humanise(h.status)}</StatusPill>
                          </td>
                          <td className="tabular text-muted">{formatDateTime(h.createdAt)}</td>
                          <td className="tabular text-right">{naira(h.amountKobo)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
              {tab === 'adjustments' && (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Reason</th>
                      <th>By</th>
                      <th>Status</th>
                      <th className="text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.adjustments.length === 0 ? (
                      <tr>
                        <td colSpan={4}>
                          <EmptyState icon={Scales} title="No adjustments" />
                        </td>
                      </tr>
                    ) : (
                      data.adjustments.map((a) => (
                        <tr key={a.id}>
                          <td className="max-w-[360px]">
                            <p className="truncate text-foreground">{a.reason}</p>
                            <p className="text-xs text-muted">{humanise(a.kind)}</p>
                          </td>
                          <td className="text-muted">
                            {a.requestedByName ?? 'Admin'}
                            <p className="tabular text-xs">{formatDateTime(a.createdAt)}</p>
                          </td>
                          <td>
                            <StatusPill tone={STATUS_TONES[a.status] ?? 'neutral'}>{a.status === 'PENDING_APPROVAL' ? 'Waiting' : humanise(a.status)}</StatusPill>
                          </td>
                          <td className="tabular text-right font-medium">{naira(a.amountKobo, { sign: true })}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </DashboardCard>

      </Page>
    </PermissionGuard>
  );
}
