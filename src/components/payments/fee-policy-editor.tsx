'use client';

// src/components/payments/fee-policy-editor.tsx
// One form for a fee rule (top-ups or withdrawals): on/off, whether Kero
// absorbs the fee or the user pays a fixed or percentage fee (with a
// maximum), limits and — for withdrawals — the daily free allowance. The
// user sees the fee before paying. Saving creates a new version; past
// payments keep the fee they were charged.

import React, { useState } from 'react';
import { AppButton } from '@/components/ui/app-button';
import { AppInput } from '@/components/ui/app-input';
import { AppSelect } from '@/components/ui/app-select';
import { AppTextarea } from '@/components/ui/app-textarea';
import { AppModal } from '@/components/ui/app-modal';
import { FEE_TYPE_LABELS, fromKobo, humanise, toKobo, type FeeType, type FeeVersion } from '@/lib/payments';

export interface FeeScope {
  transactionType: FeeType;
  role: 'rider' | 'driver' | null;
  gateway: string | null;
}

const pct = (bps: number) => String(bps / 100);
const toBps = (v: string) => Math.round(Number(v || 0) * 100);

export const scopeTitle = (scope: FeeScope) =>
  `${FEE_TYPE_LABELS[scope.transactionType]} · ${scope.gateway ? humanise(scope.gateway) : 'Any gateway'}${scope.role ? ` · ${scope.role === 'rider' ? 'Riders' : 'Drivers'}` : ''}`;

export function FeeRuleModal({
  isOpen,
  onOpenChange,
  scope,
  current,
  isSaving,
  error,
  onSave,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  scope: FeeScope | null;
  current: FeeVersion | null;
  isSaving: boolean;
  error: string | null;
  onSave: (body: object) => void;
}) {
  const [f, setF] = useState(() => ({
    enabled: current?.enabled ?? true,
    payer: current?.payer ?? 'KERO',
    feeModel: current?.feeModel ?? 'FIXED',
    fee: current?.feeModel === 'PERCENT' ? pct(current.percentBps) : fromKobo(current?.fixedFeeKobo ?? 0),
    cap: fromKobo(current?.feeCapKobo ?? null),
    min: fromKobo(current?.minAmountKobo ?? 10_000),
    max: fromKobo(current?.maxAmountKobo ?? 50_000_000),
    free: String(current?.freeDailyCount ?? 0),
    limit: current?.dailyLimitCount != null ? String(current.dailyLimitCount) : '',
    reset: current?.resetTime ?? '00:00',
    reason: '',
  }));
  const [local, setLocal] = useState<string | null>(null);
  if (!scope) return null;
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((c) => ({ ...c, [k]: v }));
  const isWithdrawal = scope.transactionType === 'withdrawal';
  const userPays = f.payer === 'USER';

  const save = () => {
    if (f.reason.trim().length < 5) return setLocal('Add a reason (at least 5 characters).');
    if ((toKobo(f.min) ?? 0) > (toKobo(f.max) ?? 0)) return setLocal('Minimum is above maximum.');
    if (isWithdrawal && !/^([01]\d|2[0-3]):[0-5]\d$/.test(f.reset)) return setLocal('Reset time must look like 00:00.');
    setLocal(null);
    onSave({
      transactionType: scope.transactionType,
      role: scope.role,
      gateway: scope.gateway,
      enabled: f.enabled,
      payer: f.payer,
      feeModel: f.feeModel,
      fixedFeeKobo: f.feeModel === 'FIXED' ? (toKobo(f.fee) ?? 0) : 0,
      percentBps: f.feeModel === 'PERCENT' ? toBps(f.fee) : 0,
      feeCapKobo: f.feeModel === 'PERCENT' ? toKobo(f.cap) : null,
      minAmountKobo: toKobo(f.min) ?? 0,
      maxAmountKobo: toKobo(f.max) ?? 0,
      freeDailyCount: isWithdrawal ? Number(f.free || 0) : 0,
      dailyLimitCount: isWithdrawal && f.limit.trim() ? Number(f.limit) : null,
      resetTime: isWithdrawal ? f.reset : '00:00',
      timezone: current?.timezone ?? 'Africa/Lagos',
      reason: f.reason.trim(),
    });
  };

  return (
    <AppModal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="md"
      title={scopeTitle(scope)}
      footer={
        <>
          <AppButton variant="tertiary" label="Cancel" onPress={() => onOpenChange(false)} />
          <AppButton variant="brand" label="Save" isLoading={isSaving} isDisabled={isSaving} onPress={save} />
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <AppSelect label="Status" selectedKey={f.enabled ? 'on' : 'off'} onSelectionChange={(v) => set('enabled', v === 'on')} options={[{ key: 'on', label: 'Allowed' }, { key: 'off', label: 'Paused' }]} />
          <AppSelect
            label="Fee"
            selectedKey={f.payer}
            onSelectionChange={(v) => set('payer', v as typeof f.payer)}
            options={[
              { key: 'KERO', label: 'Free (Kero absorbs)' },
              { key: 'USER', label: 'User pays a fee' },
            ]}
          />
        </div>

        {userPays && (
          <div className="grid grid-cols-2 gap-3">
            <AppSelect
              label="Fee type"
              selectedKey={f.feeModel}
              onSelectionChange={(v) => set('feeModel', v as typeof f.feeModel)}
              options={[
                { key: 'FIXED', label: 'Fixed amount' },
                { key: 'PERCENT', label: 'Percentage' },
              ]}
            />
            <AppInput label={f.feeModel === 'PERCENT' ? 'Fee (%)' : 'Fee (₦)'} type="number" value={f.fee} onChange={(e) => set('fee', e.target.value)} />
          </div>
        )}
        {userPays && f.feeModel === 'PERCENT' && (
          <div className="grid grid-cols-2 gap-3">
            <AppInput label="Maximum fee (₦)" type="number" placeholder="No maximum" value={f.cap} onChange={(e) => set('cap', e.target.value)} />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <AppInput label="Minimum (₦)" type="number" value={f.min} onChange={(e) => set('min', e.target.value)} />
          <AppInput label="Maximum (₦)" type="number" value={f.max} onChange={(e) => set('max', e.target.value)} />
        </div>

        {isWithdrawal && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <AppInput label="Free withdrawals per day" type="number" value={f.free} onChange={(e) => set('free', e.target.value)} />
              <AppInput label="Max withdrawals per day" type="number" placeholder="No limit" value={f.limit} onChange={(e) => set('limit', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <AppInput label="Day resets at (Lagos time)" type="time" value={f.reset} onChange={(e) => set('reset', e.target.value)} />
            </div>
          </>
        )}

        <AppTextarea label="Reason for change" rows={2} value={f.reason} onChange={(e) => set('reason', e.target.value)} />
        {(local ?? error) && <p className="rounded-2xl bg-danger-soft px-4 py-3 text-[13px] text-danger">{local ?? error}</p>}
      </div>
    </AppModal>
  );
}
