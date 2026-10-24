'use client';

// src/app/support/[id]/page.tsx
// The Help Center inbox with one ticket already open.

import React from 'react';
import { useParams } from 'next/navigation';
import { HelpCenter } from '@/components/support/help-center';

export default function SupportTicketPage() {
  const { id } = useParams<{ id: string }>();
  return <HelpCenter initialTicketId={id ?? null} />;
}
