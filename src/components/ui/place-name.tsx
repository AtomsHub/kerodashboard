'use client';

// src/components/ui/place-name.tsx
// A coordinate shown as a street address (reverse-geocoded by the backend,
// cached), linking to Google Maps. Falls back to the coordinates.

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowSquareOut, MapPin } from '@phosphor-icons/react';
import { api } from '@/lib/api';

export function usePlaceName(lat?: number | null, lng?: number | null) {
  return useQuery<string | null>({
    queryKey: ['maps', 'reverse', lat?.toFixed(4), lng?.toFixed(4)],
    enabled: typeof lat === 'number' && typeof lng === 'number' && !(lat === 0 && lng === 0),
    staleTime: Infinity,
    retry: false,
    queryFn: async () =>
      (await api.get<{ data: { address?: string } }>('/maps/reverse', { params: { latitude: lat, longitude: lng } })).data.data.address ?? null,
  });
}

export function PlaceName({ lat, lng, className = '', showIcon = true }: { lat: number; lng: number; className?: string; showIcon?: boolean }) {
  const { data: address } = usePlaceName(lat, lng);
  return (
    <a
      href={`https://www.google.com/maps?q=${lat},${lng}`}
      target="_blank"
      rel="noreferrer"
      title={`${lat.toFixed(5)}, ${lng.toFixed(5)}`}
      className={`inline-flex min-w-0 items-center gap-1.5 text-[13px] text-muted hover:text-foreground ${className}`}
    >
      {showIcon && <MapPin size={14} weight="duotone" className="shrink-0" />}
      <span className={address ? 'truncate' : 'tabular truncate'}>{address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`}</span>
      <ArrowSquareOut size={11} className="shrink-0" />
    </a>
  );
}
