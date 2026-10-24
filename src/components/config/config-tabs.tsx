'use client';

import React from 'react';
import { SlidersHorizontal, Money, ShieldWarning, Gift, XCircle } from '@phosphor-icons/react';
import { LinkTabs } from '@/components/ui/page';

export function ConfigTabs() {
  return (
    <LinkTabs
      tabs={[
        { label: 'Dispatch', href: '/config/dispatch', icon: SlidersHorizontal },
        { label: 'Cash & gateways', href: '/config/cash', icon: Money },
        { label: 'Cancellations', href: '/config/cancellation', icon: XCircle },
        { label: 'Anti-fraud', href: '/config/fraud', icon: ShieldWarning },
        { label: 'Loyalty', href: '/rewards', icon: Gift },
      ]}
    />
  );
}
