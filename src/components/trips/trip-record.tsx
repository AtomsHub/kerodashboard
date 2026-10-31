'use client';

// src/components/trips/trip-record.tsx
// Permanent trip evidence for investigations: where the driver was at each
// step (live trails expire) and every SOS raised on the trip by either party.

import React from 'react';
import { Siren } from '@phosphor-icons/react';
import { PlaceName } from '@/components/ui/place-name';
import { DashboardCard } from '@/components/ui/dashboard-card';
import { SectionHeader, StatusPill } from '@/components/ui/page';

export interface TripCheckpoint {
  key: string;
  label: string;
  at: string | null;
  location: { lat: number; lng: number } | null;
  address: string | null;
}

export interface TripSosRecord {
  id: string;
  triggeredBy: string;
  location: { lat: number; lng: number } | null;
  message: string | null;
  status: string;
  claimedByName: string | null;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

const time = (v?: string | null) =>
  v ? new Date(v).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : null;

function MapLink({ location }: { location: { lat: number; lng: number } }) {
  return <PlaceName lat={location.lat} lng={location.lng} showIcon={false} className="text-[12px]" />;
}

export function TripRecord({
  checkpoints,
  sosAlerts,
  bare = false,
}: {
  checkpoints?: TripCheckpoint[];
  sosAlerts?: TripSosRecord[];
  /** Without the card (inside a modal). */
  bare?: boolean;
}) {
  if (!checkpoints) return null;
  const body = (
      <div className={`${bare ? "" : "mt-5 "}grid grid-cols-1 gap-6 xl:grid-cols-2`}>
        <ol className="space-y-4">
          {checkpoints.map((c) => (
            <li key={c.key} className="flex items-start gap-3">
              <span className={`mt-1.5 size-2 shrink-0 rounded-full ${c.location || c.at ? 'bg-secondary' : 'bg-default'}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[14px] font-medium text-foreground">{c.label}</p>
                  <span className="tabular shrink-0 text-[12px] text-muted">{time(c.at) ?? ''}</span>
                </div>
                {c.address && <p className="truncate text-[13px] text-muted">{c.address}</p>}
                {c.location ? (
                  <MapLink location={c.location} />
                ) : (
                  !c.address && <p className="text-[12px] text-muted">No location recorded</p>
                )}
              </div>
            </li>
          ))}
        </ol>

        <div>
          <p className="text-[13px] font-medium text-foreground">SOS on this trip</p>
          {!sosAlerts?.length ? (
            <p className="mt-2 text-[13px] text-muted">None raised.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {sosAlerts.map((s) => (
                <li key={s.id} className="rounded-2xl bg-danger-soft/40 p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-foreground">
                      <Siren size={14} weight="fill" className="text-danger" />
                      Raised by the {s.triggeredBy}
                    </span>
                    <StatusPill tone={s.status === 'active' ? 'danger' : 'neutral'}>{s.status.replace('_', ' ')}</StatusPill>
                  </div>
                  <p className="mt-1 text-[12px] text-muted">
                    {time(s.createdAt)}
                    {s.claimedByName ? ` · handled by ${s.claimedByName}` : ''}
                    {s.resolvedAt ? ` · resolved ${time(s.resolvedAt)}` : ''}
                  </p>
                  {s.message && <p className="mt-1.5 text-[13px] text-foreground">“{s.message}”</p>}
                  {s.location && (
                    <div className="mt-1">
                      <MapLink location={s.location} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
  );
  if (bare) return body;
  return (
    <DashboardCard>
      <SectionHeader title="Trip record" description="Kept permanently for investigations" />
      {body}
    </DashboardCard>
  );
}
