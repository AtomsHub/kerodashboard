'use client';

// src/app/account/page.tsx
// My account: open to every signed-in admin, whatever their role.
// Shows who you are and lets you change your password. A change needs your
// current password and a 6-digit code emailed to you, then signs you out.

import React, { useState } from 'react';
import { Alert } from '@heroui/react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { applyApiFormError } from '@/lib/errors';
import { useAuthStore } from '@/stores/auth-store';
import { AppInput } from '@/components/ui/app-input';
import { AppButton } from '@/components/ui/app-button';
import { DashboardCard } from '@/components/ui/dashboard-card';
import { UserAvatar } from '@/components/ui/user-avatar';
import { DetailList, Page, PageHeader, SectionHeader, StatusPill } from '@/components/ui/page';

const formatDateTime = (v?: string | null) =>
  v
    ? new Date(v).toLocaleString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '—';

function ChangePasswordForm() {
  const email = useAuthStore((s) => s.admin?.email);
  const logout = useAuthStore((s) => s.logout);
  const [step, setStep] = useState<1 | 2>(1);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sendCode = async () => {
    setFormError(null);
    setBusy(true);
    try {
      await api.post('/auth/admin/change-password/otp', {}, { silent: true });
      setStep(2);
      setCode('');
      toast.success(`Code sent to ${email ?? 'your email'}`);
    } catch (err) {
      applyApiFormError(err, { setFormError, fallbackMessage: 'Couldn’t send the code' });
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (step === 1) {
      const next: typeof errors = {};
      if (!currentPassword) next.currentPassword = 'Enter your current password';
      if (newPassword.length < 8) next.newPassword = 'Use at least 8 characters';
      else if (newPassword === currentPassword) next.newPassword = 'Choose a different password';
      if (confirmPassword !== newPassword) next.confirmPassword = 'Passwords don’t match';
      setErrors(next);
      if (Object.keys(next).length === 0) await sendCode();
      return;
    }

    if (!/^\d{6}$/.test(code)) {
      setErrors({ otp: 'Enter the 6-digit code' });
      return;
    }
    setFormError(null);
    setBusy(true);
    try {
      await api.put('/auth/admin/change-password', { currentPassword, newPassword, otp: code }, { silent: true });
      toast.success('Password changed. Sign in with your new password.');
      await logout();
    } catch (err) {
      const apiError = applyApiFormError(err, {
        setFormError,
        setError: (field, error) => setErrors((s) => ({ ...s, [field]: error.message })),
        fields: ['otp', 'currentPassword', 'newPassword'],
        fallbackMessage: 'Couldn’t change your password',
      });
      // A wrong current password or weak new one is fixed on step 1.
      const onFirstStep = apiError.fields.some((f) => ['currentPassword', 'newPassword'].includes(String(f.path?.[0])));
      if (onFirstStep || /current password/i.test(apiError.message)) setStep(1);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4">
      {formError && (
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{formError}</Alert.Title>
          </Alert.Content>
        </Alert>
      )}

      {step === 1 ? (
        <>
          <AppInput
            label="Current password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            errorMessage={errors.currentPassword}
          />
          <AppInput
            label="New password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            errorMessage={errors.newPassword}
          />
          <AppInput
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            errorMessage={errors.confirmPassword}
          />
          <div>
            <AppButton variant="brand" type="submit" isLoading={busy} label="Send code" />
          </div>
        </>
      ) : (
        <>
          <p className="text-[13px] text-muted">
            Enter the 6-digit code we sent to <span className="text-foreground">{email}</span>.
          </p>
          <AppInput
            label="Verification code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            errorMessage={errors.otp}
          />
          <div className="flex flex-wrap items-center gap-2">
            <AppButton variant="brand" type="submit" isLoading={busy} label="Change password" />
            <AppButton variant="tertiary" label="Back" onPress={() => setStep(1)} isDisabled={busy} />
            <button
              type="button"
              disabled={busy}
              onClick={sendCode}
              className="ml-auto cursor-pointer text-[13px] font-medium text-secondary hover:underline disabled:opacity-50"
            >
              Resend code
            </button>
          </div>
        </>
      )}
    </form>
  );
}

export default function AccountPage() {
  const admin = useAuthStore((s) => s.admin);

  return (
    <Page>
      <PageHeader title="My account" description="Your profile and sign-in security." />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <DashboardCard className="xl:col-span-1">
          <div className="flex items-center gap-3">
            <UserAvatar name={admin?.fullname ?? 'Admin'} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-[16px] font-bold text-foreground">{admin?.fullname ?? '—'}</p>
              <p className="truncate text-[13px] text-muted">{admin?.email ?? '—'}</p>
            </div>
          </div>
          <DetailList
            className="mt-6"
            items={[
              {
                label: 'Role',
                value: admin?.isSuperAdmin ? <StatusPill tone="accent">Super admin</StatusPill> : admin?.roleLabel ?? '—',
              },
              { label: 'Permissions', value: admin?.isSuperAdmin ? 'All' : String(admin?.permissions?.length ?? 0) },
              { label: 'Last sign-in', value: formatDateTime(admin?.lastLoginAt) },
            ]}
          />
        </DashboardCard>

        <DashboardCard className="xl:col-span-2">
          <SectionHeader
            title="Change password"
            description="We’ll email you a code to confirm it’s you. You’ll be signed out everywhere after."
            className="mb-5"
          />
          <ChangePasswordForm />
        </DashboardCard>
      </div>
    </Page>
  );
}
