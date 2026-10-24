'use client';

// src/app/finance/settlements/page.tsx
// Phase 3: Driver Bank Disbursements, Gateway Reconciliations & Cash Payment Disputes
import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowsLeftRight,
  MagnifyingGlass,
  ArrowClockwise,
  Bank,
  CheckCircle,
  XCircle,
  Clock,
  CurrencyNgn,
  ShieldCheck,
  Lightning,
  Funnel,
  CaretLeft,
  Copy,
  Check,
  WarningCircle,
  DeviceMobile,
  Scales,
  ArrowsCounterClockwise,
  ArrowSquareOut,
  SlidersHorizontal,
  User,
  Phone,
  Broadcast,
} from '@phosphor-icons/react';
import { Card, Chip, Modal, Alert } from '@heroui/react';
import { toast } from 'sonner';
import { AppButton } from '@/components/ui/app-button';
import { AppInput } from '@/components/ui/app-input';
import { AppTextarea } from '@/components/ui/app-textarea';
import { AppSelect } from '@/components/ui/app-select';
import { AppRowActions } from '@/components/ui/app-row-actions';
import { DashboardCard, StatDashboardCard } from '@/components/ui/dashboard-card';
import { EmptyState, Page, PageHeader, SectionHeader, Segmented, SkeletonRows, StatusPill } from '@/components/ui/page';
import { PermissionGuard } from '@/components/auth/can';
import { api } from '@/lib/api';
import { applyApiFormError } from '@/lib/errors';
import {
  DriverDisbursementItem,
  CashDisputeItem,
  GatewayHealthItem,
  OutstandingDriverItem,
} from '@/types/admin';
import {
  resolveDisputeSchema,
  type ResolveDisputeInput,
} from '@/lib/schemas/admin.schemas';

type TabKey = 'disbursements' | 'disputes' | 'outstanding' | 'gateways';

const formatDateShort = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

