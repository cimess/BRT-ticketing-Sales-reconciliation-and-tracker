"use client"
import React from 'react';
import { FileText, Loader2 } from 'lucide-react';
import StatCard from '@/components/StatCard';
import { Badge } from '@/components/Badge';
import { DataTable, type ColumnDef } from '@/components/DataTable';
import { FilterRow, Input, PageScaffold } from '@/components/pageScaffold';
import { mockReports } from '@/lib/mock';
import type { ReportRecord } from '@/types/types';
export default function ReportsPage() {
  const [q, setQ] = React.useState('');
  const rows = mockReports;

  const running = rows.filter((r) => r.status === 'RUNNING').length;
  const ready = rows.filter((r) => r.status === 'READY').length;

  const columns: ColumnDef<ReportRecord>[] = [
    { id: 'id', header: 'report_id', cell: (r) => <span className="text-slate-200 font-mono text-xs">{r?.report_id}</span> },
    { id: 'name', header: 'name', cell: (r) => <span className="text-slate-300 text-sm font-semibold">{r?.name}</span>, sortValue: (r) => r?.name },
    { id: 'period', header: 'period', cell: (r) => <span className="text-slate-500 text-xs">{r?.period}</span>, sortValue: (r) => r?.period },
    { id: 'status', header: 'status', align: 'center', sortValue: (r) => r?.status, cell: (r) => <Badge variant={r?.status === 'READY' ? 'success' : r?.status === 'RUNNING' ? 'warning' : 'danger'}>{r?.status}</Badge> },
    { id: 'created', header: 'created_at', cell: (r) => <span className="text-slate-500 text-xs">{r?.created_at}</span>, sortValue: (r) => r?.created_at },
    { id: 'by', header: 'created_by', cell: (r) => <span className="text-slate-400 text-xs">{r?.created_by}</span>, sortValue: (r) => r?.created_by },
  ];

  return (
    <PageScaffold
      title="Reporting & Analytics"
      subtitle="Generated operational reports (mock)"
      kpis={
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard title="Reports" value={String(rows.length)} icon={<FileText className="text-blue-300" />} iconBg="bg-blue-500/10" />
          <StatCard title="Ready" value={String(ready)} icon={<FileText className="text-emerald-300" />} iconBg="bg-emerald-500/10" />
          <StatCard title="Running" value={String(running)} icon={<Loader2 className="text-amber-300" />} iconBg="bg-amber-500/10" />
          <StatCard title="Exports" value="CSV/PDF" icon={<FileText className="text-purple-300" />} iconBg="bg-purple-500/10" />
        </div>
      }
    >
      <FilterRow>
        <Input value={q} onChange={setQ} placeholder="Search report_id/name/creator…" />
        <button className="w-full lg:w-auto rounded-xl bg-white/[0.03] border border-white/10 px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-300 hover:bg-white/[0.06] hover:text-white">
          Generate (mock)
        </button>
      </FilterRow>

      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(r) => r.report_id}
        searchValue={q}
        searchPredicate={(r, qq) =>
          r.report_id.toLowerCase().includes(qq) ||
          r.name.toLowerCase().includes(qq) ||
          r.created_by.toLowerCase().includes(qq) ||
          r.period.toLowerCase().includes(qq)
        }
      />
    </PageScaffold>
  );
}