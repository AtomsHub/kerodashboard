'use client';

// src/app/system/monitor/page.tsx
// Server monitor: health of the API, its databases and third-party services,
// traffic and response times, the slowest and failing routes, and the most
// frequent errors. Needs the view_server_monitor permission (super admins
// always have it); error details can include internals.
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowClockwise,
  Pulse,
  Timer,
  WarningOctagon,
  Cpu,
  Database,
  Queue,
  Bug,
  ShieldWarning,
} from '@phosphor-icons/react';
import { AppButton } from '@/components/ui/app-button';
import { DashboardCard, StatDashboardCard } from '@/components/ui/dashboard-card';
import { EmptyState, Page, PageHeader, SectionHeader, Segmented, StatusPill } from '@/components/ui/page';
import { AreaChart, ChartLegend, type ChartDatum } from '@/components/charts/charts';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

type Window = '15' | '60' | '360' | '1440';

interface RouteRow {
  route: string;
  requests: number;
  errors5xx: number;
  errors4xx: number;
  errorRate: number;
  avgMs: number;
  p95Ms: number | null;
}

interface MonitorData {
  generatedAt: string;
  instance: {
    id: string;
    node: string;
    uptimeSeconds: number;
    memoryMb: { rss: number; heapUsed: number; heapTotal: number };
    cpuPercent: number;
    eventLoopLagMs: { p50: number; p99: number; max: number };
  };
  dependencies: { name: string; ok: boolean; ms: number; detail?: string }[];
  queues: { name: string; waiting?: number; active?: number; delayed?: number; failed?: number; error?: string }[];
  traffic: {
    minutes: number;
    requests: number;
    errors5xx: number;
    errors4xx: number;
    avgMs: number;
    p50Ms: number | null;
    p95Ms: number | null;
    p99Ms: number | null;
    series: { minute: string; requests: number; errors: number; p95Ms: number | null }[];
    busiest: RouteRow[];
    slowest: RouteRow[];
    failing: RouteRow[];
  };
  topErrors: {
    id: string;
    count7d: number;
    code?: string;
    message?: string;
    route?: string;
    status?: string;
    level?: string;
    stack?: string;
    firstSeen?: string;
    lastSeen?: string;
  }[];
}

const WINDOW_LABEL: Record<Window, string> = { '15': 'last 15 minutes', '60': 'last hour', '360': 'last 6 hours', '1440': 'last 24 hours' };

const ms = (v: number | null | undefined) => (v === null || v === undefined ? '—' : v >= 10000 ? '10s+' : `${v.toLocaleString()} ms`);
const n = (v: number) => v.toLocaleString();
const uptime = (s: number) => {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
};
const ago = (iso?: string) => {
  if (!iso) return '—';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  return s < 60 ? 'just now' : s < 3600 ? `${Math.floor(s / 60)} min ago` : s < 86400 ? `${Math.floor(s / 3600)} h ago` : `${Math.floor(s / 86400)} d ago`;
};

/** Group per-minute points so long windows stay readable (max ~60 points). */
function chartData(series: MonitorData['traffic']['series']): ChartDatum[] {
  const step = Math.max(1, Math.ceil(series.length / 60));
  const out: ChartDatum[] = [];
  for (let i = 0; i < series.length; i += step) {
    const chunk = series.slice(i, i + step);
    const at = new Date(chunk[0]!.minute);
    out.push({
      label: at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      values: {
        requests: chunk.reduce((sum, p) => sum + p.requests, 0),
        errors: chunk.reduce((sum, p) => sum + p.errors, 0),
      },
    });
  }
  return out;
}

