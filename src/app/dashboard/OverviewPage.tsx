"use client";

import { useState, useEffect, useCallback } from 'react';
import { useSse } from '@/context/SseContext';
import { Sigma, BriefcaseBusiness, Receipt, AlertTriangle, Users } from 'lucide-react';
import StatCard from '@/components/StatCard';
import { Badge } from '@/components/Badge';
import { DataTable, type ColumnDef } from '@/components/DataTable';
import { Drawer } from '@/components/Drawer';
import { PageScaffold, Select } from '@/components/pageScaffold';
import type { ReconciliationRun, ReconciliationScope, Status } from '@/types/types';
import { formatMoney } from '@/app/lib/utils';
import { ResponsiveDrawerShell } from '@/components/ResponsiveDrawerShell';
import OverviewChart from "@/components/Piechart";
import { useSession } from "next-auth/react";
import { useDashboard } from "./layout";
import api from "@/app/lib/axios";

export default function OverviewPage() {
  const [q, setQ] = useState('');
  const [scope, setScope] = useState<'ALL' | ReconciliationRun['scope']>('ALL');
  const [rows, setRows] = useState<ReconciliationRun[]>([]);
  const [selected, setSelected] = useState<ReconciliationRun | null>(null);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);

  const { data: session } = useSession();
  const { metrics, refreshMetrics } = useDashboard();
  const { subscribe } = useSse();

  // SSR hydration safety
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setMounted(true);
    }, 500); 
    return () => clearTimeout(timeoutId);
  }, []);

  // Fetch live reconciliation data based on role
  const fetchReconciliationData = useCallback(async () => {
    if (!session?.user) return;
    try {
      setLoading(true);
      const role = session.user.role;

      if (role === "ADMIN" || role === "AUDITOR") {
        const res = await api.get("/admin/audit");
        if (res.data?.success && res.data?.data) {
          const reports = res.data.data.reconciliationReports || [];
          const mappedRuns: ReconciliationRun[] = reports.map((rep: {
            id: string;
            expected_float: string | number;
            actual_remittance: string | number;
            variance: string | number;
            date: string;
            scope: string;
            status: string;
            user_id: string;
            generated_at: string;
          }) => ({
            run_id: rep.id,
            expected_float: Number(rep.expected_float || 0),
            actual_remittance: Number(rep.actual_remittance || 0),
            variance: Number(rep.variance || 0),
            date: new Date(rep.date).toLocaleDateString(),
            scope: rep.scope as ReconciliationScope,
            status: rep.status as Status,
            actor: rep.user_id,
            generated_at: new Date(rep.generated_at).toLocaleDateString(),
          }));
          setRows(mappedRuns);
        }
      } else {
        // SUPERVISOR or TICKETER
        const res = await api.get("/reconcile");
        if (res.data?.success && res.data?.expectations) {
          const expectations = res.data.expectations || [];
          const mappedRuns: ReconciliationRun[] = expectations.map((exp: {
            id: string;
            expected_amount: number;
            shortage_amount: number;
            due_date: string;
            user?: { role: string; first_name?: string; last_name?: string };
            created_at: string;
            status: string;
          }) => ({
            run_id: exp.id,
            expected_float: Number(exp.expected_amount || 0),
            actual_remittance: Number(exp.expected_amount || 0) - Number(exp.shortage_amount || 0),
            variance: -Number(exp.shortage_amount || 0),
            date: new Date(exp.due_date).toLocaleDateString(),
            scope: (exp.user?.role || "TICKETER") as ReconciliationScope,
            status: exp.status === 'PAID' ? 'MATCHED' : (exp.status === 'VIOLATED' || exp.status === 'OVERDUE' ? 'VARIANCE' : 'PENDING') as Status,
            actor: `${exp.user?.first_name || ''} ${exp.user?.last_name || ''}`.trim() || 'User',
            generated_at: new Date(exp.created_at).toLocaleDateString(),
          }));
          setRows(mappedRuns);
        }
      }
    } catch (err) {
      console.error("Error loading reconciliation data:", err);
    } finally {
      setLoading(false);
    }
  }, [session]);

  // Initial load
  useEffect(() => {
    if (mounted) {
      const load=setTimeout(()=>fetchReconciliationData(), 1000);
      return ()=>clearTimeout(load)
    }
  }, [mounted, fetchReconciliationData]);

  // SSE Subscription for real-time updates
  useEffect(() => {
    if (!mounted) return;

    const handleEvent = () => {
      refreshMetrics();
      fetchReconciliationData();
    };

    const unsubscribe = subscribe(handleEvent);
    return () => {
      unsubscribe();
    };
  }, [mounted, subscribe, refreshMetrics, fetchReconciliationData]);

   const columns: ColumnDef<ReconciliationRun>[] = [
    { 
      id: 'role', 
      header: 'Role', 
      cell: (r) => <span className="text-slate-300 text-xs font-bold">{r?.scope}</span>, 
      sortValue: (r) => r?.scope || '' 
    },
    { 
      id: 'expected_float', 
      header: 'expected_float', 
      cell: (r) => <span className="text-slate-500 font-mono text-xs">{r && formatMoney(r.expected_float)}</span>,
      sortValue: (r) => r?.expected_float || 0
    },
    {
      id: 'actual_remittance',
      header: 'actual_remittance',
      cell: (r) => <span className="text-slate-500 font-mono text-xs">{r && formatMoney(r.actual_remittance)}</span>,
      sortValue: (r) => r?.actual_remittance || 0,
    },
    {
      id: 'variance',
      header: 'variance',
      cell: (r) => (
        r && <span className={`text-xs font-bold font-mono ${r.variance === 0 ? 'text-slate-400' : r.variance < 0 ? 'text-red-300' : 'text-emerald-300'}`}>
          {r && formatMoney(r.variance) === "₦0.00" ? "---" : formatMoney(r.variance)}
        </span>
      ),
      sortValue: (r) => r?.variance || 0,
    },
    { 
      id: 'actor', 
      header: 'actor', 
      cell: (r) => <span className="text-slate-400 text-xs">{r?.actor}</span>, 
      sortValue: (r) => r?.actor || '' 
    },
    { 
      id: 'date', 
      header: 'date', 
      cell: (r) => <span className="text-slate-400 text-xs">{r?.date}</span>, 
      sortValue: (r) => r?.date || '' 
    },
  ];


  const filtered = () => {
    return rows.filter((r) => (scope === 'ALL' ? true : r.scope === scope));
  };

  if (!mounted) {
    return null;
  }

  return (
    <>
      <PageScaffold
        title="Overview"
        subtitle="Overview of all reconciliation reports and sales performance metrics"
        right={
          <div className="flex gap-2">
            <Select
              value={scope}
              onChange={(v) => setScope(v as ReconciliationRun['scope'])}
              options={[
                { value: 'ALL', label: 'All scopes' },
                { value: 'TICKETER', label: 'Ticketer' },
                { value: 'ADMIN', label: 'Admin' },
                { value: 'SUPERVISOR', label: 'Supervisor' },
              ]}
            />
          </div>
        }
        kpis={
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard title="Treasury Vault Float" value={formatMoney(metrics.availableFloat)} icon={<BriefcaseBusiness className="text-cyan-300" />} iconBg="bg-cyan-500/10" />
            <StatCard title="Today's Sales" value={formatMoney(metrics.salesToday)} icon={<Receipt className="text-emerald-300" />} iconBg="bg-emerald-500/10" />
            <StatCard title="Expected Remittances" value={formatMoney(metrics.expectedRemittance || 0)} icon={<Sigma className="text-amber-300" />} iconBg="bg-amber-500/10" />
            <StatCard title="Actual Remittances" value={formatMoney(metrics.totalRemitted || 0)} icon={<CheckCircle2Icon />} iconBg="bg-emerald-500/10" />
            <StatCard title="Circulating POS Float" value={formatMoney(metrics.circulatingFloat || 0)} icon={<BriefcaseBusiness className="text-orange-300" />} iconBg="bg-orange-500/10" />
            <StatCard title="Supervisor Held Cash" value={formatMoney(metrics.supervisorCash || 0)} icon={<BriefcaseBusiness className="text-yellow-300" />} iconBg="bg-yellow-500/10" />
            <StatCard title="Fines & Shortages Alert" value={String(metrics.alertCount)} icon={<AlertTriangle className={metrics.alertCount > 0 ? "text-red-400" : "text-slate-400"} />} iconBg={metrics.alertCount > 0 ? "bg-red-500/10 animate-pulse" : "bg-white/5"} />
          </div>
        }
      >
        <OverviewChart />

        <div className="mt-6">
          <div className="mb-4">
            <h3 className="text-white font-semibold text-base">Reconciliation Audit Trail</h3>
            <p className="text-slate-500 text-xs mt-0.5">Historical verification runs and variance tracking</p>
          </div>
          <DataTable
            rows={filtered()}
            columns={columns}
            getRowId={(r) => r.run_id}
            onRowClick={(r) => setSelected(r)}
            searchValue={q}
            searchPredicate={(r, qq) =>
              r.run_id.toLowerCase().includes(qq) || r?.actor?.toLowerCase().includes(qq) || r?.scope?.toLowerCase().includes(qq)
            }
          />
        </div>
      </PageScaffold>

      <Drawer
        open={Boolean(selected)}
        title={selected ? `Run ${selected.run_id}` : 'Run'}
        subtitle={selected ? `${selected.scope} • ${selected.date}` : undefined}
        onClose={() => setSelected(null)}
      >
        {selected && (
          <ResponsiveDrawerShell
            title={`Run ${selected.run_id}`}
            subtitle={`${selected.scope} • ${selected.date}`}
            badge={
              <Badge
                variant={
                  selected.status === 'MATCHED'
                    ? 'success'
                    : selected.status === 'RESOLVED'
                      ? 'info'
                      : selected.status === 'VARIANCE'
                        ? 'danger'
                        : 'warning'
                }
              >
                {selected.status}
              </Badge>
            }
            stats={[
              { label: 'Expected Float', value: formatMoney(selected.expected_float), tone: 'info' },
              { label: 'Remittance', value: formatMoney(selected.actual_remittance) === "₦0.00" ? "---" : formatMoney(selected.actual_remittance), tone: 'success' },
              { label: 'Variance', value: formatMoney(selected.variance) === "₦0.00" ? "---" : formatMoney(selected.variance), tone: selected.variance === 0 ? 'success' : 'danger' },
              { label: 'Date', value: selected.generated_at, tone: 'default' },
            ]}
            fields={[
              { label: 'Run ID', value: selected.run_id },
              { label: 'Scope', value: selected.scope },
              { label: 'Date', value: selected.date },
              { label: 'Actor', value: selected.actor },
            ]}
            sections={[
              {
                title: 'Variance Items',
                content: (
                  <div className="space-y-3">
                    {rows.filter((v) => v.run_id === selected.run_id).length === 0 ? (
                      <p className="text-sm text-slate-500">No variance items for this run.</p>
                    ) : (
                      rows
                        .filter((v) => v.run_id === selected.run_id)
                        .map((v) => (
                          <div key={v.run_id} className="rounded-2xl border border-white/5 bg-black/20 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Scope</p>
                                <p className="mt-1 text-sm font-semibold text-white">{v.scope}</p>
                              </div>
                              <Badge
                                variant={
                                  v.status === 'VARIANCE'
                                    ? 'danger'
                                    : v.status === 'RESOLVED'
                                      ? 'success'
                                      : v.status === 'INVESTIGATING'
                                        ? 'warning'
                                        : 'info'
                                }
                              >
                                {v.status}
                              </Badge>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                              <div className="rounded-xl border border-white/5 bg-white/3 p-3">
                                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Allocated</p>
                                <p className="mt-1 text-slate-200">{formatMoney(v.expected_float)}</p>
                              </div>
                              <div className="rounded-xl border border-white/5 bg-white/3 p-3">
                                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Remitted</p>
                                <p className="mt-1 text-slate-200">{formatMoney(v.actual_remittance)}</p>
                              </div>
                              <div className="rounded-xl border border-white/5 bg-white/3 p-3">
                                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Variance</p>
                                <p className="mt-1 text-slate-200">{formatMoney(v.variance)}</p>
                              </div>
                              <div className="rounded-xl border border-white/5 bg-white/3 p-3">
                                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Date</p>
                                <p className="mt-1 text-slate-200">{v.date}</p>
                              </div>
                            </div>
                          </div>
                        ))
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

// Simple internal helper icon to show in place of CheckCircle2
function CheckCircle2Icon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-emerald-300">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}
