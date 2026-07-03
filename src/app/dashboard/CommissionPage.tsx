"use client"
import { useEffect, useState, FormEvent } from 'react';
import { Percent, Wallet, Calendar, Plus, RefreshCw, AlertCircle } from 'lucide-react';
import StatCard from '@/components/StatCard';
import { Badge } from '@/components/Badge';
import { DataTable, type ColumnDef } from '@/components/DataTable';
import { FilterRow, Input, PageScaffold } from '@/components/pageScaffold';
import type { Sales_Record } from '@/types/types';
import { formatMoney } from '@/lib/utils';
import { Drawer } from '@/components/Drawer';
import { useSession } from 'next-auth/react';
import api from '../lib/axios';
import { toast } from 'react-toastify';
import axios from 'axios';

interface CommissionRow {
  id: string;
  user_id: string;
  user_name: string;
  period_start: string;
  period_end: string;
  raw_period_start?: string;
  raw_period_end?: string;
  total_sales?: number;
  commission_amount?: number;
  tickter_total_sales?: number;
  fines_deducted: number;
  shortage_deducted: number;
  net_pay: number;
  created_at: string;
  status: string;
}


interface CommissionRule {
  id: string;
  role: 'TICKETER' | 'SUPERVISOR' | string;
  percentage: number | null;
  fixed_amount: number | string | null;
  is_active: boolean;
  created_at: string;
  company_id: string;
}

interface UserEarningDetail {
  first_name: string;
  last_name: string;
  email: string;
  role: 'TICKETER' | 'SUPERVISOR' | string;
}

interface CommissionEarning {
  id: string;
  user_id: string;
  period_start: string;
  period_end: string;
  total_sales: number;
  commission_amount: number;
  shortage_deducted: number;
  fines_deducted: number;
  net_pay: number;
  status: 'PENDING' | 'PAID';
  created_at: string;
  user?: UserEarningDetail;
}


