'use client';

// src/components/trips/trip-map.tsx
// SSR-safe wrapper for the single-trip Leaflet map.

import React from 'react';
import dynamic from 'next/dynamic';

export interface TripPoint {
  lat: number;
  lng: number;
  heading?: number | null;
  timestamp?: string;
}

export interface TripMapProps {
  start: { lat: number; lng: number };
  end: { lat: number; lng: number };
  polyline?: string | null;
  driverTrail: TripPoint[];
  riderTrail: TripPoint[];
  driverLocation: TripPoint | null;
  riderLocation: TripPoint | null;
  /** Keep the driver centred as they move (active trips). */
  follow?: boolean;
}

const TripMapInner = dynamic(() => import('./trip-map-inner'), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse bg-surface-secondary" />,
});

export function TripMap(props: TripMapProps) {
  return <TripMapInner {...props} />;
}
