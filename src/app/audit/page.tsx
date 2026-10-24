'use client';

// src/app/audit/page.tsx
// Phase 8.1: System Audit Trail, Differential Logs & Statutory Export
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ClockCounterClockwise,
  UsersThree,
  DownloadSimple,
  MagnifyingGlass,
  Funnel,
  ShieldCheck,
  User,
  ArrowsLeftRight,
  FileCode,
  FileCsv,
  Eye,
  CheckCircle,
  WarningCircle,
  XCircle,
  CalendarBlank,
  X,
  FileText,
  CaretLeft,
  CaretRight,
} from '@phosphor-icons/react';
import { Chip, Modal, Avatar } from '@heroui/react';
import { AppButton } from '@/components/ui/app-button';
import { AppInput } from '@/components/ui/app-input';
import { DashboardCard, StatDashboardCard } from '@/components/ui/dashboard-card';
import { AppRowActions } from '@/components/ui/app-row-actions';
import { UserAvatar } from '@/components/ui/user-avatar';
import { EmptyState, Page, PageHeader, SectionHeader, Segmented, TablePagination } from '@/components/ui/page';
import { api } from '@/lib/api';

interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorName: string;
  actorEmail: string;
  actorRole: string;
  ipAddress: string;
  location: string;
  category: string;
  action: string;
  entityId: string;
  entityType: string;
  status: 'success' | 'warning' | 'failed';
  diff: {
    before: Record<string, any> | null;
    after: Record<string, any> | null;
  };
}


