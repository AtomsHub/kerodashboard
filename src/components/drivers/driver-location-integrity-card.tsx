'use client';

// src/components/drivers/driver-location-integrity-card.tsx
// Fake-GPS history for one driver on their admin page: recent flags and, when
// they were taken offline, a way to put them back online early.

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ShieldCheck } from '@phosphor-icons/react';
import { AppButton } from '@/components/ui/app-button';
import { AppModal } from '@/components/ui/app-modal';
import { DashboardCard } from '@/components/ui/dashboard-card';
import { EmptyState, SectionHeader, StatusPill } from '@/components/ui/page';
import { Can } from '@/components/auth/can';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { INTEGRITY_LABELS, integrityDetail, type IntegrityEvent } from '@/lib/location-integrity';

export function DriverLocationIntegrityCard({ driverId }: { driverId: string }) {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { data, isLoading } = useQuery<{ events: IntegrityEvent[]; total: number }>({
    queryKey: ['admin', 'location-integrity-events', 'driver', driverId],
    queryFn: async () =>
      (
        await api.get<{ data: { events: IntegrityEvent[]; total: number } }>('/admin/location-integrity-events', {
          params: { driverId, limit: 10 },
        })
      ).data.data,
  });
  const release = useMutation({
    mutationFn: async () => api.post(`/admin/drivers/${driverId}/location-block/clear`, undefined, { silent: true }),
    onSuccess: () => {
      toast.success('Driver can receive rides again');
      setConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ['admin', 'location-integrity-events'] });
    },
    onError: () => toast.error('Could not put the driver back online'),
  });

  const events = data?.events ?? [];
  const lastOffline = events.find((e) => e.type === 'AUTO_OFFLINE');

  return (
    <DashboardCard>
      <SectionHeader
        title="Location checks"
        description="Fake GPS, emulators and impossible jumps"
        actions={
          lastOffline ? (
            <Can permission="unsuspend_driver">
              <AppButton size="sm" variant="tertiary" label="Put back online" onPress={() => setConfirmOpen(true)} />
            </Can>
          ) : data && data.total > 0 ? (
            <StatusPill tone="warning">{data.total} flags</StatusPill>
          ) : undefined
        }
      />
      {isLoading ? (
        <div className="mt-4 h-20 animate-pulse rounded-2xl bg-surface-secondary" />
      ) : events.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="No location problems" className="py-8" />
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {events.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <StatusPill tone={INTEGRITY_LABELS[e.type]?.tone ?? 'neutral'}>{INTEGRITY_LABELS[e.type]?.label ?? e.type}</StatusPill>
                <p className="mt-1 truncate text-[12.5px] text-muted">{integrityDetail(e)}</p>
              </div>
              <span className="tabular shrink-0 text-[12px] text-muted">{formatDateTime(e.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}

      <AppModal
        isOpen={confirmOpen}
        onOpenChange={setConfirmOpen}
        size="sm"
        title="Put this driver back online?"
        description="They can receive rides again straight away. Do this only if the flags were a mistake."
        footer={
          <>
            <AppButton variant="tertiary" label="Cancel" onPress={() => setConfirmOpen(false)} />
            <AppButton variant="brand" label="Put back online" isLoading={release.isPending} isDisabled={release.isPending} onPress={() => release.mutate()} />
          </>
        }
      />
    </DashboardCard>
  );
}
