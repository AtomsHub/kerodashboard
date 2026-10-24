// src/lib/format.ts
// Small display formatters shared by admin profile and record pages.

type DateInput = string | Date | null | undefined;

function toDate(value: DateInput): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(value: DateInput): string {
  const d = toDate(value);
  return d ? d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
}

export function formatDateTime(value: DateInput): string {
  const d = toDate(value);
  return d
    ? d.toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '—';
}

/**
 * "19 Sep 2000". Birth dates are stored as UTC midnight, so format in UTC:
 * a local time zone behind UTC would otherwise show the day before.
 */
export function formatDob(value: DateInput): string {
  const d = toDate(value);
  return d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—';
}

export function capitalise(value: string | null | undefined): string {
  if (!value) return '—';
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}
