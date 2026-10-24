'use client';

// src/components/drivers/verification-pills.tsx
// Email verification and KYC are separate: a driver can confirm their email
// long before (or without) passing KYC. Always show both.

import React from 'react';
import { StatusPill, type StatusTone } from '@/components/ui/page';

export type DriverKycStatus = 'approved' | 'in_review' | 'rejected' | 'not_submitted';

const KYC: Record<DriverKycStatus, { label: string; tone: StatusTone }> = {
  approved: { label: 'KYC approved', tone: 'success' },
  in_review: { label: 'KYC in review', tone: 'warning' },
  rejected: { label: 'KYC rejected', tone: 'danger' },
  not_submitted: { label: 'No KYC', tone: 'neutral' },
};

/** Works with older payloads that only carry the booleans. */
export function kycStatusOf(driver: {
  kycStatus?: DriverKycStatus;
  kycVerified?: boolean;
  kycSubmitted?: boolean;
}): DriverKycStatus {
  if (driver.kycStatus) return driver.kycStatus;
  if (driver.kycVerified) return 'approved';
  if (driver.kycSubmitted) return 'in_review';
  return 'not_submitted';
}

export function KycStatusPill({ status, short = false }: { status: DriverKycStatus; short?: boolean }) {
  const k = KYC[status];
  return (
    <StatusPill tone={k.tone} dot>
      {short ? k.label.replace(/^KYC /, '').replace(/^No KYC$/, 'Not submitted') : k.label}
    </StatusPill>
  );
}

export function EmailStatusPill({ verified, short = false }: { verified: boolean; short?: boolean }) {
  return (
    <StatusPill tone={verified ? 'success' : 'neutral'}>
      {short ? (verified ? 'Verified' : 'Unverified') : verified ? 'Email verified' : 'Email unverified'}
    </StatusPill>
  );
}
