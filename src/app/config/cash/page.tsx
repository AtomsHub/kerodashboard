'use client';

// src/app/config/cash/page.tsx
// Cash settings backed by /admin/cash-config: debt limits, enforcement timing
// and payment gateway order. Read-only by default; Edit → Save to change.

import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CaretDown, CaretUp, FloppyDisk, PencilSimple, WarningOctagon } from '@phosphor-icons/react';
import { Modal } from '@heroui/react';
import { AppButton } from '@/components/ui/app-button';
import { AppInput } from '@/components/ui/app-input';
import { ConfigTabs } from '@/components/config/config-tabs';
import { DashboardCard } from '@/components/ui/dashboard-card';
import { DetailList, Page, PageHeader, SectionHeader, StatusPill } from '@/components/ui/page';
import { Can } from '@/components/auth/can';
import { api } from '@/lib/api';
import { formatKoboToNaira } from '@/lib/utils';

type GatewayId = 'paystack' | 'flutterwave' | 'monnify';

interface CashConfig {
  cashEnabled: boolean;
  softSuspendKobo: number;
  hardSuspendKobo: number;
  riderBlockKobo: number;
  softSuspendAfterDays: number;
  hardSuspendAfterDays: number;
  reminderIntervalDays: number;
  autoConfirmCashMinutes: number;
  paystackEnabled: boolean;
  paystackPriority: number;
  flutterwaveEnabled: boolean;
  flutterwavePriority: number;
  monnifyEnabled: boolean;
  monnifyPriority: number;
  updatedAt?: string;
}

/** Only Paystack is wired up in the backend; the others can't be turned on yet. */
const CONNECTED: Record<GatewayId, boolean> = { paystack: true, flutterwave: false, monnify: false };

const GATEWAY_NAMES: Record<GatewayId, string> = {
  paystack: 'Paystack',
  flutterwave: 'Flutterwave',
  monnify: 'Monnify',
};

/** Form values in naira / plain numbers for editing. */
interface CashForm {
  cashEnabled: boolean;
  softSuspend: string;
  hardSuspend: string;
  riderBlock: string;
  softSuspendAfterDays: string;
  hardSuspendAfterDays: string;
  reminderIntervalDays: string;
  autoConfirmCashMinutes: string;
  gatewayOrder: GatewayId[];
  enabled: Record<GatewayId, boolean>;
}

