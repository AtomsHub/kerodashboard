'use client';

// src/components/corridors/corridor-editor-map.tsx
// Dynamic SSR-safe wrapper for CorridorEditorMapInner.

import dynamic from 'next/dynamic';
import React from 'react';
import { Skeleton } from '@heroui/react';

const DynamicCorridorEditorMap = dynamic(
  () => import('./corridor-editor-map-inner'),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <Skeleton className="h-full w-full" />
      </div>
    ),
  }
);

export function CorridorEditorMap(props: React.ComponentProps<typeof DynamicCorridorEditorMap>) {
  return <DynamicCorridorEditorMap {...props} />;
}
