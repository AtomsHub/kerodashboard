// src/lib/money.ts
// One place for naira ↔ kobo. Screens show and accept naira; the API and
// database use kobo (whole numbers, no rounding errors).

/** ₦12.50 → 1250 kobo. */
export const nairaToKobo = (naira: number): number => Math.round(naira * 100);

/** 1250 kobo → 12.5 naira. */
export const koboToNaira = (kobo: number): number => kobo / 100;

/** Typed naira text ("12,500.5" or "") → kobo (null when empty or not a number). */
export function nairaInputToKobo(text: string): number | null {
  const clean = text.replace(/,/g, '').trim();
  if (clean === '' || clean === '.') return null;
  const n = Number(clean);
  return Number.isFinite(n) ? nairaToKobo(n) : null;
}

/** Kobo → the naira text an input shows (separators are added by the input). */
export const koboToNairaInput = (kobo: number | null | undefined): string => (kobo == null ? '' : String(koboToNaira(kobo)));
