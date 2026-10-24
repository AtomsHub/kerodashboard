'use client';

// src/app/config/cancellation/page.tsx
// Cancellation rules: what riders pay when they cancel after a driver accepted,
// and when drivers who cancel accepted rides get paused. Read-only by default;
// admins switch to Edit explicitly so nothing changes by accident.

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FloppyDisk, PencilSimple } from '@phosphor-icons/react';
import { AppButton } from '@/components/ui/app-button';
import { AppInput } from '@/components/ui/app-input';
import { AppModal } from '@/components/ui/app-modal';
import { ConfigTabs } from '@/components/config/config-tabs';
import { DashboardCard } from '@/components/ui/dashboard-card';
import { DetailList, Page, PageHeader, SectionHeader, StatusPill } from '@/components/ui/page';
import { Can } from '@/components/auth/can';
import { api } from '@/lib/api';
import { formatKoboToNaira } from '@/lib/utils';

interface CancellationPolicy {
  riderGraceMinutes: number;
  riderFeeAfterGraceKobo: number;
  riderArrivedPerMinuteKobo: number;
  riderArrivedCapKobo: number;
  driverPenaltyEnabled: boolean;
  driverGraceMinutes: number;
  driverCancelThreshold: number;
  driverCancelWindowHours: number;
  driverCooldownMinutes: number;
  updatedAt?: string;
}

/** Form values as typed (naira for money, strings while editing). */
type Form = Record<Exclude<keyof CancellationPolicy, 'driverPenaltyEnabled' | 'updatedAt'>, string> & {
  driverPenaltyEnabled: boolean;
};

const toForm = (p: CancellationPolicy): Form => ({
  riderGraceMinutes: String(p.riderGraceMinutes),
  riderFeeAfterGraceKobo: String(p.riderFeeAfterGraceKobo / 100),
  riderArrivedPerMinuteKobo: String(p.riderArrivedPerMinuteKobo / 100),
  riderArrivedCapKobo: String(p.riderArrivedCapKobo / 100),
  driverPenaltyEnabled: p.driverPenaltyEnabled,
  driverGraceMinutes: String(p.driverGraceMinutes),
  driverCancelThreshold: String(p.driverCancelThreshold),
  driverCancelWindowHours: String(p.driverCancelWindowHours),
  driverCooldownMinutes: String(p.driverCooldownMinutes),
});

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label="Driver penalties"
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

function validate(f: Form): string | null {
  const n = (v: string) => Number(v);
  const whole = (v: string) => Number.isInteger(Number(v));
  if (![f.riderGraceMinutes, f.driverGraceMinutes, f.driverCancelThreshold, f.driverCancelWindowHours, f.driverCooldownMinutes].every(whole))
    return 'Minutes, hours and counts must be whole numbers.';
  if (n(f.riderGraceMinutes) < 0 || n(f.riderGraceMinutes) > 60) return 'Rider free period must be 0–60 minutes.';
  if ([f.riderFeeAfterGraceKobo, f.riderArrivedPerMinuteKobo, f.riderArrivedCapKobo].some((v) => !(n(v) >= 0) || n(v) > 50_000))
    return 'Fees must be between ₦0 and ₦50,000.';
  if (n(f.riderArrivedCapKobo) < n(f.riderFeeAfterGraceKobo)) return 'The maximum fee cannot be lower than the base fee.';
  if (n(f.driverGraceMinutes) < 0 || n(f.driverGraceMinutes) > 60) return 'Driver free period must be 0–60 minutes.';
  if (n(f.driverCancelThreshold) < 1 || n(f.driverCancelThreshold) > 100) return 'Cancellations before a pause must be 1–100.';
  if (n(f.driverCancelWindowHours) < 1 || n(f.driverCancelWindowHours) > 168) return 'The counting window must be 1–168 hours.';
  if (n(f.driverCooldownMinutes) < 1 || n(f.driverCooldownMinutes) > 1440) return 'The pause must be 1–1440 minutes.';
  return null;
}

