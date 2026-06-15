// src/app/dashboard/FloatLedgerPage.tsx

"use client"
import React, { useEffect, useState } from 'react';
import { ArrowRightLeft, Coins, Plus } from 'lucide-react';
import StatCard from '@/components/StatCard';
import { Badge } from '@/components/Badge';
import { DataTable, type ColumnDef } from '@/components/DataTable';
import { FilterRow, Input, PageScaffold, Select } from '@/components/pageScaffold';
import type { DashboardRoleUsers, Float_Alocation, Float_Status } from '@/types/types';
import { formatDateTime, formatMoney } from '@/app/lib/utils';
import { Drawer } from '@/components/Drawer';
import { toast } from 'react-toastify';
import api from '@/app/lib/axios';
import Calender from '@/components/Calender';
import {  TopUpSource, TicketerPosSnapshot } from '@/types/float';
import { useDashboard } from '@/app/dashboard/layout';

interface ActiveSession {
  id: string;
  deviceName: string;
  ticketerId: string;
  ticketerName: string;
  currentFloat: number;
}

interface FloatLedgerPageProps {
  role: DashboardRoleUsers;
  float?: null;
  entries: Float_Alocation[];
  setEntries: React.Dispatch<React.SetStateAction<Float_Alocation[]>>;
  isLoading?: boolean;
  ticketerSnapshot?: TicketerPosSnapshot | null;
  onRefresh?: (startDate?: Date | null, endDate?: Date | null) => void;
  posAllocations?: Float_Alocation[];
  dateRange?: { start: Date | null; end: Date | null }; // Changed here
}


const sourceLabels: Record<TopUpSource, string> = {
  COMPANY_RESERVE: 'Company Reserve',
  GOVERNMENT_TOP_UP: 'Govt Top Up',
  EXTERNAL_OTHER_SOURCE: 'External / Other'
};

