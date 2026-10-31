'use client';

// src/components/config/stop-charge-card.tsx
// Stop charge: what a rider pays when the driver waits at a stop they added,
// paid to the driver. ₦0 per minute turns it off. The clock only runs while
// the driver's GPS is at the stop, and it is only taken from money the rider
// has (never debt), so a driver and rider can't farm it.

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AppButton } from '@/components/ui/app-button';
import { AppInput } from '@/components/ui/app-input';
import { AppModal } from '@/components/ui/app-modal';
import { DashboardCard } from '@/components/ui/dashboard-card';
import { DetailList, SectionHeader, StatusPill } from '@/components/ui/page';
import { Can } from '@/components/auth/can';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/payments';
import { formatKoboToNaira } from '@/lib/utils';

export interface StopChargePolicy {
  stopFreeMinutes: number;
  stopPerMinuteKobo: number;
  stopCapPerStopKobo: number;
  stopCapPerTripKobo: number;
  stopArrivalRadiusMeters: number;
}

const toForm = (p: StopChargePolicy) => ({
  free: String(p.stopFreeMinutes),
  perMinute: String(p.stopPerMinuteKobo / 100),
  capStop: String(p.stopCapPerStopKobo / 100),
  capTrip: String(p.stopCapPerTripKobo / 100),
  radius: String(p.stopArrivalRadiusMeters),
});

export function StopChargeCard({ policy }: { policy: StopChargePolicy | undefined }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ReturnType<typeof toForm> | null>(null);
  const kobo = (v: string) => Math.round(Number(v || 0) * 100);

  const save = useMutation({
    mutationFn: async () =>
      api.put(
        '/admin/cancellation-policy',
        {
          stopFreeMinutes: Number(form!.free),
          stopPerMinuteKobo: kobo(form!.perMinute),
          stopCapPerStopKobo: kobo(form!.capStop),
          stopCapPerTripKobo: kobo(form!.capTrip),
          stopArrivalRadiusMeters: Number(form!.radius),
        },
        { silent: true },
      ),
    onSuccess: () => {
      toast.success('Stop charge saved');
      setForm(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'cancellation-policy'] });
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not save')),
  });

  const set = (k: keyof ReturnType<typeof toForm>) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => (f ? { ...f, [k]: e.target.value } : f));
  const valid =
    form &&
    [form.free, form.radius].every((v) => Number.isInteger(Number(v))) &&
    Number(form.free) >= 0 &&
    Number(form.radius) >= 30 &&
    Number(form.radius) <= 500 &&
    [form.perMinute, form.capStop, form.capTrip].every((v) => Number(v) >= 0) &&
    Number(form.capTrip) >= Number(form.capStop);
  const on = (policy?.stopPerMinuteKobo ?? 0) > 0;

  return (
    <DashboardCard>
      <SectionHeader
        title="Stop charge"
        description="Driver waiting at a stop the rider added. Paid to the driver."
        actions={
          <div className="flex items-center gap-2">
            <StatusPill tone={on ? 'success' : 'neutral'}>{on ? 'On' : 'Off'}</StatusPill>
            <Can permission="manage_dispatch_config">
              <AppButton size="sm" variant="tertiary" label="Edit" isDisabled={!policy} onPress={() => policy && setForm(toForm(policy))} />
            </Can>
          </div>
        }
      />
      {policy && (
        <DetailList
          className="mt-5"
          items={[
            { label: 'Free at each stop', value: `${policy.stopFreeMinutes} min` },
            { label: 'Then per minute', value: on ? formatKoboToNaira(policy.stopPerMinuteKobo) : '₦0 (off)' },
            { label: 'Most per stop', value: formatKoboToNaira(policy.stopCapPerStopKobo) },
            { label: 'Most per trip', value: formatKoboToNaira(policy.stopCapPerTripKobo) },
            { label: 'Clock starts within', value: `${policy.stopArrivalRadiusMeters} m of the stop` },
          ]}
        />
      )}
      <p className="mt-4 text-[12px] text-muted">Only taken from money in the rider's wallet. It never puts a rider in debt.</p>

      <AppModal
        isOpen={Boolean(form)}
        onOpenChange={(o) => !o && setForm(null)}
        size="sm"
        title="Stop charge"
        footer={
          <>
            <AppButton variant="tertiary" label="Cancel" onPress={() => setForm(null)} />
            <AppButton variant="brand" label="Save" isDisabled={!valid} isLoading={save.isPending} onPress={() => save.mutate()} />
          </>
        }
      >
        {form && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <AppInput label="Free minutes at a stop" type="number" value={form.free} onChange={set('free')} />
              <AppInput label="₦ per minute after" type="number" value={form.perMinute} onChange={set('perMinute')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <AppInput label="Most per stop (₦)" type="number" value={form.capStop} onChange={set('capStop')} />
              <AppInput label="Most per trip (₦)" type="number" value={form.capTrip} onChange={set('capTrip')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <AppInput label="Driver within (metres)" type="number" value={form.radius} onChange={set('radius')} />
            </div>
          </>
        )}
      </AppModal>
    </DashboardCard>
  );
}
