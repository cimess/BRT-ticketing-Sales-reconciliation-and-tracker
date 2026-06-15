"use client"
import React from 'react';
import { Sigma, ArrowDownUp, } from 'lucide-react';
import StatCard from '@/components/StatCard';
import { Badge } from '@/components/Badge';
import { DataTable, type ColumnDef } from '@/components/DataTable';
import { Drawer } from '@/components/Drawer';
import { FilterRow, Input, PageScaffold, Select } from '@/components/pageScaffold';
import { mockReconciliationRuns } from '@/app/lib/mock';
import type { ReconciliationRun, Status } from '@/types/types';
import { formatMoney} from '@/lib/utils';
import { ResponsiveDrawerShell } from '@/components/ResponsiveDrawerShell';

function statusVariant(s: Status) {
  if (s === 'VARIANCE') return 'danger';
  if (s === 'MATCHED') return 'success';
  if (s === 'PENDING') return 'warning';
  if (s === 'INVESTIGATING') return 'info';
  if (s === 'RESOLVED') return 'success';
  return 'warning';
}



export default function ReconciliationPage() {
  const [q, setQ] = React.useState('');
  const [scope, setScope] = React.useState<'ALL' | ReconciliationRun['scope']>('ALL');

  const [rows] = React.useState<ReconciliationRun[]>(mockReconciliationRuns);
  const [selected, setSelected] = React.useState<ReconciliationRun | null>(null);

  const filtered = React.useMemo(() => {
    return rows.filter((r) => (scope === 'ALL' ? true : r.scope === scope));
  }, [rows, scope]);

  const totalVariance = filtered.reduce((acc, r) => acc + r.variance, 0);

  const columns: ColumnDef<ReconciliationRun>[] = [
    { id: 'run_id', header: 'run_id', cell: (r) => <span className="text-slate-200 font-mono text-xs">{r?.run_id}</span>, sortValue: (r) => r?.run_id },
    { id: 'scope', header: 'scope', cell: (r) => <span className="text-slate-300 text-xs font-bold">{r?.scope}</span>, sortValue: (r) => r?.scope },
    { id: 'date', header: 'date', cell: (r) => <span className="text-slate-400 text-xs">{r?.date}</span>, sortValue: (r) => r?.date },
    { id: 'expected_float', header: 'expected_float', cell: (r) => <span className="text-slate-500 font-mono text-xs">{formatMoney(r?.expected_float||0)}</span> },
    {
      id: 'actual_remittance',
      header: 'actual_remittance',
      cell: (r) => <span className="text-slate-500 font-mono text-xs">{formatMoney(r?.actual_remittance||0)}</span>,
      sortValue: (r) => r?.actual_remittance,
      align: 'right',
    },
    { id: 'status', header: 'status', cell: (r) => <Badge variant={r?.status&&statusVariant(r.status)}>{r?.status}</Badge>, sortValue: (r) => r?.status, align: 'center' },
    {
      id: 'variance',
      header: 'variance',
      cell: (r) => (
        <span className={`text-xs font-bold font-mono ${r?.variance === 0 ? 'text-slate-400' : (r?.variance||0) < 0 ? 'text-red-300' : 'text-emerald-300'}`}>
          {formatMoney(r?.variance||0)}
        </span>
      ),
      sortValue: (r) => r?.variance,
      align: 'right',
    },
    { id: 'generated_at', header: 'generated_at', cell: (r) => <span className="text-slate-500 text-xs">{r?.generated_at}</span>, sortValue: (r) => r?.generated_at },
    { id: 'actor', header: 'actor', cell: (r) => <span className="text-slate-400 text-xs">{r?.actor}</span>, sortValue: (r) => r?.actor },
  ];

  return (
    <>
      <PageScaffold
        title="Reconciliation Engine"
        subtitle="Allocated Float − Top-ups − Remitted = Variance (append-only runs)"
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
            <StatCard title="Today's Reconciliations" value={String(filtered.length)} icon={<Sigma className="text-blue-300" />} iconBg="bg-blue-500/10" />
            <StatCard title="Total Variance" value={formatMoney(totalVariance)} icon={<ArrowDownUp className="text-amber-300" />} iconBg="bg-amber-500/10" />
            {/* <StatCard title="Status" value={filtered.some((r) => r.status)} icon={<CheckCircle2 className="text-emerald-300" />} iconBg="bg-emerald-500/10" /> */}
          </div>
        }
      >
        <FilterRow>
          <Input value={q} onChange={setQ} placeholder="Search by run_id / actor / hash…" />
          <div className="text-slate-500 text-xs font-medium">Click a run to drill down</div>
        </FilterRow>

        <DataTable
          rows={filtered}
          columns={columns}
          getRowId={(r) => r.run_id}
          onRowClick={(r) => setSelected(r)}
          searchValue={q}
          searchPredicate={(r, qq) =>
            r.run_id.toLowerCase().includes(qq) || r.actor.toLowerCase().includes(qq) || r.scope.toLowerCase().includes(qq)
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
        { label: 'Actual Remittance', value: formatMoney(selected.actual_remittance), tone: 'success' },
        { label: 'Variance', value: formatMoney(selected.variance), tone: selected.variance === 0 ? 'success' : 'danger' },
        { label: 'Generated At', value: selected.generated_at, tone: 'default' },
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