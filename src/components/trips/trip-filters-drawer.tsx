'use client';

// src/components/trips/trip-filters-drawer.tsx
// Secondary trip filters (payment, dates, fare range) in a HeroUI drawer so
// the trips toolbar stays a single row: status · search · Filters.

import React, { useMemo, useState } from 'react';
import { Drawer, RangeCalendar } from '@heroui/react';
import { Funnel } from '@phosphor-icons/react';
import { AppButton } from '@/components/ui/app-button';
import { AppInput } from '@/components/ui/app-input';
import { AppSelect } from '@/components/ui/app-select';
import { Segmented } from '@/components/ui/page';

export type PaymentFilter = 'all' | 'WALLET' | 'CASH' | 'CARD';

export interface TripFilters {
  paymentMethod: PaymentFilter;
  /** YYYY-MM-DD, inclusive */
  dateFrom: string;
  /** YYYY-MM-DD, inclusive */
  dateTo: string;
  fareMin: string;
  fareMax: string;
}

export const EMPTY_TRIP_FILTERS: TripFilters = { paymentMethod: 'all', dateFrom: '', dateTo: '', fareMin: '', fareMax: '' };

export function countActiveFilters(f: TripFilters): number {
  return [f.paymentMethod !== 'all', Boolean(f.dateFrom || f.dateTo), Boolean(f.fareMin || f.fareMax)].filter(Boolean).length;
}

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function lastMonths(count: number) {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    return {
      key: iso(start),
      label: start.toLocaleDateString('en-NG', { month: 'long', year: 'numeric' }),
      from: iso(start),
      to: iso(end),
    };
  });
}

