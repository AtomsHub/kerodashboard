'use client';

// src/app/finance/payments/page.tsx
// Master Payments & Cashflow Ledger
// Real-time tracking of wallet top-ups, ride payments, driver payouts, and regulatory remittances.

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  CreditCard,
  ArrowClockwise,
  DownloadSimple,
  MagnifyingGlass,
  CheckCircle,
  Clock,
  XCircle,
  Copy,
  Check,
  CaretLeft,
  CaretRight,
  Receipt,
  Wallet,
  ArrowLeft,
  ArrowsLeftRight,
} from '@phosphor-icons/react';
import { Card, Chip } from '@heroui/react';
import { toast } from 'sonner';
import { AppButton } from '@/components/ui/app-button';
import { AppInput } from '@/components/ui/app-input';
import { DashboardCard, StatDashboardCard } from '@/components/ui/dashboard-card';
import { AppSelect } from '@/components/ui/app-select';
import { EmptyState, Page, PageHeader, Segmented, StatusPill, TablePagination } from '@/components/ui/page';
import { PermissionGuard } from '@/components/auth/can';
import { api } from '@/lib/api';
import { FinanceTransactionsResponse, FinanceTransactionItem } from '@/types/admin';

type ServiceCategory = 'all' | 'fund_account' | 'user_fare_payment' | 'fund_transfer' | 'cash_commission';

