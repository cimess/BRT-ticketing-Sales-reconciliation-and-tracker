"use client"
import { useEffect, useState, FormEvent } from 'react';
import { Percent, Wallet, Calendar, Plus, RefreshCw, AlertCircle, ChevronRight } from 'lucide-react';
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
  const [selectedCommission, setSelectedCommission] = useState<CommissionRow | null>(null);


  // Payroll Generator States
  const [showGenerator, setShowGenerator] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [generating, setGenerating] = useState(false);



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




  // Resolve active rules
  const ticketerRule = rules.find((r) => r.role === 'TICKETER' && r.is_active);
  const supervisorRule = rules.find((r) => r.role === 'SUPERVISOR' && r.is_active);


  // Unified rows map using the Supervisor format:
  const supervisorRows = earnings
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
            <StatCard title="Records" value={String(supervisorRows.length)} icon={<Wallet className="text-blue-300" />} iconBg="bg-blue-500/10" />
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

          </div>
        )}

             {/* COMMISSION STATEMENTS */}
        <div className="mb-8">
          <h2 className="mb-2 text-lg font-bold text-white">
            Commission Statements
            {supervisorRule && <span className='text-slate-500 text-xs font-medium ml-2'> ({supervisorRule.percentage}%)</span>}
          </h2>
          <FilterRow>
            <Input value={q2} onChange={setQ2} placeholder="Search record_id / subject / period…" />
          </FilterRow>
          <div className="space-y-2">
            {supervisorRows
              .filter((r) => !q2 || r.id.toLowerCase().includes(q2.toLowerCase()) || r.period_start.toLowerCase().includes(q2.toLowerCase()) || r.user_name.toLowerCase().includes(q2.toLowerCase()))
              .map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedCommission(item as unknown as CommissionRow)}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-white/3 border border-white/5 hover:border-white/10 hover:bg-white/5 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                      <Percent className="size-4 text-emerald-400" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">
                        {userRole === 'ADMIN' ? item.user_name : 'Commission Statement'}
                      </h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Period: {item.period_start} - {item.period_end}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-xs font-black text-white font-mono">
                        {formatMoney(item.net_pay || 0)}
                      </span>
                      <span className="block mt-0.5">
                        <Badge variant={item.status === 'PAID' ? 'success' : 'warning'}>
                          {item.status}
                        </Badge>
                      </span>
                    </div>
                    <ChevronRight className="size-4 text-slate-600" />
                  </div>
                </div>
              ))}
          </div>
        </div>


      </PageScaffold>

           {/* DRAWER: Commission Details */}
      <Drawer
        open={!!selectedCommission}
        title="Commission Statement"
        subtitle="Verification & earnings breakdown"
        onClose={() => setSelectedCommission(null)}
      >
        {selectedCommission && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-white/3 border border-white/5 space-y-4">
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <div>
                  <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest block">Net Pay</label>
                  <span className="text-lg font-black text-white font-mono mt-1 block">
                    {formatMoney(selectedCommission.net_pay || 0)}
                  </span>
                </div>
                <Badge variant={selectedCommission.status === 'PAID' ? 'success' : 'warning'}>
                  {selectedCommission.status}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest block">Period Start</label>
                  <span className="text-xs text-slate-200 mt-1 block">{selectedCommission.period_start}</span>
                </div>
                <div>
                  <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest block">Period End</label>
                  <span className="text-xs text-slate-200 mt-1 block">{selectedCommission.period_end}</span>
                </div>
              </div>

              {(userRole === 'ADMIN' || userRole === 'AUDITOR') && (
                <div className="pt-3 border-t border-white/5 grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest block">User</label>
                    <span className="text-xs text-slate-200 mt-1 block font-semibold">{selectedCommission.user_name}</span>
                  </div>
                  <div>
                    <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest block">Statement ID</label>
                    <span className="text-[10px] font-mono text-slate-400 mt-1 block break-all">{selectedCommission.id}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-xl bg-white/3 border border-white/5">
                <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest block mb-1">Total Sales</label>
                <p className="text-xs font-mono font-bold text-white">
                  {formatMoney(selectedCommission.total_sales || selectedCommission.tickter_total_sales || 0)}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-white/3 border border-white/5">
                <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest block mb-1">Base Commission</label>
                <p className="text-xs font-mono font-bold text-white">{formatMoney(selectedCommission.commission_amount || 0)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-xl bg-white/3 border border-white/5">
                <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest block mb-1">Fines Deducted</label>
                <p className="text-xs font-mono font-bold text-amber-300">-{formatMoney(selectedCommission.fines_deducted || 0)}</p>
              </div>
              <div className="p-3 rounded-xl bg-white/3 border border-white/5">
                <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest block mb-1">Shortage Deducted</label>
                <p className="text-xs font-mono font-bold text-rose-400">-{formatMoney(selectedCommission.shortage_deducted || 0)}</p>
              </div>
            </div>

            {userRole === 'ADMIN' && (
              <div className="pt-4 border-t border-white/5 flex justify-end">
                {isScenarioActive ? (
                  <span className="text-slate-500 text-xs italic">Scenario Preview</span>
                ) : selectedCommission.status === 'PAID' ? (
                  <button
                    onClick={async () => {
                      await handleUpdateStatus(selectedCommission, 'PENDING');
                      setSelectedCommission(null);
                    }}
                    disabled={payingId === selectedCommission.id}
                    className="w-full py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-semibold rounded-xl transition-all"
                  >
                    {payingId === selectedCommission.id ? 'Reversing...' : 'Reverse Payment'}
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      await handleUpdateStatus(selectedCommission, 'PAID');
                      setSelectedCommission(null);
                    }}
                    disabled={payingId === selectedCommission.id}
                    className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-all"
                  >
                    {payingId === selectedCommission.id ? 'Paying...' : 'Mark as Paid'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </Drawer>


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


    </>
  );
}
