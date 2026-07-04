// src/app/dashboard/RemittancesPage.tsx

'use client'

import React, { useEffect, useState, useCallback } from 'react';
import { Banknote, CheckCircle2, Clock, Coins, Plus, ChevronRight } from 'lucide-react';
import StatCard from '@/components/StatCard';
import { Badge } from '@/components/Badge';
import { Drawer } from '@/components/Drawer';
import { FilterRow, Input, PageScaffold, Select } from '@/components/pageScaffold';
import { formatMoney } from '@/lib/utils';
import { Remittance, User } from '../types/types';
import { toast } from 'react-toastify';
import Calendar from '@/components/Calender';
import { useDashboard } from '@/app/dashboard/layout';
import api from '../lib/axios';
import axios from 'axios';

export default function RemittancesPage({ role = 'TICKETER' }: { role?: string }) {
  const user = (role?.toUpperCase() || 'TICKETER') as 'TICKETER' | 'SUPERVISOR' | 'ADMIN';

  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'ALL' | 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED' | 'DEPOSITED'>('ALL');
  const [rows, setRows] = useState<Remittance[]>([]);
  const [team, setTeam] = useState<User[]>([]);
  const [supervisors, setSupervisors] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [openForm, setOpenForm] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(false);
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);
  const [posSession, setPosSession] = useState<string | null>(null);
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [selectedRemittance, setSelectedRemittance] = useState<Remittance | null>(null);

  // 💡 ROLES ENFORCEMENT
  const canSubmit = user === 'TICKETER' || user === 'SUPERVISOR';
  const canVerify = user === 'ADMIN';

  const { metrics, refreshMetrics } = useDashboard();

  // --- API LOGIC --- //
  const fetchRemittances = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fromDate) {
        const fromISO = new Date(fromDate);
        fromISO.setHours(0, 0, 0, 0);
        params.set('from', fromISO.toISOString());
      }
      if (toDate) {
        const toISO = new Date(toDate);
        toISO.setHours(23, 59, 59, 999);
        params.set('to', toISO.toISOString());
      }
      const queryString = params.toString();
      const url = `/api/remitance${queryString ? `?${queryString}` : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setRows(data.data);
        setTotalOutstanding(data.totalOutstanding || 0);
      }
    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : "An error occurred";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  const fetchUsers = useCallback(async () => {
    try {
      if (user === 'SUPERVISOR') {
        const res = await fetch('/api/supervisor/user');
        const data = await res.json();
        if (data.success) setTeam(data.data);
      } else if (user === 'TICKETER') {
        const res = await fetch('/api/admin/user');
        const data = await res.json();
        if (data.success) {
          const sups = data.data.filter((u: User) => u.role === 'SUPERVISOR');
          setSupervisors(sups);
        }
      }
    } catch (e) {
      console.error(e);
      const errorMessage = e instanceof Error ? e.message : "An error occurred";
      toast.error(errorMessage);
    }
  }, [user]);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (active) {
        fetchRemittances();
        setPosSession(metrics?.posSessionId || null);
        fetchUsers();
      }
    }, 0);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [fetchRemittances, fetchUsers, metrics?.posSessionId]);

  const submitRemittance = async (amount: number, method: 'CASH' | 'TRANSFER', ticketerId?: string, supervisorId?: string) => {
    if (role === "TICKETER" && !posSession) {
      toast.error("POS Session is required");
      return;
    }
    try {
      setSendingRequest(true);
      const res = await fetch('/api/remitance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, method, remittance_date: new Date().toISOString(), ticketer_id: ticketerId, supervisor_id: supervisorId, pos_id: posSession })
      });
      if (res.ok) {
        setOpenForm(false);
        fetchRemittances();
        refreshMetrics();
        toast.success(`Remittance submitted successfully`);
      } else {
        const data = await res.json();
        toast.error(data.error || `Failed to submit remittance`);
      }
    } catch (err) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      toast.error(errorMessage);
    } finally {
      setSendingRequest(false);
    }
  };

  const handleVerify = async (id: string, actionStatus: 'CONFIRMED' | 'REJECTED') => {
    if (!confirm(`Are you sure you want to ${actionStatus} this remittance?`)) return;
    try {
      setSendingRequest(true);
      const res = await fetch(`/api/remitance/${id}/verify`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: actionStatus })
      });
      if (res.ok) {
        setSelectedRemittance(null);
        fetchRemittances();
        refreshMetrics();
        toast.success(`Remittance ${actionStatus.toLowerCase()} successfully`);
      } else {
        const data = await res.json();
        toast.error(data.error || `Failed to ${actionStatus.toLowerCase()} remittance`);
      }
    } catch (err) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      toast.error(errorMessage);
    } finally {
      setSendingRequest(false);
    }
  };

  // Filter pending handovers requiring supervisor verification
  const pendingHandovers = rows.filter(
    (r) => r.status === 'PENDING_SUPERVISOR_ACCEPTANCE'
  );

  const handleAccept = async (id: string, action: 'ACCEPT' | 'REJECT') => {
    try {
      setSendingRequest(true);
      const res = await api.patch(`/remitance/${id}/accept`, { action });
      if (res.data.success) {
        fetchRemittances();
        refreshMetrics();
        toast.success(`Handover ${action === 'ACCEPT' ? 'accepted' : 'disputed'} successfully`);
      } else {
        toast.error(res.data.error || `Failed to process handover`);
      }
    } catch (err) {
      if (err instanceof axios.AxiosError) {
        toast.error(err.response?.data.message || err.response?.data.error || "An error occurred");
      } else {
        toast.error("An error occurred");
      }
    } finally {
      setSendingRequest(false);
    }
  };

  const handleReverse = async (id: string) => {
    if (!confirm("Are you sure you want to reverse this? If Admin, logs will update. If Ticketer, this cancels your submission.")) return;
    try {
      setSendingRequest(true);
      const res = await fetch(`/api/remitance/${id}/reverse`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        setSelectedRemittance(null);
        fetchRemittances();
        refreshMetrics();
        toast.success(`Remittance reversed successfully`);
      } else {
        const data = await res.json();
        toast.error(data.error || `Failed to reverse remittance`);
      }
    } catch (err) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      toast.error(errorMessage);
    } finally {
      setSendingRequest(false);
    }
  };

  // --- UI METRICS --- //
  const totalConfirmed = rows.reduce((acc, r) => r.status === 'CONFIRMED' ? acc + r.amount : acc, 0);
  const totalPending = rows.reduce((acc, r) => r.status === 'PENDING' ? acc + r.amount : acc, 0);

  const cashTotal = rows.filter(r => r.method === 'CASH' && r.status === 'CONFIRMED')
    .reduce((acc, r) => acc + r.amount, 0);
  const transferTotal = rows.filter(r => r.method === 'TRANSFER' && r.status === 'CONFIRMED')
    .reduce((acc, r) => acc + r.amount, 0);

  const dateLabel = (fromDate && toDate)
    ? `${fromDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} → ${toDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`
    : fromDate
      ? `${fromDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} → ...`
      : "Today";

  const supervisorAcceptedCash = rows.filter((r) => r.status === 'ACCEPTED_BY_SUPERVISOR');
  const tableSourceRows = user === 'SUPERVISOR'
    ? rows.filter((r) => r.status !== 'ACCEPTED_BY_SUPERVISOR')
    : rows;

  const filtered = tableSourceRows.filter((r) => {
    const matchesStatus = status === 'ALL' ? true : r.status === status;
    const matchesSearch = q === '' ? true : (
      r.id.toLowerCase().includes(q.toLowerCase()) ||
      r?.submitted_by?.toLowerCase().includes(q.toLowerCase())
    );
    return matchesStatus && matchesSearch;
  });

  return (
    <>
      <PageScaffold
        title="Remittance"
        subtitle="Manage cash and transfer handovers securely"
        right={
          <div className="flex items-center gap-2">
            <Select
              value={status}
              onChange={(v) => setStatus(v)}
              options={[
                { value: 'ALL', label: 'All statuses' },
                { value: 'PENDING', label: 'Pending' },
                { value: 'CONFIRMED', label: 'Confirmed' },
                { value: 'REJECTED', label: 'Rejected' },
                { value: 'CANCELLED', label: 'Cancelled' },
                { value: 'DEPOSITED', label: 'Deposited' },
              ]}
            />
            {canSubmit && (
              <button onClick={() => setOpenForm(true)} className="inline-flex items-center gap-2 rounded-xl bg-white/3 border border-white/10 px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-300 hover:bg-white/6 hover:text-white">
                <Plus className="w-4 h-4" strokeWidth={1.5} /> Submit
              </button>
            )}
          </div>
        }
        kpis={
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
            <StatCard
              title={`Confirmed (${dateLabel})`}
              value={formatMoney(totalConfirmed)}
              icon={<Banknote className="text-emerald-300" />}
              iconBg="bg-emerald-500/10"
            />
            <StatCard
              title="Pending Amount"
              value={formatMoney(totalPending)}
              icon={<Clock className="text-amber-300" />}
              iconBg="bg-amber-500/10"
            />
            <StatCard
              title="Total Outstanding"
              value={formatMoney(totalOutstanding)}
              icon={<Coins className="text-rose-300" />}
              iconBg="bg-rose-500/10"
            />
            <StatCard
              title="Cash Remitted"
              value={formatMoney(cashTotal)}
              icon={<Banknote className="text-cyan-300" />}
              iconBg="bg-cyan-500/10"
            />
            <StatCard
              title="Transfer Remitted"
              value={formatMoney(transferTotal)}
              icon={<Banknote className="text-violet-300" />}
              iconBg="bg-violet-500/10"
            />
            <StatCard
              title="Total Transactions"
              value={String(rows.length)}
              icon={<CheckCircle2 className="text-blue-300" />}
              iconBg="bg-blue-500/10"
            />
          </div>
        }
      >
        {/* 💡 SUPERVISOR CASH HANDOVER VERIFICATION BANNER */}
        {user === 'SUPERVISOR' && pendingHandovers.length > 0 && (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 mb-4 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-amber-300">
                ⚡ Cash Handovers Awaiting Your Physical Count ({pendingHandovers.length})
              </h4>
              <span className="text-[10px] uppercase font-bold text-amber-400/80 tracking-widest">Action Required</span>
            </div>
            <div className="mt-3 space-y-2">
              {pendingHandovers.map((item) => (
                <div key={item.id} className="flex items-center justify-between bg-black/40 border border-white/5 p-3 rounded-xl">
                  <div>
                    <p className="text-xs font-semibold text-white">{item.submitted_by}</p>
                    <p className="text-[10px] text-slate-400">Claimed Cash: <span className="text-emerald-400 font-mono font-bold">{formatMoney(item.amount)}</span></p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAccept(item.id, 'ACCEPT')}
                      disabled={sendingRequest}
                      className="px-3 py-1.5 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-xs font-bold rounded-lg border border-emerald-500/30 transition-all disabled:opacity-50"
                    >
                      Count & Accept
                    </button>
                    <button
                      onClick={() => handleAccept(item.id, 'REJECT')}
                      disabled={sendingRequest}
                      className="px-3 py-1.5 bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 text-xs font-bold rounded-lg border border-rose-500/30 transition-all disabled:opacity-50"
                    >
                      Dispute Amount
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 💡 SUPERVISOR TICKETER CASH HOLDINGS (AWAITING BANK DEPOSIT) */}
        {user === 'SUPERVISOR' && supervisorAcceptedCash.length > 0 && (
          <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4 mb-4 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-cyan-300">
                  💼 Ticketer Cash Holdings ({supervisorAcceptedCash.length})
                </h4>
                <p className="text-[10px] text-cyan-200/70">Total Cash Held: <span className="font-mono font-bold text-emerald-400">{formatMoney(supervisorAcceptedCash.reduce((sum, item) => sum + item.amount, 0))}</span></p>
              </div>
              <button
                onClick={async () => {
                  const ref = prompt("Enter Bank Deposit Reference / Teller ID for all cash holdings:");
                  if (ref === null) return;
                  try {
                    setSendingRequest(true);
                    const res = await api.post('/supervisor/deposit', { deposit_all: true, payment_reference: ref });
                    if (res.data.success) {
                      toast.success("All cash holdings marked as DEPOSITED to bank!");
                      fetchRemittances();
                    }
                  } catch (err) { toast.error("Failed to submit bank deposit."); } finally { setSendingRequest(false); }
                }}
                disabled={sendingRequest}
                className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-extrabold rounded-xl shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50"
              >
                🏦 Deposit All to Bank
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {supervisorAcceptedCash.map((item) => (
                <div key={item.id} className="flex items-center justify-between bg-black/40 border border-white/5 p-3 rounded-xl">
                  <div>
                    <p className="text-xs font-semibold text-white">{item.submitted_by}</p>
                    <p className="text-[10px] text-slate-400">Accepted Cash Held: <span className="text-emerald-400 font-mono font-bold">{formatMoney(item.amount)}</span></p>
                  </div>
                  <button
                    onClick={async () => {
                      const ref = prompt(`Enter Bank Deposit Reference for ₦${item.amount}:`);
                      if (ref === null) return;
                      try {
                        setSendingRequest(true);
                        const res = await api.post('/supervisor/deposit', { remittance_ids: [item.id], payment_reference: ref });
                        if (res.data.success) {
                          toast.success("Deposit submitted for verification!");
                          fetchRemittances();
                        }
                      } catch (err) { toast.error("Failed to submit deposit."); } finally { setSendingRequest(false); }
                    }}
                    disabled={sendingRequest}
                    className="px-3 py-1.5 bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 text-xs font-bold rounded-lg border border-cyan-500/30 transition-all disabled:opacity-50"
                  >
                    Deposit Item
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <FilterRow>
          <div className="flex flex-1 items-center gap-3 min-w-0">
            <div className="flex-1 max-w-md">
              <Input value={q} onChange={setQ} placeholder="Search remit_id or submitted_by…" />
            </div>

            {/* 🗓️ CUSTOM CALENDAR COMPONENT */}
            <Calendar
              mode="range"
              placeholder="Filter by date range"
              range={{ startDate: fromDate, endDate: toDate }}
              onRangeChange={(range) => {
                setFromDate(range.startDate);
                setToDate(range.endDate);
              }}
            />
          </div>
          <div className={`${loading ? "text-amber-500" : "text-green-500"} text-xs font-medium shrink-0`}>
            {loading ? "Loading..." : `Showing: ${dateLabel}`}
          </div>
        </FilterRow>

        {loading ? (
          <div className="text-slate-400 p-8 font-medium">Loading remittance records...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-slate-600 text-xs italic">No remittance records found.</div>
        ) : (
          <div className="space-y-2">
            {filtered.map((item: Remittance) => {
              // 💡 If DEPOSITED, display supervisor who deposited it, otherwise display the ticketer
              const remitterName = item.status === 'DEPOSITED' && item.received_by_supervisor
                ? item.received_by_supervisor
                : item.submitted_by;

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedRemittance(item)}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-white/3 border border-white/5 hover:border-white/10 hover:bg-white/5 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                      <Banknote className="size-4 text-cyan-400" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                        {remitterName}
                        {user === 'ADMIN' && (
                          <span className="text-[9px] font-mono text-slate-500 font-normal">
                            #{item.id.slice(-6)}
                          </span>
                        )}
                      </h4>
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
                          item.status === 'CONFIRMED' || item.status === 'ACCEPTED_BY_SUPERVISOR'
                            ? 'success'
                            : item.status === 'PENDING' || item.status === 'PENDING_SUPERVISOR_ACCEPTANCE'
                            ? 'warning'
                            : item.status === 'REJECTED' || item.status === 'REJECTED_BY_SUPERVISOR'
                            ? 'danger'
                            : 'info'
                        }>
                          {item.status}
                        </Badge>
                      </span>
                    </div>
                    <ChevronRight className="size-4 text-slate-600" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </PageScaffold>

      <Drawer open={openForm} title="Submit Remittance" subtitle={user === 'SUPERVISOR' ? "Log a cash handover from a ticketer" : "Hand over your cash or log a transfer"} onClose={() => setOpenForm(false)}>
        <RemitForm onSubmit={submitRemittance} role={user} team={team} supervisors={supervisors} posSession={posSession} setposSession={setPosSession} />
      </Drawer>

      {/* DRAWER: Remittance Details */}
      <Drawer
        open={!!selectedRemittance}
        title="Remittance Details"
        subtitle="Receipt and status verification"
        onClose={() => setSelectedRemittance(null)}
      >
        {selectedRemittance && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-white/3 border border-white/5 space-y-4">
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <div>
                  <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest block">Amount</label>
                  <span className="text-lg font-black text-white font-mono mt-1 block">
                    {formatMoney(selectedRemittance.amount || 0)}
                  </span>
                </div>
                <Badge variant={
                  selectedRemittance.status === 'CONFIRMED' || selectedRemittance.status === 'ACCEPTED_BY_SUPERVISOR'
                    ? 'success'
                    : selectedRemittance.status === 'PENDING' || selectedRemittance.status === 'PENDING_SUPERVISOR_ACCEPTANCE'
                    ? 'warning'
                    : selectedRemittance.status === 'REJECTED' || selectedRemittance.status === 'REJECTED_BY_SUPERVISOR'
                    ? 'danger'
                    : 'info'
                }>
                  {selectedRemittance.status}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest block">Submitted By</label>
                  <span className="text-xs font-semibold text-slate-200 mt-1 block">{selectedRemittance.submitted_by}</span>
                </div>
                <div>
                  <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest block">Method</label>
                  <span className="text-xs font-semibold text-slate-200 mt-1 block">{selectedRemittance.method}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5">
                <div>
                  <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest block">Supervisor Receiver</label>
                  <span className="text-xs text-slate-300 mt-1 block">
                    {selectedRemittance.received_by_supervisor || '—'}
                  </span>
                </div>
                <div>
                  <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest block">POS Device Session</label>
                  <span className="text-xs text-slate-300 mt-1 block font-mono">
                    {selectedRemittance.pos_name || '—'}
                  </span>
                </div>
              </div>

              {selectedRemittance.ticketer_outstanding !== undefined && (
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5">
                  <div>
                    <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest block">Outstanding Debt</label>
                    <span className="text-xs text-amber-400 font-mono font-bold mt-1 block">
                      {formatMoney(selectedRemittance.ticketer_outstanding)}
                    </span>
                  </div>
                  <div>
                    <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest block">Payment Reference</label>
                    <span className="text-xs text-slate-300 mt-1 block font-mono break-all">
                      {selectedRemittance.proof_ref || '—'}
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5">
                <div>
                  <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest block">Submitted At</label>
                  <span className="text-xs text-slate-400 mt-1 block">
                    {selectedRemittance.created_at ? new Date(selectedRemittance.created_at).toLocaleString() : ''}
                  </span>
                </div>
                {user === 'ADMIN' && (
                  <div>
                    <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest block">Remittance ID</label>
                    <span className="text-[10px] font-mono text-slate-400 mt-1 block break-all">
                      {selectedRemittance.id}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex flex-col gap-2 pt-2">
              {/* ADMIN VERIFY BUTTONS */}
              {canVerify && (selectedRemittance.status === 'PENDING' || selectedRemittance.status === 'DEPOSITED') && (
                !selectedRemittance.is_reconciliation && (
                  <div className="flex gap-2 w-full">
                    <button
                      onClick={() => handleVerify(selectedRemittance.id, 'CONFIRMED')}
                      disabled={sendingRequest}
                      className="flex-1 rounded-xl py-3 text-xs font-bold uppercase tracking-widest bg-emerald-500 text-black hover:bg-emerald-400 active:scale-[0.99] transition-all disabled:opacity-50"
                    >
                      Confirm Remittance
                    </button>
                    <button
                      onClick={() => handleVerify(selectedRemittance.id, 'REJECTED')}
                      disabled={sendingRequest}
                      className="flex-1 rounded-xl py-3 text-xs font-bold uppercase tracking-widest bg-rose-500 text-white hover:bg-rose-400 active:scale-[0.99] transition-all disabled:opacity-50"
                    >
                      Reject Remittance
                    </button>
                  </div>
                )
              )}

              {/* ADMIN REVERSE BUTTON */}
              {user === 'ADMIN' && (selectedRemittance.status === 'CONFIRMED' || selectedRemittance.status === 'REJECTED') && (
                <button
                  onClick={() => handleReverse(selectedRemittance.id)}
                  disabled={sendingRequest}
                  className="w-full rounded-xl py-3 text-xs font-bold uppercase tracking-widest bg-amber-500 text-black hover:bg-amber-400 active:scale-[0.99] transition-all disabled:opacity-50"
                >
                  Reverse Transaction
                </button>
              )}

              {/* TICKETER CANCEL BUTTON */}
              {user === 'TICKETER' && selectedRemittance.status === 'PENDING' && (
                <button
                  onClick={() => handleReverse(selectedRemittance.id)}
                  disabled={sendingRequest}
                  className="w-full rounded-xl py-3 text-xs font-bold uppercase tracking-widest bg-rose-500 text-white hover:bg-rose-400 active:scale-[0.99] transition-all disabled:opacity-50"
                >
                  Cancel Submission
                </button>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </>
  );
}

// 💡 The RemitForm must stay outside the main component!
function RemitForm({ onSubmit, role, team, supervisors, posSession, setposSession }: { onSubmit: (amount: number, method: 'CASH' | 'TRANSFER', ticketerId?: string, supervisorId?: string) => Promise<void> | void, role: string, team: User[], supervisors?: User[], posSession?: string | null, setposSession?: (value: string) => void }) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'CASH' | 'TRANSFER'>('CASH');
  const [ticketerId, setTicketerId] = useState('');
  const [supervisorId, setSupervisorId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    await onSubmit(Number(amount || 0), method, ticketerId, supervisorId);
    setIsSubmitting(false);
    setAmount('');
    setSupervisorId('');
    setMethod('CASH');
  };

  return (
    <div className="space-y-4">
      <div className="glass-panel rounded-2xl border border-white/5 p-4">
        {/* SUPERVISOR SELECTING TICKETER */}
        {role === 'SUPERVISOR' && (
          <div className="mb-4">
            <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Select Ticketer</label>
            <select value={ticketerId} onChange={(e) => setTicketerId(e.target.value)} className="mt-2 w-full rounded-xl bg-white/3 border border-white/10 px-4 py-2.5 text-sm text-white">
              <option value="" disabled className="bg-black">Choose ticketer...</option>
              {team.map(t => <option key={t.id} value={t.id} className="bg-black">{t.first_name} {t.last_name}</option>)}
            </select>
          </div>
        )}

        <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Method</label>
        <select value={method} onChange={(e) => setMethod(e.target.value as 'CASH' | 'TRANSFER')} className="mt-2 w-full rounded-xl bg-white/3 border border-white/10 px-4 py-2.5 text-sm text-white">
          <option value="CASH" className="bg-black">Cash</option>
          <option value="TRANSFER" className="bg-black">Transfer</option>
        </select>

        {/* 💡 TICKETER SELECTING SUPERVISOR (ONLY FOR CASH) */}
        {role === 'TICKETER' && method === 'CASH' && (
          <div className="mt-4">
            <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Handed Cash To (Supervisor)</label>
            <select value={supervisorId} onChange={(e) => setSupervisorId(e.target.value)} className="mt-2 w-full rounded-xl bg-white/3 border border-white/10 px-4 py-2.5 text-sm text-white">
              <option key="default-select" value="" disabled className="bg-black">Select Supervisor...</option>
              {supervisors?.map(s => {
                const sId = s.id || s.user_id;
                const name = s.username || s.fullname || `${s.first_name || ''} ${s.last_name || ''}`.trim();
                return (
                  <option key={sId} value={sId} className="bg-black">
                    {name}
                  </option>
                );
              })}
            </select>
          </div>
        )}

        {role === 'TICKETER' &&
          <div className="mb-4">
            <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">pos_id</label>
            <input value={posSession || ""} onChange={(e) => setposSession && setposSession(e.target.value)} placeholder="e.g. 50000" type="text" className="mt-2 w-full rounded-xl bg-white/3 border border-white/10 px-4 py-2.5 text-sm text-white outline-none" />
          </div>
        }

        <label className="mt-4 block text-slate-500 text-[10px] font-bold uppercase tracking-widest">Amount (NGN)</label>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 50000" type="number" className="mt-2 w-full rounded-xl bg-white/3 border border-white/10 px-4 py-2.5 text-sm text-white outline-none" />
      </div>

      <button
        onClick={handleSubmit}
        disabled={isSubmitting || (role === 'SUPERVISOR' && !ticketerId) || (role === 'TICKETER' && method === 'CASH' && !supervisorId) || (role === 'TICKETER' && !posSession)}
        className="w-full rounded-xl bg-linear-to-r from-cyan-400 to-blue-400 text-black py-3 text-sm font-bold tracking-tight active:scale-[0.99] disabled:opacity-50"
      >
        {isSubmitting ? "Submitting..." : "Submit remittance"}
      </button>
    </div>
  );
}