export default function FloatLedgerPage({
  role,
  entries,
  isLoading = false,
  ticketerSnapshot = null,
  onRefresh,
  posAllocations = [],
  dateRange,
}: FloatLedgerPageProps) {

  console.log("ENTRIES", entries)
  const [q, setQ] = React.useState('');
  const prevQRef = React.useRef(q);
  const [reason, setReason] = React.useState<'ALL' | Float_Status>('ALL');

  const [open, setOpen] = React.useState(false);
  const [amount, setAmount] = React.useState('');
  const [allocatedSource, setAllocatedSource] = React.useState<TopUpSource | ''>('');
  const [floatSource, setFloatSource] = React.useState('');
  const [allocationNote, setAllocationNote] = React.useState('');

  // Refresh dashboard metrics
  const { refreshMetrics, metrics } = useDashboard();

  // Tab switcher for Admin
  const [activeTab, setActiveTab] = useState<'COMPANY' | 'POS'>('POS');

  // Supervisor specific states
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canAllocate = role === 'SUPERVISOR' || role === 'ADMIN';
  const topUpSources: TopUpSource[] = ['COMPANY_RESERVE', 'GOVERNMENT_TOP_UP', 'EXTERNAL_OTHER_SOURCE'];

  useEffect(() => {
    if (open && role === 'SUPERVISOR') {
      const fetchSessions = async () => {
        try {
          const res = await api.get('/supervisor/topup');
          if (res.data?.success) {
            setActiveSessions(res.data.sessions);
            if (res.data.sessions.length > 0) {
              setSelectedSessionId(res.data.sessions[0].id);
            }
          }
        } catch (err) {
          console.error("Error fetching active sessions:", err);
          toast.error("Failed to load active POS sessions");
        }
      };
      fetchSessions();
    }
  }, [open, role]);

 useEffect(() => {
    // Revert calendar ONLY when the search input transitions from having text to being cleared
    if (q === '' && prevQRef.current !== '') {
      if (dateRange?.start !== null || dateRange?.end !== null) {
        if (onRefresh) {
          onRefresh(null, null);
        }
      }
    }
    prevQRef.current = q; // Sync the ref with current value
  }, [q, dateRange, onRefresh]);

  // Filters for both Company ledger and POS allocations
  const filteredCompany = React.useMemo(() => {
    return entries?.filter((e) => (reason === 'ALL' ? true : e.status === reason));
  }, [entries, reason]);

  const filteredPos = React.useMemo(() => {
    const list = role === 'ADMIN' ? posAllocations : entries;
    return list?.filter((e) => (reason === 'ALL' ? true : e.status === reason));
  }, [posAllocations, entries, reason, role]);

  // Columns for Company Float Topups
  const companyColumns: ColumnDef<Float_Alocation>[] = [
    { id: 'entry_id', header: 'ID', cell: (r) => <span className="text-slate-200 font-mono text-xs">{r?.id}</span> },
    { id: 'from', header: 'Source', cell: (r) => <span className="text-slate-300 text-xs">{sourceLabels[r?.from_user as TopUpSource] || r?.from_user}</span> },
    { id: 'to', header: 'Destination', cell: (r) => <span className="text-slate-300 text-xs">{r?.to_user}</span> },
    { id: 'amount', header: 'Amount', align: 'center', sortValue: (r) => r?.amount_allocated, cell: (r) => <span className="text-white font-mono text-xs font-bold">{formatMoney(r?.amount_allocated || 0)}</span> },
    { id: 'status', header: 'Status', cell: (r) => <Badge variant="info">{r?.status}</Badge> },
    { id: 'created', header: 'Date', cell: (r) => <span className="text-slate-500 text-xs">{formatDateTime(r?.allocated_at)}</span>, sortValue: (r) => r?.allocated_at, align: 'left' },
  ];

  // Columns for POS Topups/Allocations to Ticketer
  const posColumns: ColumnDef<Float_Alocation>[] = [
    { id: 'entry_id', header: 'ID', cell: (r) => <span className="text-slate-200 font-mono text-xs">{r?.id}</span> },
    { id: 'from', header: 'Allocated By', cell: (r) => <span className="text-slate-300 text-xs">{r?.from_user}</span> },
    { id: 'from_role', header: 'Role', cell: (r) => <Badge variant="info">{r?.from_role}</Badge>, align: 'center' },
    { id: 'to', header: role === 'TICKETER' ? 'POS Session' : 'POS Session / Ticketer', cell: (r) => <span className="text-slate-300 text-xs">{r?.to_user}</span> },
    { id: 'amount', header: 'Amount', align: 'center', sortValue: (r) => r?.amount_allocated, cell: (r) => <span className="text-white font-mono text-xs font-bold">{formatMoney(r?.amount_allocated || 0)}</span> },
    { id: 'status', header: 'Status', cell: (r) => <Badge variant="info">{r?.status}</Badge> },
    { id: 'created', header: 'Date', cell: (r) => <span className="text-slate-500 text-xs">{formatDateTime(r?.allocated_at)}</span>, sortValue: (r) => r?.allocated_at, align: 'left' },
  ];

  const handleAdminTopUp = async () => {
    if (!amount || !allocatedSource) {
      toast.error("Please fill all the fields");
      return;
    }

    try {
      setIsSubmitting(true);
      let source = allocatedSource as string;
      if (allocatedSource === 'EXTERNAL_OTHER_SOURCE') {
        source = floatSource;
      }

      const res = await api.post("/admin/float/topup", {
        amount: Number(amount),
        allocated_from: source,
        allocationNote: allocationNote,
      });
      toast.success(res.data.message);
      setOpen(false);
      setAmount("");
      setAllocatedSource("");
      setFloatSource("");
      setAllocationNote("");
      if (onRefresh) onRefresh();
      refreshMetrics();
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "An error occurred";
        toast.error(errorMessage); 
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSupervisorAllocate = async () => {
    if (!amount || !selectedSessionId) {
      toast.error("Please specify both the POS session and amount");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.post("/supervisor/floatallocation", {
        posSessionId: selectedSessionId,
        amount: Number(amount)
      });
      toast.success(res.data.message);
      setOpen(false);
      setAmount("");
      setSelectedSessionId("");
      if (onRefresh) onRefresh();
      refreshMetrics();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      toast.error(errorMessage); 
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="text-slate-400 p-8 font-medium">Loading ledger records...</div>;
  }




  return (
    <>
      <PageScaffold
        title="Float Ledger"
        subtitle="Append-only movement history (allocation / return / adjustment)"
        right={
          <div className="flex items-center gap-2">
            <Select
              value={reason}
              onChange={((v: Float_Status) => setReason(v))}
              options={[
                { value: 'ALL', label: 'All reasons' },
                { value: 'SUCCESS', label: 'Allocate topup' },
                { value: 'ADJUSTED', label: 'Adjust topup' },
                { value: 'CANCELLED', label: 'cancel topup' },
              ]}
            />
            {canAllocate && (
              <button
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-white/3 border border-white/10 px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-300 hover:bg-white/6 hover:text-white transition-colors"
              >
                <Plus className="w-4 h-4" strokeWidth={1.5} /> {role === 'SUPERVISOR' ? 'Allocate Top Up' : 'Add Top Up'}
              </button>
            )}
          </div>
        }
        kpis={
          role === 'TICKETER' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-4">
              <StatCard title="Allocations Count" value={String(filteredPos?.length || 0)} icon={<ArrowRightLeft className="text-blue-300" />} iconBg="bg-blue-500/10" />
              <StatCard title="Top Up Received" value={formatMoney(ticketerSnapshot?.data?.totalTopUp || 0)} icon={<Coins className="text-emerald-300" />} iconBg="bg-emerald-500/10" />
              <StatCard title="Opening Balance" value={formatMoney(ticketerSnapshot?.data?.closingBalance || 0)} icon={<Coins className="text-emerald-300" />} iconBg="bg-emerald-500/10" />
              <StatCard title="Expected Amount" value={formatMoney(ticketerSnapshot?.data?.expectedRemittance || 0)} icon={<Coins className="text-emerald-300" />} iconBg="bg-emerald-500/10" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-4">
              <StatCard title="Entries" value={String(role === 'ADMIN' ? (activeTab === 'COMPANY' ? filteredCompany?.length : filteredPos?.length) : filteredPos?.length)} icon={<ArrowRightLeft className="text-blue-300" />} iconBg="bg-blue-500/10" />
              <StatCard title="Allocated" value={formatMoney(metrics.totalAllocated || 0)} icon={<Coins className="text-emerald-300" />} iconBg="bg-emerald-500/10" />
              <StatCard title="Top Up Balance" value={formatMoney(metrics.availableFloat || 0)} icon={<Coins className="text-emerald-300" />} iconBg="bg-emerald-500/10" />
              <StatCard title="Top Up Received" value={formatMoney(metrics.totalTopUps || 0)} icon={<Coins className="text-emerald-300" />} iconBg="bg-emerald-500/10" />
            </div>
          )
        }
      >

        {/* Admin Tab Switcher */}
        {role === 'ADMIN' && (
          <div className="flex gap-2 border-b border-white/5 mb-6 pb-2">
            <button
              onClick={() => setActiveTab('POS')}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all ${activeTab === 'POS'
                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              POS Allocations
            </button>
            <button
              onClick={() => setActiveTab('COMPANY')}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all ${activeTab === 'COMPANY'
                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              Company Float Top-Ups
            </button>
          </div>
        )}


        <FilterRow>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
            <div className="w-full sm:w-72 shrink-0">
              <Input value={q} onChange={setQ} placeholder="Search ledger entries..." />
            </div>
            {/* Added w-full sm:w-auto below */}
            <div className="text-slate-500 text-xs font-medium z-50 w-full sm:w-auto">
              <Calender
                className="w-full"
                range={dateRange ? { startDate: dateRange.start, endDate: dateRange.end } : undefined}
                onRangeChange={(range) => {
                  if (onRefresh) {
                    onRefresh(range.startDate, range.endDate);
                  }
                }}
              />
            </div>
          </div>
        </FilterRow>


        {role === 'ADMIN' ? (
          activeTab === 'COMPANY' ? (
            <DataTable
              rows={filteredCompany}
              columns={companyColumns}
              getRowId={(r) => r.id}
              searchValue={q}
              searchPredicate={(r, qq) =>
                r?.id?.toLowerCase().includes(qq) ||
                r?.from_user?.toLowerCase().includes(qq) ||
                r?.to_user?.toLowerCase().includes(qq) ||
                r?.status?.toLowerCase().includes(qq) ||
                r?.allocated_at?.toLowerCase().includes(qq)
              }
            />
          ) : (
            <DataTable
              rows={filteredPos}
              columns={posColumns}
              getRowId={(r) => r.id}
              searchValue={q}
              searchPredicate={(r, qq) =>
                r?.id?.toLowerCase().includes(qq) ||
                r?.from_user?.toLowerCase().includes(qq) ||
                r?.to_user?.toLowerCase().includes(qq) ||
                r?.status?.toLowerCase().includes(qq) ||
                r?.allocated_at?.toLowerCase().includes(qq)
              }
            />
          )
        ) : (
          <DataTable
            rows={filteredPos}
            columns={posColumns}
            getRowId={(r) => r.id}
            searchValue={q}
            searchPredicate={(r, qq) =>
              r?.id?.toLowerCase().includes(qq) ||
              r?.from_user?.toLowerCase().includes(qq) ||
              r?.to_user?.toLowerCase().includes(qq) ||
              r?.status?.toLowerCase().includes(qq) ||
              r?.allocated_at?.toLowerCase().includes(qq)
            }
          />
        )}
      </PageScaffold>

      <Drawer
        open={Boolean(open)}
        title={role === 'SUPERVISOR' ? 'Allocate Float to POS Session' : 'Add Top Up'}
        subtitle={role === 'SUPERVISOR' ? 'Assign float directly to an active Ticketer POS session.' : 'Create a new operational top up to increment the company float.'}
        onClose={() => setOpen(false)}
      >
        {role === 'SUPERVISOR' ? (
          <div className="glass-panel rounded-3xl border border-white/10 p-5 space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">
                Select Active POS Session
              </label>
              {activeSessions.length === 0 ? (
                <div className="text-slate-400 text-xs py-3">No active POS sessions available</div>
              ) : (
                <select
                  value={selectedSessionId}
                  onChange={(e) => setSelectedSessionId(e.target.value)}
                  className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {activeSessions.map((s) => (
                    <option key={s.id} value={s.id} className="bg-slate-900 text-slate-300">
                      {s.ticketerName} ({s.deviceName}) — Bal: {formatMoney(s.currentFloat)}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">
                Amount to Allocate
              </label>
              <input
                type="number"
                className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter allocation amount"
              />
            </div>

            <button
              disabled={isSubmitting || !amount || Number(amount) <= 0 || !selectedSessionId}
              onClick={handleSupervisorAllocate}
              className="w-full rounded-2xl bg-blue-500 hover:bg-blue-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold py-3 transition-all"
            >
              {isSubmitting ? 'Allocating...' : 'Allocate Float'}
            </button>
          </div>
        ) : (
          <div className="glass-panel rounded-3xl border border-white/10 p-5 space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">
                Select Top Up Source
              </label>
              <div className="grid grid-cols-3 gap-2 mb-6">
                {topUpSources.map((float_type, index) => (
                  <button
                    key={index}
                    onClick={() => setAllocatedSource(float_type)}
                    style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
                    className={`rounded-2xl border px-3 py-3 text-[11px] font-semibold transition-all min-w-0 ${allocatedSource === float_type
                      ? 'bg-blue-500/20 border-blue-400 text-blue-300'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                      }`}
                  >
                    {sourceLabels[float_type]}
                  </button>
                ))}
              </div>
              {allocatedSource === 'EXTERNAL_OTHER_SOURCE' && (
                <div className="space-y-2 mt-2">
                  <label className="text-sm font-medium text-slate-300 ">
                    Enter Top Up Source
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-slate-300 focus:outline-none"
                    placeholder="Enter Top Up Source"
                    onChange={(e) => setFloatSource(e.target.value)}
                    value={floatSource}
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">
                Amount Received
              </label>
              <input
                type="number"
                className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-slate-300 focus:outline-none"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">
                Allocation Note / Reference
              </label>
              <textarea
                className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-slate-300 focus:outline-none"
                placeholder="Optional note about this float source..."
                onChange={(e) => setAllocationNote(e.target.value)}
                value={allocationNote}
              />
            </div>

            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3">
              <p className="text-xs text-amber-200 leading-relaxed">
                Select the source where this operational top up was received from.
                This helps management track top up origin, reconcile outstanding balances,
                and monitor company versus government-issued top up distribution.
              </p>
            </div>

            <button
              disabled={isSubmitting || !amount || !allocatedSource || (allocatedSource === 'EXTERNAL_OTHER_SOURCE' && !floatSource)}
              onClick={handleAdminTopUp}
              className="w-full rounded-2xl bg-blue-500 hover:bg-blue-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold py-3 transition-all"
            >
              {isSubmitting ? 'Adding...' : 'Add Top Up'}
            </button>
          </div>
        )}
      </Drawer>
    </>
  );
}
