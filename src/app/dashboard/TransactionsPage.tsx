// src/app/dashboard/TransactionsPage.tsx

"use client"

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Activity, AlertCircle, CheckCircle2, ChevronRight, ArrowDownLeft, ArrowUpRight, Plus, RotateCcw } from 'lucide-react';
import StatCard from '@/components/StatCard';
import { Badge } from '@/components/Badge';
import { FilterRow, Input, PageScaffold, Select } from '@/components/pageScaffold';
import Calender from '@/components/Calender';
import type { FloatLedgerEntry, DashboardRoleUsers } from '@/types/types';
import { formatMoney } from '@/lib/utils';
import api from '@/app/lib/axios';
import { Drawer } from '@/components/Drawer';
import { toast } from 'react-toastify';
import { useDashboard } from '@/app/dashboard/layout';
import axios from 'axios';

interface TransactionsPageProps {
  role: DashboardRoleUsers;
}

interface TransactionMetrics {
  actualBalance?: number;
  drift?: number;
  ledgerNet?: number;
  credits?: number;
  debits?: number;
  givenToday?: number;
  returnedToday?: number;
  outstandingToday?: number;
  totalGiven?: number;
  activeFloat?: number;
}

export default function TransactionsPage({ role }: TransactionsPageProps) {
  const [q, setQ] = useState('');
  const prevQRef = useRef(q);
  const [status, setStatus] = useState<'ALL' | 'CREDIT' | 'DEBIT'>('ALL');
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({ start: null, end: null });
  const [rows, setRows] = useState<FloatLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<TransactionMetrics>({});
  const [selectedDetailsTx, setSelectedDetailsTx] = useState<FloatLedgerEntry | null>(null);

  // Vault modal settings
  const [modalType, setModalType] = useState<'CREDIT' | 'DEBIT' | 'EXPENSE' | null>(null);
  const [actionAmount, setActionAmount] = useState('');
  const [actionNote, setActionNote] = useState('');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [reversing, setReversing] = useState(false);

  const { refreshMetrics } = useDashboard();

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
      if (err instanceof axios.AxiosError) {
        toast.error(err?.response?.data.message || "Failed to load transactions.");
      } else {
        toast.error("Failed to load transactions.");
      }
    } finally {
      setLoading(false);
    }
  }, [dateRange, status]);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (active) {
        loadTransactions();
      }
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [status, loadTransactions]);

  useEffect(() => {
    const handleSSE = (e: Event) => {
      const customEvent = e as CustomEvent;
      const type = customEvent.detail?.type;
      if (type === "TOPUP_CREATED" || type === "REMITTANCE_CREATED" || type === "FLOAT_UPDATED") {
        loadTransactions();
      }
    };

    window.addEventListener("sse", handleSSE);
    return () => {
      window.removeEventListener("sse", handleSSE);
    };
  }, [loadTransactions]);

  useEffect(() => {
    let active = true;
    let timer: NodeJS.Timeout | undefined;

    if (q === '' && prevQRef.current !== '') {
      if (dateRange.start !== null || dateRange.end !== null) {
        timer = setTimeout(() => {
          if (active) {
            loadTransactions(null, null);
          }
        }, 0);
      }
    }
    prevQRef.current = q;

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [q, dateRange, loadTransactions]);

  const handleVaultActionSubmit = async () => {
    if (!actionAmount || Number(actionAmount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (modalType === 'EXPENSE' && !actionNote.trim()) {
      toast.error("Note is required to record an expense");
      return;
    }

    try {
      setIsSubmittingAction(true);
      const url =
        modalType === 'CREDIT' ? '/admin/float/company/credit' :
        modalType === 'DEBIT' ? '/admin/float/company/debit' :
        '/admin/float/company/expense';

      const res = await api.post(url, {
        amount: Number(actionAmount),
        note: actionNote.trim() || undefined
      });

      if (res.data?.success) {
        toast.success(res.data.message || "Action completed successfully");
        setModalType(null);
        setActionAmount('');
        setActionNote('');
        loadTransactions();
        refreshMetrics();
        window.dispatchEvent(new CustomEvent("sse", { detail: { type: "FLOAT_UPDATED" } }));
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        toast.error(err.response?.data?.message || "Action failed");
      } else {
        toast.error("Action failed");
      }
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleReverse = async (ledgerId: string) => {
    if (!window.confirm("Are you sure you want to reverse this float adjustment?")) {
      return;
    }
    try {
      setReversing(true);
      const res = await api.post("/admin/float/company/reverse", { ledgerId });
      if (res.data?.success) {
        toast.success(res.data.message || "Adjustment reversed successfully");
        setSelectedDetailsTx(null);
        loadTransactions();
        refreshMetrics();
        window.dispatchEvent(new CustomEvent("sse", { detail: { type: "FLOAT_UPDATED" } }));
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        toast.error(err.response?.data?.message || "Reversal failed");
      } else {
        toast.error("Reversal failed");
      }
    } finally {
      setReversing(false);
    }
  };

  const filteredRows = React.useMemo(() => {
    if (!q) return rows;
    const qq = q.toLowerCase();
    return rows.filter((r) =>
      r.id.toLowerCase().includes(qq) ||
      r?.user?.toLowerCase().includes(qq) ||
      r.amount.toString().toLowerCase().includes(qq) ||
      r.description.toLowerCase().includes(qq) ||
      r.entry_type.toLowerCase().includes(qq)
    );
  }, [rows, q]);

  const canReverse = role === 'ADMIN' &&
    selectedDetailsTx &&
    selectedDetailsTx.display_status !== 'REVERSED' &&
    ['COMPANY_DEPOSIT', 'COMPANY_WITHDRAWAL', 'COMPANY_EXPENSE'].includes(selectedDetailsTx.reference_type || '');

  return (
    <>
      <PageScaffold
        title="Transaction Processing"
        subtitle="POS/top-up throughput and failure visibility (append-only records)"
        right={
          <div className="flex items-center gap-3">
            <Select
              value={status}
              onChange={(v) => setStatus(v as 'ALL' | 'CREDIT' | 'DEBIT')}
              options={[
                { value: 'ALL', label: 'All types' },
                { value: 'CREDIT', label: 'Credit' },
                { value: 'DEBIT', label: 'Debit' },
              ]}
            />
            {role === 'ADMIN' && (
              <div className="flex gap-2">
                <button
                  onClick={() => setModalType('CREDIT')}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-emerald-400 hover:bg-emerald-500/20 active:scale-95 transition-all"
                >
                  <Plus className="size-3.5" /> Credit Vault
                </button>
                <button
                  onClick={() => setModalType('DEBIT')}
                  className="inline-flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-rose-400 hover:bg-rose-500/20 active:scale-95 transition-all"
                >
                  <Plus className="size-3.5" /> Debit Vault
                </button>
                <button
                  onClick={() => setModalType('EXPENSE')}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-amber-400 hover:bg-amber-500/20 active:scale-95 transition-all"
                >
                  <Plus className="size-3.5" /> Record Expense
                </button>
              </div>
            )}
          </div>
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
        ) : filteredRows.length === 0 ? (
          <div className="text-center py-10 text-slate-600 text-xs italic">No transactions found.</div>
        ) : (
          <div className="space-y-2">
            {filteredRows.map((item: FloatLedgerEntry) => (
              <div
                key={item.id}
                onClick={() => setSelectedDetailsTx(item)}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-white/3 border border-white/5 hover:border-white/10 hover:bg-white/5 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                    {item.display_status === 'REVERSED' ? (
                      <AlertCircle className="size-4 text-amber-400" />
                    ) : item.entry_type === 'CREDIT' ? (
                      <ArrowDownLeft className="size-4 text-emerald-400" />
                    ) : (
                      <ArrowUpRight className="size-4 text-rose-400" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">{item.user}</h4>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {item.created_at ? new Date(item.created_at).toLocaleString() : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-xs font-black text-white font-mono">
                      {formatMoney(item.amount || 0)}
                    </span>
                    <span className="block mt-0.5">
                      <Badge variant={
                        item.display_status === 'REVERSED'
                          ? 'danger'
                          : item.entry_type === 'CREDIT'
                          ? 'success'
                          : 'warning'
                      }>
                        {item.display_status || item.entry_type}
                      </Badge>
                    </span>
                  </div>
                  <ChevronRight className="size-4 text-slate-600" />
                </div>
              </div>
            ))}
          </div>
        )}
      </PageScaffold>

      {/* DRAWER: Transaction Details */}
      <Drawer
        open={!!selectedDetailsTx}
        title="Transaction Details"
        subtitle="Verification & ledger reference"
        onClose={() => setSelectedDetailsTx(null)}
      >
        {selectedDetailsTx && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-white/3 border border-white/5 space-y-4">
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <div>
                  <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest block">Amount</label>
                  <span className="text-lg font-black text-white font-mono mt-1 block">
                    {formatMoney(selectedDetailsTx.amount || 0)}
                  </span>
                </div>
                <Badge variant={
                  selectedDetailsTx.display_status === 'REVERSED'
                    ? 'warning'
                    : selectedDetailsTx.entry_type === 'CREDIT'
                    ? 'success'
                    : 'danger'
                }>
                  {selectedDetailsTx.display_status || selectedDetailsTx.entry_type}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest block">User / Entity</label>
                  <span className="text-xs font-semibold text-slate-200 mt-1 block">{selectedDetailsTx.user}</span>
                </div>
                {role === 'ADMIN' && (
                  <div>
                    <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest block">Transaction ID</label>
                    <span className="text-[10px] font-mono text-slate-400 mt-1 block break-all">{selectedDetailsTx.id}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5">
                <div>
                  <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest block">Timestamp</label>
                  <span className="text-xs text-slate-400 mt-1 block">
                    {selectedDetailsTx.created_at ? new Date(selectedDetailsTx.created_at).toLocaleString() : ''}
                  </span>
                </div>
                {selectedDetailsTx.reference_type && (
                  <div>
                    <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest block">Reference Type</label>
                    <span className="text-xs text-slate-400 mt-1 block font-mono">
                      {selectedDetailsTx.reference_type}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {selectedDetailsTx.description && (
              <div className="p-4 rounded-xl bg-white/3 border border-white/5">
                <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest block mb-1">Description</label>
                <p className="text-xs text-slate-300 leading-relaxed font-sans">{selectedDetailsTx.description}</p>
              </div>
            )}

            {canReverse && (
              <button
                onClick={() => handleReverse(selectedDetailsTx.id)}
                disabled={reversing}
                className="w-full rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all mt-4"
              >
                <RotateCcw className="size-4" />
                {reversing ? 'Reversing...' : 'Reverse Adjustment'}
              </button>
            )}
          </div>
        )}
      </Drawer>

      {/* DRAWER: Vault Adjustment Dialog */}
      <Drawer
        open={modalType !== null}
        title={
          modalType === 'CREDIT' ? 'Credit Vault' :
          modalType === 'DEBIT' ? 'Debit Vault' :
          'Record Expense'
        }
        subtitle={
          modalType === 'CREDIT' ? 'Add funds directly to the Company Float' :
          modalType === 'DEBIT' ? 'Deduct funds directly from the Company Float' :
          'Deduct operational expense from the Company Float'
        }
        onClose={() => {
          setModalType(null);
          setActionAmount('');
          setActionNote('');
        }}
      >
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-slate-400 text-xs font-semibold">Amount (₦)</label>
           <input
              type="number"
              value={actionAmount}
              onChange={(e) => setActionAmount(e.target.value)}
              placeholder="e.g. 50000"
              min="1"
              className="w-full rounded-xl bg-white/3 border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-white/20"
            />
          </div>

          <div className="space-y-2">
            <label className="text-slate-400 text-xs font-semibold">
              Description / Note {modalType === 'EXPENSE' && <span className="text-rose-400">*</span>}
            </label>
            <textarea
              value={actionNote}
              onChange={(e) => setActionNote(e.target.value)}
              placeholder={
                modalType === 'CREDIT' ? 'e.g. Deposit from bank transfer' :
                modalType === 'DEBIT' ? 'e.g. Operational withdrawal' :
                'e.g. Office logistics, system maintenance costs (Required)'
              }
              rows={4}
              className="w-full bg-white/3 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-colors"
            />
          </div>

          <button
            onClick={handleVaultActionSubmit}
            disabled={isSubmittingAction}
            className="w-full rounded-xl bg-blue-500 text-white font-bold uppercase tracking-wider py-3 text-xs active:scale-95 transition-all hover:bg-blue-600 disabled:opacity-50"
          >
            {isSubmittingAction ? 'Processing...' : 'Submit'}
          </button>
        </div>
      </Drawer>
    </>
  );
}
