'use client';

// src/components/charts/charts.tsx
// Small SVG chart kit for the admin. Thin marks, recessive grid, one y-axis,
// a legend for 2+ series and hover tooltips on every chart. Series colours
// come from the validated --chart-1..3 tokens in fixed order.

import React, { useEffect, useMemo, useRef, useState } from 'react';

export interface ChartSeries {
  key: string;
  label: string;
  /** CSS colour, e.g. 'var(--chart-1)' */
  color: string;
}

export interface ChartDatum {
  label: string;
  /** Longer label for the tooltip header */
  title?: string;
  values: Record<string, number>;
}

type Formatter = (v: number) => string;

/* ------------------------------------------------------------------ utils */

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

function niceMax(max: number): number {
  if (max <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(max)));
  const f = max / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * exp;
}

export function ChartLegend({ series }: { series: ChartSeries[] }) {
  if (series.length < 2) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
      {series.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

function Tooltip({
  x,
  width,
  datum,
  series,
  format,
  extra,
}: {
  x: number;
  width: number;
  datum: ChartDatum;
  series: ChartSeries[];
  format: Formatter;
  extra?: React.ReactNode;
}) {
  const left = Math.min(Math.max(x, 90), width - 90);
  return (
    <div
      className="pointer-events-none absolute top-0 z-10 min-w-[160px] -translate-x-1/2 rounded-2xl bg-overlay px-3.5 py-2.5 shadow-lg"
      style={{ left }}
    >
      <p className="mb-1.5 text-xs font-medium text-muted">{datum.title ?? datum.label}</p>
      <ul className="space-y-1">
        {series.map((s) => (
          <li key={s.key} className="flex items-center justify-between gap-4 text-[13px]">
            <span className="inline-flex items-center gap-1.5 text-muted">
              <span className="size-2 rounded-full" style={{ background: s.color }} />
              {s.label}
            </span>
            <span className="tabular font-medium text-foreground">{format(datum.values[s.key] ?? 0)}</span>
          </li>
        ))}
      </ul>
      {extra}
    </div>
  );
}

const PAD = { top: 16, right: 8, bottom: 26, left: 56 };

function Axes({
  width,
  height,
  max,
  data,
  x,
  format,
}: {
  width: number;
  height: number;
  max: number;
  data: ChartDatum[];
  x: (i: number) => number;
  format: Formatter;
}) {
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const plotH = height - PAD.top - PAD.bottom;
  const every = Math.max(1, Math.ceil(data.length / Math.max(1, Math.floor((width - PAD.left) / 56))));
  return (
    <g>
      {ticks.map((t) => {
        const y = PAD.top + plotH - t * plotH;
        return (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y} y2={y} stroke="var(--separator)" strokeWidth={1} />
            <text x={PAD.left - 8} y={y + 4} textAnchor="end" className="tabular fill-muted text-[11px]">
              {format(max * t)}
            </text>
          </g>
        );
      })}
      {data.map((d, i) =>
        i % every === 0 || i === data.length - 1 ? (
          <text key={i} x={x(i)} y={height - 6} textAnchor="middle" className="fill-muted text-[11px]">
            {d.label}
          </text>
        ) : null,
      )}
    </g>
  );
}

/* ------------------------------------------------------------ area / line */

export function AreaChart({
  data,
  series,
  format,
  height = 260,
}: {
  data: ChartDatum[];
  series: ChartSeries[];
  format: Formatter;
  height?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(0, ...data.flatMap((d) => series.map((s) => d.values[s.key] ?? 0))));
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = height - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (data.length <= 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;

  return (
    <div ref={ref} className="relative w-full select-none" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} onMouseLeave={() => setHover(null)}>
          <Axes width={width} height={height} max={max} data={data} x={x} format={format} />
          {series.map((s, si) => {
            const pts = data.map((d, i) => `${x(i)},${y(d.values[s.key] ?? 0)}`);
            const area = `M${x(0)},${y(0)} L${pts.join(' L')} L${x(data.length - 1)},${y(0)} Z`;
            return (
              <g key={s.key}>
                {si === 0 && <path d={area} fill={s.color} opacity={0.12} />}
                <polyline points={pts.join(' ')} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" />
              </g>
            );
          })}
          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} stroke="var(--muted)" strokeDasharray="3 3" />
              {series.map((s) => (
                <circle
                  key={s.key}
                  cx={x(hover)}
                  cy={y(data[hover].values[s.key] ?? 0)}
                  r={4.5}
                  fill={s.color}
                  stroke="var(--surface)"
                  strokeWidth={2}
                />
              ))}
            </g>
          )}
          {data.map((_, i) => (
            <rect
              key={i}
              x={x(i) - plotW / Math.max(1, data.length - 1) / 2}
              y={0}
              width={plotW / Math.max(1, data.length - 1)}
              height={height}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
          ))}
        </svg>
      )}
      {hover !== null && data[hover] && (
        <Tooltip x={x(hover)} width={width} datum={data[hover]} series={series} format={format} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------ stacked bar */

export function StackedBarChart({
  data,
  series,
  format,
  height = 260,
}: {
  data: ChartDatum[];
  series: ChartSeries[];
  format: Formatter;
  height?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const totals = data.map((d) => series.reduce((a, s) => a + (d.values[s.key] ?? 0), 0));
  const max = niceMax(Math.max(0, ...totals));
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = height - PAD.top - PAD.bottom;
  const slot = data.length ? plotW / data.length : 0;
  const barW = Math.max(4, Math.min(28, slot * 0.6));
  const x = (i: number) => PAD.left + slot * i + slot / 2;
  const GAP = 2;

  return (
    <div ref={ref} className="relative w-full select-none" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} onMouseLeave={() => setHover(null)}>
          <Axes width={width} height={height} max={max} data={data} x={x} format={format} />
          {data.map((d, i) => {
            let acc = 0;
            const visible = series.filter((s) => (d.values[s.key] ?? 0) > 0);
            return (
              <g key={i} opacity={hover === null || hover === i ? 1 : 0.45}>
                {visible.map((s, si) => {
                  const v = d.values[s.key] ?? 0;
                  const h = (v / max) * plotH;
                  const top = PAD.top + plotH - ((acc + v) / max) * plotH;
                  acc += v;
                  const isTop = si === visible.length - 1;
                  const segH = Math.max(0, h - (si > 0 ? GAP : 0));
                  return (
                    <rect
                      key={s.key}
                      x={x(i) - barW / 2}
                      y={top}
                      width={barW}
                      height={segH}
                      rx={isTop ? Math.min(4, barW / 2) : 0}
                      fill={s.color}
                    />
                  );
                })}
              </g>
            );
          })}
          {data.map((_, i) => (
            <rect
              key={i}
              x={PAD.left + slot * i}
              y={0}
              width={slot}
              height={height}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
          ))}
        </svg>
      )}
      {hover !== null && data[hover] && (
        <Tooltip
          x={x(hover)}
          width={width}
          datum={data[hover]}
          series={series}
          format={format}
          extra={
            series.length > 1 ? (
              <div className="mt-1.5 flex justify-between gap-4 border-t border-separator pt-1.5 text-[13px]">
                <span className="text-muted">Total</span>
                <span className="tabular font-medium text-foreground">{format(totals[hover])}</span>
              </div>
            ) : undefined
          }
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ donut */

export function DonutChart({
  segments,
  format,
  centerLabel,
  size = 180,
}: {
  segments: { key: string; label: string; value: number; color: string; detail?: string }[];
  format: Formatter;
  centerLabel: string;
  size?: number;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const total = segments.reduce((a, s) => a + s.value, 0);
  const r = size / 2 - 10;
  const stroke = 18;
  const circ = 2 * Math.PI * r;
  const active = segments.find((s) => s.key === hover);

  const arcs = useMemo(() => {
    const visible = segments.filter((s) => s.value > 0);
    const lens = visible.map((s) => (total > 0 ? (s.value / total) * circ : 0));
    return visible.map((s, i) => ({
      ...s,
      dash: Math.max(0, lens[i] - 3),
      offset: lens.slice(0, i).reduce((a, b) => a + b, 0),
    }));
  }, [segments, total, circ]);

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" onMouseLeave={() => setHover(null)}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--default)" strokeWidth={stroke} />
          {arcs.map((a) => (
            <circle
              key={a.key}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={a.color}
              strokeWidth={hover === a.key ? stroke + 4 : stroke}
              strokeDasharray={`${a.dash} ${circ}`}
              strokeDashoffset={-a.offset}
              className="cursor-pointer transition-[stroke-width]"
              onMouseEnter={() => setHover(a.key)}
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="tabular text-[18px] font-bold text-foreground">{format(active ? active.value : total)}</p>
            <p className="text-xs text-muted">{active ? active.label : centerLabel}</p>
          </div>
        </div>
      </div>

      <ul className="w-full min-w-0 flex-1 space-y-3">
        {segments.map((s) => {
          const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
          return (
            <li
              key={s.key}
              className="flex items-center justify-between gap-3 text-[13px]"
              onMouseEnter={() => setHover(s.key)}
              onMouseLeave={() => setHover(null)}
            >
              <span className="flex min-w-0 flex-1 items-center gap-2 text-foreground">
                <span className="size-2 shrink-0 rounded-full" style={{ background: s.color }} />
                <span className="truncate">{s.label}</span>
              </span>
              <span className="tabular shrink-0 text-muted">
                <span className="font-medium text-foreground">{pct}%</span>
                {s.detail ? ` · ${s.detail}` : ''}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* --------------------------------------------------------- ranked bar list */

export function RankedBars({
  items,
  format,
  color = 'var(--chart-1)',
}: {
  items: { label: string; value: number; detail?: string }[];
  format: Formatter;
  color?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-4">
      {items.map((item) => (
        <li key={item.label} title={`${item.label}: ${format(item.value)}`}>
          <div className="mb-1.5 flex items-center justify-between gap-3 text-[13px]">
            <span className="truncate text-foreground">{item.label}</span>
            <span className="tabular shrink-0 text-muted">
              <span className="font-medium text-foreground">{format(item.value)}</span>
              {item.detail ? ` · ${item.detail}` : ''}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-default">
            <div className="h-full rounded-full" style={{ width: `${(item.value / max) * 100}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
