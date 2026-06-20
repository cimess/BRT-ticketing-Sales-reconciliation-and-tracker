"use client"

import { useState, useEffect } from 'react';
import { Sigma, BriefcaseBusiness, Receipt, } from 'lucide-react';
import StatCard from '@/components/StatCard';
import { Badge } from '@/components/Badge';
import { DataTable, type ColumnDef } from '@/components/DataTable';
import { Drawer } from '@/components/Drawer';
import { PageScaffold, Select } from '@/components/pageScaffold';
import { mockReconciliationRuns } from '@/app/lib/mock';
import type { ReconciliationRun } from '@/types/types';
import {formatMoney } from '@/app/lib/utils';
import { ResponsiveDrawerShell } from '@/components/ResponsiveDrawerShell';


import dynamic from 'next/dynamic';

const OverviewChart = dynamic(() => import("@/components/Piechart"), {
  ssr: false,
  loading: () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
      <div className="premium-card p-4 lg:col-span-2 h-[380px] bg-slate-900/20 animate-pulse rounded-2xl" />
      <div className="premium-card p-4 h-[380px] bg-slate-900/20 animate-pulse rounded-2xl" />
    </div>
  )
});



interface ApiData {
  floatAllocations: string;
  companyFloat: string;
  remittances: string;
  reconciliation_reports: string;
  expected_remittances: string;
  users: string;
  salesReport: string;
  varianceSum: string;
  actual_remittances: string;
  salesReportData: {
    report_date: string;
    total_sold: string;
    opening_balance: string;
    closing_balance: string;
  }
  posSessionFloat: string;
  regToken: string;
}

const res: ApiData[] = [{
  floatAllocations: "1000000",
  companyFloat: "500000",
  remittances: "5",
  reconciliation_reports: "5",
  expected_remittances: "6",
  users: "7",
  salesReport: "7",
  varianceSum: "2000000",
  actual_remittances: "180000",
  salesReportData: {
    report_date: "1d",
    total_sold: "500000",
    opening_balance: "300000",
    closing_balance: "0",
  },
  posSessionFloat: "500000",
  regToken:""
}]

export default function OverviewPage() {
  const [q, setQ] = useState('');
  const [scope, setScope] = useState<'ALL' | ReconciliationRun['scope']>('ALL');
  const [rows] = useState<ReconciliationRun[]>(mockReconciliationRuns);
  const [selected, setSelected] = useState<ReconciliationRun | null>(null);
  const [apiData, setApiData] = useState<ApiData[] | null>(res);






  const columns: ColumnDef<ReconciliationRun>[] = [
    { id: 'role', header: 'Role', cell: (r) => <span className="text-slate-300 text-xs font-bold">{r?.scope}</span>, sortValue: (r) => r.scope },
    { id: 'expected_float', header: 'expected_float', cell: (r) => <span className="text-slate-500 font-mono text-xs">{r && formatMoney(r.expected_float)}</span> },
    {
      id: 'actual_remittance',
      header: 'actual_remittance',
      cell: (r) => <span className="text-slate-500 font-mono text-xs">{r && formatMoney(r.actual_remittance)}</span>,
      sortValue: (r) => r.actual_remittance,
    },
    {
      id: 'variance',
      header: 'variance',
      cell: (r) => (
        r && <span className={`text-xs font-bold font-mono ${r.variance === 0 ? 'text-slate-400' : r.variance < 0 ? 'text-red-300' : 'text-emerald-300'}`}>
          {r && formatMoney(r.variance) === "₦0.00" ? "---" : formatMoney(r.variance)}
        </span>
      ),
      sortValue: (r) => r.variance,
    },
    { id: 'actor', header: 'actor', cell: (r) => <span className="text-slate-400 text-xs">{r?.actor}</span>,sortValue: (r) => r?.actor||"" },
    { id: 'date', header: 'date', cell: (r) => <span className="text-slate-400 text-xs">{r?.date}</span>, sortValue: (r) => r.date },
  ];

  const filtered = () => {
    const data = rows.filter((r) => (scope === 'ALL' ? true : r.scope === scope));
    return data;
  }

  return (
    <>
      <PageScaffold
        title="Overview"
        subtitle="overview of all the reconciliation reports and sales report"
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
            <StatCard title="Today's Reconciliations" value={apiData?.[0]?.reconciliation_reports || "---"} icon={<Sigma className="text-red-300" />} iconBg="bg-red-500/10" />
            <StatCard title="Total Variance" value={apiData?.[0]?.varianceSum || "---"} icon={<Receipt className="text-amber-300" />} iconBg="bg-amber-500/10" />
            <StatCard title="Company Float" value={formatMoney(Number(apiData?.[0]?.companyFloat))} icon={<BriefcaseBusiness className="text-amber-300" />} iconBg="bg-amber-500/10" />
            <StatCard title="Expected Remittances" value={formatMoney(Number(apiData?.[0]?.expected_remittances))} icon={<BriefcaseBusiness className="text-amber-300" />} iconBg="bg-amber-500/10" />
            <StatCard title="Actual Remittances" value={formatMoney(Number(apiData?.[0]?.actual_remittances))} icon={<BriefcaseBusiness className="text-amber-300" />} iconBg="bg-amber-500/10" />
            <StatCard title="Users" value={apiData?.[0]?.users || "---"} icon={<BriefcaseBusiness className="text-amber-300" />} iconBg="bg-amber-500/10" />
            <StatCard title="Sales Report" value={apiData?.[0]?.salesReport || "---"} icon={<BriefcaseBusiness className="text-amber-300" />} iconBg="bg-amber-500/10" />
          </div>
        }
      >
        <OverviewChart />

        <DataTable
          rows={filtered()}
          columns={columns}
          getRowId={(r) => r.run_id}
          onRowClick={(r) => setSelected(r)}
          searchValue={q}
          searchPredicate={(r, qq) =>
            r.run_id.toLowerCase().includes(qq) || r?.actor?.toLowerCase().includes(qq) || r.scope.toLowerCase().includes(qq)
          }
        />


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
                    {mockReconciliationRuns.filter((v) => v.run_id === selected.run_id).length === 0 ? (
                      <p className="text-sm text-slate-500">No variance items for this run.</p>
                    ) : (
                      mockReconciliationRuns
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