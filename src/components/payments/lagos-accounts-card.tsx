'use client';

// src/components/payments/lagos-accounts-card.tsx
// Lagos settlement accounts. Viewers see the accounts; adding, verifying and
// removing one needs "Manage settlement account"; the email that receives
// every Lagos verification code needs "Manage Lagos settings".
//
// Adding an account: pick the bank (Paystack bank list) → account number →
// Verify (the bank's name for the account is shown) → Send code → enter the
// code emailed to the verification address.

import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bank } from '@phosphor-icons/react';
import { AppButton } from '@/components/ui/app-button';
import { AppInput } from '@/components/ui/app-input';
import { AppModal } from '@/components/ui/app-modal';
import { AppRowActions } from '@/components/ui/app-row-actions';
import { AppSelect } from '@/components/ui/app-select';
import { EmptyState, StatusPill } from '@/components/ui/page';
import { Can, usePermission } from '@/components/auth/can';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/payments';
import type { LagosSettlementAccount } from '@/types/admin';

interface LagosSettings {
  otpEmail: string;
}

/** Modal steps: account details → enter the emailed code. */
export function LagosAddAccountModal({ isOpen, onOpenChange }: { isOpen: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [resolvedName, setResolvedName] = useState<string | null>(null);
  const [verifyId, setVerifyId] = useState<string | null>(null);
  const [otp, setOtp] = useState('');

  const banks = useQuery<Array<{ name: string; code: string }>>({
    queryKey: ['admin', 'banks'],
    queryFn: async () => (await api.get<{ data: { banks: Array<{ name: string; code: string }> } }>('/payments/banks')).data.data.banks,
    enabled: isOpen,
    staleTime: 60 * 60_000,
  });
  const bankOptions = useMemo(() => (banks.data ?? []).map((b) => ({ key: b.code, label: b.name })), [banks.data]);
  const bankName = bankOptions.find((b) => b.key === bankCode)?.label ?? '';

  const reset = () => {
    setBankCode('');
    setAccountNumber('');
    setResolvedName(null);
    setOtp('');
  };
  const close = () => {
    reset();
    setVerifyId(null);
    onOpenChange(false);
  };

  const resolve = useMutation({
    mutationFn: async () =>
      (await api.post<{ data: { accountName: string } }>('/payments/admin/lagos/settlement-accounts/resolve', { bankCode, accountNumber }, { silent: true })).data.data,
    onSuccess: (r) => setResolvedName(r.accountName),
    onError: (err) => toast.error(errorMessage(err, 'We could not find that account')),
  });

  const add = useMutation({
    mutationFn: async () =>
      (await api.post<{ data: { id: string } }>('/payments/admin/lagos/settlement-accounts', { bankName, bankCode, accountNumber }, { silent: true })).data.data,
    onSuccess: (account) => {
      setVerifyId(account.id);
      queryClient.invalidateQueries({ queryKey: ['admin', 'lagos'] });
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not add the account')),
  });

  const verify = useMutation({
    mutationFn: async () => api.post(`/payments/admin/lagos/settlement-accounts/${verifyId}/verify`, { otp }, { silent: true }),
    onSuccess: () => {
      toast.success('Account verified');
      queryClient.invalidateQueries({ queryKey: ['admin', 'lagos'] });
      close();
    },
    onError: (err) => toast.error(errorMessage(err, 'That code did not work')),
  });

  return (
    <>
      <AppModal
        isOpen={isOpen && !verifyId}
        onOpenChange={(o) => !o && close()}
        size="sm"
        title="Add settlement account"
        footer={
          <>
            <AppButton variant="tertiary" label="Cancel" onPress={close} />
            {resolvedName ? (
              <AppButton variant="brand" label="Send code" isLoading={add.isPending} onPress={() => add.mutate()} />
            ) : (
              <AppButton
                variant="brand"
                label="Verify"
                isDisabled={!bankCode || !/^\d{10}$/.test(accountNumber)}
                isLoading={resolve.isPending}
                onPress={() => resolve.mutate()}
              />
            )}
          </>
        }
      >
        <AppSelect
          label="Bank"
          placeholder={banks.isLoading ? 'Loading banks…' : 'Choose the bank'}
          selectedKey={bankCode || undefined}
          onSelectionChange={(v) => {
            setBankCode(v);
            setResolvedName(null);
          }}
          options={bankOptions}
        />
        <AppInput
          label="Account number"
          inputMode="numeric"
          maxLength={10}
          value={accountNumber}
          onChange={(e) => {
            setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 10));
            setResolvedName(null);
          }}
        />
        {resolvedName && (
          <div className="rounded-2xl bg-success-soft/50 px-4 py-3">
            <p className="text-[12px] text-muted">Account name</p>
            <p className="text-[14px] font-semibold text-foreground">{resolvedName}</p>
          </div>
        )}
      </AppModal>

      <AppModal
        isOpen={Boolean(verifyId)}
        onOpenChange={(o) => !o && close()}
        size="sm"
        title="Enter the code"
        description="We emailed a 6-digit code to the Lagos verification email."
        footer={
          <>
            <AppButton variant="tertiary" label="Later" onPress={close} />
            <AppButton variant="brand" label="Verify account" isDisabled={!/^\d{6}$/.test(otp)} isLoading={verify.isPending} onPress={() => verify.mutate()} />
          </>
        }
      >
        <AppInput label="Code" inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} />
      </AppModal>
    </>
  );
}

