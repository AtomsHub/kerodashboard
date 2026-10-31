'use client';

// src/app/payments/page.tsx
// Payment issues: everything finance or customer care should look at, in one
// table — payments held for review, top-ups/withdrawals stuck with Paystack,
// rides that were never charged and possible double charges. "Check with
// Paystack" compares Kero's records with Paystack's for a date range and lists
// the differences underneath.

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { RangeCalendar } from '@heroui/react';
import { ArrowsClockwise, CheckCircle, Clock, Copy, Path, Scales, Warning, WarningCircle } from '@phosphor-icons/react';
import { AppButton } from '@/components/ui/app-button';
import { AppModal } from '@/components/ui/app-modal';
import { DashboardCard, StatDashboardCard } from '@/components/ui/dashboard-card';
import { EmptyState, Page, PageHeader, SectionHeader, Segmented, StatusPill } from '@/components/ui/page';
import { Can, PermissionGuard } from '@/components/auth/can';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { errorMessage, humanise, naira, SERVICE_LABELS, STATUS_TONES, type PaymentTransaction } from '@/lib/payments';

interface ReconItem {
  id: string;
  reference: string;
  kind: string;
  internalAmountKobo: number | null;
  providerAmountKobo: number | null;
  internalStatus: string | null;
  providerStatus: string | null;
}

interface ReconRun {
  id: string;
  periodFrom: string;
  periodTo: string;
  status: string;
  checked: number;
  matched: number;
  mismatched: number;
  missingInternal: number;
  missingProvider: number;
  error: string | null;
  startedAt: string;
  items: ReconItem[];
}

interface Issues {
  counts: { flagged: number; stuck: number; unpaidRides: number; duplicates: number; drift: number; pendingAdjustments: number };
  flagged: PaymentTransaction[];
  stuck: PaymentTransaction[];
  unpaidRides: Array<{ trip_id: string; user_id: string; amount_kobo: number; created_at: string }>;
  duplicates: Array<{ a: string; b: string; owner: string; service: string; amount_kobo: number; created_at: string }>;
  drift: Array<{ account: string; ledgerKobo: number; cachedKobo: number }>;
  reconciliation: ReconRun | null;
}

type Kind = 'all' | 'flagged' | 'stuck' | 'unpaid' | 'duplicate';

interface Row {
  key: string;
  kind: Exclude<Kind, 'all'>;
  href: string;
  title: string;
  detail: string;
  amountKobo: number;
  status?: string;
  at: string;
}

const KIND_LABELS: Record<Exclude<Kind, 'all'>, { label: string; tone: 'danger' | 'warning' | 'accent' }> = {
  flagged: { label: 'Held for review', tone: 'danger' },
  stuck: { label: 'Stuck', tone: 'warning' },
  unpaid: { label: 'Ride not charged', tone: 'danger' },
  duplicate: { label: 'Possible double charge', tone: 'accent' },
};

const RECON_LABELS: Record<string, string> = {
  AMOUNT_MISMATCH: 'Different amount',
  STATUS_MISMATCH: 'Different status',
  MISSING_INTERNAL: 'Only at Paystack',
  MISSING_PROVIDER: 'Only in Kero',
};

