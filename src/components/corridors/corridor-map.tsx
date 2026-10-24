'use client';

// src/components/corridors/corridor-map.tsx
// Dynamic SSR-safe wrapper for CorridorMapInner.

import React from 'react';
import dynamic from 'next/dynamic';
import { ServiceAreaItem } from '@/types/admin';

const CorridorMapInner = dynamic(
  () => import('./corridor-map-inner'),
  {
    ssr: false,
    loading: () => (
      <div className="size-full flex flex-col items-center justify-center bg-surface-secondary/40 rounded-3xl animate-pulse">
        <div className="size-8 rounded-xl bg-secondary/20 animate-spin" />
        <p className="mt-3 text-xs font-semibold text-muted">Rendering Service Area Polygons...</p>
      </div>
    ),
  },
);

export interface CorridorMapProps {
  corridors: ServiceAreaItem[];
  selectedCorridorId: string | null;
  onSelectCorridor: (id: string) => void;
}

export function CorridorMap(props: CorridorMapProps) {
  return <CorridorMapInner {...props} />;
}