export function TripFiltersDrawer({ value, onApply }: { value: TripFilters; onApply: (next: TripFilters) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState<TripFilters>(value);
  // Bumping the key remounts the (uncontrolled) calendar after quick picks/reset.
  const [calendarKey, setCalendarKey] = useState(0);
  const months = useMemo(() => lastMonths(12), []);
  const active = countActiveFilters(value);

  const open = () => {
    setDraft(value);
    setCalendarKey((k) => k + 1);
    setIsOpen(true);
  };

  const setRange = (from: string, to: string) => {
    setDraft((d) => ({ ...d, dateFrom: from, dateTo: to }));
    setCalendarKey((k) => k + 1);
  };

  const today = new Date();
  const quickRanges = [
    { key: 'today', label: 'Today', from: iso(today), to: iso(today) },
    { key: '7d', label: 'Last 7 days', from: iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6)), to: iso(today) },
    { key: '30d', label: 'Last 30 days', from: iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29)), to: iso(today) },
  ];
  const matchedMonth = months.find((m) => m.from === draft.dateFrom && m.to === draft.dateTo);

  return (
    <>
      <AppButton
        size="sm"
        variant="tertiary"
        startContent={<Funnel />}
        label={active > 0 ? `Filters · ${active}` : 'Filters'}
        onPress={open}
        className={active > 0 ? 'bg-secondary-soft text-secondary-soft-foreground' : ''}
      />

      <Drawer isOpen={isOpen} onOpenChange={setIsOpen}>
        <Drawer.Backdrop>
          <Drawer.Content placement="right">
            <Drawer.Dialog className="flex h-full w-full max-w-md flex-col bg-overlay">
              <Drawer.Header className="px-6 pb-2 pt-6">
                <Drawer.Heading className="text-[18px] font-bold tracking-[-0.02em] text-foreground">Filters</Drawer.Heading>
                <p className="mt-1 text-[13px] text-muted">Narrow trips by payment, date and fare.</p>
              </Drawer.Header>

              <Drawer.Body className="flex-1 space-y-7 overflow-y-auto px-6 py-5">
                <section>
                  <h3 className="mb-3 text-[13px] font-medium text-foreground">Payment method</h3>
                  <Segmented
                    size="sm"
                    aria-label="Payment method"
                    value={draft.paymentMethod}
                    onChange={(key) => setDraft((d) => ({ ...d, paymentMethod: key }))}
                    options={[
                      { key: 'all', label: 'All' },
                      { key: 'WALLET', label: 'Wallet' },
                      { key: 'CASH', label: 'Cash' },
                      { key: 'CARD', label: 'Card' },
                    ]}
                  />
                </section>

                <section>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-[13px] font-medium text-foreground">Date</h3>
                    {(draft.dateFrom || draft.dateTo) && (
                      <button
                        type="button"
                        className="cursor-pointer text-[13px] text-muted hover:text-foreground"
                        onClick={() => setRange('', '')}
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  <div className="mb-3 flex flex-wrap gap-2">
                    {quickRanges.map((r) => {
                      const selected = draft.dateFrom === r.from && draft.dateTo === r.to;
                      return (
                        <button
                          key={r.key}
                          type="button"
                          onClick={() => setRange(r.from, r.to)}
                          className={`h-8 cursor-pointer rounded-full px-3 text-[13px] font-medium transition-colors ${
                            selected ? 'bg-secondary text-secondary-foreground' : 'bg-default text-muted hover:text-foreground'
                          }`}
                        >
                          {r.label}
                        </button>
                      );
                    })}
                  </div>

                  <AppSelect
                    aria-label="Month"
                    placeholder="Pick a month"
                    selectedKey={matchedMonth?.key ?? ''}
                    onSelectionChange={(key) => {
                      const m = months.find((x) => x.key === key);
                      if (m) setRange(m.from, m.to);
                    }}
                    options={months.map((m) => ({ key: m.key, label: m.label }))}
                  />

                  <div className="mt-4 rounded-2xl bg-surface-secondary p-3">
                    <RangeCalendar
                      key={calendarKey}
                      aria-label="Trip dates"
                      className="w-full"
                      onChange={(range) => {
                        if (range) setDraft((d) => ({ ...d, dateFrom: range.start.toString(), dateTo: range.end.toString() }));
                      }}
                    >
                      <RangeCalendar.Header>
                        <RangeCalendar.NavButton slot="previous" />
                        <RangeCalendar.Heading />
                        <RangeCalendar.NavButton slot="next" />
                      </RangeCalendar.Header>
                      <RangeCalendar.Grid>
                        <RangeCalendar.GridHeader>
                          {(day) => <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>}
                        </RangeCalendar.GridHeader>
                        <RangeCalendar.GridBody>{(date) => <RangeCalendar.Cell date={date} />}</RangeCalendar.GridBody>
                      </RangeCalendar.Grid>
                    </RangeCalendar>
                  </div>

                  {(draft.dateFrom || draft.dateTo) && (
                    <p className="tabular mt-2 text-[13px] text-muted">
                      {draft.dateFrom || '…'} → {draft.dateTo || '…'}
                    </p>
                  )}
                </section>

                <section>
                  <h3 className="mb-3 text-[13px] font-medium text-foreground">Fare (₦)</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <AppInput
                      type="number"
                      placeholder="Min"
                      value={draft.fareMin}
                      onChange={(e) => setDraft((d) => ({ ...d, fareMin: e.target.value }))}
                    />
                    <AppInput
                      type="number"
                      placeholder="Max"
                      value={draft.fareMax}
                      onChange={(e) => setDraft((d) => ({ ...d, fareMax: e.target.value }))}
                    />
                  </div>
                </section>
              </Drawer.Body>

              <Drawer.Footer className="flex items-center justify-between gap-2 px-6 pb-6 pt-3">
                <AppButton
                  variant="ghost"
                  label="Reset"
                  onPress={() => {
                    setDraft(EMPTY_TRIP_FILTERS);
                    setCalendarKey((k) => k + 1);
                  }}
                />
                <AppButton
                  variant="brand"
                  label="Apply filters"
                  onPress={() => {
                    onApply(draft);
                    setIsOpen(false);
                  }}
                />
              </Drawer.Footer>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </Drawer>
    </>
  );
}