export default function CancellationPolicyPage() {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [form, setForm] = useState<Form | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: policy, isLoading, isError } = useQuery<CancellationPolicy>({
    queryKey: ['admin', 'cancellation-policy'],
    queryFn: async () => (await api.get<{ data: CancellationPolicy }>('/admin/cancellation-policy')).data.data,
  });

  const saveMutation = useMutation({
    mutationFn: async (f: Form) => {
      const kobo = (v: string) => Math.round(Number(v) * 100);
      await api.put(
        '/admin/cancellation-policy',
        {
          riderGraceMinutes: Number(f.riderGraceMinutes),
          riderFeeAfterGraceKobo: kobo(f.riderFeeAfterGraceKobo),
          riderArrivedPerMinuteKobo: kobo(f.riderArrivedPerMinuteKobo),
          riderArrivedCapKobo: kobo(f.riderArrivedCapKobo),
          driverPenaltyEnabled: f.driverPenaltyEnabled,
          driverGraceMinutes: Number(f.driverGraceMinutes),
          driverCancelThreshold: Number(f.driverCancelThreshold),
          driverCancelWindowHours: Number(f.driverCancelWindowHours),
          driverCooldownMinutes: Number(f.driverCooldownMinutes),
        },
        { silent: true },
      );
    },
    onSuccess: () => {
      toast.success('Cancellation rules saved');
      queryClient.invalidateQueries({ queryKey: ['admin', 'cancellation-policy'] });
      setIsConfirmOpen(false);
      setIsEditing(false);
    },
    onError: (err: unknown) => {
      const e = err as { message?: string; response?: { data?: { message?: string; error?: { message?: string } } } };
      setFormError(e?.response?.data?.error?.message ?? e?.response?.data?.message ?? e?.message ?? 'Could not save the rules');
    },
  });

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => (f ? { ...f, [key]: value } : f));
  // View mode shows the saved rules; Edit works on a copy.
  const f = isEditing ? form : policy ? toForm(policy) : null;
  const naira = (v: string) => formatKoboToNaira(Math.round(Number(v) * 100));

  return (
    <Page>
      <PageHeader
        title="Settings"
        description="What cancelling costs riders, and when drivers who cancel get paused."
        badge={isEditing ? <StatusPill tone="brand" dot>Editing</StatusPill> : undefined}
        actions={
          isEditing ? (
            <>
              <AppButton
                variant="tertiary"
                label="Cancel"
                onPress={() => setIsEditing(false)}
              />
              <AppButton
                variant="brand"
                startContent={<FloppyDisk />}
                label="Save changes"
                onPress={() => {
                  if (!f) return;
                  const error = validate(f);
                  if (error) toast.error(error);
                  else {
                    setFormError(null);
                    setIsConfirmOpen(true);
                  }
                }}
              />
            </>
          ) : (
            <Can permission="manage_dispatch_config">
              <AppButton
                variant="tertiary"
                startContent={<PencilSimple />}
                label="Edit"
                isDisabled={isLoading || isError || !policy}
                onPress={() => {
                  if (!policy) return;
                  setForm(toForm(policy));
                  setIsEditing(true);
                }}
              />
            </Can>
          )
        }
      />

      <ConfigTabs />

      {isError && (
        <DashboardCard className="bg-warning-soft/50">
          <p className="text-[13px] text-foreground">Couldn’t load the cancellation rules.</p>
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
              title="Rider cancels"
              description="After a driver accepted. Cancelling while still searching is always free."
            />
            {isEditing ? (
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <AppInput label="Free for (minutes)" type="number" value={f.riderGraceMinutes} onChange={(e) => set('riderGraceMinutes', e.target.value)} />
                <AppInput label="Fee after that (₦)" type="number" value={f.riderFeeAfterGraceKobo} onChange={(e) => set('riderFeeAfterGraceKobo', e.target.value)} />
                <AppInput label="Plus per minute driver waits (₦)" type="number" value={f.riderArrivedPerMinuteKobo} onChange={(e) => set('riderArrivedPerMinuteKobo', e.target.value)} />
                <AppInput label="Maximum fee (₦)" type="number" value={f.riderArrivedCapKobo} onChange={(e) => set('riderArrivedCapKobo', e.target.value)} />
              </div>
            ) : (
              <DetailList
                className="mt-5"
                items={[
                  { label: 'Free for', value: `${f.riderGraceMinutes} min after the driver accepts` },
                  { label: 'Fee after that', value: naira(f.riderFeeAfterGraceKobo) },
                  { label: 'Driver waiting at pickup', value: `+${naira(f.riderArrivedPerMinuteKobo)} per minute` },
                  { label: 'Maximum fee', value: naira(f.riderArrivedCapKobo) },
                ]}
              />
            )}
            <p className="mt-4 text-[12px] text-muted">
              Riders always see the exact fee and must confirm it before they are charged.
            </p>
          </DashboardCard>

          <DashboardCard>
            <SectionHeader
              title="Driver cancels"
              description="Cancelling a ride they accepted. The ride goes back to other drivers."
              actions={<Toggle checked={f.driverPenaltyEnabled} disabled={!isEditing} onChange={(v) => set('driverPenaltyEnabled', v)} />}
            />
            {isEditing ? (
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <AppInput label="Not counted within (minutes)" type="number" value={f.driverGraceMinutes} onChange={(e) => set('driverGraceMinutes', e.target.value)} />
                <AppInput label="Cancellations before a pause" type="number" value={f.driverCancelThreshold} onChange={(e) => set('driverCancelThreshold', e.target.value)} />
                <AppInput label="Counted over (hours)" type="number" value={f.driverCancelWindowHours} onChange={(e) => set('driverCancelWindowHours', e.target.value)} />
                <AppInput label="Pause length (minutes)" type="number" value={f.driverCooldownMinutes} onChange={(e) => set('driverCooldownMinutes', e.target.value)} />
              </div>
            ) : (
              <DetailList
                className="mt-5"
                items={[
                  { label: 'Penalties', value: f.driverPenaltyEnabled ? 'On' : 'Off' },
                  { label: 'Not counted within', value: `${f.driverGraceMinutes} min of accepting` },
                  { label: 'Pause after', value: `${f.driverCancelThreshold} cancellations in ${f.driverCancelWindowHours} h` },
                  { label: 'Pause length', value: `${f.driverCooldownMinutes} min without ride requests` },
                ]}
              />
            )}
            <p className="mt-4 text-[12px] text-muted">
              Drivers see how close they are to a pause before they confirm a cancellation.
            </p>
          </DashboardCard>
        </div>
      )}

      <AppModal
        isOpen={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        size="sm"
        title="Save cancellation rules?"
        description="New rules apply to the next cancellation. Past charges and pauses don't change."
        footer={
          <>
            <AppButton variant="tertiary" label="Back" onPress={() => setIsConfirmOpen(false)} />
            <AppButton
              variant="brand"
              label="Save"
              isLoading={saveMutation.isPending}
              isDisabled={saveMutation.isPending}
              onPress={() => f && saveMutation.mutate(f)}
            />
          </>
        }
      >
        {formError ? <p className="rounded-2xl bg-danger-soft px-4 py-3 text-[13px] text-danger">{formError}</p> : null}
      </AppModal>
    </Page>
  );
}
