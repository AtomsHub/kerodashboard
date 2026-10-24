'use client';

import { CurrencyNgn, Lightning } from '@phosphor-icons/react';
import { LinkTabs } from '@/components/ui/page';

export function PricingTabs() {
  return (
    <LinkTabs
      tabs={[
        { label: 'Fares', href: '/pricing', icon: CurrencyNgn },
        { label: 'Surge zones', href: '/pricing/surge', icon: Lightning },
      ]}
    />
  );
}
