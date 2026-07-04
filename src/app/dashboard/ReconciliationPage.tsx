"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Sigma, ArrowDownUp, AlertCircle, RefreshCw, CheckCircle, XCircle, Plus } from 'lucide-react';
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
  status: 'UNPAID' | 'PAID' | 'WAIVED' | 'PENDING';
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
  const [statusFilter, setStatusFilter] = useState<string>('VIOLATED');

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

  // Manual Fine States
  const [fineUsers, setFineUsers] = useState<{ id: string; name: string }[]>([]);
  const [openIssueFineDrawer, setOpenIssueFineDrawer] = useState(false);
  const [fineTargetUser, setFineTargetUser] = useState('');
  const [fineAmount, setFineAmount] = useState('');
  const [fineReason, setFineReason] = useState('');
  const [submitting, setSubmitting] = useState(false);


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

  // Load candidate users who can receive fines (typed explicitly)
  const loadFineUsers = useCallback(async () => {
    try {
      if (userRole === 'ADMIN') {
        const res = await api.get('/admin/user');
        if (res.data?.success) {
          setFineUsers(res.data.data.map((u: { user_id: string; username: string; role: string }) => ({
            id: u.user_id,
            name: `${u.username} (${u.role})`
          })));
        }
      } else if (userRole === 'SUPERVISOR') {
        const res = await api.get('/supervisor/user');
        if (res.data?.success) {
          setFineUsers(res.data.data.map((u: { id: string; first_name: string; last_name: string }) => ({
            id: u.id,
            name: `${u.first_name} ${u.last_name} (TICKETER)`
          })));
        }
      }
    } catch (err) {
      console.error('Failed to load users for fine dropdown', err);
    }
  }, [userRole]);


  // Issue fine submission handler
  const handleIssueFine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fineTargetUser || !fineReason) {
      return toast.error("Please select a user and provide a reason");
    }
    if (!fineAmount || isNaN(parseFloat(fineAmount)) || parseFloat(fineAmount) <= 0) {
      return toast.error("Please enter a valid fine amount");
    }

    setSubmitting(true);
    try {
      const res = await api.post('/fines', {
        defaulterId: fineTargetUser,
        amount: parseFloat(fineAmount),
        reason: fineReason
      });

      if (res.data?.success) {
        toast.success("Fine issued successfully!");
        setFineTargetUser('');
        setFineAmount('');
        setFineReason('');
        setOpenIssueFineDrawer(false);
        fetchFines();
      } else {
        toast.error(res.data?.error || "Failed to issue fine");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error issuing fine");
    } finally {
      setSubmitting(false);
    }
  };


  const handleSubmitPayment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedExpectation) return;

    if (userRole !== "TICKETER" && !(userRole === "SUPERVISOR" && selectedExpectation?.user_id === session?.user?.id)) {
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
        supervisor_id: (payMethod === 'CASH' && userRole === 'TICKETER') ? paySupervisorId : undefined,
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
      const message = err instanceof axios.AxiosError ? err.response?.data.message : 'An error occurred during submission';
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
      const message = err instanceof axios.AxiosError ? err.response?.data.message : 'An error occurred during verification';
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
    if (!confirm("Are you sure you want to declare this fine as paid? Admin will verify the cash collection.")) return;
    try {
      setActionLoading(true);
      const res = await api.patch(`/fines/${fineId}`, { action: "DECLARE_PAID" });
      if (res.data.success) {
        toast.success("Declared as paid! Awaiting admin verification.");
        fetchFines();
        refreshMetrics();
      } else {
        toast.error(res.data.error || "Failed to declare fine paid");
      }
    } catch (err) {
      toast.error("Error declaring fine paid");
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerifyFine = async (fineId: string) => {
    if (!confirm("Confirm that you have received this cash payment and wish to settle the fine?")) return;
    try {
      setActionLoading(true);
      const res = await api.patch(`/fines/${fineId}`, { action: "VERIFY_PAYMENT" });
      if (res.data.success) {
        toast.success("Fine payment verified and ledger updated!");
        fetchFines();
        refreshMetrics();
      } else {
        toast.error(res.data.error || "Failed to verify fine");
      }
    } catch (err) {
      toast.error("Error verifying fine");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReverseFine = async (fineId: string) => {
    if (!confirm("Are you sure you want to reverse this fine payment? This will restore the user's debt and adjust the balance ledgers.")) return;
    try {
      setActionLoading(true);
      const res = await api.patch(`/fines/${fineId}`, { action: "REVERSE" });
      if (res.data.success) {
        toast.success("Fine payment reversed successfully!");
        fetchFines();
        refreshMetrics();
      } else {
        toast.error(res.data.error || "Failed to reverse fine payment");
      }
    } catch (err) {
      toast.error("Error reversing fine payment");
    } finally {
      setActionLoading(false);
    }
  };



  const handleUpdateFineAmount = async (fineId: string, amount: number) => {
    try {
      setActionLoading(true);
      const res = await api.patch(`/fines/${fineId}`, { action: "UPDATE_AMOUNT", amount });
      if (res.data.success) {
        toast.success("Fine amount updated successfully!");
        fetchFines();
        refreshMetrics();
      } else {
        toast.error(res.data.error || "Failed to update fine amount");
      }
    } catch (err) {
      toast.error("Error updating fine amount");
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
        if (row?.status === 'PENDING') variant = 'warning';
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
        const isPending = row?.status === 'PENDING';
        const isPaid = row?.status === 'PAID';

        if (!isUnpaid && !isPending && !isPaid) {
          return <span className="text-slate-500 text-xs">No Actions</span>;
        }

        return (
          <div className="flex gap-2">
            {/* Pay Button: Only shown to the offender/defaulter if unpaid */}
            {isUnpaid && row.defaulter_id === session?.user?.id && row.amount !== null && (
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

            {/* Verify Button: Only shown to ADMIN when fine is PENDING verification */}
            {isPending && userRole === 'ADMIN' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleVerifyFine(row.id);
                }}
                disabled={actionLoading}
                className="px-2.5 py-1 rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-xs font-semibold transition"
              >
                Verify
              </button>
            )}

            {/* Reverse Button: Only shown to ADMIN when fine is PAID */}
            {isPaid && userRole === 'ADMIN' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleReverseFine(row.id);
                }}
                disabled={actionLoading}
                className="px-2.5 py-1 rounded bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 text-xs font-semibold transition"
              >
                Reverse
              </button>
            )}

                       {/* Set / Edit Amount Button: Admin/Issuer supervisor on unpaid fine */}
            {isUnpaid && (userRole === 'ADMIN' || (userRole === 'SUPERVISOR' && row.issued_by === session?.user?.id)) && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const amt = prompt(row.amount === null ? "Enter fine amount:" : "Edit fine amount:", row.amount?.toString() || "");
                  if (amt) {
                    const parsed = parseFloat(amt);
                    if (!isNaN(parsed) && parsed > 0) {
                      handleUpdateFineAmount(row.id, parsed);
                    } else {
                      alert("Please enter a valid positive number");
                    }
                  }
                }}
                disabled={actionLoading}
                className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 text-xs font-semibold transition"
              >
                {row.amount === null ? "Set Amount" : "Edit Amount"}
              </button>
            )}

            {/* Waive Button: Admin/Issuer supervisor on unpaid or pending fine */}
            {(isUnpaid || isPending) && (userRole === 'ADMIN' || (userRole === 'SUPERVISOR' && row.issued_by === session?.user?.id)) && (
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
    }



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

            {/* Added: Manual "Issue Fine" button for Admins and Supervisors when viewing the Fines tab */}
            {activeTab === 'FINES' && (userRole === 'ADMIN' || userRole === 'SUPERVISOR') && (
              <button
                onClick={() => { loadFineUsers(); setOpenIssueFineDrawer(true) }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-semibold transition border border-red-500/30"
              >
                <Plus className="w-3.5 h-3.5" /> Issue Fine
              </button>
            )}

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
                content: (userRole === 'TICKETER' || (userRole === 'SUPERVISOR' && selectedExpectation.user_id === session?.user?.id)) ? (
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
                    {payMethod === 'CASH' && userRole === 'TICKETER' && (
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
                      <div className="pt-2">
                        <p className="text-xs text-slate-400 italic">
                          Please verify or reject this remittance from the main Remittances page.
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">
                        {selectedRemittance.status === 'CONFIRMED'
                          ? 'This payment has been verified by Admin.'
                          : 'Pending Admin verification.'}
                      </p>
                    )}

                  </div>
                ),
              },
            ]}
          />
        )}
      </Drawer>


      {/* Issue Fine Drawer (Admin / Supervisor Only) */}
      <Drawer
        open={openIssueFineDrawer}
        title="Issue Manual Fine"
        subtitle="Manually issue a fine or penalty to a user"
        onClose={() => {
          setOpenIssueFineDrawer(false);
          setFineTargetUser('');
          setFineAmount('');
          setFineReason('');
        }}
      >
        <form onSubmit={handleIssueFine} className="space-y-4">
          <div>
            <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Select User</label>
            <select
              required
              value={fineTargetUser}
              onChange={(e) => setFineTargetUser(e.target.value)}
              className="mt-2 w-full rounded-xl bg-white/3 border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none"
            >
              <option value="" className="bg-black">Select user to fine...</option>
              {fineUsers.map((u) => (
                <option key={u.id} value={u.id} className="bg-black">
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Fine Amount</label>
            <input
              type="number"
              required
              min="0.01"
              step="any"
              placeholder="e.g. 5000"
              value={fineAmount}
              onChange={(e) => setFineAmount(e.target.value)}
              className="mt-2 w-full rounded-xl bg-white/3 border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none"
            />
          </div>

          <div>
            <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Reason / Violation</label>
            <textarea
              required
              rows={3}
              placeholder="Provide detail about why this fine is being issued..."
              value={fineReason}
              onChange={(e) => setFineReason(e.target.value)}
              className="mt-2 w-full rounded-xl bg-white/3 border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-linear-to-r from-red-500 to-rose-500 text-white py-3 text-sm font-bold tracking-tight active:scale-[0.99] disabled:opacity-50 transition-all mt-4"
          >
            {submitting ? 'Issuing...' : 'Issue Fine'}
          </button>
        </form>
      </Drawer>

    </>
  );
}
