"use client"

import React, { useState, useEffect, useMemo } from 'react';
import { Activity, AlertCircle, CheckCircle2 } from 'lucide-react';
import StatCard from '@/components/StatCard';
import { Badge } from '@/components/Badge';
import { DataTable, type ColumnDef } from '@/components/DataTable';
import { FilterRow, Input, PageScaffold, Select } from '@/components/pageScaffold';
import { useSse } from '@/context/SseContext';
import { formatMoney } from '@/lib/utils';
import api from '@/app/lib/axios';

export interface TransactionEntry {
  id: string;
  user: string;
  amount: number;
  entry_type: "CREDIT" | "DEBIT";
  display_status: string;
  description: string;
  reference_type: string;
  reference_id: string;
  created_at: string;
}

interface SsePayload {
  user?: string;
  amount?: number | string;
}

interface SseEvent {
  type: string;
  data: SsePayload;
}

export default function TransactionsPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'ALL' | 'CREDIT' | 'DEBIT'>('ALL');
  const [transactions, setTransactions] = useState<TransactionEntry[]>([]);
  const [volume, setVolume] = useState(0);
  const [posted, setPosted] = useState(0);
  const [failures, setFailures] = useState(0);
  const [mounted, setMounted] = useState(false);
  const { subscribe } = useSse();

  useEffect(() => {
    const load =setTimeout(() => {
      setMounted(true);
    }, 2500);
    return () => clearTimeout(load);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const fetchTransactions = async () => {
      try {
        const response = await api.get<{ success: boolean; data: TransactionEntry[] }>("/transaction");
        if (response.data?.success) {
          const data = response.data.data;
          setTransactions(data);
          setVolume(data.reduce((acc, t) => acc + t.amount, 0));
          setPosted(data.filter((t) => t.entry_type === 'DEBIT').length);
          setFailures(data.filter((t) => t.entry_type === 'CREDIT').length);
        }
      } catch (err) {
        console.error("Error loading transactions:", err);
      }
    };

    fetchTransactions();
  }, [mounted]);

  const displayedRows = useMemo(() => {
    return transactions.filter((t) => (status === 'ALL' ? true : t.entry_type === status));
  }, [transactions, status]);

  const columns: ColumnDef<TransactionEntry>[] = [
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

  if (!mounted) {
    return null;
  }

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
          <StatCard title="Records" value={String(displayedRows.length)} icon={<Activity className="text-purple-300" />} iconBg="bg-purple-500/10" />
        </div>
      }
    >
      <FilterRow>
        <Input value={q} onChange={setQ} placeholder="Search tx_id / ticketer / device / external_ref…" />
        <div className="text-slate-500 text-xs font-medium">Failures should surface as discrepancies in reconciliation.</div>
      </FilterRow>

      <TransactionsPageSseBinder
        subscribe={subscribe}
        setTransactions={setTransactions}
        setVolume={setVolume}
        setPosted={setPosted}
        setFailures={setFailures}
      />

      <DataTable
        rows={displayedRows}
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

function useTransactionsSse(
  subscribe: (l: (e: SseEvent) => void) => () => void,
  setTransactions: React.Dispatch<React.SetStateAction<TransactionEntry[]>>,
  setVolume: React.Dispatch<React.SetStateAction<number>>,
  setPosted: React.Dispatch<React.SetStateAction<number>>,
  setFailures: React.Dispatch<React.SetStateAction<number>>
) {
  useEffect(() => {
    const handleEvent = ({ type, data }: SseEvent) => {
      switch (type) {
        case 'TOPUP_CREATED': {
          setTransactions((prev) => {
            const item: TransactionEntry = {
              id: `sse-${Date.now()}`,
              user: data?.user || 'sse',
              amount: Number(data?.amount || 0),
              entry_type: 'DEBIT',
              display_status: 'DEBIT',
              description: 'SSE Top Up',
              reference_type: 'TOPUP',
              reference_id: '',
              created_at: new Date().toISOString(),
            };
            setVolume((v) => v + item.amount);
            setPosted((p) => p + 1);
            return [item, ...prev];
          });
          break;
        }
        case 'SALE_CREATED': {
          setTransactions((prev) => {
            const item: TransactionEntry = {
              id: `sse-${Date.now()}`,
              user: data?.user || 'sse',
              amount: Number(data?.amount || 0),
              entry_type: 'DEBIT',
              display_status: 'DEBIT',
              description: 'SSE Sale',
              reference_type: 'SALE',
              reference_id: '',
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
    };

    const unsubscribe = subscribe(handleEvent);
    return () => {
      unsubscribe();
    };
  }, [subscribe, setTransactions, setVolume, setPosted, setFailures]);
}

export function TransactionsPageSseBinder(props: {
  subscribe: (l: (e: SseEvent) => void) => () => void;
  setTransactions: React.Dispatch<React.SetStateAction<TransactionEntry[]>>;
  setVolume: React.Dispatch<React.SetStateAction<number>>;
  setPosted: React.Dispatch<React.SetStateAction<number>>;
  setFailures: React.Dispatch<React.SetStateAction<number>>;
}) {
  useTransactionsSse(props.subscribe, props.setTransactions, props.setVolume, props.setPosted, props.setFailures);
  return null;
}
