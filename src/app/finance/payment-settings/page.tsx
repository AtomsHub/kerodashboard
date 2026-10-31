'use client';

// src/app/finance/payment-settings/page.tsx
// Payment settings: fee rules (Kero's own fee, shown to the user before they
// pay; the gateway's real charge is recorded from each payment), the payment
// gateways and which one handles what, and money-out settings. Each is a
// table; Edit opens a modal.

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Calculator, ClockCounterClockwise, CreditCard, HandCoins, PencilSimple, Plus, PlugsConnected, Power, Scales } from '@phosphor-icons/react';
import { AppButton } from '@/components/ui/app-button';
import { AppInput } from '@/components/ui/app-input';
import { AppModal } from '@/components/ui/app-modal';
import { AppSelect } from '@/components/ui/app-select';
import { AppRowActions } from '@/components/ui/app-row-actions';
import { DashboardCard, StatDashboardCard } from '@/components/ui/dashboard-card';
import { EmptyState, Page, PageHeader, SectionHeader, StatusPill } from '@/components/ui/page';
import { Can, PermissionGuard, usePermission } from '@/components/auth/can';
import { FeeRuleModal, type FeeScope } from '@/components/payments/fee-policy-editor';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { errorMessage, FEE_TYPE_LABELS, humanise, naira, toKobo, type FeePolicy, type FeeQuote, type FeeType, type FeeVersion } from '@/lib/payments';

interface Provider {
  gateway: string;
  name: string;
  integrated: boolean;
  hasKeys: boolean;
  appCheckout: boolean;
  webhookPath: string;
  operations: string[];
  enabled: boolean;
  priority: number;
  lastWebhookAt: string | null;
  healthy: boolean;
}

interface Route {
  operation: 'wallet_funding' | 'payout' | 'virtual_account';
  role: 'rider' | 'driver';
  gateway: string | null;
  candidates: string[];
}

const OPERATION_LABELS: Record<string, string> = {
  'wallet_funding:rider': 'Rider top-ups',
  'payout:driver': 'Driver withdrawals',
  'payout:rider': 'Rider withdrawals',
};

interface PaymentSettings {
  riderDebtLimitKobo: number;
  secondApprovalAboveKobo: number;
  payoutApprovalAboveKobo: number;
  riderWithdrawalsEnabled: boolean;
  riderWithdrawalWaitHours: number;
  unpaidEarningsExpireDays: number;
}

type SettingKey = keyof PaymentSettings;
const SETTING_ROWS: Array<{ key: SettingKey; label: string; kind: 'naira' | 'hours' | 'days' | 'onoff' }> = [
  { key: 'riderDebtLimitKobo', label: 'Rider debt limit', kind: 'naira' },
  { key: 'secondApprovalAboveKobo', label: 'Refunds need a second admin above', kind: 'naira' },
  { key: 'payoutApprovalAboveKobo', label: 'Withdrawals need approval above', kind: 'naira' },
  { key: 'riderWithdrawalsEnabled', label: 'Rider withdrawals', kind: 'onoff' },
  { key: 'riderWithdrawalWaitHours', label: 'Top-ups can be withdrawn after', kind: 'hours' },
  { key: 'unpaidEarningsExpireDays', label: 'Unpaid driver earnings close after', kind: 'days' },
];

const settingText = (kind: (typeof SETTING_ROWS)[number]['kind'], v: number | boolean | undefined) =>
  v === undefined ? '—' : kind === 'naira' ? naira(v as number) : kind === 'onoff' ? (v ? 'On' : 'Off') : `${v} ${kind}`;

function feeText(v: FeeVersion | null): string {
  if (!v) return '—';
  if (!v.enabled) return 'Paused';
  if (v.payer === 'KERO') return 'Free';
  if (v.feeModel === 'PERCENT') return `${v.percentBps / 100}%${v.feeCapKobo != null ? ` (max ${naira(v.feeCapKobo)})` : ''}`;
  return naira(v.fixedFeeKobo);
}

const whoText = (p: Pick<FeePolicy, 'transactionType' | 'role'>) =>
  p.role === 'rider' ? 'Riders' : p.role === 'driver' ? 'Drivers' : p.transactionType === 'wallet_funding' ? 'Riders' : 'Everyone';

