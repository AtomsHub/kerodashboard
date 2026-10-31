'use client';

// src/components/ui/money-input.tsx
// Money is always typed in naira (with thousands separators) and stored in
// kobo. Use this for every ₦ amount so no screen asks for kobo.

import React from 'react';
import { AppInput, type AppInputProps } from './app-input';
import { koboToNairaInput, nairaInputToKobo } from '@/lib/money';

export interface MoneyInputProps extends Omit<AppInputProps, 'value' | 'defaultValue' | 'onChange' | 'type'> {
  /** Amount in kobo (null/undefined = empty). */
  valueKobo: number | null | undefined;
  /** Called with kobo (null when the field is cleared). */
  onChangeKobo: (kobo: number | null) => void;
}

export function MoneyInput({ valueKobo, onChangeKobo, startContent, ...props }: MoneyInputProps) {
  return (
    <AppInput
      {...props}
      type="number"
      startContent={startContent ?? <span className="text-[13px] font-medium text-muted">₦</span>}
      value={koboToNairaInput(valueKobo)}
      onChange={(e) => onChangeKobo(nairaInputToKobo(e.target.value))}
    />
  );
}
