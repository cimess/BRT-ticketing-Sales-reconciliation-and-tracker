"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Sigma, ArrowDownUp, AlertCircle, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import StatCard from '@/components/StatCard';
import { Badge } from '@/components/Badge';
import { DataTable, type ColumnDef } from '@/components/DataTable';
import { Drawer } from '@/components/Drawer';
import { FilterRow, Input, PageScaffold, Select } from '@/components/pageScaffold';
import { formatMoney } from '@/lib/utils';
import { ResponsiveDrawerShell } from '@/components/ResponsiveDrawerShell';
import type {
  RemittanceExpectation,
  ReconciliationRemittance,
  RemittanceExpectationStatus,
  ReconciliationMethod,
  ReconcileApiResponse,
  User_Full_Audit,
} from '@/types/types';
import api from '../lib/axios';
import { toast } from 'react-toastify';
import axios from 'axios';
import { useDashboard } from './layout';
import { useSession } from 'next-auth/react';

export interface FineRecord {
  id: string;
  defaulter_id: string;
  amount: number | null;
  reason: string;
  issued_by: string;
  status: 'UNPAID' | 'PAID' | 'WAIVED';
  created_at: string;
  defaulter: {
    first_name: string | null;
    last_name: string | null;
    role: string;
  };
  issuer: {
    first_name: string | null;
    last_name: string | null;
    role: string;
  };
}


function expectationStatusVariant(s: RemittanceExpectationStatus): 'danger' | 'success' | 'warning' | 'info' {
  if (s === 'PAID') return 'success';
  if (s === 'SUBMITTED') return 'info';
  if (s === 'PENDING') return 'warning';
  if (s === 'OVERDUE' || s === 'VIOLATED') return 'danger';
  return 'warning';
}

function remittanceStatusVariant(s: string): 'danger' | 'success' | 'warning' | 'info' {
  if (s === 'CONFIRMED') return 'success';
  if (s === 'ACCEPTED_BY_SUPERVISOR') return 'info';
  if (s === 'PENDING' || s === 'PENDING_SUPERVISOR_ACCEPTANCE') return 'warning';
  if (s === 'REJECTED' || s === 'REJECTED_BY_SUPERVISOR') return 'danger';
  return 'warning';
}

