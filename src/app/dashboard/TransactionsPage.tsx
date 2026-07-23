"use client"

import React from 'react';
import { Activity, AlertCircle, CheckCircle2 } from 'lucide-react';
import StatCard from '@/components/StatCard';
import { Badge } from '@/components/Badge';
import { DataTable, type ColumnDef } from '@/components/DataTable';
import { FilterRow, Input, PageScaffold, Select } from '@/components/pageScaffold';
import { useSse } from '@/context/SseContext';
import type { FloatLedgerEntry } from '@/types/types';
import {formatMoney } from '@/lib/utils';
import { mockFloatLedger } from '@/lib/mock';
export default function TransactionsPage() {
  const [q, setQ] = React.useState('');
  const [status, setStatus] = React.useState<'ALL' | 'CREDIT' | 'DEBIT'>('ALL');

  const initialRows = React.useMemo(
    () => mockFloatLedger.filter((t) => (status === 'ALL' ? true : t.entry_type === status)),
    [status],
  );

  const [localRows, setLocalRows] = React.useState(() => initialRows);
  const [volume, setVolume] = React.useState(() => initialRows.reduce((acc, t) => acc + t.amount, 0));
  const [posted, setPosted] = React.useState(() => initialRows.filter((t) => t.entry_type === 'DEBIT').length);
  const [failures, setFailures] = React.useState(() => initialRows.filter((t) => t.entry_type === 'CREDIT').length);
  const { subscribe } = useSse();

  const columns: ColumnDef< FloatLedgerEntry>[] = [
    { id: 'id', header: 'tx_id', cell: (r) => <span className="text-slate-200 font-mono text-xs">{r?.id}</span>, sortValue: (r) => r?.id },
    { id: 'user', header: 'user', cell: (r) => <span className="text-slate-400 text-xs">{r?.user}</span>, sortValue: (r) => r?.user },
    { id: 'amount', header: 'amount', align: 'right', sortValue: (r) => r?.amount, cell: (r) => <span className="text-white text-xs font-bold font-mono">{formatMoney(r?.amount||0)}</span> },
    
    {
      id: 'reconciliation_state',
      header: 'reconciliation_state',
      align: 'center',
      cell: (r) => <Badge variant={r?.entry_type === 'CREDIT' ? 'success' : 'warning'}>{r?.entry_type}</Badge>,
      sortValue: (r) => r?.entry_type,
    },
    { id: 'created', header: 'created_at', cell: (r) => <span className="text-slate-500 text-xs">{r?.created_at}</span>, sortValue: (r) => r?.created_at },
  ];

  return (
    <PageScaffold
      title="Transaction Processing"
      subtitle="POS/top-up throughput and failure visibility (append-only records)"
      right={
        <Select
          value={status}
          onChange={(v) => setStatus(v as 'ALL' | 'CREDIT' | 'DEBIT')}
          options={[
            { value: 'ALL', label: 'All statuses' },
            { value: 'CREDIT', label: 'Credit' },
            { value: 'DEBIT', label: 'Debit' },
          ]}
        />
      }
      kpis={
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard title="Volume" value={formatMoney(volume)} icon={<Activity className="text-blue-300" />} iconBg="bg-blue-500/10" />
          <StatCard title="Posted" value={String(posted)} icon={<CheckCircle2 className="text-emerald-300" />} iconBg="bg-emerald-500/10" />
          <StatCard title="Failures" value={String(failures)} icon={<AlertCircle className="text-red-300" />} iconBg="bg-red-500/10" />
          <StatCard title="Records" value={String(localRows.length)} icon={<Activity className="text-purple-300" />} iconBg="bg-purple-500/10" />
        </div>
      }
    >
      <FilterRow>
        <Input value={q} onChange={setQ} placeholder="Search tx_id / ticketer / device / external_ref…" />
        <div className="text-slate-500 text-xs font-medium">Failures should surface as discrepancies in reconciliation.</div>
      </FilterRow>

      <TransactionsPageSseBinder subscribe={subscribe} setLocalRows={setLocalRows} setVolume={setVolume} setPosted={setPosted} setFailures={setFailures} />

      <DataTable
        rows={localRows}
        columns={columns}
        getRowId={(r) => r.id}
        searchValue={q}
        searchPredicate={(r, qq) =>
          r.id.toLowerCase().includes(qq) ||
          r.user.toLowerCase().includes(qq) ||
          r.amount.toString().toLowerCase().includes(qq) ||
          r.entry_type.toLowerCase().includes(qq)
        }
      
      />
    </PageScaffold>
   
  );
}

// subscribe to SSE and update local state
// subscribe outside render using effect
function useTransactionsSse(subscribe: (l: (e: { type: string; data: any }) => void) => () => void, setLocalRows: React.Dispatch<React.SetStateAction<any[]>>, setVolume: React.Dispatch<React.SetStateAction<number>>, setPosted: React.Dispatch<React.SetStateAction<number>>, setFailures: React.Dispatch<React.SetStateAction<number>>) {
  React.useEffect(() => {
    const unsubscribe = subscribe(({ type, data }) => {
      switch (type) {
        case 'TOPUP_CREATED': {
          setLocalRows((prev) => {
            const item = {
              id: `sse-${Date.now()}`,
              user: data?.user || 'sse',
              amount: Number(data?.amount || 0),
              entry_type: 'DEBIT',
              created_at: new Date().toISOString(),
            };
            setVolume((v) => v + item.amount);
            setPosted((p) => p + 1);
            return [item, ...prev];
          });
          break;
        }
        case 'SALE_CREATED': {
          setLocalRows((prev) => {
            const item = {
              id: `sse-${Date.now()}`,
              user: data?.user || 'sse',
              amount: Number(data?.amount || 0),
              entry_type: 'DEBIT',
              created_at: new Date().toISOString(),
            };
            setVolume((v) => v + item.amount);
            return [item, ...prev];
          });
          break;
        }
        case 'SHORTAGE_CREATED': {
          setFailures((f) => f + 1);
          break;
        }
        default:
          break;
      }
    });

    return unsubscribe;
  }, [subscribe, setLocalRows, setVolume, setPosted, setFailures]);
}

// mount SSE subscription when component is used
// This hook is used inside component body
export function TransactionsPageSseBinder(props: { subscribe: any; setLocalRows: any; setVolume: any; setPosted: any; setFailures: any }) {
  useTransactionsSse(props.subscribe, props.setLocalRows, props.setVolume, props.setPosted, props.setFailures);
  return null;
}