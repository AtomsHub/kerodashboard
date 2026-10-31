// src/lib/payments.ts
// Shared types, labels and money helpers for the Payments section.

import type { StatusTone } from '@/components/ui/page';
import { toApiError } from '@/lib/errors';

export const naira = (kobo: number | null | undefined, opts: { sign?: boolean } = {}) => {
  const value = (kobo ?? 0) / 100;
  const text = `₦${Math.abs(value).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (value < 0) return `−${text}`;
  return opts.sign && value > 0 ? `+${text}` : text;
};

/** "1,500" → 150000 kobo. Empty/invalid → null. */
export const toKobo = (naira: string): number | null => {
  const n = Number(naira.replace(/,/g, '').trim());
  return naira.trim() === '' || !Number.isFinite(n) ? null : Math.round(n * 100);
};

export const fromKobo = (kobo: number | null | undefined) => (kobo == null ? '' : String(kobo / 100));

export const errorMessage = (err: unknown, fallback: string) => toApiError(err).message || fallback;

export const SERVICE_LABELS: Record<string, string> = {
  fund_account: 'Wallet top-up',
  fund_transfer: 'Driver withdrawal',
  user_fare_payment: 'Ride fare',
  driver_fare_payment: 'Ride earnings',
  cancellation_fee: 'Cancellation fee',
  refund: 'Refund',
  admin_adjustment: 'Admin adjustment',
  reward_wallet_credit: 'Reward',
  unmatched_charge: 'Unmatched payment',
  cash_commission: 'Cash commission (old)',
};

export const STATUS_TONES: Record<string, StatusTone> = {
  COMPLETED: 'success',
  PENDING: 'warning',
  PROCESSING: 'accent',
  FAILED: 'danger',
  REFUNDED: 'neutral',
  PARTIAL: 'warning',
  APPLIED: 'success',
  PENDING_APPROVAL: 'warning',
  REJECTED: 'danger',
};

export const humanise = (s: string) => s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

/** Gateway column label: money moved between Kero wallets has no gateway. */
export const gatewayLabel = (g: string | null | undefined) =>
  !g ? '—' : g === 'KERO_WALLET' ? 'Kero wallet' : g === 'CASH_SETTLEMENT' ? 'Cash (old)' : humanise(g);

export type FeeType = 'wallet_funding' | 'withdrawal' | 'ride_payment' | 'refund';
export const FEE_TYPE_LABELS: Record<FeeType, string> = {
  wallet_funding: 'Wallet top-ups',
  withdrawal: 'Withdrawals',
  ride_payment: 'Ride payments',
  refund: 'Refunds',
};

export const PAYER_LABELS: Record<string, string> = {
  KERO: 'Free',
  USER: 'User pays',
};

export interface FeeVersion {
  id: string;
  policyId: string;
  version: number;
  enabled: boolean;
  payer: 'KERO' | 'USER';
  feeModel: 'FIXED' | 'PERCENT';
  fixedFeeKobo: number;
  percentBps: number;
  feeCapKobo: number | null;
  minAmountKobo: number;
  maxAmountKobo: number;
  freeDailyCount: number;
  dailyLimitCount: number | null;
  resetTime: string;
  timezone: string;
  reason: string | null;
  createdByName: string | null;
  createdAt: string;
}

export interface FeePolicy {
  id: string;
  scopeKey: string;
  transactionType: FeeType;
  role: 'rider' | 'driver' | null;
  gateway: string | null;
  isActive: boolean;
  current: FeeVersion | null;
  history: FeeVersion[];
}

export interface FeeQuote {
  enabled: boolean;
  payer: string;
  amountKobo: number;
  providerFeeKobo: number;
  userFeeKobo: number;
  keroSubsidyKobo: number;
  feeMarginKobo: number;
  totalChargeKobo: number;
  netAmountKobo: number;
  freeRemainingToday?: number;
  isFree?: boolean;
}

export interface PaymentTransaction {
  id: string;
  transactionId: string;
  reference: string;
  userId: string | null;
  driverId: string | null;
  tripId: string | null;
  amountKobo: number;
  netAmountKobo: number | null;
  userFeeKobo: number;
  providerFeeKobo: number;
  keroSubsidyKobo: number;
  feeMarginKobo: number;
  chargesKobo: number;
  transactionType: string;
  transactionServices: string;
  gateway: string;
  gatewayReference: string | null;
  status: string;
  narration: string | null;
  needsReview: boolean;
  reviewReason: string | null;
  feePolicyVersionId: string | null;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; fullname: string | null; phone: string | null; email: string | null; walletBalance: number; heldBalance: number } | null;
  driver?: { id: string; firstname: string | null; lastname: string | null; phone: string | null; email: string | null; walletBalance: number } | null;
}

export interface PaymentEvent {
  id: string;
  source: string;
  eventType: string;
  providerStatus: string | null;
  amountKobo: number | null;
  signatureValid: boolean | null;
  outcome: string | null;
  note: string | null;
  createdAt: string;
}

export interface LedgerEntry {
  id: string;
  journalId: string;
  account: string;
  amountKobo: number;
  kind: string;
  description: string | null;
  createdAt: string;
}

export const ACCOUNT_LABELS: Record<string, string> = {
  'kero:commission': 'Kero commission',
  'kero:fee_income': 'Fees kept by Kero',
  'kero:provider_fees': 'Provider charges',
  'kero:cancellation_fees': 'Cancellation fees',
  'kero:promotions': 'Promotions & rewards',
  'kero:refunds': 'Refunds',
  'kero:adjustments': 'Admin adjustments',
  'kero:opening_balance': 'Opening balances',
  'kero:closed_accounts': 'Closed accounts',
  'lagos:levy': 'Lagos levy',
  'payout:pending': 'Withdrawals in flight',
  suspense: 'Suspense',
};

export const accountLabel = (account: string) => {
  if (ACCOUNT_LABELS[account]) return ACCOUNT_LABELS[account];
  if (account.startsWith('provider:')) return `Held at ${account.slice(9).toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}`;
  const [owner, , kind] = account.split(':');
  if (owner === 'rider') return kind === 'bonus' ? 'Rider bonus' : 'Rider wallet';
  if (owner === 'driver') return kind === 'bonus' ? 'Driver bonus' : 'Driver wallet';
  return account;
};