export default function ReconciliationPage({ role = 'TICKETER' }: { role?: string }) {
  const userRole = (role?.toUpperCase() || 'TICKETER') as 'TICKETER' | 'SUPERVISOR' | 'ADMIN' | 'AUDITOR';

  const [activeTab, setActiveTab] = useState<'EXPECTATIONS' | 'REMITTANCES' | 'HANDOVERS' | 'FINES'>('EXPECTATIONS');
  const [q, setQ] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const [expectations, setExpectations] = useState<RemittanceExpectation[]>([]);
  const [remittances, setRemittances] = useState<ReconciliationRemittance[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Selection state for action drawers
  const [selectedExpectation, setSelectedExpectation] = useState<RemittanceExpectation | null>(null);
  const [selectedRemittance, setSelectedRemittance] = useState<ReconciliationRemittance | null>(null);

  // Form states for submitting reconciliation payment
  const [payAmount, setPayAmount] = useState<string>('');
  const [payMethod, setPayMethod] = useState<ReconciliationMethod>('CASH');
  const [payRef, setPayRef] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [paySupervisorId, setPaySupervisorId] = useState<string>('');

  const [supervisors, setSupervisors] = useState<User_Full_Audit[]>([]); // <-- ADD THIS


  const [fines, setFines] = useState<FineRecord[]>([]);
  const { data: session } = useSession();

  // Place with your other useState declarations in ReconciliationPage.tsx
  const [supervisorHandovers, setSupervisorHandovers] = useState<ReconciliationRemittance[]>([]);

  const { metrics, refreshMetrics } = useDashboard();

  const fetchSupervisorHandovers = useCallback(async () => {
    if (userRole !== 'SUPERVISOR' && userRole !== 'ADMIN') return;
    try {
      // Calls the GET endpoint you just created (using 'requests' for [id])
      const res = await fetch('/api/remitance/requests/accept?status=PENDING');
      const result = await res.json();

      if (result.success) {
        setSupervisorHandovers(result.data || []);
        console.log('supervisor data', result.data)
      }
    } catch (err) {
      console.error('Failed to load supervisor cash handovers', err);
    }
  }, [userRole]);





  const fetchReconciliationData = useCallback(async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) {
        setLoading(true);
      }
      setError(null);
      const res = await fetch('/api/reconcile');
      const data: ReconcileApiResponse = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to load reconciliation data');
      }

      setExpectations(data.expectations || []);
      setRemittances(data.remittances || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadDataOnMount = async () => {
      try {
        const res = await api.get('/reconcile');
        const data: ReconcileApiResponse = res.data;

        if (isMounted) {
          if (!res.data.success) {
            throw new Error(data.error || 'Failed to load reconciliation data');
          }
          setExpectations(data.expectations || []);
          setRemittances(data.remittances || []);
        }

        if (isMounted && (userRole === 'SUPERVISOR' || userRole === 'ADMIN')) {
          await fetchSupervisorHandovers();
        }
      } catch (err: unknown) {
        if (isMounted) {
          const message = err instanceof axios.AxiosError ? err.response?.data.error || err.response?.data.message : 'An unexpected error occurred';
          setError(message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };



    loadDataOnMount();
    return () => { isMounted = false; };
  }, [fetchReconciliationData, fetchSupervisorHandovers, userRole]);


  // Fetch supervisors for the cash-over handover dropdown (only needed for ticketers)
  useEffect(() => {
    let isMounted = true;
    const loadSupervisors = async () => {
      try {
        const res = await api.get('/admin/user?role=SUPERVISOR');
        if (isMounted && res.data?.success) {
          setSupervisors(res.data.data || []);
        }
      } catch (err) {
        console.error('Failed to load supervisors', err);
      }
    };
    if (userRole === 'TICKETER') {
      loadSupervisors();
    }
    return () => { isMounted = false; };
  }, [userRole]);



  const handleSubmitPayment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedExpectation) return;

    if (!["TICKETER"].includes(userRole)) {
      setActionError('Unauthorized');
      return;
    }

    const numAmount = parseFloat(payAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setActionError('Please enter a valid payment amount');
      return;
    }

    try {
      setActionLoading(true);
      setActionError(null);
      setActionSuccess(null);

      const res = await api.post('/reconcile', {
        expectationId: selectedExpectation.id,
        amount: numAmount,
        method: payMethod,
        payment_reference: payRef || undefined,
        supervisor_id: payMethod === 'CASH' ? paySupervisorId : undefined,
      });

      if (!res.data.success) {
        throw new Error(res.data.error || 'Failed to submit reconciliation payment');
      }

      setActionSuccess('Payment submitted successfully for verification!');
      setTimeout(() => {
        setSelectedExpectation(null);
        setActionSuccess(null);
        fetchReconciliationData();
      }, 1500);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred during submission';
      setActionError(message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleProcessRemittance = async (action: 'VERIFY' | 'REJECT') => {
    if (!selectedRemittance) return;

    if (!["ADMIN"].includes(userRole)) {
      setActionError('Unauthorized');
      return;
    }

    try {
      setActionLoading(true);
      setActionError(null);
      setActionSuccess(null);

      const res = await api.patch(`/reconcile/${selectedRemittance.id}`, {
        action,
      });

      if (!res.data.success) {
        throw new Error(res.data.error || `Failed to ${action.toLowerCase()} remittance`);
      }

      setActionSuccess(`Remittance ${action === 'VERIFY' ? 'verified' : 'rejected'} successfully!`);
      setTimeout(() => {
        setSelectedRemittance(null);
        setActionSuccess(null);
        fetchReconciliationData();
        refreshMetrics()
      }, 1500);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred during verification';
      setActionError(message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptHandover = async (id: string, action: 'ACCEPT' | 'REJECT', customAmount?: number) => {
    setActionLoading(true);
    try {
      const res = await api.patch(`/remitance/${id}/accept`, {
        action, amount: customAmount
      });
      if (res.data.success) {
        toast.success(`Cash handover ${action === 'ACCEPT' ? 'accepted' : 'rejected'} successfully`);
        fetchReconciliationData(true);
        fetchSupervisorHandovers();
        refreshMetrics()
      } else {
        toast.error(res.data.response.error || res.data.response.message || 'Failed to process cash handover');
      }
    } catch (e) {
      if (e instanceof axios.AxiosError) {
        toast.error(e.response?.data.message || e.response?.data.error || "error processing cash handover");
      } else {
        toast.error('Failed to process cash handover');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handlePayFine = async (fineId: string) => {
    if (!confirm("Are you sure you want to settle this fine in full?")) return;
    try {
      setActionLoading(true);
      const res = await api.patch(`/fines/${fineId}`, { action: "PAY" });
      if (res.data.success) {
        toast.success("Fine paid successfully!");
        fetchFines();
        refreshMetrics();
      } else {
        toast.error(res.data.error || "Failed to settle fine");
      }
    } catch (err) {
      toast.error("Error settling fine");
    } finally {
      setActionLoading(false);
    }
  };

  const handleVoidFine = async (fineId: string) => {
    if (!confirm("Are you sure you want to waive/void this fine?")) return;
    try {
      setActionLoading(true);
      const res = await api.patch(`/fines/${fineId}`, { action: "VOID" });
      if (res.data.success) {
        toast.success("Fine waived successfully!");
        fetchFines();
        refreshMetrics();
      } else {
        toast.error(res.data.error || "Failed to waive fine");
      }
    } catch (err) {
      toast.error("Error waiving fine");
    } finally {
      setActionLoading(false);
    }
  };



  const fetchFines = useCallback(async () => {
    try {
      const res = await fetch('/api/fines');
      const result = await res.json();
      if (result.success) {
        setFines(result.fines || []);
      }
    } catch (err) {
      console.error('Failed to load fines', err);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'FINES') {
      fetchFines();
    }
  }, [activeTab, fetchFines]);


  const filteredExpectations = useMemo(() => {
    return expectations.filter((e) => {
      const matchesStatus = statusFilter === 'ALL' || e.status === statusFilter;
      const userName = `${e.user?.first_name || ''} ${e.user?.last_name || ''}`.toLowerCase();
      const deviceName = e.pos_session?.device?.name?.toLowerCase() || '';
      const matchesSearch = userName.includes(q.toLowerCase()) || deviceName.includes(q.toLowerCase()) || e.id.toLowerCase().includes(q.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [expectations, statusFilter, q]);

  const filteredRemittances = useMemo(() => {
    return remittances.filter((r) => {
      const userName = `${r.ticketer?.first_name || ''} ${r.ticketer?.last_name || ''}`.toLowerCase();
      const matchesSearch = userName.includes(q.toLowerCase()) || r.id.toLowerCase().includes(q.toLowerCase());
      return matchesSearch;
    });
  }, [remittances, q]);

  const totalOutstandingShortage = useMemo(() => {
    return expectations.reduce((acc, e) => acc + Number(e.shortage_amount), 0);
  }, [expectations]);

  const totalPendingRemittances = useMemo(() => {
    return remittances.reduce((acc, r) => acc + Number(r.amount), 0);
  }, [remittances]);

  const filteredFines = useMemo(() => {
    return fines.filter((f) => {
      const query = q.toLowerCase();
      const defaulterName = `${f.defaulter?.first_name || ''} ${f.defaulter?.last_name || ''}`.toLowerCase();
      const reason = f.reason.toLowerCase();
      return defaulterName.includes(query) || reason.includes(query);
    });
  }, [fines, q]);


  const pageTitle = userRole === 'TICKETER' ? 'My Shortages' : userRole === 'SUPERVISOR' ? 'Team Shortages' : 'Reconciliation Engine';
  const pageSubtitle = userRole === 'TICKETER' ? 'Track your session shortages and payments' : userRole === 'SUPERVISOR' ? 'Monitor and clear team session shortages' : 'Track outstanding user session shortages and verify payments';

  const expectationColumns: ColumnDef<RemittanceExpectation>[] = [
    {
      id: 'ticketer',
      header: 'Ticketer',
      cell: (r) => (
        <div className="flex flex-col">
          <span className="text-slate-200 text-xs font-semibold">{`${r?.user?.first_name || ''} ${r?.user?.last_name || ''}`}</span>
          <span className="text-slate-500 text-[10px]">{r?.user?.role}</span>
        </div>
      ),
      sortValue: (r) => `${r?.user?.first_name || ''} ${r?.user?.last_name || ''}`,
    },
    {
      id: 'device',
      header: 'POS Device',
      cell: (r) => <span className="text-slate-300 text-xs">{r?.pos_session?.device?.name || 'N/A'}</span>,
    },
    {
      id: 'expected_amount',
      header: 'Expected Float',
      cell: (r) => <span className="text-slate-400 font-mono text-xs">{formatMoney(Number(r?.expected_amount))}</span>,
      align: 'right',
    },
    {
      id: 'shortage_amount',
      header: 'Shortage Owed',
      cell: (r) => (
        <span className="text-red-400 font-mono text-xs font-bold">{formatMoney(Number(r?.shortage_amount))}</span>
      ),
      align: 'right',
    },
    {
      id: 'due_date',
      header: 'Due Date',
      cell: (r) => <span className="text-slate-400 text-xs">{r ? (new Date(r.due_date).toLocaleDateString()) : '-'}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (r) => <Badge variant={expectationStatusVariant(r?.status || "PENDING")}>{r?.status}</Badge>,
      align: 'center',
    },
  ];

  const remittanceColumns: ColumnDef<ReconciliationRemittance>[] = [
    {
      id: 'ticketer',
      header: 'Submitted By',
      cell: (r) => (
        <span className="text-slate-200 text-xs font-semibold">{`${r?.ticketer?.first_name || ''} ${r?.ticketer?.last_name || ''}`}</span>
      ),
    },
    {
      id: 'amount',
      header: 'Amount Paid',
      cell: (r) => <span className="text-emerald-400 font-mono text-xs font-bold">{formatMoney(Number(r?.amount))}</span>,
      align: 'right',
    },
    {
      id: 'method',
      header: 'Method',
      cell: (r) => <Badge variant="info">{r?.method}</Badge>,
      align: 'center',
    },
    {
      id: 'date',
      header: 'Submitted Date',
      cell: (r) => <span className="text-slate-400 text-xs">{r ? new Date(r.remittance_date).toLocaleString() : '-'}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (r) => <Badge variant={remittanceStatusVariant(r?.status || "PENDING")}>{r?.status}</Badge>,
      align: 'center',
    },
  ];

  // Insert around line 299 (right after remittanceColumns array and before return)
  const handoverColumns: ColumnDef<ReconciliationRemittance>[] = [
    {
      id: 'ticketer',
      header: 'Submitted By',
      cell: (r) => (
        <div>
          <p className="text-slate-200 text-xs font-semibold">{`${r?.ticketer?.first_name || ''} ${r?.ticketer?.last_name || ''}`}</p>
          <p className="text-[10px] text-slate-400">{r?.pos_session?.device?.name || 'Session Shortage'}</p>
        </div>
      ),
    },
    {
      id: 'amount',
      header: 'Claimed Cash',
      cell: (r) => <span className="text-emerald-400 font-mono text-xs font-bold">{formatMoney(Number(r?.amount))}</span>,
      align: 'right',
    },
    {
      id: 'date',
      header: 'Submitted Date',
      cell: (r) => <span className="text-slate-400 text-xs">{r ? new Date(r.remittance_date).toLocaleString() : '-'}</span>,
    },
    {
      id: 'actions',
      header: 'Supervisor Action',
      align: 'right',
      cell: (r) => {
        if (!r?.id) return null;
        return (
          <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => handleAcceptHandover(r.id, 'ACCEPT')}
              disabled={actionLoading}
              className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-xs font-bold rounded-lg border border-emerald-500/30 transition disabled:opacity-50"
            >
              Accept
            </button>
            <button
              onClick={() => handleAcceptHandover(r.id, 'REJECT')}
              disabled={actionLoading}
              className="px-2.5 py-1 bg-red-500/20 text-red-300 hover:bg-red-500/30 text-xs font-bold rounded-lg border border-red-500/30 transition disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        );
      },
    },

  ];
  const fineColumns: ColumnDef<FineRecord>[] = [
    {
      id: 'defaulter',
      header: 'Defaulter',
      cell: (row) => (
        <div>
          <span className="font-semibold text-white">
            {row?.defaulter?.first_name || ''} {row?.defaulter?.last_name || ''}
          </span>
          <span className="block text-[10px] text-slate-400 capitalize">
            {row?.defaulter?.role.toLowerCase()}
          </span>
        </div>
      ),
    },
    {
      id: 'amount',
      header: 'Amount',
      cell: (row) => (
        <span className={row?.amount === null ? 'text-amber-400 font-medium' : 'text-white'}>
          {row?.amount !== null ? formatMoney(Number(row?.amount)) : 'Pending Input'}
        </span>
      ),
    },
    {
      id: 'reason',
      header: 'Reason',
      cell: (row) => <span className="text-slate-300 max-w-xs truncate block">{row?.reason}</span>,
    },
    {
      id: 'issued_by',
      header: 'Issued By',
      cell: (row) => (
        <span className="text-slate-400">
          {row?.issuer?.first_name || ''} {row?.issuer?.last_name || ''}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => {
        let variant: 'danger' | 'success' | 'warning' | 'info' = 'warning';
        if (row?.status === 'PAID') variant = 'success';
        if (row?.status === 'WAIVED') variant = 'info';
        if (row?.status === 'UNPAID') variant = 'danger';
        return <Badge variant={variant}>{row?.status}</Badge>;
      },
    },
    {
      id: 'created_at',
      header: 'Issued Date',
      cell: (row) => <span className="text-slate-400">{row?.created_at && new Date(row.created_at).toLocaleDateString()}</span>,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (row) => {
        const isUnpaid = row?.status === 'UNPAID';
        if (!isUnpaid) return <span className="text-slate-500 text-xs">No Actions</span>;

        return (
          <div className="flex gap-2">
            {(userRole === 'TICKETER' || userRole === 'ADMIN') && row.amount !== null && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePayFine(row.id);
                }}
                disabled={actionLoading}
                className="px-2.5 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-xs font-semibold transition"
              >
                Pay
              </button>
            )}
            {(userRole === 'ADMIN' || (userRole === 'SUPERVISOR' && row.issued_by === session?.user?.id)) && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleVoidFine(row.id);
                }}
                disabled={actionLoading}
                className="px-2.5 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-semibold transition"
              >
                Waive
              </button>
            )}
          </div>
        );
      },
    },
  ];


  return (
    <>
      <PageScaffold
        title={pageTitle}
        subtitle={pageSubtitle}
        right={
          <div className="flex gap-2 items-center">
            <button
              onClick={() => fetchReconciliationData(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <Select
              value={activeTab}
              onChange={(v) => setActiveTab(v as 'EXPECTATIONS' | 'REMITTANCES' | 'HANDOVERS' | 'FINES')}
              options={[
                { value: 'EXPECTATIONS', label: userRole === 'TICKETER' ? 'My Shortages' : 'Unresolved Shortages' },
                { value: 'REMITTANCES', label: userRole === 'TICKETER' ? 'My Payments' : 'Pending Verification' },
                ...(userRole === 'SUPERVISOR' ? [{ value: 'HANDOVERS', label: '⚡ Cash Requests (Pending)' }] : []),
                { value: 'FINES', label: userRole === 'TICKETER' ? 'My Fines' : 'Fines & Penalties' }
              ]}
            />


          </div>
        }
        kpis={
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard
              title={userRole === 'TICKETER' ? 'Open Shortages' : 'Unresolved Shortages'}
              value={String(expectations.length)}
              icon={<Sigma className="text-blue-300" />}
              iconBg="bg-blue-500/10"
            />
            <StatCard
              title="Total Outstanding Owed"
              value={formatMoney(totalOutstandingShortage)}
              icon={<ArrowDownUp className="text-red-300" />}
              iconBg="bg-red-500/10"
            />
            <StatCard
              title="Submitted Remittances"
              value={String(remittances.length)}
              icon={<AlertCircle className="text-amber-300" />}
              iconBg="bg-amber-500/10"
            />
            <StatCard
              title="Pending Amount"
              value={formatMoney(totalPendingRemittances)}
              icon={<Sigma className="text-emerald-300" />}
              iconBg="bg-emerald-500/10"
            />
          </div>
        }
      >
        <FilterRow>
          <Input value={q} onChange={setQ} placeholder="Search by user, device name or reference..." />
          {activeTab === 'EXPECTATIONS' && (
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'ALL', label: 'All Statuses' },
                { value: 'PENDING', label: 'Pending' },
                { value: 'OVERDUE', label: 'Overdue' },
                { value: 'VIOLATED', label: 'Violated' },
              ]}
            />
          )}
        </FilterRow>

        {error && (
          <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-300 text-sm mb-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {activeTab === 'EXPECTATIONS' ? (
          <DataTable
            rows={filteredExpectations}
            columns={expectationColumns}
            getRowId={(r) => r.id}
            onRowClick={(r) => {
              setSelectedExpectation(r);
              const shortage = Number(r.shortage_amount ?? 0);
              const expected = Number(r.expected_amount ?? 0);
              const payableAmount = shortage > 0 ? shortage : (expected > 0 ? expected : shortage);
              setPayAmount(String(payableAmount));
              setActionError(null);
              setActionSuccess(null);
            }}
            searchValue={q}
            searchPredicate={(r, qq) =>
              `${r.user?.first_name || ''} ${r.user?.last_name || ''}`.toLowerCase().includes(qq) ||
              (r.pos_session?.device?.name || '').toLowerCase().includes(qq)
            }
          />
        )
          : activeTab === 'FINES' ? (
            <DataTable
              rows={filteredFines}
              columns={fineColumns}
              getRowId={(r) => r.id}
              searchValue={q}
              searchPredicate={(r, qq) =>
                `${r.defaulter?.first_name || ''} ${r.defaulter?.last_name || ''}`.toLowerCase().includes(qq) ||
                r.reason.toLowerCase().includes(qq)
              }
            />
          ) : activeTab === 'HANDOVERS' ? (
            <DataTable
              rows={supervisorHandovers}
              columns={handoverColumns}
              getRowId={(r) => r.id}
              searchValue={q}
              searchPredicate={(r, qq) =>
                `${r.ticketer?.first_name || ''} ${r.ticketer?.last_name || ''}`.toLowerCase().includes(qq)
              }
            />
          ) : (
            <DataTable
              rows={filteredRemittances}
              columns={remittanceColumns}
              getRowId={(r) => r.id}
              onRowClick={(r) => {
                setSelectedRemittance(r);
                setActionError(null);
                setActionSuccess(null);
              }}
              searchValue={q}
              searchPredicate={(r, qq) =>
                `${r.ticketer?.first_name || ''} ${r.ticketer?.last_name || ''}`.toLowerCase().includes(qq)
              }
            />
          )}

      </PageScaffold>

      {/* Drawer for Submitting Shortage Payment */}
      {["TICKETER", "SUPERVISOR"].includes(userRole) && (<Drawer
        open={Boolean(selectedExpectation)}
        title="Reconcile Shortage"
        subtitle={selectedExpectation ? `User: ${selectedExpectation.user?.first_name || ''} ${selectedExpectation.user?.last_name || ''}` : undefined}
        onClose={() => setSelectedExpectation(null)}
      >

        {selectedExpectation && (
          <ResponsiveDrawerShell
            title="Submit Shortage Payment"
            subtitle={`Shortage Owed: ${formatMoney(Number(selectedExpectation.shortage_amount))}`}
            badge={<Badge variant={expectationStatusVariant(selectedExpectation.status)}>{selectedExpectation.status}</Badge>}
            stats={[
              { label: 'Expected Float', value: formatMoney(Number(selectedExpectation.expected_amount)), tone: 'info' },
              { label: 'Shortage Owed', value: formatMoney(Number(selectedExpectation.shortage_amount)), tone: 'danger' },
            ]}
            fields={[
              { label: 'Ticketer', value: `${selectedExpectation.user?.first_name || ''} ${selectedExpectation.user?.last_name || ''}` },
              { label: 'Device', value: selectedExpectation.pos_session?.device?.name || 'N/A' },
              { label: 'Due Date', value: new Date(selectedExpectation.due_date).toLocaleDateString() },
            ]}
            sections={[
              {
                title: 'Payment Details',
                content: userRole === 'TICKETER' ? (
                  <form onSubmit={handleSubmitPayment} className="space-y-4 pt-2">
                    {actionError && (
                      <div className="p-3 rounded-xl border border-red-500/20 bg-red-500/10 text-red-300 text-xs">
                        {actionError}
                      </div>
                    )}
                    {actionSuccess && (
                      <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 text-xs">
                        {actionSuccess}
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Amount to Pay (₦)</label>
                      <input
                        type="number"
                        step="0.01"
                        max={
                          Number(selectedExpectation.shortage_amount) > 0
                            ? Number(selectedExpectation.shortage_amount)
                            : Number(selectedExpectation.expected_amount)
                        }
                        value={payAmount}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPayAmount(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Payment Method</label>
                      <select
                        value={payMethod}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPayMethod(e.target.value as ReconciliationMethod)}
                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                      >
                        <option value="CASH">CASH</option>
                        <option value="TRANSFER">BANK TRANSFER</option>
                      </select>
                    </div>
                    {payMethod === 'CASH' && (
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Handed Cash To (Supervisor)</label>
                        <select
                          value={paySupervisorId}
                          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPaySupervisorId(e.target.value)}
                          className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                          required
                        >
                          <option value="" disabled>Select Supervisor...</option>
                          {supervisors?.map((s) => (
                            <option key={s.user_id} value={s.user_id}>
                              {s.username}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {payMethod === 'TRANSFER' && (
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Payment Reference / Transaction ID</label>
                        <input
                          type="text"
                          value={payRef}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPayRef(e.target.value)}
                          placeholder="e.g. TR-984028420"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"

                        />
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="w-full mt-2 bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-xl text-sm transition disabled:opacity-50"
                    >
                      {actionLoading ? 'Submitting...' : 'Submit Reconciliation Payment'}
                    </button>
                  </form>
                ) : (
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300 space-y-2">
                    <p className="font-semibold text-amber-400">ℹ️ Read-Only Audit View</p>
                    <p>Supervisors do not make payments here. The ticketer must remit overdue funds directly or hand over physical cash.</p>
                  </div>
                )

              },
            ]}
          />
        )}
      </Drawer>
      )
      }
      {/* Drawer for Viewing or Verifying a Reconciliation Remittance */}
      <Drawer
        open={Boolean(selectedRemittance)}
        title="Remittance Details"
        subtitle={selectedRemittance ? `ID: ${selectedRemittance.id}` : undefined}
        onClose={() => setSelectedRemittance(null)}
      >
        {selectedRemittance && (
          <ResponsiveDrawerShell
            title="Remittance Details"
            subtitle={`Submitted by ${selectedRemittance.ticketer?.first_name || ''} ${selectedRemittance.ticketer?.last_name || ''}`}
            badge={<Badge variant={remittanceStatusVariant(selectedRemittance.status)}>{selectedRemittance.status}</Badge>}
            stats={[
              { label: 'Amount Paid', value: formatMoney(Number(selectedRemittance.amount)), tone: 'success' },
              { label: 'Method', value: selectedRemittance.method, tone: 'info' },
            ]}
            fields={[
              { label: 'Submitted By', value: `${selectedRemittance.ticketer?.first_name || ''} ${selectedRemittance.ticketer?.last_name || ''}` },
              { label: 'Payment Reference', value: selectedRemittance.payment_reference || 'N/A' },
              { label: 'Date', value: new Date(selectedRemittance.remittance_date).toLocaleString() },
              {
                label: 'Supervisor Status',
                value: selectedRemittance.status === 'ACCEPTED_BY_SUPERVISOR'
                  ? '✅ Counted & Accepted by Supervisor'
                  : selectedRemittance.status === 'PENDING_SUPERVISOR_ACCEPTANCE'
                    ? '⏳ Awaiting Supervisor Physical Count'
                    : 'N/A'
              },
            ]}
            sections={[
              {
                title: userRole === 'ADMIN' || userRole === 'AUDITOR' ? 'Admin Action' : 'Status Overview',
                content: (
                  <div className="space-y-4 pt-2">
                    {actionError && (
                      <div className="p-3 rounded-xl border border-red-500/20 bg-red-500/10 text-red-300 text-xs">
                        {actionError}
                      </div>
                    )}
                    {actionSuccess && (
                      <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 text-xs">
                        {actionSuccess}
                      </div>
                    )}
                    {(userRole === 'ADMIN' || userRole === 'AUDITOR') ? (
                      (selectedRemittance.status === 'PENDING' || selectedRemittance.status === 'ACCEPTED_BY_SUPERVISOR') ? (
                        <div className="flex gap-3 pt-2">
                          <button
                            onClick={() => handleProcessRemittance('VERIFY')}
                            disabled={actionLoading}
                            className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2.5 rounded-xl text-sm transition disabled:opacity-50"
                          >
                            <CheckCircle className="w-4 h-4" /> Verify & Confirm
                          </button>
                          <button
                            onClick={() => handleProcessRemittance('REJECT')}
                            disabled={actionLoading}
                            className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white font-medium py-2.5 rounded-xl text-sm transition disabled:opacity-50"
                          >
                            <XCircle className="w-4 h-4" /> Reject
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">This remittance has already been processed.</p>
                      )
                    ) : (
                      <p className="text-xs text-slate-400 italic">
                        {selectedRemittance.status === 'CONFIRMED'
                          ? 'This payment has been verified by Admin.'
                          : 'Awaiting final verification by Admin.'}
                      </p>
                    )}
                  </div>
                ),
              },
            ]}
          />
        )}
      </Drawer>
    </>
  );
}
