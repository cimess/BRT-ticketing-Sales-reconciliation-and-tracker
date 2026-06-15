"use client"
import React from 'react';
import { Percent, Wallet } from 'lucide-react';
import StatCard from '@/components/StatCard';
import { Badge } from '@/components/Badge';
import { DataTable, type ColumnDef } from '@/components/DataTable';
import { FilterRow, Input, PageScaffold } from '@/components/pageScaffold';
import { mockSalesRecords,mockUsers,mockFines,mockCommisionRules } from '@/lib/mock';
import type { CommissionRecord, SupervisorCommissionRecord,Sales_Record} from '@/types/types';
import {  formatMoney} from '@/lib/utils';
import { Drawer } from '@/components/Drawer';

export default function CommissionPage() {
  const [q, setQ] = React.useState('');
  const [q2, setQ2] = React.useState('');
  const [selected, setSelected] = React.useState<Sales_Record[] | null>(null);

      const getSupervisorTotalSales = (supervisorId: string) => {
  // get all ticketers under supervisor
  const ticketers = mockUsers.filter(
    (u) => u.supervisor === supervisorId
  );

  // extract ids
  const ticketerIds = ticketers.map(
    (u) => u.user_id
  );

  // get total sales
  return mockCommissionRecords.filter((r) => ticketerIds.includes(r.user_id)).reduce((acc, r) => acc + r.total_sales, 0);
};

  
const ticketerRule=mockCommisionRules.find((r) => r.role === 'TICKETER');
const supervisorRule=mockCommisionRules.find((r) => r.role === 'SUPERVISOR');

   const mockCommissionRecords: CommissionRecord[] = [
    {
      id: "5577435",
      user_id: mockUsers[0].user_id,
      user_name: mockUsers[0].fullname,
      period_start: "2022-01-01",
      period_end: "2022-01-31",
      total_sales: mockSalesRecords.filter((r) => r.ticketer_id === mockUsers[0].user_id).reduce((acc, r) => acc + r.total_sold, 0),
      fines_deducted: mockFines.filter((r) => r.defaulter_id=== mockUsers[0].user_id).reduce((acc, r) => acc + r.amount, 0),
      net_pay:(mockSalesRecords.filter((r) => r.ticketer_id === mockUsers[0].user_id).reduce((acc, r) => acc + r.total_sold, 0) * (ticketerRule?.percentage || 0)) - mockFines.filter((r) => r.defaulter_id=== mockUsers[0].user_id).reduce((acc, r) => acc + r.amount, 0),
      created_at: "2022-01-01",
      status: 'PENDING',
    },
    {
      id: "5577499335",
      user_id: mockUsers[1].user_id,
      user_name: mockUsers[1].fullname,
      period_start: "2022-04-01",
      period_end: "2022-04-30",
      total_sales: mockSalesRecords.filter((r) => r.ticketer_id === mockUsers[1].user_id).reduce((acc, r) => acc + r.total_sold, 0),
      fines_deducted: mockFines.filter((r) => r.defaulter_id=== mockUsers[1].user_id).reduce((acc, r) => acc + r.amount, 0),
      net_pay:(mockSalesRecords.filter((r) => r.ticketer_id === mockUsers[1].user_id).reduce((acc, r) => acc + r.total_sold, 0) * (ticketerRule?.percentage || 0)) - mockFines.filter((r) => r.defaulter_id=== mockUsers[1].user_id).reduce((acc, r) => acc + r.amount, 0),
      created_at: "2022-05-01",
      status: 'PENDING',
    },{
      id: "5577402235",
      user_id: mockUsers[2].user_id,
      user_name: mockUsers[2].fullname,
      period_start: "2022-03-01",
      period_end: "2022-03-31",
      total_sales: mockSalesRecords.filter((r) => r.ticketer_id === mockUsers[2].user_id).reduce((acc, r) => acc + r.total_sold, 0),
      fines_deducted: mockFines.filter((r) => r.defaulter_id=== mockUsers[2].user_id).reduce((acc, r) => acc + r.amount, 0),
      net_pay:(mockSalesRecords.filter((r) => r.ticketer_id === mockUsers[2].user_id).reduce((acc, r) => acc + r.total_sold, 0) * (ticketerRule?.percentage || 0)) - mockFines.filter((r) => r.defaulter_id=== mockUsers[2].user_id).reduce((acc, r) => acc + r.amount, 0),
      created_at: "2022-04-01",
      status: 'PENDING',
    },{
      id: "55779933435",
      user_id: mockUsers[3].user_id,
      user_name: mockUsers[3].fullname,
      period_start: "2022-02-01",
      period_end: "2022-02-28",
      total_sales: mockSalesRecords.filter((r) => r.ticketer_id === mockUsers[3].user_id).reduce((acc, r) => acc + r.total_sold, 0),
      fines_deducted: mockFines.filter((r) => r.defaulter_id=== mockUsers[3].user_id).reduce((acc, r) => acc + r.amount, 0),
      net_pay:(mockSalesRecords.filter((r) => r.ticketer_id === mockUsers[3].user_id).reduce((acc, r) => acc + r.total_sold, 0) * (ticketerRule?.percentage || 0)) - mockFines.filter((r) => r.defaulter_id=== mockUsers[3].user_id).reduce((acc, r) => acc + r.amount, 0),
      created_at: "2022-03-01",
      status: 'PENDING',
    },{
      id: "55773003435",
      user_id: mockUsers[4].user_id,
      user_name: mockUsers[4].fullname,
      period_start: "2022-05-01",
      period_end: "2022-05-31",
      total_sales: mockSalesRecords.filter((r) => r.ticketer_id === mockUsers[4].user_id).reduce((acc, r) => acc + r.total_sold, 0),
      net_pay:(mockSalesRecords.filter((r) => r.ticketer_id === mockUsers[4].user_id).reduce((acc, r) => acc + r.total_sold, 0) * (ticketerRule?.percentage || 0)) - mockFines.filter((r) => r.defaulter_id=== mockUsers[4].user_id).reduce((acc, r) => acc + r.amount, 0),
      fines_deducted: mockFines.filter((r) => r.defaulter_id=== mockUsers[4].user_id).reduce((acc, r) => acc + r.amount, 0),
      created_at: "2022-06-01",
      status: 'PENDING',
    },{
      id: "3377383821",
      user_id: mockUsers[5].user_id,
      user_name: mockUsers[5].fullname,
      period_start: "2022-03-01",
      period_end: "2022-03-31",
      total_sales: mockSalesRecords.filter((r) => r.ticketer_id === mockUsers[5].user_id).reduce((acc, r) => acc + r.total_sold, 0),
      net_pay:(mockSalesRecords.filter((r) => r.ticketer_id === mockUsers[5].user_id).reduce((acc, r) => acc + r.total_sold, 0) * (ticketerRule?.percentage || 0)) - mockFines.filter((r) => r.defaulter_id=== mockUsers[5].user_id).reduce((acc, r) => acc + r.amount, 0),
      fines_deducted: mockFines.filter((r) => r.defaulter_id=== mockUsers[5].user_id).reduce((acc, r) => acc + r.amount, 0),
      created_at: "2022-04-01",
      status: 'PENDING',
    },
  ];
    const rows = mockCommissionRecords;
    const totalNet = rows.reduce((acc, r) => acc + (r?.net_pay||0), 0);


    const totalSaleA=getSupervisorTotalSales(mockUsers[6].fullname)
    const totalSaleB=getSupervisorTotalSales(mockUsers[7].fullname)
    const totalFineA=mockFines.filter((r) => r.defaulter_id=== mockUsers[6].user_id).reduce((acc, r) => acc + r.amount, 0)
    const totalFineB=mockFines.filter((r) => r.defaulter_id=== mockUsers[7].user_id).reduce((acc, r) => acc + r.amount, 0)

    const mockSupervisorCommissionRecords: SupervisorCommissionRecord[] = [
      {
      id: "888288222228821182",
      user_id: mockUsers[6].user_id,
      user_name: mockUsers[6].fullname,
      period_start: "2022-03-01",
      period_end: "2022-03-31",
      tickter_total_sales: totalSaleA,
      net_pay:(totalSaleA - totalFineA)*(supervisorRule?.percentage||0),
      fines_deducted: mockFines.filter((r) => r.defaulter_id=== mockUsers[6].user_id).reduce((acc, r) => acc + r.amount, 0),
      created_at: "2022-04-01",
      status: 'PENDING',
    },{
      id: "228821182",
      user_id: mockUsers[7].user_id,
      user_name: mockUsers[7].fullname,
      period_start: "2022-03-01",
      period_end: "2022-03-31",
      tickter_total_sales: totalSaleB,
      net_pay:(totalSaleB - totalFineB)*0.01,
      fines_deducted: mockFines.filter((r) => r.defaulter_id=== mockUsers[7].user_id).reduce((acc, r) => acc + r.amount, 0),
      created_at: "2022-04-01",
      status: 'PENDING',
    },
    ]

    const columns2: ColumnDef<SupervisorCommissionRecord>[] =  [
    { id: 'id', header: 'record_id', cell: (r) => <span className="text-slate-200 font-mono text-xs">{r?.id}</span> },
    { id: 'user_name', header: 'supervisor', cell: (r) => <span className="text-slate-200 font-mono text-xs">{r?.user_name}</span> },
    { id: 'start_period', header: 'start', cell: (r) => <span className="text-slate-400 text-xs">{r?.period_start}</span>, sortValue: (r) => r.period_start },
    { id: 'end_period', header: 'end', cell: (r) => <span className="text-slate-400 text-xs">{r?.period_end}</span>, sortValue: (r) => r.period_end },
    { id: 'total_sales', header: 'total_sales', cell: (r) => <span className="text-slate-300 text-xs font-bold">{r?.tickter_total_sales}</span>, sortValue: (r) => r.tickter_total_sales },
    { id: 'fines_deducted', header: 'fines_deducted', align: 'center', sortValue: (r) => r.fines_deducted, cell: (r) => <Badge variant="info">{formatMoney(r?.fines_deducted||0)}</Badge> },
    { id: 'net_pay', header: 'net_pay', align: 'right', sortValue: (r) => (r.net_pay||0), cell: (r) => <span className="text-slate-400 font-mono text-xs">{formatMoney(r?.net_pay||0)}</span> },
    { id: 'status', header: 'status', align: 'right', sortValue: (r) => r.status, cell: (r) => <span className="text-emerald-300 font-mono text-xs font-bold">{r?.status}</span> },
  ];
    
  
  const columns: ColumnDef<CommissionRecord>[] = [
    { id: 'id', header: 'record_id', cell: (r) => <span className="text-slate-200 font-mono text-xs">{r?.id}</span> },
    { id: 'user_name', header: 'Ticketer', cell: (r) => <span className="text-slate-200 font-mono text-xs">{r?.user_name}</span> },
    { id: 'start_period', header: 'start', cell: (r) => <span className="text-slate-400 text-xs">{r?.period_start}</span>, sortValue: (r) => r.period_start },
    { id: 'end_period', header: 'end', cell: (r) => <span className="text-slate-400 text-xs">{r?.period_end}</span>, sortValue: (r) => r.period_end },
    { id: 'total_sales', header: 'total_sales', cell: (r) => <span className="text-slate-300 text-xs font-bold">{r?.total_sales}</span>, sortValue: (r) => r.total_sales },
    { id: 'fines_deducted', header: 'fines_deducted', align: 'center', sortValue: (r) => r.fines_deducted, cell: (r) => <Badge variant="info">{formatMoney(r?.fines_deducted||0)}</Badge> },
    { id: 'net_pay', header: 'net_pay', align: 'right', sortValue: (r) => (r.net_pay||0), cell: (r) => <span className="text-slate-400 font-mono text-xs">{formatMoney(r?.net_pay||0)}</span> },
    { id: 'status', header: 'status', align: 'right', sortValue: (r) => r.status, cell: (r) => <span className="text-emerald-300 font-mono text-xs font-bold">{r?.status}</span> },
    { id: 'created_at', header: 'generated_at', cell: (r) => <span className="text-slate-500 text-xs">{r?.created_at}</span> },
  ];

  return (
    <>
    <PageScaffold
      title="Commission Engine"
      subtitle="Computed records tied to reconciliation runs (mock)"
      kpis={
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard title="Records" value={String(rows.length)} icon={<Wallet className="text-blue-300" />} iconBg="bg-blue-500/10" />
          <StatCard title="Net Total" value={formatMoney(totalNet)} icon={<Wallet className="text-emerald-300" />} iconBg="bg-emerald-500/10" />
          <StatCard title="Rule" value="Sales-based" icon={<Percent className="text-purple-300" />} iconBg="bg-purple-500/10" />
          <StatCard title="Audit" value="Run-linked" icon={<Percent className="text-amber-300" />} iconBg="bg-amber-500/10" />
        </div>
      }
    >
      <h2>Ticketers Commission Records  <span className='text-slate-500 text-xs font-medium'> ({ticketerRule?.percentage}%)</span></h2>
      <FilterRow>
        <Input value={q} onChange={setQ} placeholder="Search record_id / subject / period…" />
        <div className="text-slate-500 text-xs font-medium">Disputes reduce when rules are transparent + traceable.</div>
      </FilterRow>

      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(r) => r.id}
         onRowClick={(r) => {
          const salesRecord = mockSalesRecords.filter((s) => s.ticketer_id === r.user_id);
          setSelected(salesRecord ?? null);
        }}
        searchValue={q}
        searchPredicate={(r, qq) =>
          r.id.toLowerCase().includes(qq) || r.user_id.toLowerCase().includes(qq) || r.period_start.toLowerCase().includes(qq)
        }
      />
      
       <Drawer
            open={Boolean(selected)}
            title={selected&&`${selected[0].user_name} Sales Report`||''}
            subtitle={selected&&selected[0].ticketer_id||''}
            onClose={() => setSelected(null)}
          >
            <div className='space-y-4 flex flex-col gap-3' >
           {selected&&selected.map((r)=> (
  <div key={r.id} className="overflow-hidden rounded-2xl border border-white/5 bg-[#0B0F19]">
    
    {/* Header */}
    <div className="border-b border-white/5 px-5 py-4">
      <h3 className="text-sm font-bold tracking-wide text-white">
        {r.user_name} Sales Report
      </h3>
      <p className="mt-1 text-xs text-slate-500">
        Financial summary and transaction overview
      </p>
    </div>

    {/* Table */}
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-white/3 bg-white/2">
            <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Metric
            </th>

            <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Value
            </th>
          </tr>
        </thead>

        <tbody>
          <tr className="border-b border-white/3 hover:bg-white/2 transition-colors">
            <td className="px-5 py-4 text-sm font-medium text-slate-400">
              Opening Balance
            </td>

            <td className="px-5 py-4 text-right font-mono text-sm font-bold text-emerald-300">
              {formatMoney(r.opening_balance)}
            </td>
          </tr>

          <tr className="border-b border-white/3 hover:bg-white/2 transition-colors">
            <td className="px-5 py-4 text-sm font-medium text-slate-400">
              Closing Balance
            </td>

            <td className="px-5 py-4 text-right font-mono text-sm font-bold text-sky-300">
              {formatMoney(r.closing_balance)}
            </td>
          </tr>

          <tr className="border-b border-white/3 hover:bg-white/2 transition-colors">
            <td className="px-5 py-4 text-sm font-medium text-slate-400">
              Top Up
            </td>

            <td className="px-5 py-4 text-right font-mono text-sm font-bold text-amber-300">
              {formatMoney(r.top_up)}
            </td>
          </tr>

          <tr className="hover:bg-white/2 transition-colors">
            <td className="px-5 py-4 text-sm font-medium text-slate-400">
              Total Sold
            </td>

            <td className="px-5 py-4 text-right font-mono text-sm font-bold text-white">
              {formatMoney(r.total_sold)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
))}
</div>
          </Drawer>

       <h2>Supervisor Commission Records <span className='text-slate-500 text-xs font-medium'> ({supervisorRule?.percentage}%)</span></h2>
      <FilterRow>
        <Input value={q2} onChange={setQ2} placeholder="Search record_id / subject / period…" />
        <div className="text-slate-500 text-xs font-medium">Disputes reduce when rules are transparent + traceable.</div>
      </FilterRow>

      <DataTable
        rows={mockSupervisorCommissionRecords}
        columns={columns2}
        getRowId={(r) => r.id}
       
        searchValue={q2}
        searchPredicate={(r, qq) =>
          r.id.toLowerCase().includes(qq) || r.user_id.toLowerCase().includes(qq) || r.period_start.toLowerCase().includes(qq)
        }
      />
    </PageScaffold>

   
    </>
  );
}