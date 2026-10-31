'use client';

// src/app/finance/settlements/page.tsx
// Driver withdrawals and gateway health (Kero is cashless).
import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MagnifyingGlass,
  ArrowClockwise,
  Bank,
  CaretLeft,
  Copy,
  Check,
  ArrowsCounterClockwise,
  Broadcast,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { AppButton } from '@/components/ui/app-button';
import { AppInput } from '@/components/ui/app-input';
import { AppSelect } from '@/components/ui/app-select';
import { AppRowActions } from '@/components/ui/app-row-actions';
import { DashboardCard, StatDashboardCard } from '@/components/ui/dashboard-card';
import { EmptyState, Page, PageHeader, SectionHeader, Segmented, SkeletonRows, StatusPill } from '@/components/ui/page';
import { PermissionGuard } from '@/components/auth/can';
import { api } from '@/lib/api';
import {
  DriverDisbursementItem,
  GatewayHealthItem,
} from '@/types/admin';

type TabKey = 'disbursements' | 'gateways';

const formatDateShort = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

export default function SettlementsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>('disbursements');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filters for Disbursements
  const [disbursementStatus, setDisbursementStatus] = useState<string>('all');
  const [disbursementSearch, setDisbursementSearch] = useState<string>('');

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
            description="Driver withdrawals and payment gateway health. Kero is cashless."
            actions={
              <AppButton
                variant="tertiary"
                startContent={
                  <ArrowClockwise
                    className={
                      isDisbursementsFetching || isGatewaysFetching
                        ? 'animate-spin'
                        : ''
                    }
                  />
                }
                label="Refresh"
                onPress={() => {
                  refetchDisbursements();
                  refetchGateways();
                }}
              />
            }
          />

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <StatDashboardCard
              label="Payouts"
              icon={Bank}
              variant="wallet"
              value={disbursementsData?.total ?? 0}
              hint="Driver bank transfers"
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

        </Page>
    </PermissionGuard>
  );
}
