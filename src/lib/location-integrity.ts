// src/lib/location-integrity.ts
// Fake-GPS flags: shared types, labels and one-line explanations for the
// anti-fraud page and the driver page.

import type { StatusTone } from '@/components/ui/page';

export type IntegrityType = 'MOCK_LOCATION' | 'EMULATOR' | 'TELEPORT' | 'CLOCK_SKEW' | 'AUTO_OFFLINE';

export interface IntegrityEvent {
  id: string;
  driverId: string;
  driverName: string | null;
  driverPhone: string | null;
  type: IntegrityType;
  tripId: string | null;
  latitude: number | null;
  longitude: number | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export const INTEGRITY_LABELS: Record<IntegrityType, { label: string; tone: StatusTone }> = {
  MOCK_LOCATION: { label: 'Fake GPS', tone: 'danger' },
  EMULATOR: { label: 'Emulator', tone: 'danger' },
  TELEPORT: { label: 'Unrealistic speed', tone: 'warning' },
  CLOCK_SKEW: { label: 'Phone clock off', tone: 'neutral' },
  AUTO_OFFLINE: { label: 'Taken offline', tone: 'danger' },
};

/** One-line explanation of an event, e.g. "3.4 km in 9 s (1360 km/h)". */
export function integrityDetail(e: Pick<IntegrityEvent, 'type' | 'details'>): string {
  const d = e.details ?? {};
  if (e.type === 'TELEPORT') return `${d.distanceKm ?? '?'} km in ${d.seconds ?? '?'} s (${d.speedKmh ?? '?'} km/h)`;
  if (e.type === 'CLOCK_SKEW') return `Phone clock ${Math.abs(Number(d.driftSeconds ?? 0))} s off`;
  if (e.type === 'AUTO_OFFLINE') return `${d.flags ?? '?'} flags · offline ${d.offlineMinutes ?? '?'} min`;
  if (e.type === 'EMULATOR') return 'Location sent from an emulator';
  return 'Phone reported the location as mocked';
}
