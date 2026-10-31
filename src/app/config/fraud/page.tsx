'use client';

// src/app/config/fraud/page.tsx
// Anti-fraud: the live list of driver location flags (left), the rules
// (right; Edit opens a small modal), and driver–rider pairs that keep running
// up stop charges or fares the rider never pays (possible collusion).

import React, { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ShieldCheck, UsersThree } from '@phosphor-icons/react';
import { AppButton } from '@/components/ui/app-button';
import { AppInput } from '@/components/ui/app-input';
import { AppModal } from '@/components/ui/app-modal';
import { AppSelect } from '@/components/ui/app-select';
import { DashboardCard } from '@/components/ui/dashboard-card';
import { EmptyState, Page, PageHeader, SectionHeader, StatusPill } from '@/components/ui/page';
import { Can } from '@/components/auth/can';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { errorMessage, naira } from '@/lib/payments';
import { INTEGRITY_LABELS, integrityDetail, type IntegrityEvent, type IntegrityType } from '@/lib/location-integrity';

interface FraudPolicy {
  blockMockLocation: boolean;
  blockEmulators: boolean;
  teleportGuard: boolean;
  maxSpeedKmh: number;
  flagsBeforeOffline: number;
  flagWindowMinutes: number;
  offlineMinutes: number;
}

type Modal = 'checks' | 'offline' | null;

interface RidePair {
  driverId: string;
  driverName: string | null;
  riderId: string;
  riderName: string | null;
  trips: number;
  stopChargeTrips: number;
  stopChargeKobo: number;
  unpaidTrips: number;
  unpaidKobo: number;
}

