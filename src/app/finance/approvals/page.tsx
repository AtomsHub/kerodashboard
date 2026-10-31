'use client';

// src/app/finance/approvals/page.tsx
// Money waiting for a second person: large withdrawals (approved by finance
// with "Send money out") and refunds/adjustments above the amount in
// Payment settings (approved by an admin other than the requester).

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle, CheckSquare, Hourglass, Money, XCircle } from '@phosphor-icons/react';
import { AppButton } from '@/components/ui/app-button';
import { AppSelect } from '@/components/ui/app-select';
import { AppTextarea } from '@/components/ui/app-textarea';
import { AppModal } from '@/components/ui/app-modal';
import { DashboardCard, StatDashboardCard } from '@/components/ui/dashboard-card';
import { EmptyState, Page, PageHeader, SectionHeader, Segmented, StatusPill } from '@/components/ui/page';
import { Can, PermissionGuard } from '@/components/auth/can';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { errorMessage, humanise, naira, STATUS_TONES } from '@/lib/payments';
import { useWithdrawalApprovals, WithdrawalApprovalsCard } from '@/components/payments/withdrawal-approvals-card';

interface Adjustment {
  id: string;
  ownerType: 'rider' | 'driver';
  ownerId: string;
  amountKobo: number;
  kind: string;
  sourceTransactionId: string | null;
  reason: string;
  status: string;
  requestedByName: string | null;
  reviewedByName: string | null;
  reviewNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export default function ApprovalsPage() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<'withdrawals' | 'refunds'>('withdrawals');
  const [status, setStatus] = useState<'PENDING_APPROVAL' | 'APPLIED' | 'REJECTED' | 'ALL'>('PENDING_APPROVAL');
  const [target, setTarget] = useState<{ adj: Adjustment; approve: boolean } | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  // One list for both the stats and the table; filtered locally.
  const { data = [], isLoading } = useQuery<Adjustment[]>({
    queryKey: ['admin', 'payments', 'adjustments', 'ALL'],
    queryFn: async () => (await api.get<{ data: Adjustment[] }>('/admin/payments/adjustments', { params: { status: 'ALL' } })).data.data,
    refetchInterval: 30_000,
  });
  const rows = status === 'ALL' ? data : data.filter((a) => a.status === status);
  const payouts = useWithdrawalApprovals();
  const waitingPayouts = (payouts.data ?? []).filter((w) => w.approvalStatus === 'WAITING');
  const stats = useMemo(() => {
    const waiting = data.filter((a) => a.status === 'PENDING_APPROVAL');
    return {
      waiting: waiting.length,
      waitingKobo: waiting.reduce((s, a) => s + Math.abs(a.amountKobo), 0),
      applied: data.filter((a) => a.status === 'APPLIED').length,
      rejected: data.filter((a) => a.status === 'REJECTED').length,
    };
  }, [data]);

  const review = useMutation({
    mutationFn: async () => {
      if (!target) return;
      await api.post(`/admin/payments/adjustments/${target.adj.id}/review`, { approve: target.approve, ...(note.trim() ? { note: note.trim() } : {}) }, { silent: true });
    },
    onSuccess: () => {
      toast.success(target?.approve ? 'Approved: money moved' : 'Rejected');
      setTarget(null);
      setNote('');
      queryClient.invalidateQueries({ queryKey: ['admin', 'payments'] });
    },
    onError: (err) => setError(errorMessage(err, 'Could not save')),
  });

