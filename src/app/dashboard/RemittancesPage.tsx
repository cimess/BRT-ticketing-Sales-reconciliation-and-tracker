'use client'

import React, { useEffect, useState, useCallback } from 'react';
import { Banknote, CheckCircle2, Clock, Plus, X, Ban } from 'lucide-react';
import StatCard from '@/components/StatCard';
import { Badge } from '@/components/Badge';
import { DataTable, type ColumnDef } from '@/components/DataTable';
import { Drawer } from '@/components/Drawer';
import { FilterRow, Input, PageScaffold, Select } from '@/components/pageScaffold';
import { formatDateTime, formatMoney } from '@/lib/utils';
import { Remittance, User } from '../types/types';
import { toast } from 'react-toastify';
import Calendar from '@/components/Calender';
import { useDashboard } from '@/app/dashboard/layout'

export default function RemittancesPage({ role = 'TICKETER' }: { role?: string }) {
  const user = (role?.toUpperCase() || 'TICKETER') as 'TICKETER' | 'SUPERVISOR' | 'ADMIN';

  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'ALL' | 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED'>('ALL');
  const [rows, setRows] = useState<Remittance[]>([]);
  const [team, setTeam] = useState<User[]>([]);
  const [supervisors, setSupervisors] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [openForm, setOpenForm] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(false);
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);

  // 💡 ROLES ENFORCEMENT
  const canSubmit = user === 'TICKETER' || user === 'SUPERVISOR';
  const canVerify = user === 'ADMIN';

  const { refreshMetrics} = useDashboard();

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
      if (data.success) setRows(data.data);
    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : "An error occurred";
      toast.error(errorMessage);
    }
    finally { setLoading(false); }
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
  }, [user]); // Re-create function only if `user` prop/state changes


  useEffect(() => {
    const fetchData = async () => {
      await fetchRemittances();
      await fetchUsers();
    }

    fetchData();

  }, [fetchRemittances, fetchUsers]);

  const submitRemittance = async (amount: number, method: 'CASH' | 'TRANSFER', ticketerId?: string, supervisorId?: string) => {
    try {
      setSendingRequest(true);
      const res = await fetch('/api/remitance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, method, remittance_date: new Date().toISOString(), ticketer_id: ticketerId, supervisor_id: supervisorId })
      });
      if (res.ok) {
        setOpenForm(false);
        fetchRemittances();
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

  const handleReverse = async (id: string) => {
    if (!confirm("Are you sure you want to reverse this? If Admin, logs will update. If Ticketer, this cancels your submission.")) return;
    try {
      setSendingRequest(true);
      const res = await fetch(`/api/remitance/${id}/reverse`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
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

  // Cash vs Transfer breakdown
  const cashTotal = rows.filter(r => r.method === 'CASH' && r.status === 'CONFIRMED')
    .reduce((acc, r) => acc + r.amount, 0);
  const transferTotal = rows.filter(r => r.method === 'TRANSFER' && r.status === 'CONFIRMED')
    .reduce((acc, r) => acc + r.amount, 0);

  // Date label for stat cards
  const dateLabel = (fromDate && toDate)
    ? `${fromDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} → ${toDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`
    : fromDate
      ? `${fromDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} → ...`
      : "Today";
  // 💡 RESTORED: This is needed by the DataTable component!
  const filtered = rows.filter((r) => (status === 'ALL' ? true : r.status === status));


    const columns: ColumnDef<Remittance>[] = [
    { id: 'id', header: 'remit_id', cell: (r) => <span className="text-slate-200 font-mono text-xs">{r?.id?.slice(-6)}</span> },
    { id: 'method', header: 'method', cell: (r) => <Badge variant="info">{r?.method}</Badge>, sortValue: (r) => r.method },
    { id: 'amount', header: 'amount', align: 'right', sortValue: (r) => r.amount, cell: (r) => <span className="text-white font-mono text-xs font-bold">{formatMoney(r?.amount || 0)}</span> },
    { id: 'status', header: 'status', align: 'center', sortValue: (r) => r.status, cell: (r) => <Badge variant={r?.status === 'CONFIRMED' ? 'success' : r?.status === 'PENDING' ? 'warning' : r?.status === 'REJECTED' ? 'danger' : 'info'}>{r?.status}</Badge> },
    { id: 'submitted', header: 'submitted_at', cell: (r) => <span className="text-slate-500 text-xs">{formatDateTime(r?.remittance_date)}</span> },
    { id: 'by', header: 'submitted_by', cell: (r) => <span className="text-slate-300 text-xs font-bold">{r?.submitted_by}</span> },
    { id: 'received_by', header: 'received_by', cell: (r) => r?.received_by_supervisor ? <span className="text-cyan-300 text-xs font-bold">{r.received_by_supervisor}</span> : <span className="text-slate-600 text-xs">—</span> },


    {
      id: 'actions',
      header: 'actions',
      align: 'right',
      cell: (r) => (
        <div className="flex justify-end gap-2">

          {/* ADMIN VERIFY BUTTONS */}
          {canVerify && r?.status === 'PENDING' && (
            <>
              <button onClick={() => handleVerify(r?.id, 'CONFIRMED')} className="rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all">
                Confirm
              </button>
              <button onClick={() => handleVerify(r?.id, 'REJECTED')} className="rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 transition-all">
                Reject
              </button>
            </>
          )}

          {/* ADMIN REVERSE BUTTON */}

          {user === 'ADMIN' && (r?.status === 'CONFIRMED' || r?.status === 'REJECTED') && (

            <button
              onClick={() => handleReverse(r?.id || '')}
              disabled={sendingRequest}
              className="rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 transition-all">

              Reverse

            </button>

          )}

          {/* TICKETER CANCEL BUTTON */}
          {user === 'TICKETER' && r?.status === 'PENDING' && (
            <button
              onClick={() => handleReverse(r?.id || '')}
              disabled={sendingRequest}
              className="rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 transition-all">
              Cancel
            </button>
          )}
        </div>
      )
    },
  ];

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
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
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

        <DataTable rows={filtered} columns={columns} getRowId={(r) => r.id} searchValue={q} searchPredicate={(r, qq) => r.id.toLowerCase().includes(qq) || r?.submitted_by?.toLowerCase().includes(qq) || false} emptyLabel="No remittance records found." />
      </PageScaffold>

      <Drawer open={openForm} title="Submit Remittance" subtitle={user === 'SUPERVISOR' ? "Log a cash handover from a ticketer" : "Hand over your cash or log a transfer"} onClose={() => setOpenForm(false)}>
        <RemitForm onSubmit={submitRemittance} role={user} team={team} supervisors={supervisors} />
      </Drawer>
    </>
  );
}

// 💡 The RemitForm must stay outside the main component!
function RemitForm({ onSubmit, role, team, supervisors }: { onSubmit: (amount: number, method: 'CASH' | 'TRANSFER', ticketerId?: string, supervisorId?: string) => Promise<void> | void, role: string, team: User[], supervisors?: User[] }) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'CASH' | 'TRANSFER'>('CASH');
  const [ticketerId, setTicketerId] = useState('');
  const [supervisorId, setSupervisorId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false); // 💡 NEW: Track loading state

  const handleSubmit = async () => {
    setIsSubmitting(true);
    await onSubmit(Number(amount || 0), method, ticketerId, supervisorId);
    // If the modal doesn't close immediately, keep it disabled until it does
    setIsSubmitting(false);
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
              <option value="" disabled className="bg-black">Select Supervisor...</option>
              {supervisors?.map(s => <option key={s.id} value={s.id} className="bg-black">{s.first_name} {s.last_name}</option>)}
            </select>
          </div>
        )}

        <label className="mt-4 block text-slate-500 text-[10px] font-bold uppercase tracking-widest">Amount (NGN)</label>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 50000" type="number" className="mt-2 w-full rounded-xl bg-white/3 border border-white/10 px-4 py-2.5 text-sm text-white outline-none" />
      </div>

      <button
        onClick={handleSubmit}
        suppressHydrationWarning
        disabled={isSubmitting || (role === 'SUPERVISOR' && !ticketerId) || (role === 'TICKETER' && method === 'CASH' && !supervisorId)}
        className="w-full rounded-xl bg-linear-to-r from-cyan-400 to-blue-400 text-black py-3 text-sm font-bold tracking-tight active:scale-[0.99] disabled:opacity-50"
      >
        {isSubmitting ? "Submitting..." : "Submit remittance"}
      </button>

    </div>
  );
}