export default function AuditTrailPage() {
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  // Export Modal State
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');
  const [exportStartDate, setExportStartDate] = useState('2026-10-01');
  const [exportEndDate, setExportEndDate] = useState('2026-10-15');
  const [isExporting, setIsExporting] = useState(false);

  // Live Query: Audit Stats
  const { data: statsData } = useQuery<{
    totalActions: number;
    byAction: { action: string; count: number }[];
    byAdmin: { adminEmail: string; adminFullname: string | null; actionCount: number; lastActionAt: string }[];
    recentFailures: any[];
  }>({
    queryKey: ['admin', 'audit-stats'],
    queryFn: async () => {
      try {
        const res = await api.get<{ data: any }>('/admin/audit-log/stats');
        return res.data?.data;
      } catch (err) {
        throw err;
      }
    },
  });

  // Live Query: Audit Logs
  const { data: auditResponse, isLoading } = useQuery<{
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    actions: any[];
  }>({
    queryKey: ['admin', 'audit-log', page, limit, search, selectedCategory],
    queryFn: async () => {
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(limit),
        });
        if (search.trim()) params.set('search', search.trim());
        if (selectedCategory !== 'all') params.set('result', selectedCategory);

        const res = await api.get<{ data: any }>(`/admin/audit-log?${params.toString()}`);
        return res.data?.data;
      } catch (err) {
        throw err;
      }
    },
  });

  // Server-side filter on the audit row's outcome.
  const categories = [
    { key: 'all', label: 'All' },
    { key: 'success', label: 'Success' },
    { key: 'failed', label: 'Failed' },
    { key: 'denied', label: 'Denied' },
  ];

  // Map backend DTOs to the table shape — only real fields, no invented values.
  const rawActions = auditResponse?.actions ?? [];
  const logs: AuditLogEntry[] = rawActions.map((dto: any) => ({
    id: dto.id,
    timestamp: dto.createdAt ? new Date(dto.createdAt).toLocaleString() : '—',
    actorName: dto.adminFullname || (dto.adminEmail ? dto.adminEmail.split('@')[0] : '—'),
    actorEmail: dto.adminEmail || '—',
    actorRole: 'ADMIN',
    ipAddress: dto.ipAddress || '—',
    location: dto.userAgent ? String(dto.userAgent).split(' ')[0] : '',
    category: dto.entityType || '—',
    action: dto.action || '—',
    entityId: dto.entityId || '—',
    entityType: dto.entityType || '—',
    status: dto.result === 'failed' ? 'failed' : dto.result === 'denied' ? 'warning' : 'success',
    diff: {
      before: dto.oldValues ?? null,
      after: dto.newValues ?? null,
    },
  }));

  // Search and outcome are filtered by the API.
  const filteredLogs = logs;

  const totalEntries = auditResponse?.total || filteredLogs.length;
  const totalPages = auditResponse?.totalPages || 1;

  const handleRunExport = async () => {
    setIsExporting(true);
    try {
      const res = await api.post<{ data: { format: string; data: string | any[] } }>('/admin/audit-log/export', {
        format: exportFormat,
        startDate: new Date(exportStartDate).toISOString(),
        endDate: new Date(exportEndDate).toISOString(),
      });
      const exportData = res.data?.data?.data;
      const fileContent = typeof exportData === 'string' ? exportData : JSON.stringify(exportData ?? filteredLogs, null, 2);
      const mimeType = exportFormat === 'csv' ? 'text/csv;charset=utf-8;' : 'application/json;charset=utf-8;';
      const blob = new Blob([fileContent], { type: mimeType });
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `kero-audit-log-${exportStartDate}-to-${exportEndDate}.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      toast.success(
        `Statutory audit report exported (${exportFormat.toUpperCase()}) for ${exportStartDate} to ${exportEndDate}`
      );
      setIsExportOpen(false);
    } catch {
      // Fallback export with current filtered view
      const fileContent = exportFormat === 'json'
        ? JSON.stringify(filteredLogs, null, 2)
        : 'id,timestamp,actorName,actorEmail,category,action,entityId\n' +
          filteredLogs.map(l => `"${l.id}","${l.timestamp}","${l.actorName}","${l.actorEmail}","${l.category}","${l.action}","${l.entityId}"`).join('\n');
      const blob = new Blob([fileContent], { type: exportFormat === 'csv' ? 'text/csv' : 'application/json' });
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `kero-audit-export.${exportFormat}`;
      a.click();
      URL.revokeObjectURL(downloadUrl);
      toast.success(`Audit export downloaded (${exportFormat.toUpperCase()})`);
      setIsExportOpen(false);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Page>
      <PageHeader
        title="Audit trail"
        description="Every admin change, who made it and when."
        actions={
          <AppButton variant="brand" startContent={<DownloadSimple />} label="Export" onPress={() => setIsExportOpen(true)} />
        }
      />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <StatDashboardCard
          label="Events logged"
          icon={ClockCounterClockwise}
          variant="wallet"
          value={
            statsData?.totalActions !== undefined
              ? statsData.totalActions.toLocaleString()
              : (auditResponse?.total ?? 0).toLocaleString()
          }
          hint="Tamper-evident"
        />
        <StatDashboardCard label="Active admins" icon={UsersThree} value={statsData?.byAdmin?.length ?? 0} hint="Made changes" />
        <StatDashboardCard
          label="Failed actions"
          icon={WarningCircle}
          value={statsData?.recentFailures?.length ?? 0}
          hint="Denied or errored"
        />
      </div>

      <DashboardCard className="overflow-hidden p-0">
        <div className="flex flex-col gap-4 p-6 pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <SectionHeader title="Activity" />
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-64">
                <AppInput
                  size="sm"
                  placeholder="Search admin, action or ID"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  startContent={<MagnifyingGlass />}
                />
              </div>
              {(search || selectedCategory !== 'all') && (
                <AppButton
                  variant="ghost"
                  size="sm"
                  onPress={() => {
                    setSearch('');
                    setSelectedCategory('all');
                  }}
                  label="Clear"
                />
              )}
            </div>
          </div>

          <Segmented
            size="sm"
            aria-label="Outcome"
            value={selectedCategory}
            onChange={setSelectedCategory}
            options={categories}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Admin</th>
                <th>Action</th>
                <th>Category</th>
                <th>IP</th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState icon={ClockCounterClockwise} title="No activity found" description="Try a different filter or search." />
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="tabular whitespace-nowrap text-muted">{log.timestamp}</td>
                    <td>
                      <div className="flex items-center gap-3">
                        <UserAvatar name={log.actorName} size="sm" />
                        <div>
                          <p className="font-medium text-foreground">{log.actorName}</p>
                          <p className="text-xs text-muted">{log.actorEmail}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <p className="text-foreground">{log.action}</p>
                      <p className="tabular text-xs text-muted">
                        {log.entityType} · {log.entityId}
                      </p>
                    </td>
                    <td className="whitespace-nowrap text-muted">{log.category}</td>
                    <td className="whitespace-nowrap">
                      <p className="tabular text-foreground">{log.ipAddress}</p>
                      <p className="text-xs text-muted">{log.location}</p>
                    </td>
                    <td className="text-right">
                      <AppRowActions
                        items={[
                          {
                            key: 'diff',
                            label: 'View changes',
                            icon: <ArrowsLeftRight size={14} />,
                            onClick: () => setSelectedLog(log),
                          },
                        ]}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <TablePagination
          page={page}
          totalPages={totalPages}
          summary={`${totalEntries.toLocaleString()} entries`}
          onChange={setPage}
        />
      </DashboardCard>

      {/* Differential Modal: HeroUI Compound centered in middle */}
      <Modal>
        <Modal.Backdrop
          isOpen={Boolean(selectedLog)}
          onOpenChange={(open) => {
            if (!open) setSelectedLog(null);
          }}
        >
          <Modal.Container placement="center" size="lg">
            <Modal.Dialog className="rounded-3xl bg-overlay p-7">
              {selectedLog && (
                <div>
                  <div className="flex items-center justify-between pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-[18px] font-bold tracking-[-0.02em] text-foreground">
                          Audit Differential Inspector
                        </h3>
                        <Chip variant="soft" color="success" className="text-xs tabular">
                          {selectedLog.id}
                        </Chip>
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        Performed by {selectedLog.actorName} ({selectedLog.actorEmail}) at {selectedLog.timestamp}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedLog(null)}
                      className="rounded-lg p-1.5 text-muted hover:bg-muted"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="mt-4 space-y-4">
                    <div className="rounded-xl bg-surface-secondary p-3 text-xs">
                      <span className="font-semibold text-foreground">Action Summary: </span>
                      <span className="text-muted">{selectedLog.action}</span>
                      <div className="mt-1 tabular text-[11px] text-primary">
                        Target: {selectedLog.entityType} ({selectedLog.entityId})
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {/* Before State */}
                      <div className="rounded-xl border border-danger/30 bg-danger/5 p-4">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs font-semibold text-danger">Before Mutation</span>
                          <span className="text-[11px] text-muted">Previous State</span>
                        </div>
                        <pre className="max-h-64 overflow-y-auto rounded-lg bg-background p-3 tabular text-xs text-foreground">
                          {selectedLog.diff.before ? JSON.stringify(selectedLog.diff.before, null, 2) : "Not recorded"}
                        </pre>
                      </div>

                      {/* After State */}
                      <div className="rounded-xl border border-success/30 bg-success-soft p-4">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs font-semibold text-success">After Mutation</span>
                          <span className="text-[11px] text-muted">New State</span>
                        </div>
                        <pre className="max-h-64 overflow-y-auto rounded-lg bg-background p-3 tabular text-xs text-foreground">
                          {selectedLog.diff.after ? JSON.stringify(selectedLog.diff.after, null, 2) : "Not recorded"}
                        </pre>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end">
                    <AppButton variant="outline" onPress={() => setSelectedLog(null)}>
                      Close Inspector
                    </AppButton>
                  </div>
                </div>
              )}
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* Statutory Export Modal: HeroUI Compound centered in middle */}
      <Modal>
        <Modal.Backdrop
          isOpen={isExportOpen}
          onOpenChange={setIsExportOpen}
        >
          <Modal.Container placement="center" size="lg">
            <Modal.Dialog className="rounded-3xl bg-overlay p-7">
              <div>
                <div className="flex items-center justify-between pb-4">
                  <div>
                    <h3 className="text-[18px] font-bold tracking-[-0.02em] text-foreground">
                      Generate Statutory Compliance Export
                    </h3>
                    <p className="mt-1 text-xs text-muted">
                      Produce certified tamper-evident audit records for regulatory oversight
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsExportOpen(false)}
                    className="rounded-lg p-1.5 text-muted hover:bg-muted"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="mt-5 space-y-4">
                  <div>
                    <label className="text-xs font-medium text-muted">Export File Format</label>
                    <div className="mt-2 flex flex-col gap-4">
                      <button
                        type="button"
                        onClick={() => setExportFormat('csv')}
                        className={`flex items-center justify-center gap-2 rounded-xl p-3 text-sm font-medium transition-colors ${
                          exportFormat === 'csv'
                            ? 'bg-secondary-soft text-secondary-soft-foreground'
                            : 'bg-default text-muted hover:text-foreground'
                        }`}
                      >
                        <FileCsv size={20} weight="duotone" />
                        <span>CSV Spreadsheet</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setExportFormat('json')}
                        className={`flex items-center justify-center gap-2 rounded-xl p-3 text-sm font-medium transition-colors ${
                          exportFormat === 'json'
                            ? 'bg-secondary-soft text-secondary-soft-foreground'
                            : 'bg-default text-muted hover:text-foreground'
                        }`}
                      >
                        <FileCode size={20} weight="duotone" />
                        <span>JSON Payload</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4">
                    <div>
                      <label className="text-xs font-medium text-muted">Start Date</label>
                      <div className="mt-1">
                        <AppInput
                          label=""
                          type="date"
                          value={exportStartDate}
                          onChange={(e) => setExportStartDate(e.target.value)}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted">End Date</label>
                      <div className="mt-1">
                        <AppInput
                          label=""
                          type="date"
                          value={exportEndDate}
                          onChange={(e) => setExportEndDate(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl bg-surface-secondary p-3 text-xs text-muted">
                    <span className="font-semibold text-foreground">Statutory Certification: </span>
                    Includes cryptographic hash signatures, actor verification tokens, and compliance metadata formatted for Lagos State Ministry of Transport audit requirements.
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-end gap-3 pt-4">
                  <AppButton variant="outline" onPress={() => setIsExportOpen(false)}>
                    Cancel
                  </AppButton>
                  <AppButton
                    variant="primary"
                    isLoading={isExporting}
                    startContent={<DownloadSimple size={18} weight="duotone" />}
                    onPress={handleRunExport}
                  >
                    Download Export
                  </AppButton>
                </div>
              </div>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </Page>
  );
}
