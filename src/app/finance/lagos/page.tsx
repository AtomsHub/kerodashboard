'use client';

// src/app/finance/lagos/page.tsx
// Lagos road tax: balance, ledger and settlement accounts (read-only for
// everyone with access). Remitting needs "Request withdrawal"; adding or
// removing an account needs "Manage settlement account".

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Buildings,
  ArrowClockwise,
  ShieldCheck,
  CurrencyNgn,
  PaperPlaneTilt,
  Receipt,
  Copy,
  Check,
  CaretLeft,
  CaretRight,
  Path,
  LockKey,
  ArrowLeft,
  Plus,
} from '@phosphor-icons/react';
import Link from 'next/link';
import { Chip, Modal, Alert, Skeleton } from '@heroui/react';
import { AppButton } from '@/components/ui/app-button';
import { AppInput } from '@/components/ui/app-input';
import { AppTextarea } from '@/components/ui/app-textarea';
import { AppSelect } from '@/components/ui/app-select';
import { AppRowActions } from '@/components/ui/app-row-actions';
import { DashboardCard, StatDashboardCard } from '@/components/ui/dashboard-card';
import { EmptyState, Page, PageHeader, Segmented, StatusPill, TablePagination } from '@/components/ui/page';
import { PermissionGuard, Can } from '@/components/auth/can';
import { api } from '@/lib/api';
import { applyApiFormError } from '@/lib/errors';
import { LagosAccountsTable, LagosAddAccountModal } from '@/components/payments/lagos-accounts-card';
import { formatKoboToNaira } from '@/lib/utils';
import {
  LagosWalletResponse,
  LagosSettlementAccount,
  LagosWithdrawalItem,
  LagosTransactionItem,
} from '@/types/admin';
import {
  confirmLagosWithdrawalOtpSchema,
  type ConfirmLagosWithdrawalOtpInput,
} from '@/lib/schemas/admin.schemas';

const PAGE_SIZE = 15;

