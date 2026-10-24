'use client';

// src/components/dashboard/dispatch-chart.tsx
// Dispatch & Ride Volume Performance Chart.
// Replaces static dummy metrics with real aggregated platform metrics calculated from live database trips.

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendUp, TrendDown } from '@phosphor-icons/react';
import { DashboardCard } from '@/components/ui/dashboard-card';
import { api } from '@/lib/api';
import { AdminTripListItem } from '@/types/admin';

interface DataPoint {
  label: string;
  trips: number;
  revenue: number; // in Naira
  fulfillment: number; // percentage
  cancelRate: number; // percentage
}

export function DispatchPerformanceChart({
  activeDrivers = 0,
  onTrip = 0,
  cancelRateToday = 0,
  todayRevenue = 0,
}: {
  activeDrivers?: number;
  onTrip?: number;
  cancelRateToday?: number;
  todayRevenue?: number;
}) {
  const [timeRange, setTimeRange] = useState<'today' | '7d' | '30d'>('today');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // ── Query: Real Recent Platform Trips for Analytics ──────────────────
  const { data: tripsData } = useQuery<{ trips: AdminTripListItem[]; total: number }>({
    queryKey: ['admin', 'trips', 'volume-chart'],
    queryFn: async () => {
      const res = await api.get('/admin/trips?limit=100');
      const payload = (res.data as any)?.data ?? res.data;
      if (Array.isArray(payload)) return { trips: payload, total: payload.length };
      return payload ?? { trips: [], total: 0 };
    },
    refetchInterval: 30000,
  });

  const rawTrips: AdminTripListItem[] = tripsData?.trips ?? [];

  // Compute Real Data Points for selected time range
  const data: DataPoint[] = useMemo(() => {
    const now = new Date();

    if (timeRange === 'today') {
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayTrips = rawTrips.filter((t) => new Date(t.createdAt) >= startOfToday);

      const intervals = [
        { label: '00:00', startHour: 0, endHour: 3 },
        { label: '03:00', startHour: 3, endHour: 6 },
        { label: '06:00', startHour: 6, endHour: 9 },
        { label: '09:00', startHour: 9, endHour: 12 },
        { label: '12:00', startHour: 12, endHour: 15 },
        { label: '15:00', startHour: 15, endHour: 18 },
        { label: '18:00', startHour: 18, endHour: 21 },
        { label: '21:00', startHour: 21, endHour: 24 },
      ];

      return intervals.map(({ label, startHour, endHour }) => {
        const bucketTrips = todayTrips.filter((t) => {
          const h = new Date(t.createdAt).getHours();
          return h >= startHour && h < endHour;
        });

        const totalInBucket = bucketTrips.length;
        const revInKobo = bucketTrips
          .filter((t) => t.status === 'COMPLETED')
          .reduce((acc, t) => acc + (t.grandTotalKobo || t.fareKobo || 0), 0);
        const cancelledCount = bucketTrips.filter((t) => t.status === 'CANCELLED').length;
        const cancelRate = totalInBucket > 0 ? Number(((cancelledCount / totalInBucket) * 100).toFixed(1)) : 0;
        const fulfillment = totalInBucket > 0 ? Number((100 - cancelRate).toFixed(1)) : 100;

        return {
          label,
          trips: totalInBucket,
          revenue: Math.round(revInKobo / 100),
          fulfillment,
          cancelRate,
        };
      });
    }

    if (timeRange === '7d') {
      const days: DataPoint[] = [];
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);

        const bucketTrips = rawTrips.filter((t) => {
          const created = new Date(t.createdAt);
          return created >= dayStart && created < dayEnd;
        });

        const totalInBucket = bucketTrips.length;
        const revInKobo = bucketTrips
          .filter((t) => t.status === 'COMPLETED')
          .reduce((acc, t) => acc + (t.grandTotalKobo || t.fareKobo || 0), 0);
        const cancelledCount = bucketTrips.filter((t) => t.status === 'CANCELLED').length;
        const cancelRate = totalInBucket > 0 ? Number(((cancelledCount / totalInBucket) * 100).toFixed(1)) : 0;
        const fulfillment = totalInBucket > 0 ? Number((100 - cancelRate).toFixed(1)) : 100;

        days.push({
          label: i === 0 ? 'Today' : dayNames[d.getDay()],
          trips: totalInBucket,
          revenue: Math.round(revInKobo / 100),
          fulfillment,
          cancelRate,
        });
      }
      return days;
    }

    // 30 Days (4 weekly brackets)
    const weeks: DataPoint[] = [];
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - (i + 1) * 7);
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() - i * 7);

      const bucketTrips = rawTrips.filter((t) => {
        const created = new Date(t.createdAt);
        return created >= weekStart && created < weekEnd;
      });

      const totalInBucket = bucketTrips.length;
      const revInKobo = bucketTrips
        .filter((t) => t.status === 'COMPLETED')
        .reduce((acc, t) => acc + (t.grandTotalKobo || t.fareKobo || 0), 0);
      const cancelledCount = bucketTrips.filter((t) => t.status === 'CANCELLED').length;
      const cancelRate = totalInBucket > 0 ? Number(((cancelledCount / totalInBucket) * 100).toFixed(1)) : 0;
      const fulfillment = totalInBucket > 0 ? Number((100 - cancelRate).toFixed(1)) : 100;

      weeks.push({
        label: `Wk ${4 - i}`,
        trips: totalInBucket,
        revenue: Math.round(revInKobo / 100),
        fulfillment,
        cancelRate,
      });
    }
    return weeks;
  }, [rawTrips, timeRange]);

  const totalPeriodTrips = data.reduce((acc, d) => acc + d.trips, 0);
  const totalPeriodRevenue = data.reduce((acc, d) => acc + d.revenue, 0);

  const maxTrips = Math.max(...data.map((d) => d.trips), 5); // baseline minimum height of 5
  const chartHeight = 180;
  const chartWidth = 620;

  // Generate SVG path points
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * chartWidth;
    const y = chartHeight - (d.trips / maxTrips) * (chartHeight - 45) - 20;
    return { x, y, data: d };
  });

  // Build smooth Bezier SVG path
  const linePath = points.reduce((acc, p, i, arr) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = arr[i - 1];
    const cp1x = prev.x + (p.x - prev.x) / 2;
    const cp1y = prev.y;
    const cp2x = prev.x + (p.x - prev.x) / 2;
    const cp2y = p.y;
    return `${acc} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p.x} ${p.y}`;
  }, '');

  const areaPath = `${linePath} L ${chartWidth} ${chartHeight} L 0 ${chartHeight} Z`;
  const activePoint = hoveredIdx !== null ? points[hoveredIdx] : null;

  return (
    <DashboardCard className="lg:col-span-2 relative">
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[16px] font-bold text-foreground">Dispatch & Ride Volume</h2>
            {totalPeriodTrips > 0 ? (
              <span className="flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-bold text-success">
                <TrendUp size={12} weight="bold" /> {totalPeriodTrips} {totalPeriodTrips === 1 ? 'ride' : 'rides'}
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-full bg-field px-2 py-0.5 text-[11px] font-medium text-muted">
                Live Data Active
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[13px] text-muted">
            Aggregated in real-time from active and completed platform rides. Hover to inspect.
          </p>
        </div>

        {/* Time Tabs */}
        <div className="flex items-center gap-1 bg-surface-secondary rounded-xl p-1 self-start sm:self-auto">
          {(
            [
              { key: 'today', label: 'Today' },
              { key: '7d', label: '7 Days' },
              { key: '30d', label: '30 Days' },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setTimeRange(t.key);
                setHoveredIdx(null);
              }}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                timeRange === t.key
                  ? 'bg-surface text-foreground shadow-sm'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* SVG Bezier Area Chart with Interactive Hover Inspector */}
      <div className="relative mt-7 w-full">
        {/* Hover Inspector Tooltip Floating Card */}
        {activePoint && (
          <div
            className="pointer-events-none absolute z-20 transition-all duration-150 -top-4 rounded-2xl bg-overlay/95 backdrop-blur-xl border border-border/80 px-4 py-3 shadow-xl"
            style={{
              left: `${Math.min(Math.max((activePoint.x / chartWidth) * 100, 18), 82)}%`,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div className="flex items-center justify-between gap-4 border-b border-border/40 pb-2">
              <span className="text-[12px] font-bold text-foreground font-mono">
                {activePoint.data.label} Interval
              </span>
              <span className="text-[11px] font-semibold text-muted">
                {activePoint.data.trips.toLocaleString()} rides
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-2 text-[11px]">
              <div>
                <span className="text-muted block text-[10px]">Gross Volume</span>
                <span className="font-bold text-foreground">
                  ₦{activePoint.data.revenue.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-muted block text-[10px]">Fulfillment</span>
                <span className="font-bold text-success">{activePoint.data.fulfillment}%</span>
              </div>
              <div className="col-span-2 flex items-center justify-between border-t border-border/30 pt-1.5 mt-0.5">
                <span className="text-muted text-[10px]">Cancellation Rate</span>
                <span className="font-bold text-danger">{activePoint.data.cancelRate}%</span>
              </div>
            </div>
          </div>
        )}

        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-52 overflow-visible"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="dispatchAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="var(--secondary)" stopOpacity="0.32" />
              <stop offset="80%" stopColor="var(--secondary)" stopOpacity="0.04" />
              <stop offset="100%" stopColor="var(--secondary)" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="dispatchLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="var(--secondary)" />
              <stop offset="100%" stopColor="#d1b784" />
            </linearGradient>
          </defs>

          {/* Horizontal Grid lines */}
          <line x1="0" y1="25" x2={chartWidth} y2="25" stroke="var(--separator)" strokeDasharray="3 3" opacity="0.4" />
          <line x1="0" y1="80" x2={chartWidth} y2="80" stroke="var(--separator)" strokeDasharray="3 3" opacity="0.4" />
          <line x1="0" y1="135" x2={chartWidth} y2="135" stroke="var(--separator)" strokeDasharray="3 3" opacity="0.4" />

          {/* Area fill */}
          <path d={areaPath} fill="url(#dispatchAreaGradient)" />

          {/* Smooth Line stroke */}
          <path
            d={linePath}
            fill="none"
            stroke="url(#dispatchLineGradient)"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Active Data Point marker */}
          {activePoint && (
            <>
              <line
                x1={activePoint.x}
                y1={0}
                x2={activePoint.x}
                y2={chartHeight}
                stroke="var(--secondary)"
                strokeDasharray="3 3"
                strokeWidth="1.5"
                opacity="0.8"
              />
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="6.5"
                fill="var(--surface)"
                stroke="var(--secondary)"
                strokeWidth="3.5"
                className="transition-all duration-150"
              />
            </>
          )}

          {/* Interactive hover rects */}
          {points.map((p, i) => (
            <rect
              key={i}
              x={p.x - chartWidth / (points.length * 2)}
              y={0}
              width={chartWidth / points.length}
              height={chartHeight}
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            />
          ))}
        </svg>

        {/* X-Axis Labels */}
        <div className="flex justify-between items-center px-1 pt-3 border-t border-border/40 text-[11px] text-muted font-mono">
          {data.map((d, i) => (
            <span
              key={i}
              className={`transition-colors ${
                hoveredIdx === i ? 'text-secondary font-bold' : ''
              }`}
            >
              {d.label}
            </span>
          ))}
        </div>
      </div>
    </DashboardCard>
  );
}