  return (
    <PermissionGuard permission="view_ledger">
      <Page>
        <PageHeader title="Approvals" description="Large withdrawals and refunds wait here for a second person." />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <StatDashboardCard label="Withdrawals waiting" icon={Hourglass} variant="wallet" loading={payouts.isLoading} value={String(waitingPayouts.length)} hint={naira(waitingPayouts.reduce((s, w) => s + w.amountKobo, 0))} />
          <StatDashboardCard label="Refunds waiting" icon={Money} loading={isLoading} value={String(stats.waiting)} hint={naira(stats.waitingKobo)} />
          <StatDashboardCard label="Approved" icon={CheckCircle} loading={isLoading} value={String(stats.applied)} hint="Most recent 200" />
          <StatDashboardCard label="Rejected" icon={XCircle} loading={isLoading} value={String(stats.rejected)} hint="Most recent 200" />
        </div>

        <Segmented
          size="sm"
          aria-label="Approvals"
          value={view}
          onChange={setView}
          options={[
            { key: 'withdrawals', label: 'Large withdrawals', count: waitingPayouts.length },
            { key: 'refunds', label: 'Refunds and adjustments', count: stats.waiting },
          ]}
        />

        {view === 'withdrawals' ? <WithdrawalApprovalsCard /> : (
        <DashboardCard className="overflow-hidden p-0">
          <div className="flex flex-col gap-3 p-6 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <SectionHeader title="Refunds and adjustments" />
            <div className="w-full sm:w-44">
              <AppSelect
                size="sm"
                aria-label="Status"
                selectedKey={status}
                onSelectionChange={(v) => setStatus(v as typeof status)}
                options={[
                  { key: 'PENDING_APPROVAL', label: 'Waiting' },
                  { key: 'APPLIED', label: 'Approved' },
                  { key: 'REJECTED', label: 'Rejected' },
                  { key: 'ALL', label: 'All' },
                ]}
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="text-right">Amount</th>
                  <th>Reason</th>
                  <th>Wallet</th>
                  <th>Requested</th>
                  <th>Status</th>
                  <th className="w-44" />
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="h-24 animate-pulse rounded-2xl bg-surface-secondary" />
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState icon={CheckSquare} title="Nothing here" description={status === 'PENDING_APPROVAL' ? 'No requests are waiting.' : 'No requests match.'} />
                    </td>
                  </tr>
                ) : (
                  rows.map((a) => (
                    <tr key={a.id}>
                      <td className="tabular text-right font-semibold">{naira(a.amountKobo, { sign: true })}</td>
                      <td className="max-w-[360px]">
                        <p className="truncate text-foreground">{a.reason}</p>
                        <p className="text-xs text-muted">
                          {humanise(a.kind)}
                          {a.sourceTransactionId && (
                            <>
                              {' · '}
                              <Link href={`/finance/payments/${a.sourceTransactionId}`} className="text-link hover:underline">
                                payment
                              </Link>
                            </>
                          )}
                        </p>
                      </td>
                      <td>
                        <Link href={`/finance/wallets/${a.ownerType}/${a.ownerId}`} className="text-link hover:underline">
                          {a.ownerType === 'rider' ? 'Rider' : 'Driver'}
                        </Link>
                      </td>
                      <td>
                        <p className="text-foreground">{a.requestedByName ?? 'Admin'}</p>
                        <p className="tabular text-xs text-muted">{formatDateTime(a.createdAt)}</p>
                      </td>
                      <td>
                        <StatusPill tone={STATUS_TONES[a.status] ?? 'neutral'}>{a.status === 'PENDING_APPROVAL' ? 'Waiting' : humanise(a.status)}</StatusPill>
                        {a.reviewedByName && <p className="mt-0.5 text-xs text-muted">by {a.reviewedByName}</p>}
                      </td>
                      <td className="text-right">
                        {a.status === 'PENDING_APPROVAL' && (
                          <Can permission="approve_wallet_adjustment">
                            <div className="flex justify-end gap-2">
                              <AppButton size="sm" variant="tertiary" label="Reject" onPress={() => { setError(null); setTarget({ adj: a, approve: false }); }} />
                              <AppButton size="sm" variant="brand" label="Approve" onPress={() => { setError(null); setTarget({ adj: a, approve: true }); }} />
                            </div>
                          </Can>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </DashboardCard>
        )}

        <AppModal
          isOpen={Boolean(target)}
          onOpenChange={(o) => !o && setTarget(null)}
          size="sm"
          title={target?.approve ? `Approve ${naira(target.adj.amountKobo, { sign: true })}?` : 'Reject this request?'}
          description={target?.approve ? 'The money moves immediately and is recorded in the ledger.' : 'Nothing moves. The requester can see your note.'}
          footer={
            <>
              <AppButton variant="tertiary" label="Back" onPress={() => setTarget(null)} />
              <AppButton variant="brand" label={target?.approve ? 'Approve' : 'Reject'} isLoading={review.isPending} isDisabled={review.isPending} onPress={() => review.mutate()} />
            </>
          }
        >
          <div className="space-y-3">
            <AppTextarea label="Note (optional)" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            {error && <p className="rounded-2xl bg-danger-soft px-4 py-3 text-[13px] text-danger">{error}</p>}
          </div>
        </AppModal>
      </Page>
    </PermissionGuard>
  );
}