export default function PaymentSettingsPage() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin', 'payments'] });
  const canManageFees = usePermission('manage_fee_policies');

  const policies = useQuery<{ policies: FeePolicy[] }>({
    queryKey: ['admin', 'payments', 'fee-policies'],
    queryFn: async () => (await api.get<{ data: { policies: FeePolicy[] } }>('/admin/payments/fee-policies')).data.data,
  });
  const providers = useQuery<{ providers: Provider[]; routing: Route[] }>({
    queryKey: ['admin', 'payments', 'providers'],
    queryFn: async () => (await api.get<{ data: { providers: Provider[]; routing: Route[] } }>('/admin/payments/providers')).data.data,
  });
  const general = useQuery<PaymentSettings>({
    queryKey: ['admin', 'payments', 'settings'],
    queryFn: async () => (await api.get<{ data: PaymentSettings }>('/admin/payments/settings')).data.data,
  });
  const integrated = (providers.data?.providers ?? []).filter((p) => p.integrated);
  const gatewayOptions = integrated.map((p) => ({ key: p.gateway, label: p.name }));

  // ── Fee rules ─────────────────────────────────────────────────────────
  const [editing, setEditing] = useState<{ scope: FeeScope; current: FeeVersion | null } | null>(null);
  const [feeError, setFeeError] = useState<string | null>(null);
  const [history, setHistory] = useState<FeePolicy | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newRule, setNewRule] = useState({ type: 'wallet_funding' as FeeType, gateway: 'PAYSTACK' });

  const saveFee = useMutation({
    mutationFn: async (body: object) => api.post('/admin/payments/fee-policies', body, { silent: true }),
    onSuccess: () => {
      toast.success('Fee rule saved');
      setEditing(null);
      refresh();
    },
    onError: (err) => setFeeError(errorMessage(err, 'Could not save the rule')),
  });
  const toggleFee = useMutation({
    mutationFn: async (p: FeePolicy) => api.patch(`/admin/payments/fee-policies/${p.id}`, { isActive: !p.isActive }, { silent: true }),
    onSuccess: refresh,
    onError: (err) => toast.error(errorMessage(err, 'Could not change the rule')),
  });
  const openEditor = (p: FeePolicy) => {
    setFeeError(null);
    setEditing({ scope: { transactionType: p.transactionType, role: p.role, gateway: p.gateway }, current: p.current });
  };

  // ── Gateways & routing ───────────────────────────────────────────────
  const [providerEdit, setProviderEdit] = useState<Provider | null>(null);
  const [providerForm, setProviderForm] = useState({ enabled: true, priority: '1' });
  const saveProvider = useMutation({
    mutationFn: async () =>
      api.put(`/admin/payments/providers/${providerEdit!.gateway}`, { enabled: providerForm.enabled, priority: Number(providerForm.priority) || 1 }, { silent: true }),
    onSuccess: () => {
      toast.success('Gateway updated');
      setProviderEdit(null);
      refresh();
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not update the gateway')),
  });
  const [routeEdit, setRouteEdit] = useState<{ operation: Route['operation']; role: Route['role']; gateway: string; candidates: string[] } | null>(null);
  const saveRoute = useMutation({
    mutationFn: async () =>
      api.put('/admin/payments/routes', { operation: routeEdit!.operation, role: routeEdit!.role, gateway: routeEdit!.gateway === 'auto' ? null : routeEdit!.gateway }, { silent: true }),
    onSuccess: () => {
      toast.success('Saved');
      setRouteEdit(null);
      refresh();
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not save')),
  });

  // ── Money-out settings ───────────────────────────────────────────────
  const [settingEdit, setSettingEdit] = useState<{ row: (typeof SETTING_ROWS)[number]; value: string } | null>(null);
  const settingValue = () => {
    if (!settingEdit) return null;
    const { row, value } = settingEdit;
    if (row.kind === 'onoff') return value === 'on';
    if (row.kind === 'naira') return toKobo(value);
    const n = Number(value);
    return Number.isInteger(n) && n >= 0 ? n : null;
  };
  const saveSetting = useMutation({
    mutationFn: async () => api.put('/admin/payments/settings', { [settingEdit!.row.key]: settingValue() }, { silent: true }),
    onSuccess: () => {
      toast.success('Saved');
      setSettingEdit(null);
      refresh();
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not save')),
  });
  const editSetting = (row: (typeof SETTING_ROWS)[number]) => {
    const v = general.data?.[row.key];
    setSettingEdit({ row, value: row.kind === 'onoff' ? (v ? 'on' : 'off') : row.kind === 'naira' ? String(Number(v ?? 0) / 100) : String(v ?? 0) });
  };

  // ── Calculator ───────────────────────────────────────────────────────
  const [calcOpen, setCalcOpen] = useState(false);
  const [calc, setCalc] = useState({ type: 'wallet_funding' as FeeType, role: 'rider' as 'rider' | 'driver', gateway: 'PAYSTACK', amount: '5000' });
  const quote = useQuery<FeeQuote>({
    queryKey: ['admin', 'payments', 'fee-quote', calc],
    enabled: calcOpen && Boolean(toKobo(calc.amount)),
    queryFn: async () =>
      (
        await api.get<{ data: FeeQuote }>('/admin/payments/fee-quote', {
          params: { type: calc.type, role: calc.role, gateway: calc.gateway, amountKobo: toKobo(calc.amount) },
        })
      ).data.data,
  });

  const rules = policies.data?.policies ?? [];
  const ruleFor = (t: FeeType) => rules.find((p) => p.transactionType === t && p.isActive)?.current ?? null;
  const topUp = ruleFor('wallet_funding');
  const withdrawal = ruleFor('withdrawal');
  const active = (providers.data?.providers ?? []).filter((p) => p.enabled);

  return (
    <PermissionGuard permission="view_payment_settings">
      <Page>
        <PageHeader
          title="Payment settings"
          description="Fees are shown to riders and drivers before they pay. Changes apply to new payments only."
          actions={<AppButton variant="tertiary" startContent={<Calculator />} label="Fee calculator" onPress={() => setCalcOpen(true)} />}
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <StatDashboardCard label="Active gateways" icon={PlugsConnected} variant="wallet" loading={providers.isLoading} value={String(active.length)} hint={active.map((p) => p.name).join(', ') || 'None switched on'} />
          <StatDashboardCard label="Top-up fee" icon={CreditCard} loading={policies.isLoading} value={feeText(topUp)} hint={topUp?.payer === 'USER' ? 'Paid by the rider' : 'Kero absorbs the gateway charge'} />
          <StatDashboardCard label="Withdrawal fee" icon={HandCoins} loading={policies.isLoading} value={feeText(withdrawal)} hint={withdrawal?.freeDailyCount ? `After ${withdrawal.freeDailyCount} free per day` : 'No free withdrawals'} />
          <StatDashboardCard label="Approval above" icon={Scales} loading={general.isLoading} value={naira(general.data?.payoutApprovalAboveKobo)} hint="Larger withdrawals wait for finance" />
        </div>

        {/* ── Fee rules ── */}
        <DashboardCard className="overflow-hidden p-0">
          <div className="p-6 pb-4">
            <SectionHeader
              title="Fee rules"
              description="Kero's fee, shown before paying."
              actions={
                <Can permission="manage_fee_policies">
                  <AppButton size="sm" variant="tertiary" startContent={<Plus />} label="Add rule" onPress={() => setAddOpen(true)} />
                </Can>
              }
            />
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Payment</th>
                  <th>For</th>
                  <th>Gateway</th>
                  <th>Fee</th>
                  <th>Free per day</th>
                  <th>Last change</th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody>
                {policies.isLoading ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="h-20 animate-pulse rounded-2xl bg-surface-secondary" />
                    </td>
                  </tr>
                ) : rules.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState icon={CreditCard} title="No fee rules" description="Add a rule for top-ups or withdrawals." />
                    </td>
                  </tr>
                ) : (
                  rules.map((p) => {
                    const v = p.current;
                    return (
                      <tr key={p.id} className={p.isActive ? '' : 'opacity-60'}>
                        <td className="font-medium text-foreground">
                          {FEE_TYPE_LABELS[p.transactionType]}
                          {!p.isActive && <StatusPill>Off</StatusPill>}
                        </td>
                        <td>{whoText(p)}</td>
                        <td>{p.gateway ? humanise(p.gateway) : 'Any gateway'}</td>
                        <td className="tabular">{feeText(v)}</td>
                        <td className="tabular text-muted">{p.transactionType === 'withdrawal' && v ? v.freeDailyCount : '—'}</td>
                        <td className="text-muted">
                          {v ? (
                            <>
                              {v.createdByName ?? 'Admin'}
                              <p className="tabular text-xs">{formatDateTime(v.createdAt)}</p>
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="text-right">
                          <AppRowActions
                            items={[
                              ...(canManageFees ? [{ key: 'edit', label: 'Edit', icon: <PencilSimple size={14} />, onClick: () => openEditor(p) }] : []),
                              { key: 'history', label: 'History', icon: <ClockCounterClockwise size={14} />, onClick: () => setHistory(p) },
                              ...(canManageFees && p.gateway !== null
                                ? [{ key: 'toggle', label: p.isActive ? 'Turn off' : 'Turn on', icon: <Power size={14} />, danger: p.isActive, onClick: () => toggleFee.mutate(p) }]
                                : []),
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
        </DashboardCard>

        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
          {/* ── Gateways ── */}
          <DashboardCard className="overflow-hidden p-0">
            <div className="p-6 pb-4">
              <SectionHeader title="Payment gateways" description="A gateway can be switched on once its keys are on the server." />
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Gateway</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Last webhook</th>
                  <th className="w-20" />
                </tr>
              </thead>
              <tbody>
                {(providers.data?.providers ?? []).map((p) => (
                  <tr key={p.gateway}>
                    <td>
                      <p className="font-medium text-foreground">{p.name}</p>
                      {p.integrated && <p className="tabular text-xs text-muted">{p.webhookPath}</p>}
                    </td>
                    <td>
                      {!p.integrated ? (
                        <StatusPill>No keys</StatusPill>
                      ) : (
                        <StatusPill tone={p.enabled ? (p.healthy ? 'success' : 'danger') : 'neutral'}>{p.enabled ? (p.healthy ? 'On' : 'Failing') : 'Off'}</StatusPill>
                      )}
                    </td>
                    <td className="tabular text-muted">{p.integrated ? p.priority : '—'}</td>
                    <td className="tabular text-muted">{p.lastWebhookAt ? formatDateTime(p.lastWebhookAt) : '—'}</td>
                    <td className="text-right">
                      {p.integrated && (
                        <Can permission="manage_payment_providers">
                          <AppButton
                            size="sm"
                            variant="tertiary"
                            label="Edit"
                            onPress={() => {
                              setProviderForm({ enabled: p.enabled, priority: String(p.priority) });
                              setProviderEdit(p);
                            }}
                          />
                        </Can>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DashboardCard>

          <div className="space-y-5">
            {/* ── Routing ── */}
            <DashboardCard className="overflow-hidden p-0">
              <div className="p-6 pb-4">
                <SectionHeader title="Gateway used for" />
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Operation</th>
                    <th>Gateway</th>
                    <th className="w-20" />
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      ['wallet_funding', 'rider'],
                      ['payout', 'driver'],
                      ['payout', 'rider'],
                    ] as const
                  ).map(([op, role]) => {
                    const r = providers.data?.routing.find((x) => x.operation === op && x.role === role);
                    return (
                      <tr key={`${op}:${role}`}>
                        <td className="font-medium text-foreground">{OPERATION_LABELS[`${op}:${role}`]}</td>
                        <td className="text-muted">{!r || r.candidates.length === 0 ? 'None available' : r.gateway ? humanise(r.gateway) : 'Highest priority'}</td>
                        <td className="text-right">
                          {r && r.candidates.length > 0 && (
                            <Can permission="manage_payment_providers">
                              <AppButton size="sm" variant="tertiary" label="Edit" onPress={() => setRouteEdit({ operation: op, role, gateway: r.gateway ?? 'auto', candidates: r.candidates })} />
                            </Can>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </DashboardCard>

            {/* ── General ── */}
            <DashboardCard className="overflow-hidden p-0">
              <div className="p-6 pb-4">
                <SectionHeader title="Money out" />
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Setting</th>
                    <th>Value</th>
                    <th className="w-20" />
                  </tr>
                </thead>
                <tbody>
                  {SETTING_ROWS.map((row) => (
                    <tr key={row.key}>
                      <td className="font-medium text-foreground">{row.label}</td>
                      <td className="tabular">{settingText(row.kind, general.data?.[row.key])}</td>
                      <td className="text-right">
                        <Can permission="manage_fee_policies">
                          <AppButton size="sm" variant="tertiary" label="Edit" isDisabled={!general.data} onPress={() => editSetting(row)} />
                        </Can>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DashboardCard>
          </div>
        </div>

        {/* ── Modals ── */}
        {editing && (
          <FeeRuleModal
            key={`${editing.scope.transactionType}|${editing.scope.role}|${editing.scope.gateway}|${editing.current?.id ?? 'new'}`}
            isOpen
            onOpenChange={(o) => !o && setEditing(null)}
            scope={editing.scope}
            current={editing.current}
            isSaving={saveFee.isPending}
            error={feeError}
            onSave={(body) => saveFee.mutate(body)}
          />
        )}

        <AppModal
          isOpen={addOpen}
          onOpenChange={setAddOpen}
          size="sm"
          title="Add fee rule"
          footer={
            <>
              <AppButton variant="tertiary" label="Cancel" onPress={() => setAddOpen(false)} />
              <AppButton
                variant="brand"
                label="Continue"
                isDisabled={gatewayOptions.length === 0}
                onPress={() => {
                  setAddOpen(false);
                  setFeeError(null);
                  const existing = rules.find((p) => p.transactionType === newRule.type && p.gateway === newRule.gateway);
                  setEditing({
                    scope: { transactionType: newRule.type, role: newRule.type === 'withdrawal' ? null : 'rider', gateway: newRule.gateway },
                    current: existing?.current ?? ruleFor(newRule.type),
                  });
                }}
              />
            </>
          }
        >
          <div className="grid grid-cols-2 gap-3">
            <AppSelect
              label="Payment"
              selectedKey={newRule.type}
              onSelectionChange={(v) => setNewRule((r) => ({ ...r, type: v as FeeType }))}
              options={[
                { key: 'wallet_funding', label: 'Rider top-ups' },
                { key: 'withdrawal', label: 'Withdrawals' },
              ]}
            />
            <AppSelect label="Gateway" selectedKey={newRule.gateway} onSelectionChange={(v) => setNewRule((r) => ({ ...r, gateway: v }))} options={gatewayOptions} />
          </div>
        </AppModal>

        <AppModal isOpen={Boolean(history)} onOpenChange={(o) => !o && setHistory(null)} size="lg" title="Rule history">
          <table className="data-table">
            <thead>
              <tr>
                <th>Version</th>
                <th>Fee</th>
                <th>Changed by</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {history?.history.map((v) => (
                <tr key={v.id}>
                  <td>
                    v{v.version} {history.current?.id === v.id && <StatusPill tone="success">Current</StatusPill>}
                  </td>
                  <td className="tabular">{feeText(v)}</td>
                  <td className="text-muted">
                    {v.createdByName ?? 'Admin'}
                    <p className="tabular text-xs">{formatDateTime(v.createdAt)}</p>
                  </td>
                  <td className="max-w-[220px] text-muted">{v.reason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </AppModal>

        <AppModal
          isOpen={Boolean(providerEdit)}
          onOpenChange={(o) => !o && setProviderEdit(null)}
          size="sm"
          title={providerEdit?.name ?? 'Gateway'}
          description={providerEdit ? `Webhook: ${providerEdit.webhookPath}${providerEdit.appCheckout ? '' : ' · App checkout comes with the next app build'}` : undefined}
          footer={
            <>
              <AppButton variant="tertiary" label="Cancel" onPress={() => setProviderEdit(null)} />
              <AppButton variant="brand" label="Save" isLoading={saveProvider.isPending} onPress={() => saveProvider.mutate()} />
            </>
          }
        >
          <div className="grid grid-cols-2 gap-3">
            <AppSelect label="Status" selectedKey={providerForm.enabled ? 'on' : 'off'} onSelectionChange={(v) => setProviderForm((f) => ({ ...f, enabled: v === 'on' }))} options={[{ key: 'on', label: 'On' }, { key: 'off', label: 'Off' }]} />
            <AppInput label="Priority" type="number" value={providerForm.priority} onChange={(e) => setProviderForm((f) => ({ ...f, priority: e.target.value }))} />
          </div>
        </AppModal>

        <AppModal
          isOpen={Boolean(routeEdit)}
          onOpenChange={(o) => !o && setRouteEdit(null)}
          size="sm"
          title={routeEdit ? OPERATION_LABELS[`${routeEdit.operation}:${routeEdit.role}`] : ''}
          footer={
            <>
              <AppButton variant="tertiary" label="Cancel" onPress={() => setRouteEdit(null)} />
              <AppButton variant="brand" label="Save" isLoading={saveRoute.isPending} onPress={() => saveRoute.mutate()} />
            </>
          }
        >
          {routeEdit && (
            <AppSelect
              label="Gateway"
              selectedKey={routeEdit.gateway}
              onSelectionChange={(v) => setRouteEdit((r) => (r ? { ...r, gateway: v } : r))}
              options={[{ key: 'auto', label: 'Highest priority' }, ...routeEdit.candidates.map((g) => ({ key: g, label: humanise(g) }))]}
            />
          )}
        </AppModal>

        <AppModal
          isOpen={Boolean(settingEdit)}
          onOpenChange={(o) => !o && setSettingEdit(null)}
          size="sm"
          title={settingEdit?.row.label ?? ''}
          footer={
            <>
              <AppButton variant="tertiary" label="Cancel" onPress={() => setSettingEdit(null)} />
              <AppButton variant="brand" label="Save" isLoading={saveSetting.isPending} isDisabled={settingValue() === null} onPress={() => saveSetting.mutate()} />
            </>
          }
        >
          {settingEdit &&
            (settingEdit.row.kind === 'onoff' ? (
              <AppSelect
                label="Status"
                selectedKey={settingEdit.value}
                onSelectionChange={(v) => setSettingEdit((e) => (e ? { ...e, value: v } : e))}
                options={[
                  { key: 'on', label: 'On' },
                  { key: 'off', label: 'Off' },
                ]}
              />
            ) : (
              <AppInput
                label={settingEdit.row.kind === 'naira' ? 'Amount (₦)' : settingEdit.row.kind === 'hours' ? 'Hours' : 'Days'}
                type="number"
                value={settingEdit.value}
                onChange={(e) => setSettingEdit((s) => (s ? { ...s, value: e.target.value } : s))}
              />
            ))}
        </AppModal>

        <AppModal isOpen={calcOpen} onOpenChange={setCalcOpen} size="sm" title="Fee calculator">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <AppSelect
                label="Payment"
                selectedKey={`${calc.type}:${calc.role}`}
                onSelectionChange={(v) => {
                  const [type, role] = v.split(':') as [FeeType, 'rider' | 'driver'];
                  setCalc((c) => ({ ...c, type, role }));
                }}
                options={[
                  { key: 'wallet_funding:rider', label: 'Rider top-up' },
                  { key: 'withdrawal:driver', label: 'Driver withdrawal' },
                  { key: 'withdrawal:rider', label: 'Rider withdrawal' },
                ]}
              />
              <AppSelect label="Gateway" selectedKey={calc.gateway} onSelectionChange={(v) => setCalc((c) => ({ ...c, gateway: v }))} options={gatewayOptions} />
            </div>
            <AppInput label="Amount (₦)" type="number" value={calc.amount} onChange={(e) => setCalc((c) => ({ ...c, amount: e.target.value }))} />
            {quote.data && (
              <dl className="divide-y divide-border rounded-2xl bg-surface-secondary px-4 text-[13px]">
                {[
                  ['Fee', quote.data.userFeeKobo > 0 ? naira(quote.data.userFeeKobo) : 'Free'],
                  [calc.type === 'withdrawal' ? 'Reaches the bank' : 'Charged at checkout', naira(calc.type === 'withdrawal' ? quote.data.netAmountKobo : quote.data.totalChargeKobo)],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between py-2">
                    <dt className="text-muted">{label}</dt>
                    <dd className="tabular font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </AppModal>
      </Page>
    </PermissionGuard>
  );
}