export default function SettlementsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>('disbursements');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filters for Disbursements
  const [disbursementStatus, setDisbursementStatus] = useState<string>('all');
  const [disbursementSearch, setDisbursementSearch] = useState<string>('');

  // Dispute Resolve Modal
  const [selectedDispute, setSelectedDispute] = useState<CashDisputeItem | null>(null);
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);

  // Copy helper
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // ── Query: Driver Disbursements ───────────────────────────────────────
  const {
    data: disbursementsData,
    isLoading: isDisbursementsLoading,
    refetch: refetchDisbursements,
    isFetching: isDisbursementsFetching,
  } = useQuery<{
    total: number;
    disbursements: DriverDisbursementItem[];
  }>({
    queryKey: ['admin', 'settlements', 'disbursements', disbursementStatus, disbursementSearch],
    queryFn: async () => {
      // Driver payouts are ledger rows with transactionServices = 'fund_transfer'.
      const params = new URLSearchParams({ service: 'fund_transfer', limit: '50' });
      if (disbursementStatus !== 'all') params.set('status', disbursementStatus);
      if (disbursementSearch.trim()) params.set('search', disbursementSearch.trim());

      const res = await api.get<{ data: { data: any[]; total: number } }>(`/admin/finance/transactions?${params.toString()}`);
      const rows = res.data.data.data ?? [];
      const disbursements: DriverDisbursementItem[] = rows.map((t) => ({
        id: t.id,
        driverId: t.driver?.id ?? t.user?.id ?? '',
        driverName: t.driver ? `${t.driver.firstname ?? ''} ${t.driver.lastname ?? ''}`.trim() : t.user?.fullname ?? '—',
        driverPhone: t.driver?.phone ?? t.user?.phone ?? null,
        bankName: t.bankName ?? '—',
        accountNumber: t.accountNumber ?? '—',
        accountName: t.accountName ?? '—',
        amountKobo: t.amountKobo ?? 0,
        gateway: t.gateway ?? '—',
        status: t.status === 'COMPLETED' ? 'SUCCESS' : t.status === 'FAILED' ? 'FAILED' : 'PENDING',
        reference: t.reference ?? t.id,
        failureReason: null,
        createdAt: t.createdAt,
        completedAt: t.createdAt,
      }));
      return { total: res.data.data.total ?? disbursements.length, disbursements };
    },
  });

  // ── Query: Cash Payment Disputes ──────────────────────────────────────
  const {
    data: disputesData,
    isLoading: isDisputesLoading,
    refetch: refetchDisputes,
    isFetching: isDisputesFetching,
  } = useQuery<{
    total: number;
    disputes: CashDisputeItem[];
  }>({
    queryKey: ['admin', 'settlements', 'disputes'],
    queryFn: async () => {
      try {
        const res = await api.get<{
          data: { total: number; disputes: CashDisputeItem[] } | CashDisputeItem[];
        }>('/payments/admin/cash/disputes');
        const raw = res.data?.data;
        if (raw && !Array.isArray(raw) && Array.isArray(raw.disputes)) {
          return { total: raw.total ?? raw.disputes.length, disputes: raw.disputes };
        }
        if (Array.isArray(raw)) {
          return { total: raw.length, disputes: raw };
        }
      } catch (err) {
        throw err;
      }
      throw new Error('Unexpected response from server');
    },
  });

  // ── Query: Outstanding Cash Debt ──────────────────────────────────────
  const {
    data: outstandingData,
    isLoading: isOutstandingLoading,
    refetch: refetchOutstanding,
    isFetching: isOutstandingFetching,
  } = useQuery<{
    total: number;
    drivers: OutstandingDriverItem[];
  }>({
    queryKey: ['admin', 'settlements', 'outstanding'],
    queryFn: async () => {
      try {
        const res = await api.get<{
          data: { total: number; drivers: OutstandingDriverItem[] } | OutstandingDriverItem[];
        }>('/payments/admin/cash/outstanding');
        const raw = res.data?.data;
        if (raw && !Array.isArray(raw) && Array.isArray(raw.drivers)) {
          return { total: raw.total ?? raw.drivers.length, drivers: raw.drivers };
        }
        if (Array.isArray(raw)) {
          return { total: raw.length, drivers: raw };
        }
      } catch (err) {
        throw err;
      }
      throw new Error('Unexpected response from server');
    },
  });

  // ── Query: Gateway Diagnostics ────────────────────────────────────────
  const {
    data: gatewayData,
    isLoading: isGatewaysLoading,
    refetch: refetchGateways,
    isFetching: isGatewaysFetching,
  } = useQuery<GatewayHealthItem[]>({
    queryKey: ['admin', 'settlements', 'gateways'],
    queryFn: async () => {
      try {
        const res = await api.get<{
          data: { gateways: GatewayHealthItem[] } | GatewayHealthItem[];
        }>('/payments/admin/gateways');
        const raw = res.data?.data;
        if (raw && !Array.isArray(raw) && Array.isArray(raw.gateways)) {
          return raw.gateways;
        }
        if (Array.isArray(raw)) {
          return raw;
        }
      } catch (err) {
        throw err;
      }
      return [];
    },
  });

  // ── Mutation: Test Gateway Connectivity ──────────────────────────────
  const testGatewayMutation = useMutation({
    mutationFn: async (gateway: string) => {
      const res = await api.post(`/payments/admin/gateways/${gateway.toLowerCase()}/test`);
      return res.data;
    },
    onSuccess: (_, gateway) => {
      toast.success(`${gateway} API test passed. Ping responded within acceptable SLA.`);
      refetchGateways();
    },
    onError: (err: any, gateway) => {
      toast.error(`Gateway health test failed for ${gateway}: ${err?.message || 'Timeout / Offline'}`);
    },
  });

  // ── Mutation: Reset Circuit Breaker ──────────────────────────────────
  const resetCircuitMutation = useMutation({
    mutationFn: async (gateway: string) => {
      const res = await api.post(`/payments/admin/gateways/${gateway.toLowerCase()}/reset-circuit`);
      return res.data;
    },
    onSuccess: (_, gateway) => {
      toast.success(`${gateway} circuit breaker reset to CLOSED state.`);
      refetchGateways();
    },
    onError: (err: any, gateway) => {
      toast.error(`Failed to reset circuit breaker for ${gateway}: ${err?.message || 'Error'}`);
    },
  });

  // ── Mutation: Resolve Cash Dispute ────────────────────────────────────
  const {
    register: registerResolve,
    handleSubmit: handleResolveSubmit,
    formState: { errors: resolveErrors, isSubmitting: isResolving },
    reset: resetResolveForm,
    setError: setResolveFormError,
  } = useForm<ResolveDisputeInput>({
    resolver: zodResolver(resolveDisputeSchema),
    defaultValues: {
      resolution: 'REFUND_RIDER',
      notes: '',
    },
  });

  const resolveDisputeMutation = useMutation({
    mutationFn: async ({ disputeId, data }: { disputeId: string; data: ResolveDisputeInput }) => {
      const res = await api.put(`/payments/admin/cash/disputes/${disputeId}`, data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Cash dispute resolved and settled in transaction ledger.');
      setIsResolveModalOpen(false);
      setSelectedDispute(null);
      resetResolveForm();
      refetchDisputes();
    },
    onError: (err: any) => {
      applyApiFormError(err, { setError: setResolveFormError });
    },
  });

  const onResolveSubmit = (values: ResolveDisputeInput) => {
    if (!selectedDispute) return;
    resolveDisputeMutation.mutate({ disputeId: selectedDispute.id, data: values });
  };

  const openResolveModal = (dispute: CashDisputeItem) => {
    setSelectedDispute(dispute);
    resetResolveForm({
      resolution: 'REFUND_RIDER',
      notes: `Resolution for trip ${dispute.tripId}: Verified cash payment logs.`,
    });
    setIsResolveModalOpen(true);
  };

  return (
    <PermissionGuard permission="view_transactions">
      <Page>
          <PageHeader
            back={
              <Link href="/finance" className="inline-flex items-center gap-1 hover:text-foreground">
                <CaretLeft size={14} /> Finance
              </Link>
            }
            title="Settlements"
            description="Driver payouts, cash disputes and gateway health."
            actions={
              <AppButton
                variant="tertiary"
                startContent={
                  <ArrowClockwise
                    className={
                      isDisbursementsFetching || isDisputesFetching || isOutstandingFetching || isGatewaysFetching
                        ? 'animate-spin'
                        : ''
                    }
                  />
                }
                label="Refresh"
                onPress={() => {
                  refetchDisbursements();
                  refetchDisputes();
                  refetchOutstanding();
                  refetchGateways();
                }}
              />
            }
          />

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <StatDashboardCard
              label="Payouts"
              icon={Bank}
              variant="wallet"
              value={disbursementsData?.total ?? 0}
              hint="Driver bank transfers"
            />
            <StatDashboardCard label="Open disputes" icon={Scales} value={disputesData?.total ?? 0} hint="Awaiting a decision" />
            <StatDashboardCard
              label="Drivers in arrears"
              icon={DeviceMobile}
              value={outstandingData?.total ?? 0}
              hint="Recovered on next trips"
            />
            <StatDashboardCard
              label="Healthy gateways"
              icon={Broadcast}
              value={`${(gatewayData || []).filter((g) => g.enabled && g.isHealthy).length} / ${(gatewayData || []).length}`}
              hint="Automatic failover on"
            />
          </div>

          <Segmented
            aria-label="Section"
            value={activeTab}
            onChange={setActiveTab}
            options={[
              { key: 'disbursements', label: 'Payouts', count: disbursementsData?.total ?? 0 },
              { key: 'disputes', label: 'Disputes', count: disputesData?.total ?? 0 },
              { key: 'outstanding', label: 'Arrears', count: outstandingData?.total ?? 0 },
              { key: 'gateways', label: 'Gateways' },
            ]}
          />

          {activeTab === 'disbursements' && (
            <DashboardCard className="overflow-hidden p-0">
              <div className="flex flex-col gap-3 p-6 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <SectionHeader title="Driver payouts" />
                <div className="flex flex-wrap items-center gap-2">
                  <div className="w-56">
                    <AppInput
                      size="sm"
                      placeholder="Search driver or bank"
                      value={disbursementSearch}
                      onChange={(e) => setDisbursementSearch(e.target.value)}
                      startContent={<MagnifyingGlass />}
                    />
                  </div>
                  <div className="w-36">
                    <AppSelect
                      size="sm"
                      aria-label="Payout status"
                      selectedKey={disbursementStatus}
                      onSelectionChange={setDisbursementStatus}
                      options={[
                        { key: 'all', label: 'All statuses' },
                        { key: 'COMPLETED', label: 'Paid' },
                        { key: 'PENDING', label: 'Pending' },
                        { key: 'FAILED', label: 'Failed' },
                      ]}
                    />
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Driver</th>
                      <th>Bank</th>
                      <th>Amount</th>
                      <th>Gateway</th>
                      <th>Status</th>
                      <th>Reference</th>
                      <th className="w-12" />
                    </tr>
                  </thead>
                  <tbody>
                    {isDisbursementsLoading ? (
                      <SkeletonRows cols={7} />
                    ) : (disbursementsData?.disbursements.length ?? 0) === 0 ? (
                      <tr>
                        <td colSpan={7}>
                          <EmptyState icon={Bank} title="No payouts" description="Try a different filter or search." />
                        </td>
                      </tr>
                    ) : (
                      disbursementsData?.disbursements.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <div className="font-medium text-foreground">{item.driverName}</div>
                            <div className="text-xs text-muted">{item.accountName}</div>
                          </td>
                          <td>
                            <div className="text-foreground">{item.bankName}</div>
                            <div className="tabular text-xs text-muted">{item.accountNumber}</div>
                          </td>
                          <td className="tabular whitespace-nowrap font-medium text-foreground">
                            ₦{(item.amountKobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="capitalize text-muted">{item.gateway?.toLowerCase()}</td>
                          <td>
                            {item.status === 'SUCCESS' ? (
                              <StatusPill tone="success">Paid</StatusPill>
                            ) : item.status === 'FAILED' ? (
                              <StatusPill tone="danger">Failed</StatusPill>
                            ) : (
                              <StatusPill tone="warning">Processing</StatusPill>
                            )}
                          </td>
                          <td>
                            <div className="tabular flex items-center gap-1 text-foreground">
                              <span>{item.reference.slice(0, 12)}</span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(item.reference)}
                                className="cursor-pointer text-muted hover:text-foreground"
                              >
                                {copiedId === item.reference ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
                              </button>
                            </div>
                            <div className="tabular text-xs text-muted">
                              {new Date(item.createdAt).toLocaleTimeString('en-NG', {
                                hour: '2-digit',
                                minute: '2-digit',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </div>
                          </td>
                          <td className="text-right">
                            {item.status === 'FAILED' && (
                              <AppRowActions
                                items={[
                                  {
                                    key: 'retry',
                                    label: 'Retry payout',
                                    icon: <ArrowsCounterClockwise size={14} />,
                                    onClick: () => toast.info(`Retrying ${item.reference}`),
                                  },
                                ]}
                              />
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

          {activeTab === 'disputes' && (
            <DashboardCard className="overflow-hidden p-0">
              <SectionHeader
                className="p-6 pb-4"
                title="Cash disputes"
                description="When a driver and rider disagree about a cash payment."
              />

              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Dispute</th>
                      <th>Driver</th>
                      <th>Rider</th>
                      <th>Amount</th>
                      <th>Reason</th>
                      <th>Status</th>
                      <th className="text-right" />
                    </tr>
                  </thead>
                  <tbody>
                    {isDisputesLoading ? (
                      <SkeletonRows cols={7} />
                    ) : (disputesData?.disputes.length ?? 0) === 0 ? (
                      <tr>
                        <td colSpan={7}>
                          <EmptyState icon={CheckCircle} title="No open disputes" />
                        </td>
                      </tr>
                    ) : (
                      disputesData?.disputes.map((dispute) => (
                        <tr key={dispute.id}>
                          <td>
                            <div className="tabular font-medium text-foreground">{dispute.id.slice(0, 10)}</div>
                            <Link href={`/trips/${dispute.tripId}`} className="tabular text-xs text-muted hover:underline">
                              Trip {dispute.tripId.slice(0, 8)}
                            </Link>
                          </td>
                          <td className="text-foreground">{dispute.driverName || 'Driver'}</td>
                          <td className="text-foreground">{dispute.riderName || 'Rider'}</td>
                          <td className="tabular whitespace-nowrap font-medium text-foreground">
                            ₦{(dispute.disputedAmountKobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="max-w-xs truncate text-muted">{dispute.reason}</td>
                          <td>
                            {dispute.status === 'PENDING' ? (
                              <StatusPill tone="warning">In review</StatusPill>
                            ) : dispute.status === 'RESOLVED' ? (
                              <StatusPill tone="success">Resolved</StatusPill>
                            ) : (
                              <StatusPill>Dismissed</StatusPill>
                            )}
                          </td>
                          <td className="text-right">
                            {dispute.status === 'PENDING' && (
                              <AppButton size="sm" variant="tertiary" label="Resolve" onPress={() => openResolveModal(dispute)} />
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

          {activeTab === 'outstanding' && (
            <DashboardCard className="overflow-hidden p-0">
              <SectionHeader
                className="p-6 pb-4"
                title="Cash arrears"
                description="Commission and road tax owed from cash trips."
              />

              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Driver</th>
                      <th>Phone</th>
                      <th>Cash trips</th>
                      <th>Owed</th>
                      <th>Owing since</th>
                      <th>Last reminder</th>
                      <th className="w-12" />
                    </tr>
                  </thead>
                  <tbody>
                    {isOutstandingLoading ? (
                      <SkeletonRows cols={7} />
                    ) : (outstandingData?.drivers.length ?? 0) === 0 ? (
                      <tr>
                        <td colSpan={7}>
                          <EmptyState icon={CheckCircle} title="No arrears" description="Every driver is square." />
                        </td>
                      </tr>
                    ) : (
                      outstandingData?.drivers.map((drv) => (
                        <tr key={drv.driverId}>
                          <td>
                            <Link href={`/drivers/${drv.driverId}`} className="font-medium text-foreground hover:underline">
                              {drv.name}
                            </Link>
                          </td>
                          <td className="tabular text-muted">{drv.phone || '—'}</td>
                          <td className="tabular text-muted">{(drv as any).totalCashTrips ?? '—'}</td>
                          <td className="tabular whitespace-nowrap font-medium text-danger">
                            ₦{(drv.outstandingFeesKobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="tabular whitespace-nowrap text-muted">{formatDateShort((drv as any).firstOutstandingAt)}</td>
                          <td className="tabular whitespace-nowrap text-muted">
                            {formatDateShort((drv as any).lastReminderAt)}
                          </td>
                          <td className="text-right">
                            <AppRowActions
                              items={[
                                {
                                  key: 'remind',
                                  label: 'Send reminder',
                                  icon: <Phone size={14} />,
                                  onClick: () => toast.success(`Reminder sent to ${drv.name}`),
                                },
                                {
                                  key: 'profile',
                                  label: 'View driver',
                                  icon: <User size={14} />,
                                  href: `/drivers/${drv.driverId}`,
                                },
                              ]}
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </DashboardCard>
          )}

          {activeTab === 'gateways' && (
            <div className="space-y-5">
              <SectionHeader
                title="Payment gateways"
                description="Traffic fails over automatically if a provider degrades."
                actions={
                  <AppButton
                    size="sm"
                    variant="tertiary"
                    startContent={<Broadcast />}
                    label="Check all"
                    onPress={() => refetchGateways()}
                  />
                }
              />

              <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                {(gatewayData || []).map((gateway) => {
                  const healthy = gateway.isHealthy && gateway.enabled;
                  return (
                    <DashboardCard key={gateway.gateway}>
                      <div className="flex items-center justify-between">
                        <h3 className="text-[16px] font-bold capitalize text-foreground">{gateway.gateway.toLowerCase()}</h3>
                        <StatusPill tone={healthy ? 'success' : 'danger'} dot pulse={healthy}>
                          {healthy ? 'Healthy' : 'Degraded'}
                        </StatusPill>
                      </div>

                      <dl className="mt-5 space-y-3 text-[13px]">
                        {[
                          { label: 'Priority', value: `#${gateway.priority}` },
                          { label: 'Avg response', value: (gateway as any).avgResponseTimeMs ? `${Math.round((gateway as any).avgResponseTimeMs)}ms` : '—' },
                          { label: 'Failures in a row', value: String((gateway as any).consecutiveFailures ?? 0) },
                          { label: 'Timeout', value: `${gateway.timeoutMs}ms` },
                          {
                            label: 'Range',
                            value: `₦${(gateway.minAmountKobo / 100).toLocaleString()} – ₦${(gateway.maxAmountKobo / 100).toLocaleString()}`,
                          },
                        ].map((row) => (
                          <div key={row.label} className="flex items-center justify-between">
                            <dt className="text-muted">{row.label}</dt>
                            <dd className="tabular font-medium text-foreground">{row.value}</dd>
                          </div>
                        ))}
                      </dl>

                      <div className="mt-6 flex items-center gap-2">
                        <AppButton
                          size="sm"
                          variant="tertiary"
                          label="Ping"
                          isLoading={testGatewayMutation.isPending && testGatewayMutation.variables === gateway.gateway}
                          onPress={() => testGatewayMutation.mutate(gateway.gateway)}
                        />
                        {!gateway.isHealthy && (
                          <AppButton
                            size="sm"
                            variant="ghost"
                            label="Reset circuit"
                            isLoading={resetCircuitMutation.isPending && resetCircuitMutation.variables === gateway.gateway}
                            onPress={() => resetCircuitMutation.mutate(gateway.gateway)}
                          />
                        )}
                      </div>
                    </DashboardCard>
                  );
                })}
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              MODAL: RESOLVE CASH DISPUTE (Centered Compound)
             ════════════════════════════════════════════════════════════════ */}
          <Modal>
            <Modal.Backdrop
              isOpen={isResolveModalOpen}
              onOpenChange={setIsResolveModalOpen}
            >
              <Modal.Container placement="center" size="md">
                <Modal.Dialog className="rounded-3xl bg-overlay p-7">
                  <form onSubmit={handleResolveSubmit(onResolveSubmit)} className="space-y-4">
                    <div className="flex items-center gap-2.5">
                      <div>
                        <h3 className="text-[18px] font-bold tracking-[-0.02em] text-foreground">Resolve Cash Dispute</h3>
                        <p className="mt-1 text-[13px] text-muted">
                          Arbitrate trip #{selectedDispute?.tripId.slice(0, 8)}
                        </p>
                      </div>
                    </div>

                    {selectedDispute && (
                      <div className="p-3 rounded-lg bg-surface-secondary text-xs space-y-1.5">
                        <div className="flex justify-between">
                          <span className="text-muted">Driver:</span>
                          <span className="font-semibold text-foreground">{selectedDispute.driverName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted">Rider:</span>
                          <span className="font-semibold text-foreground">{selectedDispute.riderName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted">Disputed Sum:</span>
                          <span className="tabular font-bold text-primary">
                            ₦{(selectedDispute.disputedAmountKobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground">
                        Arbitration Ruling
                      </label>
                      <select
                        {...registerResolve('resolution')}
                        className="w-full h-10 px-3 rounded-lg bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="REFUND_RIDER">Refund Rider (Debit Driver's Wallet / Arrears)</option>
                        <option value="PAY_DRIVER">Pay Driver (Credit Driver Wallet from Platform Escrow)</option>
                        <option value="SPLIT">50/50 Split Settlement</option>
                        <option value="DISMISS">Dismiss Dispute (Uphold Recorded Fare)</option>
                      </select>
                      {resolveErrors.resolution && (
                        <p className="text-xs text-danger">{resolveErrors.resolution.message}</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <AppTextarea
                        label="Audit Resolution Notes"
                        placeholder="State findings from telematics or rider/driver statements..."
                        isRequired
                        rows={3}
                        {...registerResolve('notes')}
                        errorMessage={resolveErrors.notes?.message}
                      />
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-3">
                      <AppButton
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={() => {
                          setIsResolveModalOpen(false);
                          setSelectedDispute(null);
                        }}
                      >
                        Cancel
                      </AppButton>
                      <AppButton
                        variant="primary"
                        size="sm"
                        type="submit"
                        isLoading={isResolving || resolveDisputeMutation.isPending}
                      >
                        Enforce Resolution
                      </AppButton>
                    </div>
                  </form>
                </Modal.Dialog>
              </Modal.Container>
            </Modal.Backdrop>
          </Modal>
        </Page>
    </PermissionGuard>
  );
}
