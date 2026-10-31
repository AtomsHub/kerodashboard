'use client';

// src/app/finance/payments/[id]/page.tsx
// One payment: headline cards, then two cards — the payment's details and
// Kero vs Paystack (checked on demand) with who it belongs to. Timeline,
// ledger entries and possible duplicates appear only when there are any.
// Resolve / Refund / Mark reviewed go through the verified backend paths.

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, ArrowsClockwise, CheckCircle, Coins, Copy, Eye, Receipt, Warning, Wallet } from '@phosphor-icons/react';
import { AppButton } from '@/components/ui/app-button';
import { AppInput } from '@/components/ui/app-input';
import { AppTextarea } from '@/components/ui/app-textarea';
import { AppModal } from '@/components/ui/app-modal';
import { DashboardCard, StatDashboardCard } from '@/components/ui/dashboard-card';
import { Page, PageHeader, SectionHeader, StatusPill } from '@/components/ui/page';
import { Can, PermissionGuard } from '@/components/auth/can';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import {
  accountLabel,
  errorMessage,
  humanise,
  naira,
  PAYER_LABELS,
  SERVICE_LABELS,
  STATUS_TONES,
  toKobo,
  type FeeVersion,
  type LedgerEntry,
  type PaymentEvent,
  type PaymentTransaction,
  gatewayLabel,
} from '@/lib/payments';

interface Detail {
  transaction: PaymentTransaction;
  events: PaymentEvent[];
  ledger: LedgerEntry[];
  trip: { id: string; status: string; grandTotalKobo: number | null; startAddress: string; endAddress: string } | null;
  possibleDuplicates: Array<{ id: string; reference: string; status: string; createdAt: string }>;
  feePolicyVersion: FeeVersion | null;
}

interface Verification {
  kero: { status: string; amountKobo: number; reference: string; needsReview: boolean };
  provider: { status?: string; amountKobo?: number; feesKobo?: number } | null;
  error: string | null;
  agrees: boolean;
}

const SOURCE_LABELS: Record<string, string> = {
  webhook: 'Paystack webhook',
  verify: 'Checked with Paystack',
  cron: 'Automatic check',
  app: 'App',
  admin: 'Admin',
};

