// src/app/dashboard/TransactionsPage.tsx

"use client"

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Activity, AlertCircle, CheckCircle2 } from 'lucide-react';
import StatCard from '@/components/StatCard';
import { Badge } from '@/components/Badge';
import { DataTable, type ColumnDef } from '@/components/DataTable';
import { FilterRow, Input, PageScaffold, Select } from '@/components/pageScaffold';
import Calender from '@/components/Calender';
import type { FloatLedgerEntry, DashboardRoleUsers } from '@/types/types';
import { formatMoney } from '@/lib/utils';
import api from '@/app/lib/axios';

interface TransactionsPageProps {
  role: DashboardRoleUsers;
}

export default function TransactionsPage({ role }: TransactionsPageProps) {
  const [q, setQ] = React.useState('');
  const prevQRef = useRef(q);
  const [status, setStatus] = React.useState<'ALL' | 'CREDIT' | 'DEBIT'>('ALL');
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({ start: null, end: null });
  const [rows, setRows] = useState<FloatLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [metrics, setMetrics] = useState<any>({});

  const loadTransactions = useCallback(async (start?: Date | null, end?: Date | null) => {
    const fromDate = start !== undefined ? start : dateRange.start;
    const toDate = end !== undefined ? end : dateRange.end;

    if (start !== undefined || end !== undefined) {
      setDateRange({ start: start ?? null, end: end ?? null });
    }

    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (fromDate) params.append("fromDate", fromDate.toISOString());
      if (toDate) params.append("toDate", toDate.toISOString());
      if (status !== 'ALL') params.append("type", status);
      const queryStr = params.toString() ? `?${params.toString()}` : "";

      const res = await api.get(`/transaction${queryStr}`);
      if (res.data?.success) {
        setRows(res.data.data);
        setMetrics(res.data.metrics);
      }
    } catch (err) {
      console.error("Error loading transactions:", err);
    } finally {
      setLoading(false);
    }
  }, [dateRange, status]);

  // Load once on mount or when type filter changes
  useEffect(() => {
    // eslint-disable-next-line 
    loadTransactions();
  }, [status]);

  // Auto-reset calendar when search query input transitions to empty
  useEffect(() => {
    if (q === '' && prevQRef.current !== '') {
      if (dateRange.start !== null || dateRange.end !== null) {
        // eslint-disable-next-line
        loadTransactions(null, null);
      }
    }
    prevQRef.current = q;
  }, [q, dateRange, loadTransactions]);

  const columns: ColumnDef<FloatLedgerEntry>[] = [
    { id: 'id', header: 'tx_id', cell: (r) => <span className="text-slate-200 font-mono text-xs">{r?.id}</span>, sortValue: (r) => r?.id },
    { id: 'user', header: 'user', cell: (r) => <span className="text-slate-400 text-xs">{r?.user}</span>, sortValue: (r) => r?.user },
    { id: 'amount', header: 'amount', align: 'right', sortValue: (r) => r?.amount, cell: (r) => <span className="text-white text-xs font-bold font-mono">{formatMoney(r?.amount||0)}</span> },
    {
      id: 'entry_type',
      header: 'type',
      align: 'center',
      cell: (r) => <Badge variant={r?.entry_type === 'CREDIT' ? 'success' : 'warning'}>{r?.entry_type}</Badge>,
      sortValue: (r) => r?.entry_type,
    },
    { id: 'description', header: 'description', cell: (r) => <span className="text-slate-400 text-xs">{r?.description}</span>, sortValue: (r) => r?.description },
    { id: 'created', header: 'created_at', cell: (r) => <span className="text-slate-500 text-xs">{r?.created_at ? new Date(r.created_at).toLocaleString() : ''}</span>, sortValue: (r) => r?.created_at },
  ];

  return (
    <PageScaffold
      title="Transaction Processing"
      subtitle="POS/top-up throughput and failure visibility (append-only records)"
      right={
        <Select
          value={status}
          onChange={(v) => setStatus(v as 'ALL' | 'CREDIT' | 'DEBIT')}
          options={[
            { value: 'ALL', label: 'All types' },
            { value: 'CREDIT', label: 'Credit' },
            { value: 'DEBIT', label: 'Debit' },
          ]}
        />
      }
      kpis={
        role === 'ADMIN' || role === 'AUDITOR' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard 
              title="Company Float Balance" 
              value={formatMoney(metrics.actualBalance || 0)} 
              icon={<Activity className="text-blue-300" />} 
              iconBg="bg-blue-500/10" 
              subtitle={metrics.drift === 0 ? "Reconciled with ledger" : `Drift: ${formatMoney(metrics.drift || 0)}`}
            />
            <StatCard 
              title="Ledger Net Balance" 
              value={formatMoney(metrics.ledgerNet || 0)} 
              icon={<CheckCircle2 className="text-emerald-300" />} 
              iconBg="bg-emerald-500/10" 
              subtitle={`Creds: ${formatMoney(metrics.credits || 0)} | Debs: ${formatMoney(metrics.debits || 0)}`}
            />
            <StatCard 
              title="Given Today (Allocations)" 
              value={formatMoney(metrics.givenToday || 0)} 
              icon={<AlertCircle className="text-purple-300" />} 
              iconBg="bg-purple-500/10" 
              subtitle="Outflow today"
            />
            <StatCard 
              title="Returned Today (Remits)" 
              value={formatMoney(metrics.returnedToday || 0)} 
              icon={<Activity className="text-emerald-300" />} 
              iconBg="bg-emerald-500/10" 
              subtitle="Inflow today"
            />
          </div>
        ) : role === 'SUPERVISOR' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard 
              title="Given Today (Allocations)" 
              value={formatMoney(metrics.givenToday || 0)} 
              icon={<Activity className="text-blue-300" />} 
              iconBg="bg-blue-500/10" 
              subtitle="Float allocated today"
            />
            <StatCard 
              title="Returned Today (Remitted)" 
              value={formatMoney(metrics.returnedToday || 0)} 
              icon={<CheckCircle2 className="text-emerald-300" />} 
              iconBg="bg-emerald-500/10" 
              subtitle="Team remittances today"
            />
            <StatCard 
              title="Today's Net Outstanding" 
              value={formatMoney(metrics.outstandingToday || 0)} 
              icon={<AlertCircle className="text-purple-300" />} 
              iconBg="bg-purple-500/10" 
              subtitle="Active float in field today"
            />
            <StatCard 
              title="Total Allocated" 
              value={formatMoney(metrics.totalGiven || 0)} 
              icon={<Activity className="text-emerald-300" />} 
              iconBg="bg-emerald-500/10" 
              subtitle="All-time allocations"
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard 
              title="Given Today (Received)" 
              value={formatMoney(metrics.givenToday || 0)} 
              icon={<Activity className="text-blue-300" />} 
              iconBg="bg-blue-500/10" 
              subtitle="Top ups received today"
            />
            <StatCard 
              title="Returned Today (Remitted)" 
              value={formatMoney(metrics.returnedToday || 0)} 
              icon={<CheckCircle2 className="text-emerald-300" />} 
              iconBg="bg-emerald-500/10" 
              subtitle="My remittances today"
            />
            <StatCard 
              title="Active POS Float" 
              value={formatMoney(metrics.activeFloat || 0)} 
              icon={<AlertCircle className="text-purple-300" />} 
              iconBg="bg-purple-500/10" 
              subtitle="Current session balance"
            />
            <StatCard 
              title="Total Received" 
              value={formatMoney(metrics.totalGiven || 0)} 
              icon={<Activity className="text-emerald-300" />} 
              iconBg="bg-emerald-500/10" 
              subtitle="All-time top ups received"
            />
          </div>
        )
      }
    >
      <FilterRow>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
          <div className="w-full sm:w-72 shrink-0">
            <Input value={q} onChange={setQ} placeholder="Search tx_id / user / description…" />
          </div>
          <div className="text-slate-500 text-xs font-medium z-10 w-full sm:w-auto">
            <Calender
              className="w-full"
              range={dateRange ? { startDate: dateRange.start, endDate: dateRange.end } : undefined}
              onRangeChange={(range) => {
                loadTransactions(range.startDate, range.endDate);
              }}
            />
          </div>
        </div>
      </FilterRow>

      {loading ? (
        <div className="text-slate-400 p-8 font-medium">Loading ledger entries...</div>
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          getRowId={(r) => r.id}
          searchValue={q}
          searchPredicate={(r, qq) =>
            r.id.toLowerCase().includes(qq) ||
            r.user.toLowerCase().includes(qq) ||
            r.amount.toString().toLowerCase().includes(qq) ||
            r.description.toLowerCase().includes(qq) ||
            r.entry_type.toLowerCase().includes(qq)
          }
        />
      )}
    </PageScaffold>
  );
}
