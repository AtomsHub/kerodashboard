'use client';

// src/components/ui/sortable-th.tsx
// Clickable table headers. Sorting runs on the server (the list endpoints
// take `sortBy` + `sortOrder`), so it covers every page, not just the rows
// on screen. Click once for the column's natural order, again to flip it.

import React, { useState } from 'react';
import { CaretDown, CaretUp, CaretUpDown } from '@phosphor-icons/react';

export type SortOrder = 'asc' | 'desc';
export interface SortState<K extends string> {
  key: K;
  order: SortOrder;
}

export function useTableSort<K extends string>(initial: SortState<K>, onChange?: () => void) {
  const [sort, setSort] = useState<SortState<K>>(initial);
  const toggle = (key: K, firstOrder: SortOrder = 'desc') => {
    setSort((s) => (s.key === key ? { key, order: s.order === 'desc' ? 'asc' : 'desc' } : { key, order: firstOrder }));
    onChange?.();
  };
  return { sort, toggle };
}

interface SortableThProps<K extends string> {
  label: React.ReactNode;
  sortKey: K;
  sort: SortState<K>;
  onSort: (key: K, firstOrder?: SortOrder) => void;
  /** Order applied on the first click (names read best A–Z). */
  firstOrder?: SortOrder;
  className?: string;
}

export function SortableTh<K extends string>({
  label,
  sortKey,
  sort,
  onSort,
  firstOrder = 'desc',
  className = '',
}: SortableThProps<K>) {
  const active = sort.key === sortKey;
  const Icon = !active ? CaretUpDown : sort.order === 'asc' ? CaretUp : CaretDown;
  return (
    <th className={className} aria-sort={active ? (sort.order === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={() => onSort(sortKey, firstOrder)}
        className={`-mx-1 inline-flex cursor-pointer items-center gap-1 rounded-md px-1 transition-colors hover:text-foreground ${
          active ? 'text-foreground' : ''
        }`}
      >
        {label}
        <Icon size={12} weight="bold" className={active ? 'text-secondary' : 'opacity-50'} />
      </button>
    </th>
  );
}