/** Accounts table plus the verification email (inside the Lagos page tab). */
export function LagosAccountsTable({ accounts, isLoading }: { accounts: LagosSettlementAccount[]; isLoading: boolean }) {
  const queryClient = useQueryClient();
  const canManage = usePermission('lagos_manage_settlement_account');
  const [verifyId, setVerifyId] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [removeTarget, setRemoveTarget] = useState<LagosSettlementAccount | null>(null);
  const [emailEdit, setEmailEdit] = useState<string | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin', 'lagos'] });

  const settings = useQuery<LagosSettings>({
    queryKey: ['admin', 'lagos', 'settings'],
    queryFn: async () => (await api.get<{ data: LagosSettings }>('/payments/admin/lagos/settings')).data.data,
  });

  const verify = useMutation({
    mutationFn: async () => api.post(`/payments/admin/lagos/settlement-accounts/${verifyId}/verify`, { otp }, { silent: true }),
    onSuccess: () => {
      toast.success('Account verified');
      setVerifyId(null);
      refresh();
    },
    onError: (err) => toast.error(errorMessage(err, 'That code did not work')),
  });
  const resend = useMutation({
    mutationFn: async (id: string) => api.post(`/payments/admin/lagos/settlement-accounts/${id}/resend-otp`, undefined, { silent: true }),
    onSuccess: () => toast.success('New code sent'),
    onError: (err) => toast.error(errorMessage(err, 'Could not send a new code')),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/payments/admin/lagos/settlement-accounts/${id}`, { silent: true }),
    onSuccess: () => {
      toast.success('Account removed');
      setRemoveTarget(null);
      refresh();
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not remove the account')),
  });
  const saveEmail = useMutation({
    mutationFn: async () => api.put('/payments/admin/lagos/settings', { otpEmail: emailEdit }, { silent: true }),
    onSuccess: () => {
      toast.success('Verification email saved');
      setEmailEdit(null);
      refresh();
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not save')),
  });

  return (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-3.5">
        <div className="min-w-0">
          <p className="text-[12.5px] text-muted">Verification codes are sent to</p>
          <p className="truncate text-[14px] font-medium text-foreground">{settings.data?.otpEmail || 'Not set'}</p>
        </div>
        <Can permission="lagos_manage_settings">
          <AppButton size="sm" variant="tertiary" label="Edit" isDisabled={!settings.data} onPress={() => setEmailEdit(settings.data?.otpEmail ?? '')} />
        </Can>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Bank</th>
              <th>Account name</th>
              <th>Status</th>
              <th className="w-12" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={4}>
                  <div className="h-12 animate-pulse rounded-2xl bg-surface-secondary" />
                </td>
              </tr>
            ) : accounts.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  <EmptyState icon={Bank} title="No account yet" description="Remittances need a verified Lagos State account." />
                </td>
              </tr>
            ) : (
              accounts.map((a) => (
                <tr key={a.id}>
                  <td>
                    <p className="text-foreground">{a.bankName}</p>
                    <p className="tabular text-xs text-muted">{a.accountNumber}</p>
                  </td>
                  <td className="text-muted">{a.accountName}</td>
                  <td>
                    <StatusPill tone={a.isVerified ? 'success' : 'warning'}>{a.isVerified ? 'Verified' : 'Needs code'}</StatusPill>
                  </td>
                  <td className="text-right">
                    {canManage && (
                      <AppRowActions
                        items={[
                          ...(!a.isVerified
                            ? [
                                { key: 'verify', label: 'Enter code', onClick: () => { setOtp(''); setVerifyId(a.id); } },
                                { key: 'resend', label: 'Send new code', onClick: () => resend.mutate(a.id) },
                              ]
                            : []),
                          { key: 'remove', label: 'Remove', danger: true, onClick: () => setRemoveTarget(a) },
                        ]}
                      />
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AppModal
        isOpen={Boolean(verifyId)}
        onOpenChange={(o) => !o && setVerifyId(null)}
        size="sm"
        title="Enter the code"
        description="We emailed a 6-digit code to the Lagos verification email."
        footer={
          <>
            <AppButton variant="tertiary" label="Later" onPress={() => setVerifyId(null)} />
            <AppButton variant="brand" label="Verify account" isDisabled={!/^\d{6}$/.test(otp)} isLoading={verify.isPending} onPress={() => verify.mutate()} />
          </>
        }
      >
        <AppInput label="Code" inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} />
      </AppModal>

      <AppModal
        isOpen={emailEdit !== null}
        onOpenChange={(o) => !o && setEmailEdit(null)}
        size="sm"
        title="Verification email"
        description="Every Lagos code (new accounts and remittances) is sent here."
        footer={
          <>
            <AppButton variant="tertiary" label="Cancel" onPress={() => setEmailEdit(null)} />
            <AppButton variant="brand" label="Save" isDisabled={!emailEdit?.includes('@')} isLoading={saveEmail.isPending} onPress={() => saveEmail.mutate()} />
          </>
        }
      >
        <AppInput label="Email" type="email" value={emailEdit ?? ''} onChange={(e) => setEmailEdit(e.target.value)} />
      </AppModal>

      <AppModal
        isOpen={Boolean(removeTarget)}
        onOpenChange={(o) => !o && setRemoveTarget(null)}
        size="sm"
        title="Remove this account?"
        description={removeTarget ? `${removeTarget.bankName} · ${removeTarget.accountName}` : undefined}
        footer={
          <>
            <AppButton variant="tertiary" label="Cancel" onPress={() => setRemoveTarget(null)} />
            <AppButton variant="danger" label="Remove" isLoading={remove.isPending} onPress={() => removeTarget && remove.mutate(removeTarget.id)} />
          </>
        }
      />
    </>
  );
}