export default function MasterPaymentsPage() {
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [category, setCategory] = useState<ServiceCategory>('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [gatewayFilter, setGatewayFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    toast.success('Reference copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // ── Query: Master Transactions Ledger ────────────────────────────────
  const { data: txResponse, isLoading, refetch, isFetching } = useQuery<FinanceTransactionsResponse>({
    queryKey: ['admin', 'finance', 'transactions', page, limit, category, statusFilter, gatewayFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (category !== 'all') params.set('service', category);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (gatewayFilter !== 'all') params.set('gateway', gatewayFilter);
      if (search.trim()) params.set('search', search.trim());

      const res = await api.get<{ data: FinanceTransactionsResponse }>('/admin/finance/transactions?' + params.toString());
      return res.data?.data;
    },
    refetchInterval: 30000,
  });

  const transactions = txResponse?.data ?? [];
  const total = txResponse?.total ?? 0;
  const totalPages = txResponse?.totalPages ?? Math.max(1, Math.ceil(total / limit));

  const formatNaira = (kobo: number | null | undefined) => {
    if (kobo === null || kobo === undefined) return '₦0.00';
    return `₦${(kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Export CSV
  const handleExportCSV = () => {
    if (transactions.length === 0) {
      toast.error('No transactions available to export');
      return;
    }
    const headers = [
      'Transaction ID',
      'Reference',
      'Service',
      'Type',
      'Amount (NGN)',
      'Charges (NGN)',
      'Status',
      'Gateway',
      'User / Driver',
      'Created At',
    ];
    const rows = transactions.map((tx) => [
      tx.transactionId,
      tx.reference,
      tx.transactionServices,
      tx.transactionType,
      (tx.amountKobo / 100).toFixed(2),
      (tx.chargesKobo / 100).toFixed(2),
      tx.status,
      tx.gateway,
      tx.user?.fullname || (tx.driver ? `${tx.driver.firstname || ''} ${tx.driver.lastname || ''}`.trim() : 'N/A'),
      new Date(tx.createdAt).toISOString(),
    ]);

    // Quote every cell so commas or quotes in names don't break the columns.
    const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csvContent = [headers.map(cell).join(','), ...rows.map((e) => e.map(cell).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `kero-payments-ledger-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Payments CSV downloaded');
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <StatusPill tone="success">Completed</StatusPill>;
      case 'PENDING':
      case 'PROCESSING':
        return <StatusPill tone="warning">{status === 'PROCESSING' ? 'Processing' : 'Pending'}</StatusPill>;
      case 'FAILED':
      default:
        return <StatusPill tone="danger">Failed</StatusPill>;
    }
  };

  const SERVICE_LABELS: Record<string, string> = {
    fund_account: 'Wallet top-up',
    user_fare_payment: 'Ride fare',
    driver_fare_payment: 'Ride fare',
    fund_transfer: 'Driver payout',
    cash_commission: 'Cash commission',
  };

  const successRate =
    transactions.length > 0
      ? `${Math.round((transactions.filter((t) => t.status === 'COMPLETED').length / transactions.length) * 100)}%`
      : '—';

  return (
    <PermissionGuard permission="view_transactions">
      <Page>
        <PageHeader
          back={
            <Link href="/finance" className="inline-flex items-center gap-1 hover:text-foreground">
              <ArrowLeft size={14} /> Finance
            </Link>
          }
          title="Payments"
          description="Every top-up, fare, payout and fee."
          actions={
            <>
              <AppButton
                variant="tertiary"
                isIconOnly
                aria-label="Refresh"
                startContent={<ArrowClockwise className={isFetching ? 'animate-spin' : ''} />}
                onPress={() => refetch()}
                isDisabled={isFetching}
              />
              <AppButton variant="brand" startContent={<DownloadSimple />} label="Export" onPress={handleExportCSV} />
            </>
          }
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <StatDashboardCard
            label="Transactions"
            value={total.toLocaleString()}
            icon={Receipt}
            hint="Matching current filters"
            loading={isLoading}
            variant="wallet"
          />
          <StatDashboardCard
            label="Volume on this page"
            value={formatNaira(transactions.reduce((acc, t) => acc + t.amountKobo, 0))}
            icon={Wallet}
            hint={`${transactions.length} rows`}
            loading={isLoading}
          />
          <StatDashboardCard label="Success rate" value={successRate} icon={CheckCircle} hint="On this page" loading={isLoading} />
        </div>

        <DashboardCard className="overflow-hidden p-0">
          <div className="flex flex-col gap-3 p-6 pb-4 xl:flex-row xl:items-center xl:justify-between">
            <Segmented
              size="sm"
              aria-label="Category"
              value={category}
              onChange={(key) => {
                setCategory(key);
                setPage(1);
              }}
              options={[
                { key: 'all', label: 'All' },
                { key: 'fund_account', label: 'Top-ups' },
                { key: 'user_fare_payment', label: 'Fares' },
                { key: 'fund_transfer', label: 'Payouts' },
                { key: 'cash_commission', label: 'Cash' },
              ]}
            />

            <div className="flex flex-wrap items-center gap-2 xl:flex-nowrap">
              <div className="w-full sm:w-52 xl:w-48 2xl:w-60">
                <AppInput
                  size="sm"
                  placeholder="Search reference or name"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  startContent={<MagnifyingGlass />}
                />
              </div>
              <div className="w-36">
                <AppSelect
                  size="sm"
                  aria-label="Status"
                  selectedKey={statusFilter}
                  onSelectionChange={(key) => {
                    setStatusFilter(key);
                    setPage(1);
                  }}
                  options={[
                    { key: 'all', label: 'All statuses' },
                    { key: 'COMPLETED', label: 'Completed' },
                    { key: 'PENDING', label: 'Pending' },
                    { key: 'FAILED', label: 'Failed' },
                  ]}
                />
              </div>
              <div className="w-36">
                <AppSelect
                  size="sm"
                  aria-label="Gateway"
                  selectedKey={gatewayFilter}
                  onSelectionChange={(key) => {
                    setGatewayFilter(key);
                    setPage(1);
                  }}
                  options={[
                    { key: 'all', label: 'All gateways' },
                    { key: 'PAYSTACK', label: 'Paystack' },
                    { key: 'FLUTTERWAVE', label: 'Flutterwave' },
                    { key: 'MONNIFY', label: 'Monnify' },
                  ]}
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Type</th>
                  <th>Account</th>
                  <th className="text-right">Amount</th>
                  <th className="text-right">Fee</th>
                  <th>Gateway</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={8}>
                        <div className="h-6 w-full animate-pulse rounded-lg bg-default" />
                      </td>
                    </tr>
                  ))
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <EmptyState icon={Receipt} title="No transactions" description="Try a different filter or search." />
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <span className="tabular font-medium text-foreground">{tx.reference.slice(0, 14)}</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(tx.reference)}
                            className="cursor-pointer text-muted transition-colors hover:text-foreground"
                            title="Copy reference"
                          >
                            {copiedId === tx.reference ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
                          </button>
                        </div>
                      </td>

                      <td className="whitespace-nowrap text-foreground">
                        {SERVICE_LABELS[tx.transactionServices] ?? tx.transactionServices.replace(/_/g, ' ')}
                      </td>

                      <td>
                        {tx.user ? (
                          <div>
                            <span className="block text-foreground">{tx.user.fullname || 'Rider'}</span>
                            <span className="tabular text-xs text-muted">{tx.user.phone || tx.user.email || tx.user.id}</span>
                          </div>
                        ) : tx.driver ? (
                          <div>
                            <span className="block text-foreground">
                              {tx.driver.firstname} {tx.driver.lastname}
                            </span>
                            <span className="tabular text-xs text-muted">Driver · {tx.driver.phone || tx.driver.email}</span>
                          </div>
                        ) : tx.accountName ? (
                          <div>
                            <span className="block text-foreground">{tx.accountName}</span>
                            <span className="text-xs text-muted">{tx.bankName || 'Bank payout'}</span>
                          </div>
                        ) : (
                          <span className="text-muted">Platform</span>
                        )}
                      </td>

                      <td className="tabular whitespace-nowrap text-right font-medium">
                        <span className={tx.transactionType === 'credit' ? 'text-success' : 'text-foreground'}>
                          {tx.transactionType === 'credit' ? '+' : '−'}
                          {formatNaira(tx.amountKobo)}
                        </span>
                      </td>

                      <td className="tabular whitespace-nowrap text-right text-muted">{formatNaira(tx.chargesKobo)}</td>

                      <td className="capitalize text-muted">{tx.gateway?.toLowerCase()}</td>

                      <td>{renderStatusBadge(tx.status)}</td>

                      <td className="tabular whitespace-nowrap text-muted">
                        {new Date(tx.createdAt).toLocaleDateString('en-NG', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <TablePagination
            page={page}
            totalPages={totalPages}
            summary={`${total.toLocaleString()} transactions`}
            onChange={setPage}
          />
        </DashboardCard>
      </Page>
    </PermissionGuard>
  );
}