function toForm(c: CashConfig): CashForm {
  const order = (['paystack', 'flutterwave', 'monnify'] as GatewayId[]).sort(
    (a, b) => c[`${a}Priority`] - c[`${b}Priority`],
  );
  return {
    cashEnabled: c.cashEnabled,
    softSuspend: String(c.softSuspendKobo / 100),
    hardSuspend: String(c.hardSuspendKobo / 100),
    riderBlock: String(c.riderBlockKobo / 100),
    softSuspendAfterDays: String(c.softSuspendAfterDays),
    hardSuspendAfterDays: String(c.hardSuspendAfterDays),
    reminderIntervalDays: String(c.reminderIntervalDays),
    autoConfirmCashMinutes: String(c.autoConfirmCashMinutes),
    gatewayOrder: order,
    enabled: { paystack: c.paystackEnabled, flutterwave: c.flutterwaveEnabled, monnify: c.monnifyEnabled },
  };
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors ${
        checked ? 'bg-secondary' : 'bg-default'
      } ${disabled ? 'cursor-default opacity-60' : 'cursor-pointer'}`}
    >
      <span className={`size-5 rounded-full bg-surface transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

export default function CashPolicyConfigPage() {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [form, setForm] = useState<CashForm | null>(null);

  const { data: config, isLoading, isError } = useQuery<CashConfig>({
    queryKey: ['admin', 'cash-config'],
    queryFn: async () => {
      const res = await api.get<{ data: CashConfig }>('/admin/cash-config');
      return res.data.data;
    },
  });

  useEffect(() => {
    if (config && !isEditing) setForm(toForm(config));
  }, [config, isEditing]);

  const saveMutation = useMutation({
    mutationFn: async (f: CashForm) => {
      const priority = (id: GatewayId) => f.gatewayOrder.indexOf(id) + 1;
      const kobo = (v: string) => Math.round(Number(v) * 100);
      await api.put('/admin/cash-config', {
        cashEnabled: f.cashEnabled,
        softSuspendKobo: kobo(f.softSuspend),
        hardSuspendKobo: kobo(f.hardSuspend),
        riderBlockKobo: kobo(f.riderBlock),
        softSuspendAfterDays: Number(f.softSuspendAfterDays),
        hardSuspendAfterDays: Number(f.hardSuspendAfterDays),
        reminderIntervalDays: Number(f.reminderIntervalDays),
        autoConfirmCashMinutes: Number(f.autoConfirmCashMinutes),
        paystackEnabled: f.enabled.paystack,
        paystackPriority: priority('paystack'),
        flutterwaveEnabled: f.enabled.flutterwave,
        flutterwavePriority: priority('flutterwave'),
        monnifyEnabled: f.enabled.monnify,
        monnifyPriority: priority('monnify'),
      });
    },
    onSuccess: () => {
      toast.success('Cash settings saved');
      queryClient.invalidateQueries({ queryKey: ['admin', 'cash-config'] });
      setIsConfirmOpen(false);
      setIsEditing(false);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Could not save cash settings');
    },
  });

  const validate = (f: CashForm): string | null => {
    const soft = Number(f.softSuspend);
    const hard = Number(f.hardSuspend);
    if (!(soft > 0) || !(hard > 0)) return 'Debt limits must be positive amounts.';
    if (soft >= hard) return 'The warning limit must be lower than the block limit.';
    if (Number(f.softSuspendAfterDays) < 7) return 'Soft suspension needs at least 7 days.';
    if (Number(f.hardSuspendAfterDays) <= Number(f.softSuspendAfterDays))
      return 'Hard suspension must come after soft suspension.';
    if (!Object.values(f.enabled).some(Boolean)) return 'Keep at least one gateway enabled.';
    return null;
  };

  const set = <K extends keyof CashForm>(key: K, value: CashForm[K]) => setForm((f) => (f ? { ...f, [key]: value } : f));

  const move = (index: number, dir: -1 | 1) =>
    setForm((f) => {
      if (!f) return f;
      const order = [...f.gatewayOrder];
      const target = index + dir;
      if (target < 0 || target >= order.length) return f;
      [order[index], order[target]] = [order[target], order[index]];
      return { ...f, gatewayOrder: order };
    });

  const f = form;

  return (
    <Page>
      <PageHeader
        title="Settings"
        description="Cash debt limits and payment gateway order."
        badge={isEditing ? <StatusPill tone="brand" dot>Editing</StatusPill> : undefined}
        actions={
          isEditing ? (
            <>
              <AppButton
                variant="tertiary"
                label="Cancel"
                onPress={() => {
                  if (config) setForm(toForm(config));
                  setIsEditing(false);
                }}
              />
              <AppButton
                variant="brand"
                startContent={<FloppyDisk />}
                label="Save changes"
                onPress={() => {
                  if (!f) return;
                  const error = validate(f);
                  if (error) toast.error(error);
                  else setIsConfirmOpen(true);
                }}
              />
            </>
          ) : (
            <Can permission="manage_cash_config">
              <AppButton
                variant="tertiary"
                startContent={<PencilSimple />}
                label="Edit"
                isDisabled={isLoading || isError || !f}
                onPress={() => setIsEditing(true)}
              />
            </Can>
          )
        }
      />

      <ConfigTabs />

      {isError && (
        <DashboardCard className="bg-warning-soft/50">
          <p className="text-[13px] text-foreground">Couldn’t load the saved cash settings.</p>
        </DashboardCard>
      )}

      {isLoading || !f ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="h-72 animate-pulse rounded-3xl bg-surface" />
          <div className="h-72 animate-pulse rounded-3xl bg-surface" />
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
          <DashboardCard>
            <SectionHeader
              title="Cash payments"
              description="Limits on commission drivers owe from cash trips"
              actions={<Toggle checked={f.cashEnabled} disabled={!isEditing} onChange={(v) => set('cashEnabled', v)} />}
            />

            {isEditing ? (
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <AppInput
                  label="Warn driver at (₦)"
                  type="number"
                  value={f.softSuspend}
                  onChange={(e) => set('softSuspend', e.target.value)}
                />
                <AppInput
                  label="Block driver at (₦)"
                  type="number"
                  value={f.hardSuspend}
                  onChange={(e) => set('hardSuspend', e.target.value)}
                />
                <AppInput
                  label="Block rider at (₦)"
                  type="number"
                  value={f.riderBlock}
                  onChange={(e) => set('riderBlock', e.target.value)}
                />
                <AppInput
                  label="Auto-confirm cash (min)"
                  type="number"
                  value={f.autoConfirmCashMinutes}
                  onChange={(e) => set('autoConfirmCashMinutes', e.target.value)}
                />
              </div>
            ) : (
              <DetailList
                className="mt-5"
                items={[
                  { label: 'Cash trips', value: f.cashEnabled ? 'Allowed' : 'Turned off' },
                  { label: 'Warn driver at', value: formatKoboToNaira(Number(f.softSuspend) * 100) },
                  { label: 'Block driver at', value: formatKoboToNaira(Number(f.hardSuspend) * 100) },
                  { label: 'Block rider at', value: formatKoboToNaira(Number(f.riderBlock) * 100) },
                  { label: 'Auto-confirm cash after', value: `${f.autoConfirmCashMinutes} min` },
                ]}
              />
            )}
          </DashboardCard>

          <DashboardCard>
            <SectionHeader title="Enforcement" description="How long unpaid debt can sit" />
            {isEditing ? (
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <AppInput
                  label="Soft suspend (days)"
                  type="number"
                  value={f.softSuspendAfterDays}
                  onChange={(e) => set('softSuspendAfterDays', e.target.value)}
                />
                <AppInput
                  label="Hard suspend (days)"
                  type="number"
                  value={f.hardSuspendAfterDays}
                  onChange={(e) => set('hardSuspendAfterDays', e.target.value)}
                />
                <AppInput
                  label="Remind every (days)"
                  type="number"
                  value={f.reminderIntervalDays}
                  onChange={(e) => set('reminderIntervalDays', e.target.value)}
                />
              </div>
            ) : (
              <DetailList
                className="mt-5"
                items={[
                  { label: 'Soft suspension after', value: `${f.softSuspendAfterDays} days` },
                  { label: 'Hard suspension after', value: `${f.hardSuspendAfterDays} days` },
                  { label: 'Reminder every', value: `${f.reminderIntervalDays} days` },
                ]}
              />
            )}
          </DashboardCard>

          <DashboardCard className="lg:col-span-2">
            <SectionHeader title="Payment gateways" description="Tried in this order for card and transfer payments" />
            <ul className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
              {f.gatewayOrder.map((id, index) => (
                <li key={id} className="flex items-center justify-between gap-3 rounded-2xl bg-surface-secondary px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="tabular grid size-7 place-items-center rounded-full bg-surface text-xs font-medium text-foreground">
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-[14px] font-medium text-foreground">{GATEWAY_NAMES[id]}</p>
                      <p className="text-xs text-muted">{!CONNECTED[id] ? 'Not connected' : f.enabled[id] ? 'Enabled' : 'Disabled'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {isEditing && (
                      <>
                        <button
                          type="button"
                          aria-label="Move up"
                          disabled={index === 0}
                          onClick={() => move(index, -1)}
                          className="grid size-8 cursor-pointer place-items-center rounded-full text-muted hover:bg-surface hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <CaretUp size={14} />
                        </button>
                        <button
                          type="button"
                          aria-label="Move down"
                          disabled={index === f.gatewayOrder.length - 1}
                          onClick={() => move(index, 1)}
                          className="grid size-8 cursor-pointer place-items-center rounded-full text-muted hover:bg-surface hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <CaretDown size={14} />
                        </button>
                      </>
                    )}
                    <Toggle
                      checked={CONNECTED[id] && f.enabled[id]}
                      disabled={!isEditing || !CONNECTED[id]}
                      onChange={(v) => set('enabled', { ...f.enabled, [id]: v })}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </DashboardCard>
        </div>
      )}

      <Modal isOpen={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <Modal.Backdrop variant="blur">
          <Modal.Container placement="center" size="sm">
            <Modal.Dialog className="max-w-md rounded-3xl bg-overlay p-7">
              <div>
                <div>
                  <h3 className="text-[18px] font-bold tracking-[-0.02em] text-foreground">Save cash settings?</h3>
                  <p className="mt-1 text-[13px] text-muted">Limits apply to every driver and rider straight away.</p>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <AppButton variant="tertiary" label="Cancel" onPress={() => setIsConfirmOpen(false)} isDisabled={saveMutation.isPending} />
                <AppButton
                  variant="brand"
                  label="Save"
                  isLoading={saveMutation.isPending}
                  onPress={() => f && saveMutation.mutate(f)}
                />
              </div>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </Page>
  );
}