/** YYYY-MM-DD for a date in local time. */
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function PaymentIssuesPage() {
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<Kind>('all');
  const [checkOpen, setCheckOpen] = useState(false);
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);

  const { data, isLoading, isError } = useQuery<Issues>({
    queryKey: ['admin', 'payments', 'issues'],
    queryFn: async () => (await api.get<{ data: Issues }>('/admin/payments/issues')).data.data,
    refetchInterval: 60_000,
  });

  const rows = useMemo<Row[]>(() => {
    if (!data) return [];
    const tx = (t: PaymentTransaction, k: 'flagged' | 'stuck'): Row => ({
      key: `${k}-${t.id}`,
      kind: k,
      href: `/finance/payments/${t.id}`,
      title: SERVICE_LABELS[t.transactionServices] ?? humanise(t.transactionServices),
      detail: k === 'flagged' ? (t.reviewReason ?? t.reference) : t.reference,
      amountKobo: t.amountKobo,
      status: t.status,
      at: t.createdAt,
    });
    return [
      ...data.flagged.map((t) => tx(t, 'flagged')),
      ...data.stuck.map((t) => tx(t, 'stuck')),
      ...data.unpaidRides.map((r) => ({
        key: `unpaid-${r.trip_id}`,
        kind: 'unpaid' as const,
        href: `/trips/${r.trip_id}`,
        title: 'Ride fare',
        detail: `Trip ${r.trip_id.slice(-8)} completed but the held fare was never charged`,
        amountKobo: r.amount_kobo,
        at: r.created_at,
      })),
      ...data.duplicates.map((d) => ({
        key: `dup-${d.a}-${d.b}`,
        kind: 'duplicate' as const,
        href: `/finance/payments/${d.b}`,
        title: SERVICE_LABELS[d.service] ?? humanise(d.service),
        detail: 'Same person and amount twice within 10 minutes',
        amountKobo: d.amount_kobo,
        at: d.created_at,
      })),
    ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [data]);
  const shown = kind === 'all' ? rows : rows.filter((r) => r.kind === kind);

  const runCheck = useMutation({
    mutationFn: async () => {
      if (!range) throw new Error('Pick the days to check');
      return (
        await api.post<{ data: ReconRun }>(
          '/admin/payments/reconciliation',
          { from: `${range.from}T00:00:00+01:00`, to: `${range.to}T23:59:59+01:00` },
          { silent: true },
        )
      ).data.data;
    },
    onSuccess: (run) => {
      const diffs = run.mismatched + run.missingInternal + run.missingProvider;
      if (run.status === 'FAILED') toast.error(run.error ?? 'The check failed');
      else toast.success(diffs ? `${diffs} difference${diffs === 1 ? '' : 's'} found` : `All ${run.checked} payments match Paystack`);
      setCheckOpen(false);
      queryClient.invalidateQueries({ queryKey: ['admin', 'payments', 'issues'] });
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not run the check')),
  });

  const markDone = useMutation({
    mutationFn: async (id: string) => api.patch(`/admin/payments/reconciliation/items/${id}`, { resolved: true }, { silent: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'payments', 'issues'] }),
  });

  const run = data?.reconciliation;
  const c = data?.counts;

  return (
    <PermissionGuard permission="view_transactions">
      <Page>
        <PageHeader
          title="Payment issues"
          description="Anything stuck, flagged or out of balance. Open a payment to see Kero's record next to Paystack's and resolve it."
          actions={
            <Can permission="run_reconciliation">
              <AppButton
                variant="tertiary"
                startContent={<Scales />}
                label="Check with Paystack"
                onPress={() => {
                  const to = new Date();
                  const from = new Date(Date.now() - 6 * 86_400_000);
                  setRange({ from: isoDay(from), to: isoDay(to) });
                  setCheckOpen(true);
                }}
              />
            </Can>
          }
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <StatDashboardCard label="Held for review" icon={WarningCircle} variant="wallet" loading={isLoading} value={String(c?.flagged ?? 0)} hint="Wrong amount or unknown payer" />
          <StatDashboardCard label="Stuck" icon={Clock} loading={isLoading} value={String(c?.stuck ?? 0)} hint="Pending at Paystack over 15 min" />
          <StatDashboardCard label="Rides not charged" icon={Path} loading={isLoading} value={String(c?.unpaidRides ?? 0)} hint="Completed, fare still on hold" />
          <StatDashboardCard label="Possible double charges" icon={Copy} loading={isLoading} value={String(c?.duplicates ?? 0)} hint="Last 30 days" />
        </div>

        {isError && (
          <DashboardCard className="bg-warning-soft/50">
            <p className="text-[13px] text-foreground">Couldn’t load payment issues.</p>
          </DashboardCard>
        )}

        {c && c.drift > 0 && (
          <DashboardCard className="bg-danger-soft/40">
            <div className="flex items-start gap-3">
              <Warning size={20} className="mt-0.5 shrink-0 text-danger" />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium text-foreground">{c.drift} wallet{c.drift === 1 ? '' : 's'} don’t match the ledger</p>
                <p className="mt-0.5 text-[13px] text-muted">A balance changed without a ledger entry. Tell engineering; don’t adjust these wallets until it’s explained.</p>
                <ul className="mt-2 space-y-1 text-[12.5px]">
                  {data?.drift.slice(0, 5).map((d) => (
                    <li key={d.account} className="tabular text-muted">
                      {d.account}: wallet {naira(d.cachedKobo)} · ledger {naira(d.ledgerKobo)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </DashboardCard>
        )}

        {c && c.pendingAdjustments > 0 && (
          <DashboardCard>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[14px] text-foreground">
                {c.pendingAdjustments} adjustment{c.pendingAdjustments === 1 ? '' : 's'} waiting for a second approver.
              </p>
              <Link href="/finance/approvals" className="text-[13px] font-medium text-link hover:underline">
                Review
              </Link>
            </div>
          </DashboardCard>
        )}

        <DashboardCard className="overflow-hidden p-0">
          <div className="flex flex-col gap-3 p-6 pb-4 lg:flex-row lg:items-center lg:justify-between">
            <SectionHeader title="Needs attention" />
            <Segmented
              size="sm"
              aria-label="Type"
              value={kind}
              onChange={setKind}
              options={[
                { key: 'all', label: 'All', count: rows.length },
                { key: 'flagged', label: 'Review', count: c?.flagged },
                { key: 'stuck', label: 'Stuck', count: c?.stuck },
                { key: 'unpaid', label: 'Not charged', count: c?.unpaidRides },
                { key: 'duplicate', label: 'Doubles', count: c?.duplicates },
              ]}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Issue</th>
                  <th>Payment</th>
                  <th className="text-right">Amount</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={4}>
                      <div className="h-24 animate-pulse rounded-2xl bg-surface-secondary" />
                    </td>
                  </tr>
                ) : shown.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      <EmptyState icon={CheckCircle} title="Nothing needs attention" description="Every payment is settled and the ledger balances." />
                    </td>
                  </tr>
                ) : (
                  shown.map((r) => (
                    <tr key={r.key}>
                      <td>
                        <StatusPill tone={KIND_LABELS[r.kind].tone}>{KIND_LABELS[r.kind].label}</StatusPill>
                      </td>
                      <td className="max-w-[420px]">
                        <Link href={r.href} className="font-medium text-foreground hover:underline">
                          {r.title}
                        </Link>
                        <p className="truncate text-xs text-muted">{r.detail}</p>
                      </td>
                      <td className="tabular text-right font-medium">
                        {naira(r.amountKobo)}
                        {r.status && (
                          <div className="mt-0.5">
                            <StatusPill tone={STATUS_TONES[r.status] ?? 'neutral'}>{humanise(r.status)}</StatusPill>
                          </div>
                        )}
                      </td>
                      <td className="tabular text-muted">{formatDateTime(r.at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </DashboardCard>

        <DashboardCard className="overflow-hidden p-0">
          <div className="p-6 pb-4">
            <SectionHeader
              title="Paystack check"
              description={
                run
                  ? `${run.periodFrom.slice(0, 10)} → ${run.periodTo.slice(0, 10)} · ${run.checked} payments checked · ${formatDateTime(run.startedAt)}`
                  : 'Compares Kero’s top-ups and withdrawals with Paystack’s records for the days you pick.'
              }
              actions={
                run ? (
                  run.status === 'FAILED' ? (
                    <StatusPill tone="danger">Failed</StatusPill>
                  ) : run.items.length ? (
                    <StatusPill tone="warning">{run.items.length} to look at</StatusPill>
                  ) : (
                    <StatusPill tone="success">All match</StatusPill>
                  )
                ) : undefined
              }
            />
            {run?.error && <p className="mt-3 rounded-2xl bg-danger-soft px-4 py-3 text-[13px] text-danger">{run.error}</p>}
          </div>
          {!run ? (
            <EmptyState icon={Scales} title="Not checked yet" description="Use “Check with Paystack” above." className="pb-10" />
          ) : run.items.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Difference</th>
                    <th>Reference</th>
                    <th className="text-right">Kero</th>
                    <th className="text-right">Paystack</th>
                    <th className="w-24" />
                  </tr>
                </thead>
                <tbody>
                  {run.items.map((i) => (
                    <tr key={i.id}>
                      <td>
                        <StatusPill tone={i.kind === 'MISSING_INTERNAL' ? 'danger' : 'warning'}>{RECON_LABELS[i.kind] ?? i.kind}</StatusPill>
                      </td>
                      <td>
                        <Link href={`/finance/payments/${encodeURIComponent(i.reference)}`} className="tabular text-[13px] text-link hover:underline">
                          {i.reference}
                        </Link>
                      </td>
                      <td className="tabular text-right text-[13px]">
                        {i.internalAmountKobo != null ? naira(i.internalAmountKobo) : '—'}
                        {i.internalStatus && <p className="text-xs text-muted">{humanise(i.internalStatus)}</p>}
                      </td>
                      <td className="tabular text-right text-[13px]">
                        {i.providerAmountKobo != null ? naira(i.providerAmountKobo) : '—'}
                        {i.providerStatus && <p className="text-xs text-muted">{humanise(i.providerStatus)}</p>}
                      </td>
                      <td className="text-right">
                        <AppButton size="sm" variant="tertiary" label="Done" isDisabled={markDone.isPending} onPress={() => markDone.mutate(i.id)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </DashboardCard>

        <AppModal
          isOpen={checkOpen}
          onOpenChange={setCheckOpen}
          size="sm"
          title="Check with Paystack"
          description="Pick up to 31 days. Kero compares every top-up and withdrawal in that period with Paystack and lists anything that doesn’t match."
          footer={
            <>
              <AppButton variant="tertiary" label="Cancel" onPress={() => setCheckOpen(false)} />
              <AppButton
                variant="brand"
                startContent={<ArrowsClockwise />}
                label="Run check"
                isLoading={runCheck.isPending}
                isDisabled={!range || runCheck.isPending}
                onPress={() => runCheck.mutate()}
              />
            </>
          }
        >
          <div className="rounded-2xl bg-surface-secondary p-3">
            <RangeCalendar
              aria-label="Days to check"
              className="w-full"
              onChange={(value) => {
                if (value) setRange({ from: value.start.toString(), to: value.end.toString() });
              }}
            >
              <RangeCalendar.Header>
                <RangeCalendar.NavButton slot="previous" />
                <RangeCalendar.Heading />
                <RangeCalendar.NavButton slot="next" />
              </RangeCalendar.Header>
              <RangeCalendar.Grid>
                <RangeCalendar.GridHeader>{(day) => <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>}</RangeCalendar.GridHeader>
                <RangeCalendar.GridBody>{(date) => <RangeCalendar.Cell date={date} />}</RangeCalendar.GridBody>
              </RangeCalendar.Grid>
            </RangeCalendar>
          </div>
          {range && <p className="tabular mt-3 text-center text-[13px] text-muted">{range.from} → {range.to}</p>}
        </AppModal>
      </Page>
    </PermissionGuard>
  );
}
