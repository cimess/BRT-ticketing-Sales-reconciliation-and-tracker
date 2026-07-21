// src/app/dashboard/FloatLedgerPage.tsx

"use client"
import React, { useCallback, useEffect, useState } from 'react';
import { ArrowRightLeft, Coins, Plus, ChevronRight } from 'lucide-react';
import StatCard from '@/components/StatCard';
import { Badge } from '@/components/Badge';
import { FilterRow, Input, PageScaffold, Select } from '@/components/pageScaffold';
import type { DashboardRoleUsers, Float_Alocation, Float_Status } from '@/types/types';
import { formatDateTime, formatMoney } from '@/app/lib/utils';
import { Drawer } from '@/components/Drawer';
import { toast } from 'react-toastify';
import api from '@/app/lib/axios';
import Calender from '@/components/Calender';
import { TopUpSource, TicketerPosSnapshot } from '@/types/float';
import { useDashboard } from '@/app/dashboard/layout';
import axios from 'axios';
import Loader from '../loading';

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
  dateRange?: { start: Date | null; end: Date | null };
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


  // Add at the beginning of the FloatLedgerPage component:
  interface QuickStatusDevice {
    id: string;
    name: string;
    serialNumber: string;
    status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
    activeSession: {
      id: string;
      userId: string;
      userName: string;
      currentFloat: number;
      assignedAt: string;
    } | null;
    lastSession: {
      userId: string;
      userName: string;
      lastFloat: number;
      closedAt: string | null;
    } | null;
    isEligible: boolean;
    reason: string | null;
  }

  const [quickDevices, setQuickDevices] = useState<QuickStatusDevice[]>([]);
  const [quickAmounts, setQuickAmounts] = useState<Record<string, string>>({});
  const [quickSubmitting, setQuickSubmitting] = useState<Record<string, boolean>>({});

  const fetchQuickDevices = useCallback(async () => {
    if (role !== 'SUPERVISOR') return;
    try {
      const res = await api.get<{ success: boolean; devices: QuickStatusDevice[] }>('/supervisor/device/quick-status');
      if (res.data?.success) {
        setQuickDevices(res.data.devices);
      }
    } catch (err) {
      if (err instanceof axios.AxiosError) {
        toast.error(err?.response?.data.message || "Failed to load database audit logs.");
      }
      toast.error("Failed to load active POS sessions");
    }
  }, [role]);


  useEffect(() => {
    if (role === 'SUPERVISOR') {
      const timer = setTimeout(() => {
        fetchQuickDevices();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [role, entries, fetchQuickDevices]);

  // Real-time Auto-Refresh: Listen for notification events and reload ledger entries
  useEffect(() => {
    const handleSSE = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.type === "TOPUP_CREATED" || customEvent.detail?.type === "FLOAT_UPDATED") {
        if (onRefresh) onRefresh();
        fetchQuickDevices();
      }
    };

    window.addEventListener("sse", handleSSE);
    return () => {
      window.removeEventListener("sse", handleSSE);
    };
  }, [onRefresh, fetchQuickDevices]);



  const [q, setQ] = useState('');
  const prevQRef = React.useRef(q);
  const [reason, setReason] = useState<'ALL' | Float_Status>('ALL');

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [allocatedSource, setAllocatedSource] = useState<TopUpSource | ''>('');
  const [allocationNote, setAllocationNote] = useState('');

  // Selected entry for details drawer
  const [selectedDetailsFloat, setSelectedDetailsFloat] = useState<Float_Alocation | null>(null);

  // Refresh dashboard metrics
  const { refreshMetrics, metrics } = useDashboard();

  // Tab switcher for Admin
  const [activeTab, setActiveTab] = useState<'COMPANY' | 'POS'>('POS');

  // Vault modal settings for Admin (Credit Vault & Record Expense)
  const [vaultModalType, setVaultModalType] = useState<'CREDIT' | 'EXPENSE' | null>(null);
  const [vaultAmount, setVaultAmount] = useState('');
  const [vaultNote, setVaultNote] = useState('');
  const [isSubmittingVault, setIsSubmittingVault] = useState(false);


  // Supervisor specific states
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reversingId, setReversingId] = useState<string | null>(null);

  const canAllocate = role === 'SUPERVISOR' || role === 'ADMIN';
  const topUpSources: TopUpSource[] = ['COMPANY_RESERVE', 'GOVERNMENT_TOP_UP', 'EXTERNAL_OTHER_SOURCE'];

  useEffect(() => {
    if (open && role === 'SUPERVISOR') {
      const fetchSessions = async () => {
        try {
          const res = await api.get<{ success: boolean; sessions: ActiveSession[] }>('/supervisor/floatallocation');
          if (res.data?.success) {
            setActiveSessions(res.data.sessions);
            if (res.data.sessions.length > 0) {
              setSelectedSessionId(res.data.sessions[0].id);
            }
          }
        } catch (err) {

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
    prevQRef.current = q;
  }, [q, dateRange, onRefresh]);

  // Search filter predicate
  const filterBySearch = (list: Float_Alocation[], query: string) => {
    if (!query) return list;
    const qq = query.toLowerCase();
    return list.filter((r) =>
      r?.id?.toLowerCase().includes(qq) ||
      r?.from_user?.toLowerCase().includes(qq) ||
      r?.to_user?.toLowerCase().includes(qq) ||
      r?.status?.toLowerCase().includes(qq) ||
      r?.allocated_at?.toLowerCase().includes(qq)
    );
  };

  // Filters for both Company ledger and POS allocations
  const companyList = React.useMemo(() => {
    const base = entries?.filter((e) => (reason === 'ALL' ? true : e.status === reason)) || [];
    return filterBySearch(base, q);
  }, [entries, reason, q]);

  const posList = React.useMemo(() => {
    const list = role === 'ADMIN' ? posAllocations : entries;
    const base = list?.filter((e) => (reason === 'ALL' ? true : e.status === reason)) || [];
    return filterBySearch(base, q);
  }, [posAllocations, entries, reason, role, q]);

  const handleAdminTopUp = async () => {
    if (isSubmitting) return;
    if (!amount || !allocatedSource) {
      toast.error("Please fill all the fields");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.post<{ success: boolean; message: string }>("/admin/float/topup", {
        amount: Number(amount),
        allocated_from: allocatedSource,
        allocationNote: allocationNote,
      });
      toast.success(res.data.message);
      setOpen(false);
      setAmount("");
      setAllocatedSource("");
      setAllocationNote("");
      if (onRefresh) onRefresh();
      refreshMetrics();
    } catch (err) {
      if (axios.isAxiosError(err)) {
        toast.error(err.response?.data.message || "Top-up failed");
      } else {
        const errorMessage = err instanceof Error ? err.message : "An error occurred";
        toast.error(errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSupervisorAllocate = async () => {
    if (isSubmitting) return;
    if (!amount || !selectedSessionId) {
      toast.error("Please specify both the POS session and amount");
      return;
    }

    try {

      setIsSubmitting(true);
      const res = await api.post<{ success: boolean; message: string }>("/supervisor/floatallocation", {
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
      if (axios.isAxiosError(err)) {
        toast.error(err.response?.data?.message || err.response?.data?.error || "An error occurred");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReverseAllocation = async (allocationId: string) => {
    if (isSubmitting) return;
    if (!window.confirm("Are you sure you want to reverse this float allocation? This will return the allocated amount to the company vault and deduct it from the ticketer's POS session.")) {
      return;
    }
    try {
      setReversingId(allocationId);
      const res = await api.patch<{ success: boolean; message?: string }>(`/supervisor/floatallocation/${allocationId}/reverse`);
      if (res.data?.success) {
        toast.success("Float allocation reversed successfully!");
        setSelectedDetailsFloat(null);
        if (onRefresh) onRefresh();
        refreshMetrics();
      } else {
        toast.error(res.data?.message || "Failed to reverse allocation");
      }
    } catch (err) {
      (err);
      if (axios.isAxiosError(err)) {
        toast.error(err.response?.data?.error || err.response?.data?.message || err?.message || "An error occurred");
      }
    } finally {
      setReversingId(null);
    }
  };

  const handleVaultActionSubmit = async () => {
    if (isSubmitting) return;
    if (!vaultAmount || Number(vaultAmount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (vaultModalType === 'EXPENSE' && !vaultNote.trim()) {
      toast.error("Note is required to record an expense");
      return;
    }

    try {
      setIsSubmittingVault(true);
      const url =
        vaultModalType === 'CREDIT'
          ? '/admin/float/company/credit'
          : '/admin/float/company/expense';

      const res = await api.post(url, {
        amount: Number(vaultAmount),
        note: vaultNote.trim() || undefined
      });

      if (res.data?.success) {
        toast.success(res.data.message || "Action completed successfully");
        setVaultModalType(null);
        setVaultAmount('');
        setVaultNote('');
        if (onRefresh) onRefresh();
        refreshMetrics();
        // Dispatch event so other pages (Overview, etc.) update their statistics
        window.dispatchEvent(new CustomEvent("sse", { detail: { type: "FLOAT_UPDATED" } }));
      }
    } catch (err) {
      if (err instanceof axios.AxiosError) {
        toast.error(err.response?.data?.message || err.response?.data?.error || "Action failed");
      } else {
        toast.error("Action failed");
      }
    } finally {
      setIsSubmittingVault(false);
    }
  };


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <Loader />
      </div>
    )
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
            {role === 'ADMIN' && (
              <>
                <button
                  onClick={() => setVaultModalType('CREDIT')}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-1 lg:px-4 py-2 lg:py-2.5 text-[8px] lg:text-[11px] font-bold uppercase tracking-widest text-emerald-400 hover:bg-emerald-500/20 active:scale-95 transition-all"
                >
                  <Plus className="w-4 h-4 hidden lg:inline" strokeWidth={1.5} />
                  <span className="">Credit Vault</span>
                </button>
                <button
                  onClick={() => setVaultModalType('EXPENSE')}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 px-1 lg:px-4 py-2 lg:py-2.5 text-[8px] lg:text-[11px] font-bold uppercase tracking-widest text-amber-400 hover:bg-amber-500/20 active:scale-95 transition-all"
                >
                  <Plus className="w-4 h-4 hidden lg:inline" strokeWidth={1.5} />
                  <span className="">Record Expense</span>
                </button>
              </>
            )}
            {canAllocate && (
              <button
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-500/10 border border-blue-500/20 px-1 lg:px-4 py-2 lg:py-2.5 text-[8px] lg:text-[11px] font-bold uppercase tracking-widest text-blue-400 hover:bg-blue-500/20 hover:text-white transition-colors"
              >
                <Plus className="w-4 h-4 hidden lg:inline" strokeWidth={1.5} /> <span className="">{role === 'SUPERVISOR' ? 'Allocate Float' : 'Add Top Up'}</span>
              </button>
            )}
          </div>
        }

        kpis={
          role === 'TICKETER' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-4">
              <StatCard title="Allocations Count" value={String(posList?.length || 0)} icon={<ArrowRightLeft className="text-blue-300" />} iconBg="bg-blue-500/10" />
              <StatCard title="Top Up Received" value={formatMoney(ticketerSnapshot?.data?.totalTopUp || 0)} icon={<Coins className="text-emerald-300" />} iconBg="bg-emerald-500/10" />
              <StatCard title="Closing Balance" value={formatMoney(ticketerSnapshot?.data?.closingBalance || 0)} icon={<Coins className="text-emerald-300" />} iconBg="bg-emerald-500/10" />
              <StatCard title="Expected Amount" value={formatMoney(ticketerSnapshot?.data?.expectedRemittance || 0)} icon={<Coins className="text-emerald-300" />} iconBg="bg-emerald-500/10" />
            </div>
          ) : role === 'ADMIN' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <StatCard title="Available Float (Vault)" value={formatMoney(metrics.availableFloat || 0)} icon={<Coins className="text-emerald-300" />} iconBg="bg-emerald-500/10" />
              <StatCard title="TopUp Bank (Operational)" value={formatMoney(metrics.topUpBankBalance || 0)} icon={<Coins className="text-blue-300" />} iconBg="bg-blue-500/10" />
              <StatCard title="Allocated (Today)" value={formatMoney(metrics.totalAllocated || 0)} icon={<Coins className="text-blue-300" />} iconBg="bg-blue-500/10" />
              <StatCard title="Remitted (Today)" value={formatMoney(metrics.companyRemitted || 0)} icon={<Coins className="text-emerald-300" />} iconBg="bg-emerald-500/10" />
              <StatCard title="Pos Total Float" value={formatMoney(metrics.circulatingFloat || 0)} icon={<Coins className="text-amber-300" />} iconBg="bg-amber-500/10" />
              <StatCard title="Outstanding (Supervisors)" value={formatMoney(metrics.supervisorCash || 0)} icon={<Coins className="text-rose-300" />} iconBg="bg-rose-500/10" />
              <StatCard
                title="Ledger Sync Drift"
                value={metrics.ledgerReconciliation?.isInSync ? "In Sync" : formatMoney(metrics.ledgerReconciliation?.drift || 0)}
                icon={<ArrowRightLeft className={metrics.ledgerReconciliation?.isInSync ? "text-emerald-300" : "text-rose-400"} />}
                iconBg={metrics.ledgerReconciliation?.isInSync ? "bg-emerald-500/10" : "bg-rose-500/10"}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              <StatCard title="Top Up" value={formatMoney(metrics.availableFloat || 0)} icon={<Coins className="text-emerald-300" />} iconBg="bg-emerald-500/10" />
              <StatCard title="Allocated (Today)" value={formatMoney(metrics.totalAllocated || 0)} icon={<Coins className="text-blue-300" />} iconBg="bg-blue-500/10" />
              <StatCard title="Pending Remittance" value={formatMoney(metrics.pendingRemittances || 0)} icon={<Coins className="text-amber-300" />} iconBg="bg-amber-500/10" />
              <StatCard title="Outstanding (Ticketers)" value={formatMoney(metrics.circulatingFloat || 0)} icon={<Coins className="text-amber-300" />} iconBg="bg-amber-500/10" />
              <StatCard title="Supervisor Cash (In Hand)" value={formatMoney(metrics.supervisorCash || 0)} icon={<Coins className="text-rose-300" />} iconBg="bg-rose-500/10" />
              <StatCard title="Allocations Count" value={String(posList?.length || 0)} icon={<ArrowRightLeft className="text-blue-300" />} iconBg="bg-blue-500/10" />
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

        {role === 'SUPERVISOR' && quickDevices.length > 0 && (
          <div className="bg-white/3 border border-white/5 rounded-3xl p-6 mb-6">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Quick POS Allocation Dashboard</h3>
                <p className="text-[11px] text-slate-400 mt-1">Assign inactive devices and allocate float instantly to the last holder.</p>
              </div>
              <button
                onClick={fetchQuickDevices}
                className="text-[10px] text-blue-400 font-bold uppercase tracking-wider hover:underline"
              >
                Refresh Status
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {quickDevices.map((device) => {
                const isDeviceActive = device.status === 'ACTIVE';
                const lastHolder = device.lastSession?.userName || "N/A";
                const currentHolder = device.activeSession?.userName || lastHolder;
                const currentFloat = isDeviceActive ? (device.activeSession?.currentFloat ?? 0) : (device.lastSession?.lastFloat ?? 0);

                return (
                  <div
                    key={device.id}
                    className={`rounded-2xl border p-4 transition-all relative ${isDeviceActive
                      ? 'bg-blue-950/20 border-blue-500/30'
                      : device.status === 'MAINTENANCE'
                        ? 'bg-red-950/10 border-red-500/10 opacity-70'
                        : 'bg-white/3 border-white/5'
                      }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="text-xs font-bold text-white font-mono">{device.name}</h4>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">{device.serialNumber}</p>
                      </div>
                      <Badge variant={isDeviceActive ? 'success' : device.status === 'MAINTENANCE' ? 'danger' : 'neutral'}>
                        {device.status}
                      </Badge>
                    </div>

                    <div className="space-y-1.5 mb-4 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-medium">Holder:</span>
                        <span className="text-slate-200 font-semibold">{currentHolder}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-medium">
                          {isDeviceActive ? 'Current Float:' : 'Carry-over Float:'}
                        </span>
                        <span className="text-slate-200 font-mono font-bold">{formatMoney(currentFloat)}</span>
                      </div>
                    </div>

                    {device.isEligible ? (
                      <div className="space-y-2 mt-4 pt-3 border-t border-white/5">
                        <div className="flex gap-2">
                          <input
                            type="number"
                            placeholder="Allocation amount (₦)"
                            value={quickAmounts[device.id] || ''}
                            onChange={(e) => setQuickAmounts(prev => ({ ...prev, [device.id]: e.target.value }))}
                            disabled={quickSubmitting[device.id]}
                            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <button
                            onClick={async () => {
                              if (quickSubmitting[device.id]) return;
                              const amount = quickAmounts[device.id];
                              if (!amount || Number(amount) <= 0) {
                                toast.error("Please enter a valid amount");
                                return;
                              }

                              if (!isDeviceActive) {
                                const confirmAssign = window.confirm(
                                  `This will assign ${device.name} to ${lastHolder} with carry-over of ${formatMoney(currentFloat)} and allocate an additional ${formatMoney(Number(amount))}. Continue?`
                                );
                                if (!confirmAssign) return;
                              }

                              try {
                                setQuickSubmitting(prev => ({ ...prev, [device.id]: true }));
                                const res = await api.post<{ success: boolean; message: string }>("/supervisor/floatallocation", {
                                  deviceId: device.id,
                                  amount: Number(amount)
                                });
                                toast.success(res.data.message);
                                setQuickAmounts(prev => ({ ...prev, [device.id]: '' }));
                                if (onRefresh) onRefresh();
                                refreshMetrics();
                                fetchQuickDevices();
                              } catch (err) {
                                if (axios.isAxiosError(err)) {
                                  toast.error(err.response?.data?.message || err.response?.data?.error || "An error occurred");
                                }
                              } finally {
                                setQuickSubmitting(prev => ({ ...prev, [device.id]: false }));
                              }
                            }}
                            disabled={quickSubmitting[device.id] || !quickAmounts[device.id]}
                            className="rounded-xl bg-blue-500 hover:bg-blue-400 disabled:bg-slate-700 disabled:text-slate-500 text-white text-[11px] font-bold px-3 py-2 shrink-0 transition-all"
                          >
                            {quickSubmitting[device.id] ? '...' : isDeviceActive ? 'Top Up' : 'Assign & Alloc'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 pt-3 border-t border-white/5 text-center">
                        <span className="text-[10px] text-rose-400 font-bold bg-rose-500/10 px-2.5 py-1 rounded-lg inline-block">
                          ⚠️ {device.reason || 'Not eligible for quick assign'}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}


        <FilterRow>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
            <div className="w-full sm:w-72 shrink-0">
              <Input value={q} onChange={setQ} placeholder="Search ledger entries..." />
            </div>
            <div className="text-slate-500 text-xs font-medium z-30 w-full sm:w-auto">
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

        {/* Mobile-first Minimalist Card Deck List */}
        {role === 'ADMIN' && activeTab === 'COMPANY' ? (
          companyList.length === 0 ? (
            <div className="text-center py-10 text-slate-600 text-xs italic">No top-ups found.</div>
          ) : (
            <div className="space-y-2">
              {companyList.map((item: Float_Alocation) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedDetailsFloat(item)}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-white/3 border border-white/5 hover:border-white/10 hover:bg-white/5 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                      <Coins className="size-4 text-emerald-400" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">
                        {sourceLabels[item.from_user as TopUpSource] || item.from_user}
                      </h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {formatDateTime(item.allocated_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-xs font-black text-white font-mono">
                        {formatMoney(item.amount_allocated)}
                      </span>
                      <span className={`block text-[9px] font-black uppercase tracking-wider mt-0.5 ${item.status === 'SUCCESS' ? 'text-emerald-400' : item.status === 'CANCELLED' ? 'text-rose-400' : 'text-amber-400'
                        }`}>
                        {item.status}
                      </span>
                    </div>
                    <ChevronRight className="size-4 text-slate-600" />
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          posList.length === 0 ? (
            <div className="text-center py-10 text-slate-600 text-xs italic">No allocations found.</div>
          ) : (
            <div className="space-y-2">
              {posList.map((item: Float_Alocation) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedDetailsFloat(item)}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-white/3 border border-white/5 hover:border-white/10 hover:bg-white/5 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                      <ArrowRightLeft className="size-4 text-blue-400" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">{item.to_user}</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {formatDateTime(item.allocated_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-xs font-black text-white font-mono">
                        {formatMoney(item.amount_allocated)}
                      </span>
                      <span className={`block text-[9px] font-black uppercase tracking-wider mt-0.5 ${item.status === 'SUCCESS' ? 'text-emerald-400' : item.status === 'CANCELLED' ? 'text-rose-400' : 'text-amber-400'
                        }`}>
                        {item.status}
                      </span>
                    </div>
                    <ChevronRight className="size-4 text-slate-600" />
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </PageScaffold>

      {/* DRAWER: Float details (Mobile slide-up sheet) */}
      <Drawer
        open={!!selectedDetailsFloat}
        title="Float Allocation Details"
        subtitle="Verification & transaction state"
        onClose={() => setSelectedDetailsFloat(null)}
      >
        {selectedDetailsFloat && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-white/3 border border-white/5 space-y-4">
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <div>
                  <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest block">Amount</label>
                  <span className="text-lg font-black text-white font-mono mt-1 block">
                    {formatMoney(selectedDetailsFloat.amount_allocated)}
                  </span>
                </div>
                <Badge variant={selectedDetailsFloat.status === 'SUCCESS' ? 'success' : selectedDetailsFloat.status === 'CANCELLED' ? "danger" : 'warning'}>
                  {selectedDetailsFloat.status}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest block">Allocated By</label>
                  <span className="text-xs font-semibold text-slate-200 mt-1 block">{selectedDetailsFloat.from_user}</span>
                  {selectedDetailsFloat.from_role && (
                    <span className="text-[9px] text-slate-500 uppercase font-black block mt-0.5">{selectedDetailsFloat.from_role}</span>
                  )}
                </div>
                <div>
                  <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest block">Destination</label>
                  <span className="text-xs font-semibold text-slate-200 mt-1 block">
                    {activeTab === 'COMPANY' && role === 'ADMIN'
                      ? (sourceLabels[selectedDetailsFloat.from_user as TopUpSource] || selectedDetailsFloat.from_user)
                      : selectedDetailsFloat.to_user}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                {role === 'ADMIN' && <div>
                  <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest block">Allocation ID</label>
                  <span className="text-[10px] font-mono text-slate-400 mt-1 block break-all">{selectedDetailsFloat.id}</span>
                </div>}
                <div>

                  <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest block">Timestamp</label>
                  <span className="text-xs text-slate-400 mt-1 block">{formatDateTime(selectedDetailsFloat.allocated_at)}</span>
                </div>
              </div>

              {selectedDetailsFloat.pre_allocation_float !== undefined && (
                <div className="border-t border-white/5 pt-3">
                  <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest block">
                    POS Drawer Balance (Before Allocation)
                  </label>
                  <span className="text-xs font-semibold text-slate-200 font-mono mt-1 block">
                    {formatMoney(selectedDetailsFloat.pre_allocation_float)}
                  </span>
                </div>
              )}
            </div>


            {/* Actions Section for Admins & Supervisors */}
            {activeTab === 'COMPANY' && role === 'ADMIN' && selectedDetailsFloat.status === 'SUCCESS' && (
              <button
                onClick={async () => {
                  if (reversingId) return;
                  const id = selectedDetailsFloat.id;
                  setSelectedDetailsFloat(null);
                  if (!window.confirm("Are you sure you want to reverse this top-up? This will return the top-up amount from the TopUp Bank to the Company Float.")) {
                    return;
                  }
                  try {
                    setReversingId(id);
                    const res = await api.post("/admin/float/reversetopup", { id });
                    if (res.data?.success) {
                      toast.success(res.data.message || "Top-up reversed successfully!");
                      if (onRefresh) onRefresh();
                      refreshMetrics();
                      window.dispatchEvent(new CustomEvent("sse", { detail: { type: "FLOAT_UPDATED" } }));
                    } else {
                      toast.error(res.data?.message || "Failed to reverse top-up");
                    }
                  } catch (err) {
                    if (axios.isAxiosError(err)) {
                      toast.error(err.response?.data?.message || err.response?.data?.error || "An error occurred");
                    }
                  } finally {
                    setReversingId(null);
                  }
                }}
                disabled={reversingId === selectedDetailsFloat.id}
                className="w-full rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
              >
                <ArrowRightLeft className="size-4" />
                {reversingId === selectedDetailsFloat.id ? 'Reversing...' : 'Reverse Top Up'}
              </button>
            )}

            {/* Actions Section for Admins & Supervisors */}
            {activeTab === 'COMPANY' && role === 'ADMIN' && selectedDetailsFloat.status === 'SUCCESS' && (
              <button
                onClick={async () => {
                  const id = selectedDetailsFloat.id;
                  setSelectedDetailsFloat(null);
                  if (!window.confirm("Are you sure you want to reverse this top-up? This will return the top-up amount from the TopUp Bank to the Company Float.")) {
                    return;
                  }
                  try {
                    setReversingId(id);
                    const res = await api.post("/admin/float/reversetopup", { id });
                    if (res.data?.success) {
                      toast.success(res.data.message || "Top-up reversed successfully!");
                      if (onRefresh) onRefresh();
                      refreshMetrics();
                      window.dispatchEvent(new CustomEvent("sse", { detail: { type: "FLOAT_UPDATED" } }));
                    } else {
                      toast.error(res.data?.message || "Failed to reverse top-up");
                    }
                  } catch (err) {
                    if (axios.isAxiosError(err)) {
                      toast.error(err.response?.data?.message || err.response?.data?.error || "An error occurred");
                    }
                  } finally {
                    setReversingId(null);
                  }
                }}
                disabled={reversingId === selectedDetailsFloat.id}
                className="w-full rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
              >
                <ArrowRightLeft className="size-4" />
                {reversingId === selectedDetailsFloat.id ? 'Reversing...' : 'Reverse Top Up'}
              </button>
            )}

            {/* ADD THIS NEW BLOCK BELOW */}
            {((role === 'SUPERVISOR') || (role === 'ADMIN' && activeTab === 'POS')) && selectedDetailsFloat.status === 'SUCCESS' && (
              <button
                onClick={() => handleReverseAllocation(selectedDetailsFloat.id)}
                disabled={reversingId === selectedDetailsFloat.id}
                className="w-full rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
              >
                <ArrowRightLeft className="size-4" />
                {reversingId === selectedDetailsFloat.id ? 'Reversing...' : 'Reverse Float Allocation'}
              </button>
            )}


          </div>
        )}
      </Drawer>

      {/* DRAWER: Allocate/Add Top Up */}
      <Drawer
        open={Boolean(open)}
        title={role === 'SUPERVISOR' ? 'Allocate Float to POS Session' : 'Add Top Up'}
        subtitle={role === 'SUPERVISOR' ? 'Assign float directly to an active Ticketer POS session.' : 'Deploy operational top-up to the TopUp Bank from the Company Float.'}

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
              disabled={isSubmitting || !amount || !allocatedSource}
              onClick={handleAdminTopUp}
              className="w-full rounded-2xl bg-blue-500 hover:bg-blue-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold py-3 transition-all"
            >
              {isSubmitting ? 'Adding...' : 'Add Top Up'}
            </button>
          </div>
        )}
      </Drawer>

      {/* DRAWER: Credit Vault / Record Expense */}
      <Drawer
        open={Boolean(vaultModalType)}
        title={vaultModalType === 'CREDIT' ? 'Credit Company Float (Vault)' : 'Record Company Expense'}
        subtitle={vaultModalType === 'CREDIT' ? 'Add funds directly to the master company vault.' : 'Deduct funds from the master vault to record business expenses.'}
        onClose={() => setVaultModalType(null)}
      >
        <div className="glass-panel rounded-3xl border border-white/10 p-5 space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">
              Amount (₦)
            </label>
            <input
              type="number"
              className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-slate-300 focus:outline-none"
              value={vaultAmount}
              onChange={(e) => setVaultAmount(e.target.value)}
              placeholder="Enter amount"
              min="1"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">
              {vaultModalType === 'EXPENSE' ? 'Expense Description (Required)' : 'Note / Reference (Optional)'}
            </label>
            <textarea
              className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-slate-300 focus:outline-none"
              placeholder={vaultModalType === 'EXPENSE' ? 'E.g., Office internet subscription...' : 'Optional notes...'}
              onChange={(e) => setVaultNote(e.target.value)}
              value={vaultNote}
            />
          </div>

          <button
            disabled={isSubmittingVault || !vaultAmount || (vaultModalType === 'EXPENSE' && !vaultNote.trim())}
            onClick={handleVaultActionSubmit}
            className={`w-full rounded-2xl font-semibold py-3 transition-all ${vaultModalType === 'CREDIT'
                ? 'bg-emerald-500 hover:bg-emerald-400 text-white disabled:bg-slate-700 disabled:text-slate-500'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950 disabled:bg-slate-700 disabled:text-slate-500'
              }`}
          >
            {isSubmittingVault ? 'Processing...' : vaultModalType === 'CREDIT' ? 'Credit Vault' : 'Record Expense'}
          </button>
        </div>
      </Drawer>

    </>
  );
}
