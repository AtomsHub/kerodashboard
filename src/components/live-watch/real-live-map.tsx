'use client';

// src/components/live-watch/real-live-map.tsx
// Dynamic SSR-safe wrapper for the Leaflet Live Operations Map.

import React from 'react';
import dynamic from 'next/dynamic';
import { LiveTrip, OnlineDriver } from '@/types/admin';

const LiveMapInner = dynamic(
  () => import('./live-map-inner'),
  {
    ssr: false,
    loading: () => (
      <div className="size-full flex flex-col items-center justify-center bg-surface-secondary/50 rounded-3xl animate-pulse">
        <div className="size-10 rounded-2xl bg-default animate-spin" />
        <p className="mt-3 text-xs font-semibold text-muted">Mounting Lagos Street Map Tiles...</p>
      </div>
    ),
  },
);

export interface RealLiveMapProps {
  drivers: OnlineDriver[];
  trips: LiveTrip[];
  selectedDriver: OnlineDriver | null;
  selectedTrip: LiveTrip | null;
  onSelectDriver: (driver: OnlineDriver) => void;
  onSelectTrip: (trip: LiveTrip) => void;
  isSocketLive: boolean;
}

export function RealLiveMap(props: RealLiveMapProps) {
  return <LiveMapInner {...props} />;
}
