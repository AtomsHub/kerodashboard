'use client';

// src/components/support/help-center.tsx
// Help Center page body: conversations | chat | chat details. Used by
// /support and /support/[id] (that ticket already open).

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Page, StatusPill } from '@/components/ui/page';
import { PermissionGuard } from '@/components/auth/can';
import { SupportInbox } from '@/components/support/support-inbox';
import { isActiveSos } from '@/components/support/support-meta';
import { api } from '@/lib/api';
import type { SupportTicketListResponse } from '@/types/admin';

export function HelpCenter({ initialTicketId = null }: { initialTicketId?: string | null }) {
  // Same query key as the inbox list, so this is served from its cache.
  const { data } = useQuery<SupportTicketListResponse>({
    queryKey: ['admin', 'support', 'tickets', ''],
    queryFn: async () =>
      (await api.get<{ data: SupportTicketListResponse }>('/admin/support/tickets', { params: { page: 1, limit: 100 } })).data.data,
    refetchInterval: 10000,
  });
  const sosCount = (data?.tickets ?? []).filter(isActiveSos).length;

  return (
    <PermissionGuard permission="view_support">
      <Page>
        <SupportInbox
          mode="support"
          initialTicketId={initialTicketId}
          title="Help Center"
          badge={
            sosCount > 0 ? (
              <StatusPill tone="danger" dot pulse>
                {sosCount} SOS
              </StatusPill>
            ) : undefined
          }
        />
      </Page>
    </PermissionGuard>
  );
}