/** Label left, value right. Rows with no value are not shown. */
function Rows({ rows }: { rows: Array<[string, React.ReactNode | null | undefined | false]> }) {
  const shown = rows.filter(([, v]) => v !== null && v !== undefined && v !== false && v !== '');
  return (
    <dl className="mt-3 divide-y divide-border">
      {shown.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-4 py-2.5">
          <dt className="shrink-0 text-[13px] text-muted">{label}</dt>
          <dd className="tabular min-w-0 truncate text-right text-[13.5px] text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function PaymentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [verification, setVerification] = useState<Verification | null>(null);
  const [modal, setModal] = useState<null | 'resolve' | 'refund' | 'reviewed'>(null);
  const [note, setNote] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery<Detail>({
    queryKey: ['admin', 'payments', 'transaction', id],
    queryFn: async () => (await api.get<{ data: Detail }>(`/admin/payments/transactions/${id}`)).data.data,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin', 'payments'] });

  const verify = useMutation({
    mutationFn: async () => (await api.post<{ data: Verification }>(`/admin/payments/transactions/${id}/verify`, undefined, { silent: true })).data.data,
    onSuccess: (v) => {
      setVerification(v);
      refresh();
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not reach Paystack')),
  });

  const act = useMutation({
    mutationFn: async (kind: 'resolve' | 'refund' | 'reviewed') => {
      if (kind === 'resolve') return (await api.post<{ data: { outcome: string } }>(`/admin/payments/transactions/${id}/resolve`, note.trim() ? { note: note.trim() } : {}, { silent: true })).data.data;
      if (kind === 'reviewed') return (await api.post(`/admin/payments/transactions/${id}/reviewed`, { note: note.trim() }, { silent: true })).data;
      const amountKobo = toKobo(refundAmount);
      if (!amountKobo || amountKobo <= 0) throw new Error('Enter the amount to refund');
      return (await api.post<{ data: { status: string } }>(`/admin/payments/transactions/${id}/refund`, { amountKobo, reason: note.trim() }, { silent: true })).data.data;
    },
    onSuccess: (result: unknown, kind) => {
      const r = result as { outcome?: string; status?: string };
      if (kind === 'resolve') toast.success(`Done: ${humanise(r.outcome ?? 'resolved')}`);
      else if (kind === 'refund') toast.success(r.status === 'APPLIED' ? 'Refunded to the wallet' : 'Refund sent for a second approval');
      else toast.success('Marked as reviewed');
      setModal(null);
      setNote('');
      setRefundAmount('');
      refresh();
    },
    onError: (err) => setModalError(errorMessage(err, 'That didn’t work')),
  });

  const open = (kind: 'resolve' | 'refund' | 'reviewed') => {
    setModalError(null);
    setNote('');
    setModal(kind);
  };

  const t = data?.transaction;
  const owner = t?.user
    ? { href: `/riders/${t.user.id}`, name: t.user.fullname ?? 'Rider', role: 'Rider', phone: t.user.phone, wallet: `/finance/wallets/rider/${t.user.id}` }
    : t?.driver
      ? { href: `/drivers/${t.driver.id}`, name: [t.driver.firstname, t.driver.lastname].filter(Boolean).join(' ') || 'Driver', role: 'Driver', phone: t.driver.phone, wallet: `/finance/wallets/driver/${t.driver.id}` }
      : null;
  const viaProvider = Boolean(t && ['fund_account', 'fund_transfer', 'unmatched_charge'].includes(t.transactionServices));
  const resolvable = t && ['fund_account', 'fund_transfer'].includes(t.transactionServices) && ['PENDING', 'PROCESSING'].includes(t.status);
  const providerFee = t ? t.providerFeeKobo || t.chargesKobo : 0;
  const expectedKobo = t ? (t.transactionServices === 'fund_account' ? t.amountKobo + t.userFeeKobo : (t.netAmountKobo ?? t.amountKobo)) : 0;

  return (
    <PermissionGuard permission="view_transactions">
      <Page>
        <PageHeader
          back={
            <Link href="/finance/payments" className="inline-flex items-center gap-1 hover:text-foreground">
              <ArrowLeft size={14} /> Payment ledger
            </Link>
          }
          title={t ? (SERVICE_LABELS[t.transactionServices] ?? humanise(t.transactionServices)) : 'Payment'}
          description={t ? formatDateTime(t.createdAt) : undefined}
          badge={t ? <StatusPill tone={STATUS_TONES[t.status] ?? 'neutral'}>{humanise(t.status)}</StatusPill> : undefined}
          actions={
            t ? (
              <>
                <AppButton
                  variant="tertiary"
                  startContent={<Copy />}
                  label="Copy reference"
                  onPress={() => {
                    void navigator.clipboard.writeText(t.reference);
                    toast.success('Reference copied');
                  }}
                />
                {t.needsReview && (
                  <Can permission="resolve_payments">
                    <AppButton variant="tertiary" label="Mark reviewed" onPress={() => open('reviewed')} />
                  </Can>
                )}
                {(t.userId || t.driverId) && (
                  <Can permission="approve_refunds">
                    <AppButton variant="tertiary" label="Refund" onPress={() => { open('refund'); setRefundAmount(String(t.amountKobo / 100)); }} />
                  </Can>
                )}
                {resolvable && (
                  <Can permission="resolve_payments">
                    <AppButton variant="brand" startContent={<ArrowsClockwise />} label="Resolve" onPress={() => open('resolve')} />
                  </Can>
                )}
              </>
            ) : undefined
          }
        />

        {isError && (
          <DashboardCard className="bg-warning-soft/50">
            <p className="text-[13px]">Couldn’t find that payment.</p>
          </DashboardCard>
        )}

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <StatDashboardCard icon={Wallet} variant="wallet" loading={isLoading} label={t?.transactionServices === 'fund_account' ? 'To wallet' : 'Amount'} value={naira(t?.amountKobo)} hint={t ? humanise(t.transactionType) : ''} />
          <StatDashboardCard icon={Receipt} loading={isLoading} label="Fee paid by user" value={t?.userFeeKobo ? naira(t.userFeeKobo) : 'None'} hint={data?.feePolicyVersion ? `Rule v${data.feePolicyVersion.version} · ${PAYER_LABELS[data.feePolicyVersion.payer]}` : 'No fee rule'} />
          <StatDashboardCard icon={Coins} loading={isLoading} label="Provider charge" value={providerFee ? naira(providerFee) : 'None'} hint={t?.keroSubsidyKobo ? `Kero absorbed ${naira(t.keroSubsidyKobo)}` : viaProvider ? 'Paid by Kero' : 'Internal movement'} />
          <StatDashboardCard
            icon={t?.needsReview ? Warning : CheckCircle}
            loading={isLoading}
            label="Review"
            value={t?.needsReview ? 'Needs review' : 'Clear'}
            hint={t?.needsReview ? (t.reviewReason ?? '') : 'Nothing flagged'}
          />
        </div>

        {t && data && (
          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
            <DashboardCard>
              <SectionHeader title="Payment" />
              <Rows
                rows={[
                  ['Reference', t.reference],
                  ['Gateway code', t.gatewayReference],
                  ['Provider', viaProvider ? gatewayLabel(t.gateway) : 'Kero wallet'],
                  ['Narration', t.narration],
                  ['Sent to bank', t.transactionServices === 'fund_transfer' && t.netAmountKobo != null ? naira(t.netAmountKobo) : null],
                  ['Fee margin', t.feeMarginKobo ? naira(t.feeMarginKobo) : null],
                  ['Created', formatDateTime(t.createdAt)],
                  ['Last updated', formatDateTime(t.updatedAt)],
                  [
                    'Trip',
                    data.trip ? (
                      <Link href={`/trips/${data.trip.id}`} className="text-link hover:underline">
                        {humanise(data.trip.status)} · {data.trip.endAddress.split(',')[0]}
                      </Link>
                    ) : null,
                  ],
                ]}
              />
            </DashboardCard>

            <DashboardCard>
              <SectionHeader
                title={viaProvider ? 'Kero vs Paystack' : 'Who'}
                actions={viaProvider ? <AppButton size="sm" variant="tertiary" label="Check with Paystack" isLoading={verify.isPending} onPress={() => verify.mutate()} /> : undefined}
              />
              <Rows
                rows={[
                  ['Belongs to', owner ? (
                    <Link href={owner.href} className="hover:underline">
                      {owner.name} · {owner.role}
                    </Link>
                  ) : viaProvider ? 'Not linked to anyone' : null],
                  ['Phone', owner?.phone],
                  ['Wallet', owner ? (
                    <Link href={owner.wallet} className="text-link hover:underline">
                      Open wallet
                    </Link>
                  ) : null],
                  ['Kero status', viaProvider ? humanise(t.status) : null],
                  ['Kero amount', viaProvider ? naira(expectedKobo) : null],
                  ['Paystack status', verification?.provider?.status ? humanise(verification.provider.status) : null],
                  ['Paystack amount', verification?.provider?.amountKobo != null ? naira(verification.provider.amountKobo) : null],
                  ['Paystack charge', verification?.provider?.feesKobo != null ? naira(verification.provider.feesKobo) : null],
                  ['Result', verification ? (
                    verification.error ? (
                      <span className="text-danger">{verification.error}</span>
                    ) : verification.agrees ? (
                      <StatusPill tone="success">Both agree</StatusPill>
                    ) : (
                      <StatusPill tone="danger">Don’t match</StatusPill>
                    )
                  ) : null],
                ]}
              />
            </DashboardCard>
          </div>
        )}

        {data && data.events.length > 0 && (
          <DashboardCard className="overflow-hidden p-0">
            <div className="p-6 pb-4">
              <SectionHeader title="Timeline" />
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>From</th>
                  <th>Event</th>
                  <th>Result</th>
                  <th className="text-right">Amount</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {data.events.map((e) => (
                  <tr key={e.id}>
                    <td>{SOURCE_LABELS[e.source] ?? humanise(e.source)}</td>
                    <td className="text-muted">
                      {e.eventType}
                      {e.signatureValid === false && <StatusPill tone="danger">Bad signature</StatusPill>}
                    </td>
                    <td className="text-muted">{[e.providerStatus && humanise(e.providerStatus), e.outcome && humanise(e.outcome)].filter(Boolean).join(' · ') || '—'}</td>
                    <td className="tabular text-right">{e.amountKobo != null ? naira(e.amountKobo) : '—'}</td>
                    <td className="tabular text-muted">{formatDateTime(e.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DashboardCard>
        )}

        {data && data.ledger.length > 0 && (
          <DashboardCard className="overflow-hidden p-0">
            <div className="p-6 pb-4">
              <SectionHeader title="Ledger entries" />
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Type</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.ledger.map((l) => (
                  <tr key={l.id}>
                    <td>{accountLabel(l.account)}</td>
                    <td className="text-muted">{humanise(l.kind)}</td>
                    <td className={`tabular text-right font-medium ${l.amountKobo >= 0 ? 'text-success' : ''}`}>{naira(l.amountKobo, { sign: true })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DashboardCard>
        )}

        {data && data.possibleDuplicates.length > 0 && (
          <DashboardCard className="overflow-hidden p-0">
            <div className="p-6 pb-4">
              <SectionHeader title="Possible duplicates" description="Same person, amount and kind within 10 minutes" />
            </div>
            <table className="data-table">
              <tbody>
                {data.possibleDuplicates.map((d) => (
                  <tr key={d.id}>
                    <td className="tabular">{d.reference}</td>
                    <td>
                      <StatusPill tone={STATUS_TONES[d.status] ?? 'neutral'}>{humanise(d.status)}</StatusPill>
                    </td>
                    <td className="tabular text-muted">{formatDateTime(d.createdAt)}</td>
                    <td className="text-right">
                      <Link href={`/finance/payments/${d.id}`} aria-label="View payment" className="inline-grid size-8 place-items-center rounded-full text-muted hover:bg-default hover:text-foreground">
                        <Eye size={16} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DashboardCard>
        )}

        <AppModal
          isOpen={modal !== null}
          onOpenChange={(o) => !o && setModal(null)}
          size="sm"
          title={modal === 'resolve' ? 'Resolve this payment?' : modal === 'refund' ? 'Refund to wallet' : 'Mark as reviewed'}
          description={
            modal === 'resolve'
              ? 'Kero asks Paystack again and settles it: credit if paid, fail if not.'
              : modal === 'refund'
                ? 'Above ₦20,000 a second admin must approve it.'
                : undefined
          }
          footer={
            <>
              <AppButton variant="tertiary" label="Cancel" onPress={() => setModal(null)} />
              <AppButton
                variant="brand"
                label={modal === 'resolve' ? 'Resolve' : modal === 'refund' ? 'Refund' : 'Mark reviewed'}
                isLoading={act.isPending}
                isDisabled={act.isPending || (modal !== 'resolve' && note.trim().length < 5)}
                onPress={() => modal && act.mutate(modal)}
              />
            </>
          }
        >
          <div className="space-y-3">
            {modal === 'refund' && <AppInput label="Amount (₦)" type="number" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} />}
            <AppTextarea label={modal === 'resolve' ? 'Note (optional)' : 'Reason'} value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
            {modalError && <p className="rounded-2xl bg-danger-soft px-4 py-3 text-[13px] text-danger">{modalError}</p>}
          </div>
        </AppModal>
      </Page>
    </PermissionGuard>
  );
}
