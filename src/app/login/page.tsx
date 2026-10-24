'use client';

// src/app/login/page.tsx
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { EnvelopeSimple, LockKey, ArrowRight, ShieldCheck, Password } from '@phosphor-icons/react';
import { Card, Alert } from '@heroui/react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { applyApiFormError } from '@/lib/errors';
import { AppButton } from '@/components/ui/app-button';
import { AppInput } from '@/components/ui/app-input';
import { AdminUser, ALL_PERMISSIONS } from '@/types/admin';

/** Staff on a temporary password must set their own before they get a session. */
interface PasswordSetup {
  setupToken: string;
  email: string;
}

export default function LoginPage() {
  const router = useRouter();
  const { setAuth, setAccessToken } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | undefined>(undefined);
  const [passwordError, setPasswordError] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);

  const [setup, setSetup] = useState<PasswordSetup | null>(null);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [setupErrors, setSetupErrors] = useState<{ otp?: string; newPassword?: string; confirm?: string }>({});
  const [isResending, setIsResending] = useState(false);

  type RawAdmin = { id?: string; fullname?: string; email?: string; role?: string; isSuperAdmin?: boolean; permissions?: string[]; adminRole?: { id?: string; name?: string } };
  const finishSignIn = async (token: string, rawUser: RawAdmin | undefined) => {
    // Set token first so subsequent API calls include Bearer header
    setAccessToken(token);

    const isSuperAdmin = rawUser?.role === 'SUPER_ADMIN' || rawUser?.isSuperAdmin === true;
    const initialAdmin: AdminUser = {
      id: rawUser?.id || '',
      fullname: rawUser?.fullname || email.split('@')[0],
      email: rawUser?.email || email,
      isSuperAdmin,
      roleLabel: isSuperAdmin ? 'Super Admin' : (rawUser?.adminRole?.name || 'Admin'),
      roleId: rawUser?.adminRole?.id || null,
      isActive: true,
      lastLoginAt: new Date().toISOString(),
      permissions: isSuperAdmin ? (ALL_PERMISSIONS as any) : (rawUser?.permissions || []),
    };

    let resolvedAdmin = initialAdmin;

    // Augment with fresh /auth/admin/me profile
    try {
      const meRes = await api.get('/auth/admin/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (meRes.data?.success && meRes.data?.data) {
        const meData = meRes.data.data;
        resolvedAdmin = {
          ...initialAdmin,
          ...meData,
          isSuperAdmin: Boolean(meData.isSuperAdmin ?? initialAdmin.isSuperAdmin),
          roleLabel: meData.roleLabel ?? initialAdmin.roleLabel,
          permissions: isSuperAdmin ? (ALL_PERMISSIONS as any) : (meData.permissions ?? initialAdmin.permissions),
        };
      }
    } catch {
      // If /me call has a momentary delay, fall back to initialAdmin
    }

    setAuth({ admin: resolvedAdmin, accessToken: token });
    router.push('/');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setEmailError(undefined);
    setPasswordError(undefined);

    if (!email) {
      setEmailError('Please enter your work email');
      return;
    }
    if (!password) {
      setPasswordError('Please enter your password');
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.post('/auth/admin/login', { email, password }, { silent: true });
      const data = res.data?.data;
      if (res.data?.success && data?.passwordChangeRequired) {
        setSetup({ setupToken: data.setupToken, email: data.email });
        setCode('');
        setNewPassword('');
        setConfirmPassword('');
        setSetupErrors({});
        return;
      }
      if (res.data?.success && data) {
        await finishSignIn(data.accessToken, data.user);
      }
    } catch (err: unknown) {
      applyApiFormError(err, {
        setFormError,
        setError: (field, error) => {
          if (field === 'email') setEmailError(error.message);
          if (field === 'password') setPasswordError(error.message);
        },
        fields: ['email', 'password'],
        fallbackMessage: 'Invalid credentials or inactive account',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setup) return;
    setFormError(null);
    const errors: typeof setupErrors = {};
    if (!/^\d{6}$/.test(code)) errors.otp = 'Enter the 6-digit code';
    if (newPassword.length < 8) errors.newPassword = 'Use at least 8 characters';
    if (confirmPassword !== newPassword) errors.confirm = 'Passwords don’t match';
    setSetupErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsLoading(true);
    try {
      const res = await api.post(
        '/auth/admin/password-setup',
        { setupToken: setup.setupToken, otp: code, newPassword },
        { silent: true },
      );
      toast.success('Password set. Welcome to Kero.');
      await finishSignIn(res.data.data.accessToken, res.data.data.user);
    } catch (err: unknown) {
      applyApiFormError(err, {
        setFormError,
        setError: (field, error) => {
          if (field === 'otp') setSetupErrors((s) => ({ ...s, otp: error.message }));
          if (field === 'newPassword') setSetupErrors((s) => ({ ...s, newPassword: error.message }));
        },
        fields: ['otp', 'newPassword'],
        fallbackMessage: 'Couldn’t set your password',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!setup) return;
    setIsResending(true);
    setFormError(null);
    try {
      await api.post('/auth/admin/password-setup/resend', { setupToken: setup.setupToken }, { silent: true });
      toast.success('New code sent');
    } catch (err: unknown) {
      applyApiFormError(err, { setFormError, fallbackMessage: 'Couldn’t resend the code' });
    } finally {
      setIsResending(false);
    }
  };

  const errorAlert = formError && (
    <div className="mt-5">
      <Alert status="danger">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>{formError}</Alert.Title>
        </Alert.Content>
      </Alert>
    </div>
  );

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/kero-logo-white.svg" alt="Kero" className="h-8 w-auto self-start" />
        <div className="max-w-md">
          <h1 className="text-[36px] font-bold leading-[1.1] tracking-[-0.03em]">
            Operations command for every Kero ride.
          </h1>
          <p className="mt-4 text-[15px] text-sidebar-muted">
            Monitor live trips, verify drivers, respond to SOS alerts and manage your team — in one place.
          </p>
        </div>
        <p className="text-xs text-sidebar-muted">© Kero Mobility</p>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center bg-background p-6">
        <Card className="w-full max-w-[420px] gap-0 rounded-3xl border-0 bg-surface p-8 shadow-none sm:p-10">
          {setup ? (
            <>
              <h2 className="text-[24px] font-bold tracking-[-0.03em] text-foreground">Set your password</h2>
              <p className="mt-1 text-[14px] text-muted">
                You’re signed in with a temporary password. Enter the code we sent to{' '}
                <span className="text-foreground">{setup.email}</span> and choose your own.
              </p>

              {errorAlert}

              <form onSubmit={handleSetup} className="mt-6 space-y-4">
                <AppInput
                  label="Verification code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  isRequired
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6-digit code"
                  startContent={<Password />}
                  errorMessage={setupErrors.otp}
                />
                <AppInput
                  label="New password"
                  type="password"
                  autoComplete="new-password"
                  isRequired
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  startContent={<LockKey />}
                  errorMessage={setupErrors.newPassword}
                />
                <AppInput
                  label="Confirm password"
                  type="password"
                  autoComplete="new-password"
                  isRequired
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat it"
                  startContent={<LockKey />}
                  errorMessage={setupErrors.confirm}
                />

                <AppButton
                  type="submit"
                  size="lg"
                  fullWidth
                  isLoading={isLoading}
                  label={isLoading ? 'Saving…' : 'Set password and continue'}
                  endContent={<ArrowRight weight="bold" />}
                  className="mt-2"
                />
              </form>

              <div className="mt-6 flex items-center justify-between text-[13px]">
                <button
                  type="button"
                  onClick={() => {
                    setSetup(null);
                    setPassword('');
                    setFormError(null);
                  }}
                  className="cursor-pointer text-muted hover:text-foreground"
                >
                  Back to sign in
                </button>
                <button
                  type="button"
                  disabled={isResending}
                  onClick={handleResend}
                  className="cursor-pointer font-medium text-secondary hover:underline disabled:opacity-50"
                >
                  {isResending ? 'Sending…' : 'Resend code'}
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-[24px] font-bold tracking-[-0.03em] text-foreground">Welcome back</h2>
              <p className="mt-1 text-[14px] text-muted">Sign in with your Kero staff account.</p>

              {errorAlert}

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <AppInput
                  label="Work email"
                  type="email"
                  isRequired
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError(undefined);
                  }}
                  placeholder="name@kero.ng"
                  startContent={<EnvelopeSimple />}
                  errorMessage={emailError}
                />

                <AppInput
                  label="Password"
                  type="password"
                  isRequired
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (passwordError) setPasswordError(undefined);
                  }}
                  placeholder="••••••••"
                  startContent={<LockKey />}
                  errorMessage={passwordError}
                />

                <AppButton
                  type="submit"
                  size="lg"
                  fullWidth
                  isLoading={isLoading}
                  label={isLoading ? 'Signing in…' : 'Sign in'}
                  endContent={<ArrowRight weight="bold" />}
                  className="mt-2"
                />
              </form>

              <div className="mt-8 flex items-center justify-center gap-2 text-xs text-muted">
                <ShieldCheck size={16} className="text-success" />
                Role-based access control enforced
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
