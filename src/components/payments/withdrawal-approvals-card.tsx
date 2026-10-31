'use client';

// src/components/payments/withdrawal-approvals-card.tsx
// Withdrawals above the approval amount in Payment settings wait here. The
// money is already set aside from the wallet; approving sends it, rejecting
// returns it. Needs the "Send money out" permission.

import React, { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PaperPlaneTilt } from '@phosphor-icons/react';
import { AppButton } from '@/components/ui/app-button';
import { AppModal } from '@/components/ui/app-modal';
import { AppTextarea } from '@/components/ui/app-textarea';
import { DashboardCard } from '@/components/ui/dashboard-card';
import { EmptyState, SectionHeader, StatusPill } from '@/components/ui/page';
import { Can } from '@/components/auth/can';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { errorMessage, naira } from '@/lib/payments';

export interface PayoutApproval {
  id: string;
  reference: string;
  role: 'rider' | 'driver';
  ownerId: string | null;
  ownerName: string | null;
  ownerPhone: string | null;
  amountKobo: number;
  netAmountKobo: number | null;
  feeKobo: number;
  bankName: string | null;
  accountName: string | null;
  accountNumberMasked: string;
  status: string;
  approvalStatus: 'WAITING' | 'APPROVED' | 'REJECTED';
  approvedByName: string | null;
  approvedAt: string | null;
  approvalNote: string | null;
  createdAt: string;
}

const TONE = { WAITING: 'warning', APPROVED: 'success', REJECTED: 'danger' } as const;
const LABEL = { WAITING: 'Waiting', APPROVED: 'Sent', REJECTED: 'Rejected' } as const;

export function useWithdrawalApprovals() {
  return useQuery<PayoutApproval[]>({
    queryKey: ['admin', 'payments', 'payout-approvals'],
    queryFn: async () => (await api.get<{ data: PayoutApproval[] }>('/admin/payments/payouts/approvals')).data.data,
    refetchInterval: 30_000,
  });
}

export function WithdrawalApprovalsCard() {
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useWithdrawalApprovals();
  const [target, setTarget] = useState<{ row: PayoutApproval; approve: boolean } | null>(null);
  const [note, setNote] = useState('');

  const review = useMutation({
    mutationFn: async () =>
      api.post(`/admin/payments/payouts/${target!.row.id}/review`, { approve: target!.approve, ...(note.trim() ? { note: note.trim() } : {}) }, { silent: true }),
    onSuccess: () => {
      toast.success(target?.approve ? 'Approved: sent to the bank' : 'Rejected: money back in the wallet');
      setTarget(null);
      setNote('');
      queryClient.invalidateQueries({ queryKey: ['admin', 'payments'] });
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not save')),
  });

  return (
    <DashboardCard className="overflow-hidden p-0">
      <SectionHeader className="p-6 pb-4" title="Large withdrawals" description="Approving sends the money; rejecting returns it to the wallet." />
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Who</th>
              <th>To</th>
              <th>Status</th>
              <th className="text-right">Amount</th>
              <th className="w-44" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5}>
                  <div className="h-16 animate-pulse rounded-2xl bg-surface-secondary" />
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <EmptyState icon={PaperPlaneTilt} title="Nothing waiting" description="Withdrawals above the approval amount show up here." />
                </td>
              </tr>
            ) : (
              data.map((w) => (
                <tr key={w.id}>
                  <td>
                    {w.ownerId ? (
                      <Link href={`/finance/wallets/${w.role}/${w.ownerId}`} className="font-medium text-foreground hover:underline">
                        {w.ownerName ?? (w.role === 'driver' ? 'Driver' : 'Rider')}
                      </Link>
                    ) : (
                      w.ownerName
                    )}
                    <p className="text-xs text-muted">
                      {w.role === 'driver' ? 'Driver' : 'Rider'} · {formatDateTime(w.createdAt)}
                    </p>
                  </td>
                  <td className="text-muted">
                    {w.bankName}
                    <p className="tabular text-xs">
                      {w.accountName} · {w.accountNumberMasked}
                    </p>
                  </td>
                  <td>
                    <StatusPill tone={TONE[w.approvalStatus]}>{LABEL[w.approvalStatus]}</StatusPill>
                    {w.approvedByName && <p className="mt-0.5 text-xs text-muted">by {w.approvedByName}</p>}
                  </td>
                  <td className="tabular text-right font-medium">
                    {naira(w.amountKobo)}
                    {w.feeKobo > 0 && <p className="text-xs font-normal text-muted">{naira(w.feeKobo)} fee</p>}
                  </td>
                  <td className="text-right">
                    {w.approvalStatus === 'WAITING' && (
                      <Can permission="approve_withdrawals">
                        <div className="flex justify-end gap-1">
                          <AppButton size="sm" variant="tertiary" label="Reject" onPress={() => setTarget({ row: w, approve: false })} />
                          <AppButton size="sm" variant="brand" label="Approve" onPress={() => setTarget({ row: w, approve: true })} />
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

      <AppModal
        isOpen={Boolean(target)}
        onOpenChange={(o) => !o && setTarget(null)}
        size="sm"
        title={target?.approve ? `Send ${naira(target.row.netAmountKobo ?? target.row.amountKobo)}?` : 'Reject this withdrawal?'}
        description={target ? `${target.row.accountName ?? ''} · ${target.row.bankName ?? ''} ${target.row.accountNumberMasked}` : undefined}
        footer={
          <>
            <AppButton variant="tertiary" label="Cancel" onPress={() => setTarget(null)} />
            <AppButton
              variant={target?.approve ? 'brand' : 'danger'}
              label={target?.approve ? 'Approve and send' : 'Reject'}
              isLoading={review.isPending}
              isDisabled={!target?.approve && note.trim().length < 5}
              onPress={() => review.mutate()}
            />
          </>
        }
      >
        <AppTextarea label={target?.approve ? 'Note (optional)' : 'Reason'} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </AppModal>
    </DashboardCard>
  );
}