export default function CommissionPage() {
  const { data: session } = useSession();
  const userRole = session?.user?.role;
  const userId = session?.user?.id;

  const [q, setQ] = useState('');
  const [q2, setQ2] = useState('');
  const [selected, setSelected] = useState<Sales_Record[] | null>(null);

  // Strictly Typed States
  const [earnings, setEarnings] = useState<CommissionEarning[]>([]);
  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Payroll Generator States
  const [showGenerator, setShowGenerator] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [generating, setGenerating] = useState(false);

  // Rule Form States
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [ruleRole, setRuleRole] = useState('TICKETER');
  const [rulePercentage, setRulePercentage] = useState('');
  const [ruleFixedAmount, setRuleFixedAmount] = useState('');
  const [savingRule, setSavingRule] = useState(false);

     // Pay / Reverse Action Handler
  const [payingId, setPayingId] = useState<string | null>(null);
  const [isScenarioActive, setIsScenarioActive] = useState(false);

  const handleUpdateStatus = async (row: CommissionRow, status: 'PAID' | 'PENDING') => {
    try {
      setPayingId(row.id);
      const res = await api.patch('/admin/commision-earnings', {
        id: row.id,
        status,
        userId: row.user_id,
        periodStart: row.raw_period_start,
        periodEnd: row.raw_period_end,
        totalSales: row.total_sales || row.tickter_total_sales || 0,
        commissionAmount: row.commission_amount || 0,
        finesDeducted: row.fines_deducted || 0,
        shortage_deducted: row.shortage_deducted || 0,
        netPay: row.net_pay || 0
      });
      if (res.data.error) throw new Error(res.data.error);
      
      const successMessage = status === 'PAID' 
        ? "Statement successfully marked as PAID!" 
        : "Payment successfully reversed to PENDING!";
      toast(successMessage, { type: "success" });
      
      // Reload active dataset
      if (isScenarioActive) {
        const reloadRes = await api.get('/admin/commision-earnings', {
          params: { startDate, endDate }
        });
        setEarnings(reloadRes.data.earnings || []);
      } else {
        fetchData(); 
      }
    } catch (err) {
      if (err instanceof axios.AxiosError) {
        const message = err.response?.data?.error || `Failed to update status to ${status}.`;
        toast(message, { type: "error" });
      } else {
        toast(`Failed to update status to ${status}.`, { type: "error" });
      }
    } finally {
      setPayingId(null);
    }
  };

  const handleMarkAsPaid = async (id: string) => {
    try {
      setPayingId(id);
      const res = await api.patch('/admin/commision-earnings', {
        id,
        status: 'PAID'
      });
      if (res.data.error) throw new Error(res.data.error);
      toast("Statement successfully marked as PAID!", { type: "success" });
      fetchData(); // Refresh list to show updated status
    } catch (err) {
      if (err instanceof axios.AxiosError) {
        const message = err.response?.data?.error || "Failed to mark statement as paid.";
        toast(message, { type: "error" });
      } else {
        toast("Failed to mark statement as paid.", { type: "error" });
      }
    } finally {
      setPayingId(null);
    }
  };


  // Fetch data (triggered manually or on actions)
  const fetchData = async () => {
    try {
      setLoading(true);
      if (error !== null) {
        setError(null);
      }

      const earningsPromise = api.get<{ success?: boolean; earnings: CommissionEarning[]; error?: string }>('/admin/commision-earnings').then(res => res.data);

      if (userRole === 'ADMIN') {
        const rulesPromise = api.get<{ success: boolean; rules: CommissionRule[]; error?: string }>('/admin/commision-rules').then(res => res.data);
        const [earningsRes, rulesRes] = await Promise.all([earningsPromise, rulesPromise]);
        
        if (earningsRes.error) throw new Error(earningsRes.error);
        setEarnings(earningsRes.earnings || []);
        if (rulesRes && rulesRes.success) {
          setRules(rulesRes.rules || []);
        }
      } else {
        const earningsRes = await earningsPromise;
        if (earningsRes.error) throw new Error(earningsRes.error);
        setEarnings(earningsRes.earnings || []);
      }
    } catch (err) {
      if (err instanceof axios.AxiosError) {
        const message = err.response?.data?.error || "Failed to load commission data.";
        setError(message);
      } else {
        setError("Failed to load commission data.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Safe effect subscription with zero synchronous state updates on initial render
  useEffect(() => {
    let isMounted = true;
    if (session?.user) {
      const load = async () => {
        try {
          const earningsPromise = api.get<{ success?: boolean; earnings: CommissionEarning[]; error?: string }>('/admin/commision-earnings').then(res => res.data);
          
          if (userRole === 'ADMIN') {
            const rulesPromise = api.get<{ success: boolean; rules: CommissionRule[]; error?: string }>('/admin/commision-rules').then(res => res.data);
            const [earningsRes, rulesRes] = await Promise.all([earningsPromise, rulesPromise]);
            
            if (!isMounted) return;
            if (earningsRes.error) throw new Error(earningsRes.error);
            setEarnings(earningsRes.earnings || []);
            if (rulesRes && rulesRes.success) {
              setRules(rulesRes.rules || []);
            }
          } else {
            const earningsRes = await earningsPromise;
            if (!isMounted) return;
            if (earningsRes.error) throw new Error(earningsRes.error);
            setEarnings(earningsRes.earnings || []);
          }
        } catch (err) {
          if (!isMounted) return;
          if (err instanceof axios.AxiosError) {
            setError(err.response?.data?.error || "Failed to load commission data.");
          } else {
            setError("Failed to load commission data.");
          }
        } finally {
          if (isMounted) {
            setLoading(false);
          }
        }
      };
      load();
    }
    return () => {
      isMounted = false;
    };
  }, [session, userRole]);

  // Run Payroll
  const handleGenerateEarnings = async (e: FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) return;

    try {
      setGenerating(true);
      const res = await api.get('/admin/commision-earnings', {
        params: {
          startDate,
          endDate
        }
      });

      if (res.data.error) throw new Error(res.data.error);
      
      setEarnings(res.data.earnings || []);
      setIsScenarioActive(true);
      setShowGenerator(false);
      toast("Scenario calculations compiled successfully!", { type: "success" });
    } catch (err) {
      if (err instanceof axios.AxiosError) {
        const message = err.response?.data?.error || "Failed to calculate scenario.";
        toast(message, { type: "error" });
      } else {
        toast("Failed to calculate scenario.", { type: "error" });
      }
    } finally {
      setGenerating(false);
    }
  };


  // Save Rule
  const handleSaveRule = async (e: FormEvent) => {
    e.preventDefault();
    try {
      setSavingRule(true);
      await api.post('/admin/commision-rules', {
        role: ruleRole,
        percentage: rulePercentage ? parseFloat(rulePercentage) : null,
        fixedAmount: ruleFixedAmount ? parseFloat(ruleFixedAmount) : null
      });

      setShowRuleForm(false);
      fetchData(); // Refresh rules safely (async)
    } catch (err) {
      if (err instanceof axios.AxiosError) {
        const message = err.response?.data?.error || "Failed to save rule.";
        toast(message, { type: "error" });
      } else {
        toast("Failed to save rule.", { type: "error" });
      }
    } finally {
      setSavingRule(false);
    }
  };

  // Resolve active rules
  const ticketerRule = rules.find((r) => r.role === 'TICKETER' && r.is_active);
  const supervisorRule = rules.find((r) => r.role === 'SUPERVISOR' && r.is_active);

     // In ticketerRows map:
  const ticketerRows = earnings
    .filter((e) => e.user?.role === 'TICKETER')
    .filter((e) => userRole === 'ADMIN' || e.user_id === userId)
    .map((e) => ({
      id: e.id,
      user_id: e.user_id,
      user_name: `${e.user?.first_name || ''} ${e.user?.last_name || ''}`,
      period_start: new Date(e.period_start).toLocaleDateString(),
      period_end: new Date(e.period_end).toLocaleDateString(),
      raw_period_start: e.period_start,
      raw_period_end: e.period_end,
      total_sales: e.total_sales,
      commission_amount: e.commission_amount,
      fines_deducted: e.fines_deducted,
      shortage_deducted: e.shortage_deducted || 0,
      net_pay: e.net_pay,
      created_at: new Date(e.created_at).toLocaleDateString(),
      status: e.status,
    }));

  // In supervisorRows map:
  const supervisorRows = earnings
    .filter((e) => e.user?.role === 'SUPERVISOR')
    .filter((e) => userRole === 'ADMIN' || e.user_id === userId)
    .map((e) => ({
      id: e.id,
      user_id: e.user_id,
      user_name: `${e.user?.first_name || ''} ${e.user?.last_name || ''}`,
      period_start: new Date(e.period_start).toLocaleDateString(),
      period_end: new Date(e.period_end).toLocaleDateString(),
      raw_period_start: e.period_start,
      raw_period_end: e.period_end,
      tickter_total_sales: e.total_sales,
      commission_amount: e.commission_amount,
      fines_deducted: e.fines_deducted,
      shortage_deducted: e.shortage_deducted || 0,
      net_pay: e.net_pay,
      created_at: new Date(e.created_at).toLocaleDateString(),
      status: e.status,
    }));


  const totalNet = earnings
    .filter((e) => userRole === 'ADMIN' || e.user_id === userId)
    .reduce((acc, r) => acc + (r?.net_pay || 0), 0);

   const columns2: ColumnDef<CommissionRow>[] = [
    { id: 'id', header: 'record_id', cell: (r) => <span className="text-slate-200 font-mono text-xs">{r?.id}</span> },
    { id: 'user_name', header: 'Supervisor', cell: (r) => <span className="text-slate-200 font-mono text-xs">{r?.user_name}</span> },
    { id: 'start_period', header: 'start', cell: (r) => <span className="text-slate-400 text-xs">{r?.period_start}</span> },
    { id: 'end_period', header: 'end', cell: (r) => <span className="text-slate-400 text-xs">{r?.period_end}</span> },
    { id: 'total_sales', header: 'Total Sales Under Mgmt', cell: (r) => <span className="text-slate-300 text-xs font-bold">{formatMoney(r?.tickter_total_sales || 0)}</span> },
    { id: 'fines_deducted', header: 'fines_deducted', align: 'center', cell: (r) => <Badge variant="info">{formatMoney(r?.fines_deducted || 0)}</Badge> },
    { id: 'shortage_deducted', header: 'shortage_deducted', align: 'center', cell: (r) => <Badge variant="danger">{formatMoney(r?.shortage_deducted || 0)}</Badge> },
    { id: 'net_pay', header: 'net_pay', align: 'right', cell: (r) => <span className="text-slate-200 font-mono text-xs font-bold">{formatMoney(r?.net_pay || 0)}</span> },
    { id: 'status', header: 'status', align: 'right', cell: (r) => <Badge variant={r?.status === 'PAID' ? 'success' : 'warning'}>{r?.status}</Badge> },
      {
      id: 'actions',
      header: 'Actions',
      align: 'right',
      cell: (r) => {
        if (userRole !== 'ADMIN') return null;
        
        // Scenario mode: read-only, no action buttons
        if (isScenarioActive) {
          return <span className="text-slate-500 text-xs italic">Scenario Preview</span>;
        }
        
        // Paid status: show reverse button
        if (r?.status === 'PAID') {
          return (
            <div className="flex items-center gap-2 justify-end">
              <span className="text-emerald-400 text-xs font-semibold">Paid</span>
              <button
                onClick={() => handleUpdateStatus(r, 'PENDING')}
                disabled={payingId === r?.id}
                className="px-2 py-0.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-[10px] font-medium rounded transition-all"
              >
                {payingId === r?.id ? 'Reversing...' : 'Reverse'}
              </button>
            </div>
          );
        }
        
        // Pending/Live status: show pay button
        return (
          <button
            onClick={() => {r?.id && handleUpdateStatus(r, 'PAID')}}
            disabled={payingId === r?.id}
            className="px-3 py-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-all"
          >
            {payingId === r?.id ? 'Paying...' : 'Mark Paid'}
          </button>
        );
      }
    }


  ];

  const columns: ColumnDef<CommissionRow>[] = [
    { id: 'id', header: 'record_id', cell: (r) => <span className="text-slate-200 font-mono text-xs">{r?.id}</span> },
    { id: 'user_name', header: 'Ticketer', cell: (r) => <span className="text-slate-200 font-mono text-xs">{r?.user_name}</span> },
    { id: 'start_period', header: 'start', cell: (r) => <span className="text-slate-400 text-xs">{r?.period_start}</span> },
    { id: 'end_period', header: 'end', cell: (r) => <span className="text-slate-400 text-xs">{r?.period_end}</span> },
    { id: 'total_sales', header: 'total_sales', cell: (r) => <span className="text-slate-300 text-xs font-bold">{formatMoney(r?.total_sales || 0)}</span> },
    { id: 'fines_deducted', header: 'fines_deducted', align: 'center', cell: (r) => <Badge variant="info">{formatMoney(r?.fines_deducted || 0)}</Badge> },
    { id: 'shortage_deducted', header: 'shortage_deducted', align: 'center', cell: (r) => <Badge variant="danger">{formatMoney(r?.shortage_deducted || 0)}</Badge> },
    { id: 'net_pay', header: 'net_pay', align: 'right', cell: (r) => <span className="text-slate-200 font-mono text-xs font-bold">{formatMoney(r?.net_pay || 0)}</span> },
    { id: 'status', header: 'status', align: 'right', cell: (r) => <Badge variant={r?.status === 'PAID' ? 'success' : 'warning'}>{r?.status}</Badge> },
          {
      id: 'actions',
      header: 'Actions',
      align: 'right',
      cell: (r) => {
        if (userRole !== 'ADMIN') return null;
        
        // Scenario mode: read-only, no action buttons
        if (isScenarioActive) {
          return <span className="text-slate-500 text-xs italic">Scenario Preview</span>;
        }
        
        // Paid status: show reverse button
        if (r?.status === 'PAID') {
          return (
            <div className="flex items-center gap-2 justify-end">
              <span className="text-emerald-400 text-xs font-semibold">Paid</span>
              <button
                onClick={() => handleUpdateStatus(r, 'PENDING')}
                disabled={payingId === r?.id}
                className="px-2 py-0.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-[10px] font-medium rounded transition-all"
              >
                {payingId === r?.id ? 'Reversing...' : 'Reverse'}
              </button>
            </div>
          );
        }
        
        // Pending/Live status: show pay button
        return (
          <button
            onClick={() => { r?.id && handleUpdateStatus(r, 'PAID')}}
            disabled={payingId === r?.id}
            className="px-3 py-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-all"
          >
            {payingId === r?.id ? 'Paying...' : 'Mark Paid'}
          </button>
        );
      }
    }


  ];


  if (loading) {
    return (
      <PageScaffold title="Commission Engine" subtitle="Loading live records...">
        <div className="flex h-64 items-center justify-center">
          <RefreshCw className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </PageScaffold>
    );
  }

  return (
    <>
      <PageScaffold
        title="Commission Engine"
        subtitle={userRole === 'ADMIN' ? "Computed records and payroll settings" : "My earnings reports"}
        kpis={
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard title="Records" value={String(userRole === 'ADMIN' ? earnings.length : (userRole === 'SUPERVISOR' ? supervisorRows.length : ticketerRows.length))} icon={<Wallet className="text-blue-300" />} iconBg="bg-blue-500/10" />
            <StatCard title="Net Total" value={formatMoney(totalNet)} icon={<Wallet className="text-emerald-300" />} iconBg="bg-emerald-500/10" />
            <StatCard title="Ticketer Rule" value={ticketerRule ? `${ticketerRule.percentage}%` : 'Not Set'} icon={<Percent className="text-purple-300" />} iconBg="bg-purple-500/10" />
            <StatCard title="Supervisor Rule" value={supervisorRule ? `${supervisorRule.percentage}%` : 'Not Set'} icon={<Percent className="text-amber-300" />} iconBg="bg-amber-500/10" />
          </div>
        }
      >
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-red-200">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        )}

               {userRole === 'ADMIN' && (
          <div className="flex flex-wrap gap-3 mb-6">
            <button
              onClick={() => setShowGenerator(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-xl transition-all"
            >
              <Calendar className="h-4 w-4" /> Run Payroll Scenario
            </button>
            {isScenarioActive && (
              <button
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                  setIsScenarioActive(false);
                  fetchData(); // Reloads the default live estimates
                }}
                className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-sm font-semibold rounded-xl transition-all"
              >
                Clear Scenario Filter
              </button>
            )}
            <button
              onClick={() => setShowRuleForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-sm font-semibold rounded-xl transition-all border border-white/10"
            >
              <Plus className="h-4 w-4" /> Update Commission Rules
            </button>
          </div>
        )}


        {/* TICKETERS SECTION */}
        {(userRole === 'ADMIN' || userRole === 'TICKETER') && (
          <div className="mb-8">
            <h2 className="mb-2 text-lg font-bold text-white">
              Ticketer Commission Statements
              {ticketerRule && <span className='text-slate-500 text-xs font-medium ml-2'> ({ticketerRule.percentage}%)</span>}
            </h2>
            <FilterRow>
              <Input value={q} onChange={setQ} placeholder="Search record_id / subject / period…" />
            </FilterRow>
            <DataTable
              rows={ticketerRows}
              columns={columns}
              getRowId={(r) => r.id}
              searchValue={q}
              searchPredicate={(r, qq) =>
                r.id.toLowerCase().includes(qq) || r.user_id.toLowerCase().includes(qq) || r.period_start.toLowerCase().includes(qq)
              }
            />
          </div>
        )}

        {/* SUPERVISORS SECTION */}
        {(userRole === 'ADMIN' || userRole === 'SUPERVISOR') && (
          <div className="mb-8">
            <h2 className="mb-2 text-lg font-bold text-white">
              Supervisor Commission Statements
              {supervisorRule && <span className='text-slate-500 text-xs font-medium ml-2'> ({supervisorRule.percentage}%)</span>}
            </h2>
            <FilterRow>
              <Input value={q2} onChange={setQ2} placeholder="Search record_id / subject / period…" />
            </FilterRow>
            <DataTable
              rows={supervisorRows}
              columns={columns2}
              getRowId={(r) => r.id}
              searchValue={q2}
              searchPredicate={(r, qq) =>
                r.id.toLowerCase().includes(qq) || r.user_id.toLowerCase().includes(qq) || r.period_start.toLowerCase().includes(qq)
              }
            />
          </div>
        )}
      </PageScaffold>

      {/* MODAL: Payroll Generator */}
      <Drawer
        open={showGenerator}
        title="Run Payroll Engine"
        subtitle="Generate commission entries and offset outstanding fines"
        onClose={() => setShowGenerator(false)}
      >
        <form onSubmit={handleGenerateEarnings} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">Period Start Date</label>
            <input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-[#0B0F19] border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">Period End Date</label>
            <input
              type="date"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-[#0B0F19] border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
          <button
            type="submit"
            disabled={generating}
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-all disabled:opacity-50"
          >
            {generating ? 'Compiling Statements...' : 'Compile & Generate Earnings'}
          </button>
        </form>
      </Drawer>

      {/* MODAL: Commission Rules Editor */}
      <Drawer
        open={showRuleForm}
        title="Update Commission Rules"
        subtitle="Set active percentage or fixed payouts per ticket/shift sold"
        onClose={() => setShowRuleForm(false)}
      >
        <form onSubmit={handleSaveRule} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">Target User Role</label>
            <select
              value={ruleRole}
              onChange={(e) => setRuleRole(e.target.value)}
              className="w-full bg-[#0B0F19] border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="TICKETER">Ticketer</option>
              <option value="SUPERVISOR">Supervisor</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">Percentage Payout (%)</label>
            <input
              type="number"
              step="0.01"
              placeholder="e.g. 2.5"
              value={rulePercentage}
              onChange={(e) => setRulePercentage(e.target.value)}
              className="w-full bg-[#0B0F19] border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">Fixed Payout Amount (optional)</label>
            <input
              type="number"
              placeholder="e.g. 500"
              value={ruleFixedAmount}
              onChange={(e) => setRuleFixedAmount(e.target.value)}
              className="w-full bg-[#0B0F19] border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
          <button
            type="submit"
            disabled={savingRule}
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-all disabled:opacity-50"
          >
            {savingRule ? 'Saving Rule...' : 'Save & Set as Active Rule'}
          </button>
        </form>
      </Drawer>
    </>
  );
}