function Rows({ rows }: { rows: Array<[string, React.ReactNode]> }) {
  return (
    <dl className="mt-3 divide-y divide-border">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between gap-4 py-2.5">
          <dt className="text-[13px] text-muted">{label}</dt>
          <dd className="tabular text-right text-[13.5px] text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

const onOff = (v: boolean) => <StatusPill tone={v ? 'success' : 'neutral'}>{v ? 'On' : 'Off'}</StatusPill>;
const ON_OFF = [
  { key: 'on', label: 'On' },
  { key: 'off', label: 'Off' },
];

export default function AntiFraudConfigPage() {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<Modal>(null);
  const [form, setForm] = useState<FraudPolicy | null>(null);
  const [typeFilter, setTypeFilter] = useState<'ALL' | IntegrityType>('ALL');
  const [releaseTarget, setReleaseTarget] = useState<IntegrityEvent | null>(null);

  const { data: policy, isLoading } = useQuery<FraudPolicy>({
    queryKey: ['admin', 'fraud-policy'],
    queryFn: async () => (await api.get<{ data: FraudPolicy }>('/admin/fraud-policy')).data.data,
  });

  const events = useQuery<{ events: IntegrityEvent[]; total: number }>({
    queryKey: ['admin', 'location-integrity-events', typeFilter],
    queryFn: async () =>
      (
        await api.get<{ data: { events: IntegrityEvent[]; total: number } }>('/admin/location-integrity-events', {
          params: { limit: 40, ...(typeFilter !== 'ALL' ? { type: typeFilter } : {}) },
        })
      ).data.data,
    refetchInterval: 30_000,
  });

  const pairs = useQuery<RidePair[]>({
    queryKey: ['admin', 'fraud', 'ride-pairs'],
    queryFn: async () => (await api.get<{ data: RidePair[] }>('/admin/fraud/ride-pairs')).data.data,
  });

  const save = useMutation({
    mutationFn: async (f: FraudPolicy) => api.put('/admin/fraud-policy', f, { silent: true }),
    onSuccess: () => {
      toast.success('Saved');
      queryClient.invalidateQueries({ queryKey: ['admin', 'fraud-policy'] });
      setModal(null);
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not save')),
  });

  const release = useMutation({
    mutationFn: async (driverId: string) => api.post(`/admin/drivers/${driverId}/location-block/clear`, undefined, { silent: true }),
    onSuccess: () => {
      toast.success('Driver can receive rides again');
      setReleaseTarget(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'location-integrity-events'] });
    },
    onError: () => toast.error('Could not put the driver back online'),
  });

  const open = (m: Modal) => {
    if (!policy) return;
    setForm({ ...policy });
    setModal(m);
  };
  const set = <K extends keyof FraudPolicy>(k: K, v: FraudPolicy[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const num = (k: 'maxSpeedKmh' | 'flagsBeforeOffline' | 'flagWindowMinutes' | 'offlineMinutes') => (e: React.ChangeEvent<HTMLInputElement>) =>
    set(k, Number(e.target.value));
  const list = events.data?.events ?? [];

  return (
    <Page>
      <PageHeader title="Anti-fraud" description="Fake-GPS and emulator protection for drivers." />

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
        {/* Left: flags */}
        <DashboardCard className="overflow-hidden p-0 lg:col-span-7">
          <div className="flex flex-col gap-3 p-6 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <SectionHeader title="Location flags" description="Newest first" />
            <div className="w-full sm:w-44">
              <AppSelect
                size="sm"
                aria-label="Flag type"
                selectedKey={typeFilter}
                onSelectionChange={(v) => setTypeFilter(v as typeof typeFilter)}
                options={[
                  { key: 'ALL', label: 'All flags' },
                  { key: 'MOCK_LOCATION', label: 'Fake GPS' },
                  { key: 'TELEPORT', label: 'Unrealistic speed' },
                  { key: 'AUTO_OFFLINE', label: 'Taken offline' },
                ]}
              />
            </div>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Driver</th>
                <th>Flag</th>
                <th>When</th>
                <th className="w-32" />
              </tr>
            </thead>
            <tbody>
              {events.isLoading ? (
                <tr>
                  <td colSpan={4}>
                    <div className="h-20 animate-pulse rounded-2xl bg-surface-secondary" />
                  </td>
                </tr>
              ) : list.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <EmptyState icon={ShieldCheck} title="No flags" description="Suspicious driver locations will show up here." />
                  </td>
                </tr>
              ) : (
                list.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <Link href={`/drivers/${e.driverId}`} className="font-medium text-foreground hover:underline">
                        {e.driverName ?? 'Driver'}
                      </Link>
                      {e.tripId && <p className="text-xs text-muted">On a trip</p>}
                    </td>
                    <td>
                      <StatusPill tone={INTEGRITY_LABELS[e.type]?.tone ?? 'neutral'}>{INTEGRITY_LABELS[e.type]?.label ?? e.type}</StatusPill>
                      <p className="mt-0.5 text-xs text-muted">{integrityDetail(e)}</p>
                    </td>
                    <td className="tabular text-muted">{formatDateTime(e.createdAt)}</td>
                    <td className="text-right">
                      {e.type === 'AUTO_OFFLINE' ? (
                        <Can permission="unsuspend_driver">
                          <AppButton size="sm" variant="tertiary" label="Put back online" onPress={() => setReleaseTarget(e)} />
                        </Can>
                      ) : e.latitude != null && e.longitude != null ? (
                        <a
                          href={`https://www.google.com/maps?q=${e.latitude},${e.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[12.5px] text-muted hover:text-foreground hover:underline"
                        >
                          Map
                        </a>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </DashboardCard>

        {/* Right: rules */}
        <div className="space-y-5 lg:col-span-5">
          <DashboardCard>
            <SectionHeader
              title="Location checks"
              actions={
                <Can permission="manage_dispatch_config">
                  <AppButton size="sm" variant="tertiary" label="Edit" isDisabled={!policy} onPress={() => open('checks')} />
                </Can>
              }
            />
            {isLoading || !policy ? (
              <div className="mt-4 h-28 animate-pulse rounded-2xl bg-surface-secondary" />
            ) : (
              <Rows
                rows={[
                  ['Block fake GPS', onOff(policy.blockMockLocation)],
                  ['Block unrealistic speed', onOff(policy.teleportGuard)],
                  ['Fastest believable speed', `${policy.maxSpeedKmh} km/h`],
                  ['Block emulators', onOff(policy.blockEmulators)],
                ]}
              />
            )}
            <p className="mt-3 text-[12px] text-muted">
              Speed is distance ÷ time between two updates, so a driver who goes offline and reappears later somewhere else isn’t flagged.
            </p>
          </DashboardCard>

          <DashboardCard>
            <SectionHeader
              title="Taking drivers offline"
              actions={
                <Can permission="manage_dispatch_config">
                  <AppButton size="sm" variant="tertiary" label="Edit" isDisabled={!policy} onPress={() => open('offline')} />
                </Can>
              }
            />
            {policy && (
              <Rows
                rows={[
                  ['Flags before offline', String(policy.flagsBeforeOffline)],
                  ['Counted over', `${policy.flagWindowMinutes} min`],
                  ['Offline for', `${policy.offlineMinutes} min`],
                ]}
              />
            )}
          </DashboardCard>
        </div>
      </div>

      <DashboardCard className="overflow-hidden p-0">
        <SectionHeader className="p-6 pb-4" title="Driver and rider pairs" description="Same pair with stop charges or unpaid fares on 2+ trips in 30 days" />
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Driver</th>
                <th>Rider</th>
                <th className="text-right">Trips together</th>
                <th className="text-right">Stop charges</th>
                <th className="text-right">Unpaid</th>
              </tr>
            </thead>
            <tbody>
              {pairs.isLoading ? (
                <tr>
                  <td colSpan={5}>
                    <div className="h-16 animate-pulse rounded-2xl bg-surface-secondary" />
                  </td>
                </tr>
              ) : (pairs.data ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState icon={UsersThree} title="Nothing suspicious" description="Pairs that keep running up stop charges or unpaid fares show up here." />
                  </td>
                </tr>
              ) : (
                (pairs.data ?? []).map((p) => (
                  <tr key={`${p.driverId}:${p.riderId}`}>
                    <td>
                      <Link href={`/drivers/${p.driverId}`} className="font-medium text-foreground hover:underline">
                        {p.driverName ?? 'Driver'}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/riders/${p.riderId}`} className="text-foreground hover:underline">
                        {p.riderName ?? 'Rider'}
                      </Link>
                    </td>
                    <td className="tabular text-right">{p.trips}</td>
                    <td className="tabular text-right">
                      {p.stopChargeTrips}
                      <p className="text-xs text-muted">{naira(p.stopChargeKobo)}</p>
                    </td>
                    <td className="tabular text-right">
                      {p.unpaidTrips > 0 ? <StatusPill tone="danger">{p.unpaidTrips}</StatusPill> : '0'}
                      {p.unpaidKobo > 0 && <p className="text-xs text-muted">{naira(p.unpaidKobo)}</p>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </DashboardCard>

      <AppModal
        isOpen={modal !== null}
        onOpenChange={(o) => !o && setModal(null)}
        size="sm"
        title={modal === 'checks' ? 'Location checks' : 'Taking drivers offline'}
        footer={
          <>
            <AppButton variant="tertiary" label="Cancel" onPress={() => setModal(null)} />
            <AppButton variant="brand" label="Save" isLoading={save.isPending} onPress={() => form && save.mutate(form)} />
          </>
        }
      >
        {form && modal === 'checks' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <AppSelect label="Block fake GPS" selectedKey={form.blockMockLocation ? 'on' : 'off'} onSelectionChange={(v) => set('blockMockLocation', v === 'on')} options={ON_OFF} />
              <AppSelect label="Block emulators" selectedKey={form.blockEmulators ? 'on' : 'off'} onSelectionChange={(v) => set('blockEmulators', v === 'on')} options={ON_OFF} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <AppSelect label="Block unrealistic speed" selectedKey={form.teleportGuard ? 'on' : 'off'} onSelectionChange={(v) => set('teleportGuard', v === 'on')} options={ON_OFF} />
              <AppInput label="Fastest speed (km/h)" type="number" value={String(form.maxSpeedKmh)} onChange={num('maxSpeedKmh')} />
            </div>
          </div>
        )}
        {form && modal === 'offline' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <AppInput label="Flags before offline" type="number" value={String(form.flagsBeforeOffline)} onChange={num('flagsBeforeOffline')} />
              <AppInput label="Counted over (min)" type="number" value={String(form.flagWindowMinutes)} onChange={num('flagWindowMinutes')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <AppInput label="Offline for (min)" type="number" value={String(form.offlineMinutes)} onChange={num('offlineMinutes')} />
            </div>
          </div>
        )}
      </AppModal>

      <AppModal
        isOpen={Boolean(releaseTarget)}
        onOpenChange={(o) => !o && setReleaseTarget(null)}
        size="sm"
        title="Put this driver back online?"
        description={`${releaseTarget?.driverName ?? 'The driver'} can receive rides again straight away.`}
        footer={
          <>
            <AppButton variant="tertiary" label="Cancel" onPress={() => setReleaseTarget(null)} />
            <AppButton variant="brand" label="Put back online" isLoading={release.isPending} onPress={() => releaseTarget && release.mutate(releaseTarget.driverId)} />
          </>
        }
      />
    </Page>
  );
}