export default function LagosRevenuePage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<'ledger' | 'accounts'>('ledger');
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [confirmingWithdrawalId, setConfirmingWithdrawalId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form Alerts
  const [withdrawAlert, setWithdrawAlert] = useState<string | null>(null);
  const [withdrawOtpAlert, setWithdrawOtpAlert] = useState<string | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // ── Query: Lagos Escrow Wallet Balance ──────────────────────────────
  const {
    data: walletData,
    isLoading: isWalletLoading,
    refetch: refetchWallet,
    isFetching: isWalletFetching,
  } = useQuery<LagosWalletResponse>({
    queryKey: ['admin', 'lagos', 'wallet'],
    queryFn: async () => {
      const res = await api.get<{ data: LagosWalletResponse }>('/payments/admin/lagos/wallet');
      return (
        res.data?.data ?? {
          balanceKobo: 0,
          totalCollectedKobo: 0,
          pendingWithdrawalsKobo: 0,
          activeAccountsCount: 0,
          lastRemittanceAt: null,
        }
      );
    },
  });

  // ── Query: Paginated Lagos Transactions (Trip Levies & Remittances) ──
  const {
    data: txData,
    isLoading: isTxLoading,
    refetch: refetchTx,
    isFetching: isTxFetching,
  } = useQuery<{
    transactions: LagosTransactionItem[];
    pagination: { page: number; limit: number; total: number; pages: number };
  }>({
    queryKey: ['admin', 'lagos', 'transactions', page],
    queryFn: async () => {
      const res = await api.get<{
        data: {
          transactions: LagosTransactionItem[];
          pagination: { page: number; limit: number; total: number; pages: number };
        };
      }>(`/payments/admin/lagos/transactions?page=${page}&limit=${PAGE_SIZE}`);
      return (
        res.data?.data ?? {
          transactions: [],
          pagination: { page: 1, limit: PAGE_SIZE, total: 0, pages: 1 },
        }
      );
    },
  });

  // ── Query: Settlement Accounts (for remittance destination) ───────────
  const { data: accountsData, isLoading: isAccountsLoading } = useQuery<{ accounts: LagosSettlementAccount[] }>({
    queryKey: ['admin', 'lagos', 'accounts'],
    queryFn: async () => {
      const res = await api.get<{
        data: LagosSettlementAccount[] | { accounts: LagosSettlementAccount[] };
      }>('/payments/admin/lagos/settlement-accounts');
      const payload = res.data?.data;
      if (Array.isArray(payload)) return { accounts: payload };
      return (payload as any) ?? { accounts: [] };
    },
  });

  const transactions = txData?.transactions ?? [];
  const pagination = txData?.pagination ?? { page: 1, limit: PAGE_SIZE, total: 0, pages: 1 };
  const allAccounts = accountsData?.accounts ?? [];
  // Only verified accounts can receive a remittance.
  const accounts = allAccounts.filter((a) => a.isVerified);
  const balanceKobo = walletData?.balanceKobo ?? 0;
  const totalCollectedKobo = walletData?.totalCollectedKobo ?? 0;
  const pendingKobo = walletData?.pendingWithdrawalsKobo ?? 0;

  // ── Form: Request Remittance Withdrawal ─────────────────────────────
  const withdrawForm = useForm<{ amountNaira: number; settlementAccountId: string; notes?: string }>({
    defaultValues: { amountNaira: 0, settlementAccountId: '', notes: '' },
  });

  const withdrawMutation = useMutation({
    mutationFn: async (payload: {
      amountNaira: number;
      settlementAccountId: string;
      notes?: string;
    }) => {
      const res = await api.post('/payments/admin/lagos/withdrawals', {
        amountKobo: Math.round(payload.amountNaira * 100),
        settlementAccountId: payload.settlementAccountId,
        notes: payload.notes,
      }, { silent: true });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'lagos'] });
      setIsWithdrawModalOpen(false);
      withdrawForm.reset();
      setWithdrawAlert(null);
      if (data?.data?.id) {
        setConfirmingWithdrawalId(data.data.id);
      }
    },
    onError: (err) => {
      applyApiFormError(err, {
        setFormError: setWithdrawAlert,
      });
    },
  });

  // ── Form: Confirm Remittance OTP ────────────────────────────────────
  const confirmWithdrawOtpForm = useForm<ConfirmLagosWithdrawalOtpInput>({
    resolver: zodResolver(confirmLagosWithdrawalOtpSchema),
    defaultValues: { otp: '' },
  });

  const confirmWithdrawOtpMutation = useMutation({
    mutationFn: async (payload: ConfirmLagosWithdrawalOtpInput) => {
      if (!confirmingWithdrawalId) return;
      const res = await api.post(
        `/payments/admin/lagos/withdrawals/${confirmingWithdrawalId}/confirm`,
        payload,
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'lagos'] });
      setConfirmingWithdrawalId(null);
      confirmWithdrawOtpForm.reset();
      setWithdrawOtpAlert(null);
    },
    onError: (err) => {
      applyApiFormError(err, {
        setError: confirmWithdrawOtpForm.setError,
        setFormError: setWithdrawOtpAlert,
      });
    },
  });

  const openWithdraw = () => {
    // Start with the full balance and the first verified account.
    withdrawForm.reset({ amountNaira: Math.floor(balanceKobo / 100), settlementAccountId: accounts[0]?.id ?? '', notes: '' });
    setWithdrawAlert(null);
    setIsWithdrawModalOpen(true);
  };

  /** Plain-language checks before asking the server. */
  const submitWithdraw = (values: { amountNaira: number; settlementAccountId: string; notes?: string }) => {
    const amountKobo = Math.round((values.amountNaira || 0) * 100);
    const settlementAccountId = values.settlementAccountId || accounts[0]?.id || '';
    if (!settlementAccountId) return setWithdrawAlert('Add and verify a Lagos State account first.');
    if (amountKobo <= 0) return setWithdrawAlert('Enter the amount to remit.');
    if (amountKobo > balanceKobo) return setWithdrawAlert(`Only ${formatKoboToNaira(balanceKobo)} is available. Enter that amount or less.`);
    setWithdrawAlert(null);
    withdrawMutation.mutate({ ...values, settlementAccountId });
  };

  const handleRefresh = () => {
    refetchWallet();
    refetchTx();
  };

  return (
    <PermissionGuard permission="lagos_view_wallet">
      <Page>
        <PageHeader
          back={
            <Link href="/finance" className="inline-flex items-center gap-1 hover:text-foreground">
              <ArrowLeft size={14} /> Finance
            </Link>
          }
          title="Lagos road tax"
          description="₦50 per trip, held and remitted to Lagos State."
          actions={
            <>
              <AppButton
                variant="tertiary"
                isIconOnly
                aria-label="Refresh"
                onPress={handleRefresh}
                isDisabled={isWalletFetching || isTxFetching}
                startContent={<ArrowClockwise className={isWalletFetching || isTxFetching ? 'animate-spin' : ''} />}
              />
              <Can permission="lagos_manage_settlement_account">
                <AppButton variant="tertiary" startContent={<Plus />} label="Add account" onPress={() => setAddAccountOpen(true)} />
              </Can>
              <Can permission="lagos_request_withdrawal">
                <AppButton
                  variant="brand"
                  onPress={openWithdraw}
                  isDisabled={balanceKobo <= 0}
                  startContent={<PaperPlaneTilt />}
                  label="Remit"
                />
              </Can>
            </>
          }
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <StatDashboardCard
            label="Balance held"
            value={formatKoboToNaira(balanceKobo)}
            icon={ShieldCheck}
            variant="wallet"
            hint="Awaiting remittance"
            loading={isWalletLoading}
          />
          <StatDashboardCard
            label="Collected to date"
            value={formatKoboToNaira(totalCollectedKobo)}
            icon={CurrencyNgn}
            hint="All-time road tax"
            loading={isWalletLoading}
          />
          <StatDashboardCard
            label="Pending transfers"
            value={formatKoboToNaira(pendingKobo)}
            icon={PaperPlaneTilt}
            hint="Waiting for OTP sign-off"
            loading={isWalletLoading}
          />
          <StatDashboardCard label="Levy per trip" value="₦50.00" icon={Receipt} hint="Flat statutory fee" />
        </div>

        <LagosAddAccountModal isOpen={addAccountOpen} onOpenChange={setAddAccountOpen} />

        <DashboardCard className="overflow-hidden p-0">
          <div className="p-6 pb-4">
            <Segmented
              size="sm"
              aria-label="Lagos"
              value={tab}
              onChange={setTab}
              options={[
                { key: 'ledger', label: 'Ledger', count: pagination.total },
                { key: 'accounts', label: 'Settlement accounts', count: allAccounts.length },
              ]}
            />
          </div>

          {tab === 'accounts' ? (
            <LagosAccountsTable accounts={allAccounts} isLoading={isAccountsLoading} />
          ) : (
          <>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Transaction</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Balance after</th>
                  <th>Note</th>
                  <th>Date</th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody>
                {isTxLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={7}>
                        <Skeleton className="h-6 w-full rounded-lg" />
                      </td>
                    </tr>
                  ))
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState icon={Receipt} title="No entries yet" description="Road tax appears here as trips complete." />
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => {
                    const isCredit = tx.amountKobo >= 0;
                    return (
                      <tr key={tx.id}>
                        <td>
                          <div className="flex items-center gap-1.5">
                            <span className="tabular font-medium text-foreground">{tx.id.slice(0, 10)}</span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(tx.tripId || tx.id)}
                              className="cursor-pointer text-muted hover:text-foreground"
                              title="Copy ID"
                            >
                              {copiedId === (tx.tripId || tx.id) ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                            </button>
                          </div>
                          {tx.tripId && <span className="tabular text-xs text-muted">Trip {tx.tripId.slice(0, 8)}</span>}
                        </td>

                        <td>
                          <StatusPill
                            tone={tx.type === 'TRIP_COMMISSION' ? 'success' : tx.type === 'WITHDRAWAL' ? 'brand' : 'neutral'}
                          >
                            {tx.type === 'TRIP_COMMISSION' ? 'Road tax' : tx.type === 'WITHDRAWAL' ? 'Remittance' : tx.type}
                          </StatusPill>
                        </td>

                        <td className="tabular whitespace-nowrap font-medium">
                          <span className={isCredit ? 'text-success' : 'text-foreground'}>
                            {isCredit ? '+' : '−'}
                            {formatKoboToNaira(Math.abs(tx.amountKobo))}
                          </span>
                        </td>

                        <td className="tabular whitespace-nowrap text-muted">{formatKoboToNaira(tx.balanceAfterKobo)}</td>

                        <td className="max-w-[240px] truncate text-muted">{tx.description || 'Road tax per trip'}</td>

                        <td className="tabular whitespace-nowrap text-muted">
                          {new Date(tx.createdAt).toLocaleDateString('en-NG', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>

                        <td className="text-right">
                          <AppRowActions
                            items={[
                              {
                                key: 'copy-id',
                                label: 'Copy ID',
                                icon: <Copy size={14} />,
                                onClick: () => copyToClipboard(tx.id),
                              },
                              ...(tx.tripId
                                ? [
                                    {
                                      key: 'view-trip',
                                      label: 'View trip',
                                      icon: <Path size={14} />,
                                      href: `/trips/${tx.tripId}`,
                                    },
                                  ]
                                : []),
                            ]}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <TablePagination
            page={page}
            totalPages={pagination.pages}
            summary={`${pagination.total} entries`}
            onChange={setPage}
          />
          </>
          )}
        </DashboardCard>

        {/* Modal: Request Remittance Withdrawal */}
        <Modal
          isOpen={isWithdrawModalOpen}
          onOpenChange={(isOpen) => {
            setIsWithdrawModalOpen(isOpen);
            if (!isOpen) setWithdrawAlert(null);
          }}
        >
          <Modal.Backdrop variant="blur">
            <Modal.Container placement="center" size="md">
              <Modal.Dialog className="rounded-3xl bg-overlay p-7">
                <div className="flex items-center gap-3 pb-4">
                  <div className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand">
                    <PaperPlaneTilt size={20} weight="duotone" />
                  </div>
                  <div>
                    <h3 className="text-[18px] font-bold tracking-[-0.02em] text-foreground">Remit to Lagos State</h3>
                    <p className="mt-1 text-[13px] text-muted">A code is emailed before the money is sent.</p>
                  </div>
                </div>

                {withdrawAlert && (
                  <Alert status="danger" className="mt-4 rounded-xl text-xs">
                    <Alert.Indicator />
                    <Alert.Content>
                      <Alert.Title>{withdrawAlert}</Alert.Title>
                    </Alert.Content>
                  </Alert>
                )}

                <form
                  onSubmit={withdrawForm.handleSubmit(submitWithdraw)}
                  className="mt-4 space-y-4"
                >
                  <AppInput
                    label="Amount (₦)"
                    type="number"
                    min="1"
                    value={String(withdrawForm.watch('amountNaira'))}
                    onChange={(e) =>
                      withdrawForm.setValue('amountNaira', Number(e.target.value))
                    }
                    description={`Available: ${formatKoboToNaira(balanceKobo)}`}
                  />

                  {accounts.length > 0 ? (
                    <AppSelect
                      label="Send to"
                      options={accounts.map((acc) => ({
                        key: acc.id,
                        label: `${acc.bankName} - ${acc.accountNumber}`,
                        description: acc.accountName,
                      }))}
                      selectedKey={withdrawForm.watch('settlementAccountId') || accounts[0]?.id}
                      onSelectionChange={(key) =>
                        withdrawForm.setValue('settlementAccountId', key)
                      }
                    />
                  ) : (
                    <p className="mt-1 text-[13px] text-muted">No verified account yet. Add one under Settlement accounts.</p>
                  )}

                  <AppTextarea
                    label="Note"
                    placeholder="e.g. October remittance"
                    value={withdrawForm.watch('notes')}
                    onChange={(e) => withdrawForm.setValue('notes', e.target.value)}
                  />

                  <div className="flex justify-end gap-2 pt-2">
                    <AppButton
                      variant="tertiary"
                      size="sm"
                      label="Cancel"
                      onPress={() => setIsWithdrawModalOpen(false)}
                    />
                    <AppButton
                      variant="brand"
                      size="sm"
                      type="submit"
                      isLoading={withdrawMutation.isPending}
                      label="Send code"
                    />
                  </div>
                </form>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </Modal>

        {/* Modal: Confirm Remittance OTP */}
        <Modal
          isOpen={Boolean(confirmingWithdrawalId)}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setConfirmingWithdrawalId(null);
              setWithdrawOtpAlert(null);
            }
          }}
        >
          <Modal.Backdrop variant="blur">
            <Modal.Container placement="center" size="sm">
              <Modal.Dialog className="rounded-3xl bg-overlay p-7">
                <div className="flex items-center gap-3 pb-4">
                  <div className="grid size-10 place-items-center rounded-xl bg-warning-soft text-warning">
                    <LockKey size={20} weight="duotone" />
                  </div>
                  <div>
                    <h3 className="text-[18px] font-bold tracking-[-0.02em] text-foreground">Enter the code</h3>
                    <p className="mt-1 text-[13px] text-muted">We emailed a 6-digit code to the Lagos verification email.</p>
                  </div>
                </div>

                {withdrawOtpAlert && (
                  <Alert status="danger" className="mt-4 rounded-xl text-xs">
                    <Alert.Indicator />
                    <Alert.Content>
                      <Alert.Title>{withdrawOtpAlert}</Alert.Title>
                    </Alert.Content>
                  </Alert>
                )}

                <form
                  onSubmit={confirmWithdrawOtpForm.handleSubmit((values) =>
                    confirmWithdrawOtpMutation.mutate(values),
                  )}
                  className="mt-4 space-y-4"
                >
                  <AppInput
                    label="Code"
                    placeholder="123456"
                    value={confirmWithdrawOtpForm.watch('otp')}
                    onChange={(e) => confirmWithdrawOtpForm.setValue('otp', e.target.value)}
                  />

                  <div className="flex justify-end gap-2 pt-2">
                    <AppButton
                      variant="tertiary"
                      size="sm"
                      label="Cancel"
                      onPress={() => setConfirmingWithdrawalId(null)}
                    />
                    <AppButton
                      variant="brand"
                      size="sm"
                      type="submit"
                      isLoading={confirmWithdrawOtpMutation.isPending}
                      label="Confirm and send"
                    />
                  </div>
                </form>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </Modal>
      </Page>
    </PermissionGuard>
  );
}
