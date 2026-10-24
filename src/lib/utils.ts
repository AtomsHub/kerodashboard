// src/lib/utils.ts

export function formatKoboToNaira(kobo: number | null | undefined): string {
  if (kobo == null || isNaN(kobo)) return '₦0.00';
  const naira = kobo / 100;
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(naira);
}

export function formatNumber(num: number | null | undefined): string {
  if (num == null || isNaN(num)) return '0';
  return new Intl.NumberFormat('en-NG').format(num);
}