function RouteTable({ rows, empty }: { rows: RouteRow[]; empty: string }) {
  if (rows.length === 0) return <EmptyState icon={Pulse} title={empty} className="py-10" />;
  return (
    <div className="-mx-6 overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>Route</th>
            <th className="text-right">Requests</th>
            <th className="text-right">Server errors</th>
            <th className="text-right">Avg</th>
            <th className="text-right">p95</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.route}>
              <td className="max-w-[320px] truncate font-mono text-[12px] text-foreground" title={r.route}>
                {r.route}
              </td>
              <td className="tabular text-right">{n(r.requests)}</td>
              <td className={`tabular text-right ${r.errors5xx ? 'font-medium text-danger' : 'text-muted'}`}>
                {n(r.errors5xx)}
                {r.errors5xx ? ` (${(r.errorRate * 100).toFixed(1)}%)` : ''}
              </td>
              <td className="tabular text-right text-muted">{ms(r.avgMs)}</td>
              <td className="tabular text-right font-medium text-foreground">{ms(r.p95Ms)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SystemMonitorPage() {
  const canView = useAuthStore((s) => s.hasPermission('view_server_monitor'));
  const [range, setRange] = useState<Window>('60');
  const [openError, setOpenError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['admin', 'monitor', range, refresh],
    queryFn: async () =>
      (await api.get<{ data: MonitorData }>('/admin/monitor', { params: { minutes: range, ...(refresh ? { refresh: 1 } : {}) } }))
        .data.data,
    enabled: canView,
    refetchInterval: 30_000,
  });

  if (!canView) {
    return (
      <Page>
        <PageHeader title="Server monitor" />
        <EmptyState icon={ShieldWarning} title="No access" description="Ask a super admin for the View Server Monitor permission." className="py-24" />
      </Page>
    );
  }

  const down = data?.dependencies.filter((d) => !d.ok) ?? [];
  const failedJobs = data?.queues.reduce((sum, q) => sum + (q.failed ?? 0), 0) ?? 0;
  const t = data?.traffic;
  const errorRate = t && t.requests ? (t.errors5xx / t.requests) * 100 : 0;
  const lag = data?.instance.eventLoopLagMs.p99 ?? 0;
  const overall: { tone: 'success' | 'warning' | 'danger'; label: string } = !data
    ? { tone: 'warning', label: 'Checking…' }
    : down.some((d) => ['Postgres', 'Redis'].includes(d.name)) || errorRate >= 5
      ? { tone: 'danger', label: 'Problem' }
      : down.length || errorRate >= 1 || lag > 200 || failedJobs > 0
        ? { tone: 'warning', label: 'Needs attention' }
        : { tone: 'success', label: 'All systems normal' };

  return (
    <Page>
      <PageHeader
        title="Server monitor"
        description={`API health and performance, ${WINDOW_LABEL[range]}. Updates every 30 s.`}
        badge={
          <StatusPill tone={overall.tone} dot pulse={overall.tone !== 'success'}>
            {overall.label}
          </StatusPill>
        }
        actions={
          <>
            <Segmented
              size="sm"
              aria-label="Time window"
              value={range}
              onChange={setRange}
              options={[
                { key: '15', label: '15 min' },
                { key: '60', label: '1 hour' },
                { key: '360', label: '6 hours' },
                { key: '1440', label: '24 hours' },
              ]}
            />
            <AppButton
              variant="tertiary"
              isIconOnly
              aria-label="Check again now"
              startContent={<ArrowClockwise className={isFetching ? 'animate-spin' : ''} />}
              onPress={() => {
                setRefresh((r) => r + 1);
                void refetch();
              }}
            />
          </>
        }
      />

      {error && !data ? (
        <DashboardCard>
          <EmptyState icon={WarningOctagon} title="Couldn't load the monitor" description={(error as Error).message} className="py-16" />
        </DashboardCard>
      ) : null}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatDashboardCard
          label="Requests"
          icon={Pulse}
          loading={isLoading}
          value={n(t?.requests ?? 0)}
          hint={t ? `${(t.requests / Math.max(1, t.minutes)).toFixed(1)} per minute` : undefined}
        />
        <StatDashboardCard
          label="Server errors"
          icon={WarningOctagon}
          variant={errorRate >= 1 ? 'danger' : 'surface'}
          loading={isLoading}
          value={n(t?.errors5xx ?? 0)}
          hint={t ? `${errorRate.toFixed(2)}% of requests · ${n(t.errors4xx)} client errors` : undefined}
        />
        <StatDashboardCard
          label="Response time (p95)"
          icon={Timer}
          variant={(t?.p95Ms ?? 0) >= 1000 ? 'warning' : 'surface'}
          loading={isLoading}
          value={ms(t?.p95Ms)}
          hint={t ? `median ${ms(t.p50Ms)} · p99 ${ms(t.p99Ms)}` : undefined}
        />
        <StatDashboardCard
          label="Server"
          icon={Cpu}
          variant={lag > 200 ? 'warning' : 'surface'}
          loading={isLoading}
          value={data ? `${data.instance.cpuPercent}% CPU` : '—'}
          hint={
            data
              ? `${data.instance.memoryMb.rss} MB memory · up ${uptime(data.instance.uptimeSeconds)} · lag p99 ${data.instance.eventLoopLagMs.p99} ms`
              : undefined
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <DashboardCard className="lg:col-span-2">
          <SectionHeader
            title="Traffic"
            description="Requests and server errors"
            actions={
              <ChartLegend
                series={[
                  { key: 'requests', label: 'Requests', color: 'var(--chart-1)' },
                  { key: 'errors', label: 'Server errors', color: 'var(--danger)' },
                ]}
              />
            }
          />
          <div className="mt-5">
            {!t || t.requests === 0 ? (
              <EmptyState icon={Pulse} title="No traffic in this window" className="py-16" />
            ) : (
              <AreaChart
                data={chartData(t.series)}
                format={(v) => v.toLocaleString()}
                series={[
                  { key: 'requests', label: 'Requests', color: 'var(--chart-1)' },
                  { key: 'errors', label: 'Server errors', color: 'var(--danger)' },
                ]}
              />
            )}
          </div>
        </DashboardCard>

        <DashboardCard>
          <SectionHeader title="Services" description="Databases and third parties, checked every minute" />
          <ul className="mt-4 space-y-2.5">
            {(data?.dependencies ?? []).map((d) => (
              <li key={d.name} className="flex items-center justify-between gap-3 text-[13px]" title={d.detail}>
                <span className="flex min-w-0 items-center gap-2">
                  <span className={`size-2 shrink-0 rounded-full ${d.ok ? 'bg-success' : 'bg-danger'}`} />
                  <span className="truncate text-foreground">{d.name}</span>
                </span>
                <span className={`tabular shrink-0 ${d.ok ? 'text-muted' : 'font-medium text-danger'}`}>
                  {d.ok ? ms(d.ms) : d.detail ?? 'Down'}
                </span>
              </li>
            ))}
            {!data && isLoading ? <li className="text-[13px] text-muted">Checking…</li> : null}
          </ul>
        </DashboardCard>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <DashboardCard>
          <SectionHeader title="Slowest routes" description="By 95th-percentile response time (3+ requests)" />
          <div className="mt-4">
            <RouteTable rows={t?.slowest ?? []} empty="Not enough traffic yet" />
          </div>
        </DashboardCard>
        <DashboardCard>
          <SectionHeader title="Failing routes" description="Routes returning server errors" />
          <div className="mt-4">
            <RouteTable rows={t?.failing ?? []} empty="No server errors in this window" />
          </div>
        </DashboardCard>
      </div>

      <DashboardCard>
        <SectionHeader title="Most frequent errors" description="Last 7 days, similar errors grouped. Click one for details." />
        <div className="mt-4">
          {(data?.topErrors ?? []).length === 0 ? (
            <EmptyState icon={Bug} title="No errors recorded" className="py-10" />
          ) : (
            <ul className="divide-y divide-border">
              {data!.topErrors.map((e) => (
                <li key={e.id} className="py-3">
                  <button
                    type="button"
                    className="flex w-full items-start justify-between gap-4 text-left"
                    onClick={() => setOpenError(openError === e.id ? null : e.id)}
                  >
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <StatusPill tone={e.level === 'error' ? 'danger' : 'warning'}>{e.status ?? '—'}</StatusPill>
                        <span className="font-mono text-[12px] text-muted">{e.code}</span>
                        <span className="font-mono text-[12px] text-muted">{e.route}</span>
                      </span>
                      <span className="mt-1 block truncate text-[13px] text-foreground">{e.message}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="tabular block text-[15px] font-semibold text-foreground">{n(e.count7d)}</span>
                      <span className="block text-[12px] text-muted">{ago(e.lastSeen)}</span>
                    </span>
                  </button>
                  {openError === e.id ? (
                    <div className="mt-3 space-y-2 rounded-2xl bg-default p-4 text-[12px]">
                      <p className="text-muted">
                        First seen {ago(e.firstSeen)} · last seen {ago(e.lastSeen)}
                      </p>
                      {e.stack ? (
                        <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[11px] text-foreground">{e.stack}</pre>
                      ) : (
                        <p className="text-muted">No stack trace (client errors don&apos;t record one).</p>
                      )}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </DashboardCard>

      <DashboardCard>
        <SectionHeader title="Background jobs" description="Queued work (reminders, dispatch timers, payouts…)" />
        <div className="-mx-6 mt-4 overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Queue</th>
                <th className="text-right">Waiting</th>
                <th className="text-right">Running</th>
                <th className="text-right">Scheduled</th>
                <th className="text-right">Failed</th>
              </tr>
            </thead>
            <tbody>
              {(data?.queues ?? []).map((q) => (
                <tr key={q.name}>
                  <td className="font-mono text-[12px] text-foreground">
                    <span className="inline-flex items-center gap-2">
                      <Queue size={14} className="text-muted" />
                      {q.name}
                    </span>
                  </td>
                  {q.error ? (
                    <td colSpan={4} className="text-right text-danger">
                      {q.error}
                    </td>
                  ) : (
                    <>
                      <td className="tabular text-right">{n(q.waiting ?? 0)}</td>
                      <td className="tabular text-right">{n(q.active ?? 0)}</td>
                      <td className="tabular text-right text-muted">{n(q.delayed ?? 0)}</td>
                      <td className={`tabular text-right ${q.failed ? 'font-medium text-danger' : 'text-muted'}`}>{n(q.failed ?? 0)}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DashboardCard>

      {data ? (
        <p className="flex items-center gap-2 text-[12px] text-muted">
          <Database size={14} />
          Traffic and errors cover every server instance. CPU and memory are for instance {data.instance.id} ({data.instance.node}).
          Updated {ago(data.generatedAt)}.
        </p>
      ) : null}
    </Page>
  );
}
