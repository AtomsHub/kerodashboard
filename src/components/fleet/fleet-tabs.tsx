'use client';

import { Car, MapPin, Wrench } from '@phosphor-icons/react';
import { LinkTabs } from '@/components/ui/page';

export function FleetTabs() {
  return (
    <LinkTabs
      tabs={[
        { label: 'Vehicles', href: '/fleet', icon: Car },
        { label: 'Maintenance', href: '/fleet/maintenance', icon: Wrench },
        { label: 'Zones', href: '/fleet/zones', icon: MapPin },
      ]}
    />
  );
}
