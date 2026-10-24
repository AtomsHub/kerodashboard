'use client';

// src/app/drivers/review-queue/page.tsx
// KYC queue: drivers by KYC state. Reviewing happens on the driver page,
// where each stage's details and documents sit next to the actions.

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, IdentificationCard, MagnifyingGlass, X } from '@phosphor-icons/react';
import { AppButton } from '@/components/ui/app-button';
import { AppInput } from '@/components/ui/app-input';
import { DashboardCard } from '@/components/ui/dashboard-card';
import { EmptyState, Page, PageHeader, Segmented, TablePagination } from '@/components/ui/page';
import { UserAvatar } from '@/components/ui/user-avatar';
import { PermissionGuard } from '@/components/auth/can';
import { KycStatusPill, kycStatusOf, type DriverKycStatus } from '@/components/drivers/verification-pills';
import { api } from '@/lib/api';
import type { AdminDriverListItem } from '@/types/admin';

type Tab = Extract<DriverKycStatus, 'in_review' | 'rejected' | 'approved'>;
const LIMIT = 20;

const fmt = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export default function KycQueuePage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('in_review');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const list = (status: Tab, p: number, q: string) => ({
    queryKey: ['admin', 'kyc', 'queue', status, p, q],
    queryFn: async () => {
      const params = new URLSearchParams({
        kycStatus: status,
        page: String(p),
        limit: String(LIMIT),
        sortBy: 'kycSubmittedAt',
        // Oldest first while waiting, newest first once decided.
        sortOrder: status === 'in_review' ? 'asc' : 'desc',
      });
      if (q.trim()) params.set('search', q.trim());
      return (
        await api.get<{ data: { total: number; drivers: (AdminDriverListItem & { kycSubmittedAt?: string | null })[] } }>(
          `/admin/drivers?${params.toString()}`,
        )
      ).data.data;
    },
    refetchInterval: 20000,
  });

  const { data, isLoading } = useQuery(list(tab, page, search));
  // Counts for the tabs (first page only, totals come from the API).
  const inReview = useQuery({ ...list('in_review', 1, ''), select: (d: { total: number }) => d.total });
  const rejected = useQuery({ ...list('rejected', 1, ''), select: (d: { total: number }) => d.total });
  const approved = useQuery({ ...list('approved', 1, ''), select: (d: { total: number }) => d.total });

  const drivers = data?.drivers ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / LIMIT));

  return (
    <PermissionGuard permission="view_drivers">
      <Page>
        <PageHeader title="KYC" description="Drivers waiting for, or done with, identity checks." />

        <DashboardCard className="overflow-hidden p-0">
          <div className="flex flex-col gap-3 p-6 pb-4 lg:flex-row lg:items-center lg:justify-between">
            <Segmented
              size="sm"
              aria-label="KYC status"
              value={tab}
              onChange={(key) => {
                setTab(key);
                setPage(1);
              }}
              options={[
                { key: 'in_review', label: 'In review', count: inReview.data },
                { key: 'rejected', label: 'Rejected', count: rejected.data },
                { key: 'approved', label: 'Approved', count: approved.data },
              ]}
            />
            <div className="w-full lg:w-64">
              <AppInput
                size="sm"
                placeholder="Search name, email or plate"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                startContent={<MagnifyingGlass />}
                endContent={
                  search ? (
                    <button type="button" onClick={() => setSearch('')} className="cursor-pointer text-muted hover:text-foreground">
                      <X size={14} />
                    </button>
                  ) : null
                }
              />
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-2 px-6 pb-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-2xl bg-surface-secondary" />
              ))}
            </div>
          ) : drivers.length === 0 ? (
            <div className="pb-6">
              <EmptyState
                icon={IdentificationCard}
                title={tab === 'in_review' ? 'Nothing to review' : 'No drivers here'}
                description={
                  tab === 'in_review'
                    ? 'Drivers appear here when they submit their KYC in the app.'
                    : 'Drivers move here after a decision is sent.'
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Driver</th>
                    <th>Phone</th>
                    <th>Submitted</th>
                    <th>KYC</th>
                    <th className="text-right" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {drivers.map((d) => (
                    <tr key={d.id} className="cursor-pointer" onClick={() => router.push(`/drivers/${d.id}`)}>
                      <td>
                        <div className="flex items-center gap-3">
                          <UserAvatar src={d.avatarUrl || d.selfieUrl} name={`${d.firstname ?? ''} ${d.lastname ?? ''}`} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">
                              {[d.firstname, d.lastname].filter(Boolean).join(' ') || 'Unnamed driver'}
                            </p>
                            <p className="truncate text-xs text-muted">{d.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="tabular text-muted">{d.phone ?? '—'}</td>
                      <td className="tabular text-muted">{fmt(d.kycSubmittedAt)}</td>
                      <td>
                        <KycStatusPill short status={kycStatusOf(d)} />
                      </td>
                      <td className="text-right">
                        <AppButton
                          size="sm"
                          variant={tab === 'in_review' ? 'brand' : 'tertiary'}
                          endContent={<ArrowRight />}
                          label={tab === 'in_review' ? 'Review' : 'Open'}
                          onPress={() => router.push(`/drivers/${d.id}`)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <TablePagination
                page={page}
                totalPages={totalPages}
                summary={`${data?.total ?? 0} drivers`}
                onChange={setPage}
              />
            </div>
          )}
        </DashboardCard>
      </Page>
    </PermissionGuard>
  );
}
