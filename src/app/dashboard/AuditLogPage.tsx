// src/app/dashboard/AuditLogPage.tsx
"use client";
import { AlertTriangle, ArrowRight, FileSearch, Fingerprint, ShieldCheck, Smartphone, Wallet, Database, Play, CheckCircle, AlertCircle, Eye } from 'lucide-react';
import StatCard from '@/components/StatCard';
import { Badge } from '@/components/Badge';
import { DataTable, type ColumnDef } from '@/components/DataTable';
import { Drawer } from '@/components/Drawer';
import { FilterRow, Input, PageScaffold, Select } from '@/components/pageScaffold';
import { useSession } from 'next-auth/react';
import { formatMoney } from '@/lib/utils';
import { useState, useEffect } from 'react';
import api from '../lib/axios';
import axios from 'axios';


interface DBReconciliationReport {
  id: string;
  scope: string;
  status: string;
  variance: string | number;
  generated_at: string | Date;
  expected_float: string | number;
  actual_remittance: string | number;
  date: string | Date;
}

interface DBAuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  meta: Record<string, unknown> | null;
  created_at: string | Date;
  user: {
    first_name: string;
    last_name: string;
    role: string;
  };
}

interface DBRemittance {
  id: string;
  method: string;
  status: string;
  amount: string | number;
  created_at: string | Date;
  payment_reference: string | null;
  remittance_date: string | Date;
  submitted_by: string;
  pos_session_id: string | null;
  ticketer: {
    first_name: string;
    last_name: string;
    role: string;
  };
  verified_by: string | null;
  verified_at: string | Date | null;
}

interface DBPosDeviceSession {
  id: string;
  status: string;
  unassigned_by: string | null;
  assigned_by: string;
  unassigned_at: string | Date | null;
  assigned_at: string;
  device_id: string;
  unassigned_reason: string | null;
  pos_float: string | number;
  user: {
    first_name: string;
    last_name: string;
  };
  device: {
    name: string;
  };
}

interface DBFine {
  id: string;
  status: string;
  amount: string | number;
  created_at: string | Date;
  defaulter_id: string;
  reason: string;
  defaulter: {
    first_name: string;
    last_name: string;
  };
  issuer: {
    first_name: string;
    last_name: string;
  };
}

interface DBCommissionEarning {
  id: string;
  status: string;
  net_pay: string | number;
  created_at: string | Date;
  total_sales: string | number;
  commission_amount: string | number;
  fines_deducted: string | number;
  shortage_deducted: string | number;
  period_start: string | Date;
  period_end: string | Date;
  user: {
    first_name: string;
    last_name: string;
  };
}


type FindingCategory = 'DISCREPANCY' | 'AUDIT' | 'REMITTANCE' | 'DEVICE' | 'FINE' | 'PAYROLL';
type FindingStatus = 'OPEN' | 'RISK' | 'CLEAR' | 'INFO';
type FindingScope = 'ALL' | FindingCategory;

interface FindingRow {
  id: string;
  category: FindingCategory;
  subject: string;
  verifies: string;
  source: string;
  signal: string;
  status: FindingStatus;
  actor: string;
  created_at: string;
  reference: string;
  notes: string[];
  before?: unknown;
  after?: unknown;
}

interface VerificationStage {
  id: string;
  title: string;
  reads: string;
  checks: string;
  count: number;
  variant: 'success' | 'warning' | 'danger' | 'info';
}

const categoryVariant: Record<FindingCategory, 'success' | 'warning' | 'danger' | 'info'> = {
  DISCREPANCY: 'warning',
  AUDIT: 'danger',
  REMITTANCE: 'info',
  DEVICE: 'warning',
  FINE: 'danger',
  PAYROLL: 'info',
};

const statusVariant: Record<FindingStatus, 'success' | 'warning' | 'danger' | 'info'> = {
  OPEN: 'warning',
  RISK: 'danger',
  CLEAR: 'success',
  INFO: 'info',
};

// Database-to-finding mappers

function mapReconciliationReport(report: DBReconciliationReport): FindingRow {
  return {
    id: `recon-${report.id}`,
    category: 'DISCREPANCY',
    subject: `${report.scope} Run ${report.id.substring(0, 8)}`,
    verifies: 'expected float vs actual remittance',
    source: 'Reconciliation_reports',
    signal: `${report.status}: Variance ${formatMoney(Number(report.variance))}`,
    status: report.status === 'VARIANCE' ? 'RISK' : 'OPEN',
    actor: 'System Auto-run',
    created_at: new Date(report.generated_at).toLocaleString(),
    reference: `expected: ${formatMoney(Number(report.expected_float))} / actual: ${formatMoney(Number(report.actual_remittance))}`,
    notes: [
      `Scope: ${report.scope}`,
      `Report Date: ${new Date(report.date).toLocaleDateString()}`,
    ],
    before: { expected_float: report.expected_float },
    after: { actual_remittance: report.actual_remittance, variance: report.variance },
  };
}

function mapAuditLog(log: DBAuditLog): FindingRow {
  const actorName = `${log.user.first_name} ${log.user.last_name} (${log.user.role})`;
  
  let category: FindingCategory = 'AUDIT';
  if (log.entity_type === 'REMITTANCE') category = 'REMITTANCE';
  else if (log.entity_type === 'FINE') category = 'FINE';
  else if (log.entity_type === 'POS_DEVICE') category = 'DEVICE';
  else if (log.entity_type === 'SALARY') category = 'PAYROLL';
  else if (log.entity_type === 'FLOAT_ALLOCATION') category = 'DISCREPANCY';

  return {
    id: `audit-${log.id}`,
    category,
    subject: `${log.action} - ${log.entity_type}`,
    verifies: 'before/after mutation trail',
    source: 'AuditLog',
    signal: `Mutation recorded on ${log.entity_id}`,
    status: log.action === 'REVERSE' || log.action === 'CANCELLED' ? 'RISK' : 'INFO',
    actor: actorName,
    created_at: new Date(log.created_at).toLocaleString(),
    reference: `${log.entity_type}:${log.entity_id}`,
    notes: [
      `Target Entity ID: ${log.entity_id}`,
      `Origin metadata: ${log.meta ? JSON.stringify(log.meta) : 'None'}`
    ],
    before: log.before_state ?? undefined,
    after: log.after_state ?? undefined,
  };
}

function mapRemittance(remit: DBRemittance): FindingRow {
  const actorName = `${remit.ticketer.first_name} ${remit.ticketer.last_name} (${remit.ticketer.role})`;
  return {
    id: `remit-${remit.id}`,
    category: 'REMITTANCE',
    subject: `${remit.method} Remittance`,
    verifies: 'submitted vs verified remittance',
    source: 'Remittance',
    signal: `${remit.status}: ${formatMoney(Number(remit.amount))}`,
    status: remit.status === 'PENDING' ? 'OPEN' : 'INFO',
    actor: actorName,
    created_at: new Date(remit.created_at).toLocaleString(),
    reference: `payment ref: ${remit.payment_reference ?? 'N/A'}`,
    notes: [
      `Remittance Date: ${new Date(remit.remittance_date).toLocaleDateString()}`,
      `Submitted By ID: ${remit.submitted_by}`,
      `POS Session ID: ${remit.pos_session_id ?? 'None'}`
    ],
    before: { status: remit.status, amount: remit.amount },
    after: { verified_by: remit.verified_by, verified_at: remit.verified_at },
  };
}

function mapPosDeviceSession(session: DBPosDeviceSession): FindingRow {
  const actorName = `${session.user.first_name} ${session.user.last_name}`;
  return {
    id: `pos-${session.id}`,
    category: 'DEVICE',
    subject: `${session.device.name} Session`,
    verifies: 'POS device session history',
    source: 'PosDeviceSession',
    signal: `Status: ${session.status}`,
    status: 'RISK',
    actor: session.unassigned_by || session.assigned_by,
    created_at: new Date(session.unassigned_at || session.assigned_at).toLocaleString(),
    reference: `device: ${session.device_id}`,
    notes: [
      `Assigned to: ${actorName}`,
      `Reason: ${session.unassigned_reason ?? 'No reason stated'}`,
      `Float balance: ${formatMoney(Number(session.pos_float))}`
    ],
    before: { status: 'ACTIVE', assigned_to: actorName },
    after: { status: session.status, unassigned_reason: session.unassigned_reason },
  };
}

function mapFine(fine: DBFine): FindingRow {
  const defaulterName = `${fine.defaulter.first_name} ${fine.defaulter.last_name}`;
  const issuerName = `${fine.issuer.first_name} ${fine.issuer.last_name}`;
  return {
    id: `fine-${fine.id}`,
    category: 'FINE',
    subject: `Fine issued to ${defaulterName}`,
    verifies: 'fine issue + evidence trail',
    source: 'Fine',
    signal: `${fine.status}: ${formatMoney(Number(fine.amount))}`,
    status: fine.status === 'UNPAID' ? 'OPEN' : 'INFO',
    actor: issuerName,
    created_at: new Date(fine.created_at).toLocaleString(),
    reference: `defaulter: ${fine.defaulter_id}`,
    notes: [
      `Reason: ${fine.reason}`,
      `Issued by: ${issuerName}`,
    ],
    before: { status: 'UNPAID', amount: fine.amount },
    after: { status: fine.status },
  };
}

function mapCommissionEarning(earning: DBCommissionEarning): FindingRow {
  const userName = `${earning.user.first_name} ${earning.user.last_name}`;
  return {
    id: `pay-${earning.id}`,
    category: 'PAYROLL',
    subject: `Commission Earning for ${userName}`,
    verifies: 'sales vs fines vs commission rate',
    source: 'CommissionEarning',
    signal: `Net Pay: ${formatMoney(Number(earning.net_pay))}`,
    status: earning.status === 'PENDING' ? 'OPEN' : 'CLEAR',
    actor: userName,
    created_at: new Date(earning.created_at).toLocaleString(),
    reference: `sales: ${formatMoney(Number(earning.total_sales))}`,
    notes: [
      `Commission: ${formatMoney(Number(earning.commission_amount))}`,
      `Fines Deducted: ${formatMoney(Number(earning.fines_deducted))}`,
      `Shortages Deducted: ${formatMoney(Number(earning.shortage_deducted))}`,
      `Period: ${new Date(earning.period_start).toLocaleDateString()} - ${new Date(earning.period_end).toLocaleDateString()}`
    ],
    before: { gross_sales: earning.total_sales, deductions: Number(earning.fines_deducted) + Number(earning.shortage_deducted) },
    after: { net_pay: earning.net_pay, status: earning.status },
  };
}


function categoryLabel(category: FindingCategory) {
  switch (category) {
    case 'DISCREPANCY':
      return 'Discrepancy';
    case 'AUDIT':
      return 'Audit';
    case 'REMITTANCE':
      return 'Remittance';
    case 'DEVICE':
      return 'Device';
    case 'FINE':
      return 'Fine';
    case 'PAYROLL':
      return 'Payroll';
    default:
      return category;
  }
}

// Side-by-side Visual Diff component
function VisualDiff({ before, after }: { before?: unknown; after?: unknown }) {
  if (!before && !after) return <p className="text-slate-500 text-xs italic">No state changes recorded.</p>;

 const beforeObj = (typeof before === 'object' && before !== null ? before : {}) as Record<string, unknown>;
 const afterObj = (typeof after === 'object' && after !== null ? after : {}) as Record<string, unknown>;
 const allKeys = Array.from(new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]));

  return (
    <div className="space-y-2 font-mono text-xs">
      <div className="grid grid-cols-3 gap-2 border-b border-white/10 pb-2 text-[10px] uppercase font-bold text-slate-500">
        <span>Field</span>
        <span>Before</span>
        <span>After</span>
      </div>
      <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
        {allKeys.map((key) => {
          const valBefore = beforeObj[key];
          const valAfter = afterObj[key];
          const isAdded = !(key in beforeObj) && (key in afterObj);
          const isRemoved = (key in beforeObj) && !(key in afterObj);
          const isChanged = (key in beforeObj) && (key in afterObj) && JSON.stringify(valBefore) !== JSON.stringify(valAfter);
          
          let rowClass = "text-slate-400";
          let beforeBadge = "text-slate-500";
          let afterBadge = "text-slate-300";

          if (isAdded) {
            rowClass = "bg-emerald-500/5 text-emerald-300 border-l-2 border-emerald-500 pl-2";
            afterBadge = "text-emerald-400 font-semibold";
          } else if (isRemoved) {
            rowClass = "bg-red-500/5 text-red-300 border-l-2 border-red-500 pl-2 line-through";
            beforeBadge = "text-red-400 font-semibold";
          } else if (isChanged) {
            rowClass = "bg-amber-500/5 text-amber-300 border-l-2 border-amber-500 pl-2";
            beforeBadge = "text-red-400/80 line-through";
            afterBadge = "text-emerald-400 font-semibold";
          }

          const formatVal = (val: unknown) => {
            if (val === undefined || val === null) return "null";
            if (typeof val === 'object') return JSON.stringify(val);
            return String(val);
          };

          return (
            <div key={key} className={`grid grid-cols-3 gap-2 py-1 items-center rounded transition ${rowClass}`}>
              <span className="font-semibold text-slate-300 truncate">{key}</span>
              <span className={`truncate ${beforeBadge}`}>{isAdded ? "-" : formatVal(valBefore)}</span>
              <span className={`truncate ${afterBadge}`}>{isRemoved ? "-" : formatVal(valAfter)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AuditorPage() {
  const { data: session } = useSession();
  const [q, setQ] = useState('');
  const [scope, setScope] = useState<FindingScope>('REMITTANCE');
  const [selected, setSelected] = useState<FindingRow | null>(null);
  
  const [dbAuditLogs, setDbAuditLogs] = useState<FindingRow[]>([]);
  const [loadingDbLogs, setLoadingDbLogs] = useState(false);

  // Date Range Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // SQL Console States
  const [sqlQuery, setSqlQuery] = useState(`SELECT id, first_name, last_name, role \nFROM "User" \nWHERE company_id = '${session?.user?.company_id || 'cmqlzhetb00000cj243lbzpl0'}';`);
  const [queryResults, setQueryResults] = useState<Record<string, string>[] | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);



  // Fetch real audit logs from database with active date filters
  useEffect(() => {
    const fetchDbAuditLogs = async () => {
      setLoadingDbLogs(true);
      try {
        const params: Record<string, string> = {};
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;

        const res = await api.get('/admin/audit', { params });
        if (res.data.success && res.data.data) {
          const payload = res.data.data;
          
                  const mappedRecon = (payload.reconciliationReports as DBReconciliationReport[] || []).map(mapReconciliationReport);
          const mappedLogs = (payload.auditLogs as DBAuditLog[] || []).map(mapAuditLog);
          const mappedRemit = (payload.remittances as DBRemittance[] || []).map(mapRemittance);
          const mappedDevice = (payload.posDeviceSessions as DBPosDeviceSession[] || []).map(mapPosDeviceSession);
          const mappedFines = (payload.fines as DBFine[] || []).map(mapFine);
          const mappedSalary = (payload.commissionEarnings as DBCommissionEarning[] || []).map(mapCommissionEarning);

          const compiled = [
            ...mappedRecon,
            ...mappedLogs,
            ...mappedRemit,
            ...mappedDevice,
            ...mappedFines,
            ...mappedSalary,
          ];

          setDbAuditLogs(compiled);
        }
      } catch (err) {
        console.error("Failed to load database audit logs:", err);
      } finally {
        setLoadingDbLogs(false);
      }
    };
    if (session?.user) {
      fetchDbAuditLogs();
    }
  }, [session, startDate, endDate]);

  const handleExecuteQuery = async () => {
    setQueryLoading(true);
    setQueryError(null);
    setQueryResults(null);
    try {
      const res = await api.post('/admin/query', { query: sqlQuery });
      if (res.data.success) {
        setQueryResults((res.data.results as Record<string, string>[]) || []);
      } else {
        setQueryError((res.data.error as string) || "Query execution failed.");
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setQueryError(((err.response?.data as Record<string, string>)?.error) || "Error executing SQL query");
      } else if (err instanceof Error) {
        setQueryError(err.message);
      } else {
        setQueryError("An unknown error occurred");
      }
    } finally {
      setQueryLoading(false);
    }
  };

  // Filter based on selected scope
  const filtered = dbAuditLogs.filter((finding) => (scope === 'ALL' ? true : finding.category === scope));

  // Dynamic discovery counts based on state
  const counts = {
    discrepancies: dbAuditLogs.filter((f) => f.category === 'DISCREPANCY').length,
    edits: dbAuditLogs.filter((f) => f.category === 'AUDIT').length,
    remittances: dbAuditLogs.filter((f) => f.category === 'REMITTANCE').length,
    devices: dbAuditLogs.filter((f) => f.category === 'DEVICE').length,
    payroll: dbAuditLogs.filter((f) => f.category === 'PAYROLL').length,
  };

  const dynamicStages: VerificationStage[] = [
    {
      id: 'float',
      title: 'Float trail',
      reads: 'FloatAllocation + FloatLedger',
      checks: 'who moved float and what remains',
      count: counts.discrepancies,
      variant: 'success',
    },
    {
      id: 'sales',
      title: 'Sales trail',
      reads: 'Sales_Record + POS session history',
      checks: 'device session backs the sales report',
      count: counts.payroll,
      variant: 'info',
    },
    {
      id: 'remittance',
      title: 'Remittance trail',
      reads: 'Remittance + ReconciliationRun',
      checks: 'submitted amount vs variance',
      count: counts.remittances,
      variant: 'warning',
    },
    {
      id: 'audit',
      title: 'Audit trail',
      reads: 'AuditLogEntry',
      checks: 'before / after mutation history',
      count: counts.edits,
      variant: 'danger',
    },
    {
      id: 'payroll',
      title: 'Salary review',
      reads: 'Sales_Record + Fine + Commission_Rate',
      checks: 'net pay after deductions',
      count: counts.payroll,
      variant: 'warning',
    },
  ];

  const columns: ColumnDef<FindingRow>[] = [
    {
      id: 'category',
      header: 'category',
      cell: (row) => <Badge variant={categoryVariant[row?.category || "AUDIT"]}>{categoryLabel(row?.category || "AUDIT")}</Badge>,
      sortValue: (row) => row.category,
      align: 'center',
    },
    {
      id: 'subject',
      header: 'subject',
      cell: (row) => <span className="text-slate-200 text-sm font-semibold">{row?.subject}</span>,
      sortValue: (row) => row?.subject,
    },
    { id: 'verifies', header: 'verifies', cell: (row) => <span className="text-slate-400 text-xs">{row?.verifies}</span>, sortValue: (row) => row?.verifies },
    { id: 'signal', header: 'signal', cell: (row) => <span className="text-slate-300 text-xs font-medium">{row?.signal}</span>, sortValue: (row) => row?.signal },
    {
      id: 'status',
      header: 'status',
      cell: (row) => <Badge variant={statusVariant[row?.status || "INFO"]}>{row?.status}</Badge>,
      sortValue: (row) => row?.status,
      align: 'center',
    },
    { id: 'actor', header: 'actor', cell: (row) => <span className="text-slate-400 text-xs">{row?.actor}</span>, sortValue: (row) => row?.actor },
    { id: 'source', header: 'source', cell: (row) => <span className="text-slate-500 text-xs">{row?.source}</span>, sortValue: (row) => row?.source },
    { id: 'created', header: 'created_at', cell: (row) => <span className="text-slate-500 text-xs">{row?.created_at}</span>, sortValue: (row) => row?.created_at },
  ];

  return (
    <>
      <PageScaffold
        title="Auditor Control Room"
        subtitle="Independent verification of allocations, remittances, device history, fines, and edit trails"
        right={
          <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-slate-300">
            <ShieldCheck className="w-4 h-4" strokeWidth={1.5} />
            Read only
          </div>
        }
        kpis={
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
            <StatCard title="Discrepancies" value={String(counts.discrepancies)} icon={<AlertTriangle className="text-amber-300" />} iconBg="bg-amber-500/10" />
            <StatCard title="Suspicious edits" value={String(counts.edits)} icon={<Fingerprint className="text-red-300" />} iconBg="bg-red-500/10" />
            <StatCard title="Overdue remittances" value={String(counts.remittances)} icon={<Wallet className="text-blue-300" />} iconBg="bg-blue-500/10" />
            <StatCard title="Device returns" value={String(counts.devices)} icon={<Smartphone className="text-purple-300" />} iconBg="bg-purple-500/10" />
            <StatCard title="Salary reviews" value={String(counts.payroll)} icon={<FileSearch className="text-emerald-300" />} iconBg="bg-emerald-500/10" />
          </div>
        }
      >
        <div className="glass-panel rounded-2xl border border-white/5 p-4 lg:p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
            <span className="text-slate-300">Flow</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-300">Float Allocation</span>
            <ArrowRight className="w-4 h-4 text-slate-600" />
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-300">Sales Report</span>
            <ArrowRight className="w-4 h-4 text-slate-600" />
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-300">Remittance</span>
            <ArrowRight className="w-4 h-4 text-slate-600" />
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-300">Reconciliation</span>
            <ArrowRight className="w-4 h-4 text-slate-600" />
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-300">Audit Log</span>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {dynamicStages.map((stage) => (
              <div key={stage.id} className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-white text-sm font-bold">{stage.title}</p>
                    <p className="mt-1 text-[11px] text-slate-500">{stage.reads}</p>
                  </div>
                  <Badge variant={stage.variant}>{String(stage.count)}</Badge>
                </div>
                <p className="mt-3 text-xs text-slate-400">{stage.checks}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Read-Only SQL Playground Box */}
        {(
          <div className="glass-panel rounded-2xl border border-white/5 p-5 space-y-4 bg-slate-950/40">
            <div className="flex items-center gap-2 text-white font-bold text-base">
              <Database className="w-5 h-5 text-emerald-400" />
              <span>Auditor SQL Playground</span>
              <span className="text-[10px] tracking-wider uppercase font-semibold text-slate-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">Read-Only</span>
            </div>
            
            <p className="text-xs text-slate-400">
              Run custom database queries inside the read-only replica connection pool. Destructive commands are blocked automatically.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 space-y-3">
                <textarea
                  value={sqlQuery}
                  onChange={(e) => setSqlQuery(e.target.value)}
                  className="w-full h-40 bg-black/50 border border-white/10 rounded-xl p-3 font-mono text-xs text-emerald-300 focus:outline-none focus:border-emerald-500/50 resize-y"
                  placeholder="SELECT * FROM table..."
                />
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-slate-500 font-mono">Max limit: 100 rows</span>
                  <button
                    onClick={handleExecuteQuery}
                    disabled={queryLoading || !sqlQuery.trim()}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold uppercase rounded-xl transition duration-150"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    {queryLoading ? "Running..." : "Run Query"}
                  </button>
                </div>
              </div>

              {/* Schema Documentation Reference */}
              <div className="bg-black/20 border border-white/5 rounded-xl p-4 text-[11px] font-mono text-slate-400 overflow-y-auto max-h-48 space-y-2">
                <div className="font-bold text-slate-300 border-b border-white/5 pb-1">Available Schema Tables</div>
                <div>• <span className="text-emerald-400">`&quot;User&quot;`</span> (id, role, company_id)</div>
                <div>• <span className="text-emerald-400">`&quot;Fine&quot;`</span> (id, amount, status, company_id)</div>
                <div>• <span className="text-emerald-400">`&quot;Remittance&quot;`</span> (id, amount, status, company_id)</div>
                <div>• <span className="text-emerald-400">`&quot;Float_Ledger&quot;`</span> (id, amount, company_id)</div>
                <div>• <span className="text-emerald-400">`&quot;Sales_Record&quot;`</span> (id, total_sold, company_id)</div>
              </div>
            </div>

            {/* Error Message rendering */}
            {queryError && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl border border-red-500/20 bg-red-500/10 text-red-300 text-xs font-mono">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{queryError}</span>
              </div>
            )}

            {/* Results Table rendering */}
            {queryResults && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Returned {queryResults.length} records</span>
                </div>
                <div className="overflow-x-auto rounded-xl border border-white/5 bg-black/40 max-h-64">
                  {queryResults.length === 0 ? (
                    <div className="p-4 text-xs text-slate-500 text-center font-mono">Empty result set.</div>
                  ) : (
                    <table className="w-full text-[11px] font-mono text-slate-300">
                      <thead>
                        <tr className="border-b border-white/10 bg-white/5 text-left text-slate-400">
                          {Object.keys(queryResults[0]).map((key) => (
                            <th key={key} className="px-3 py-2 font-bold">{key}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {queryResults.map((row, i) => (
                          <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition">
                            {Object.values(row).map((val: unknown, j) => (
                              <td key={j} className="px-3 py-1.5 max-w-[200px] truncate">
                                {val === null ? (
                                  <span className="text-slate-600">NULL</span>
                                ) : typeof val === 'object' ? (
                                  JSON.stringify(val)
                                ) : (
                                  String(val)
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <FilterRow>
          <Input value={q} onChange={setQ} placeholder="Search subject / actor..." />
          <Select
            value={scope}
            onChange={(value) => setScope(value as FindingScope)}
            options={[
              { value: 'ALL', label: 'All findings' },
              { value: 'DISCREPANCY', label: 'Discrepancies' },
              { value: 'AUDIT', label: 'Audit edits' },
              { value: 'REMITTANCE', label: 'Remittances' },
              { value: 'DEVICE', label: 'Device history' },
              { value: 'FINE', label: 'Fines' },
              { value: 'PAYROLL', label: 'Payroll reviews' },
            ]}
          />
          <div className="flex items-center gap-2">
            <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full lg:w-40 rounded-xl bg-white/[0.03] border border-white/10 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-white/20"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full lg:w-40 rounded-xl bg-white/[0.03] border border-white/10 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-white/20"
            />
          </div>
          <div className="text-slate-500 text-[11px] font-medium italic shrink-0">
            {startDate || endDate ? "Filtering active range" : "Showing today's logs"}
          </div>
        </FilterRow>

        <DataTable
          rows={filtered}
          columns={columns}
          getRowId={(row) => row.id}
          onRowClick={(row) => setSelected(row)}
          searchValue={q}
          searchPredicate={(row, qq) =>
            row.category.toLowerCase().includes(qq) ||
            row.subject.toLowerCase().includes(qq) ||
            row.verifies.toLowerCase().includes(qq) ||
            row.signal.toLowerCase().includes(qq) ||
            row.source.toLowerCase().includes(qq) ||
            row.actor.toLowerCase().includes(qq) ||
            row.reference.toLowerCase().includes(qq) ||
            row.notes.join(' ').toLowerCase().includes(qq)
          }
          emptyLabel={loadingDbLogs ? "Loading database audit trails..." : "No audit findings match this filter."}
        />
      </PageScaffold>

      <Drawer
        open={Boolean(selected)}
        title={selected ? selected.subject : 'Audit Forensic Profile'}
        subtitle={selected ? `${selected.source} — ${selected.reference}` : undefined}
        onClose={() => setSelected(null)}
      >
        {selected && (
          <div className="space-y-5">
            {/* Stage Identification Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-indigo-400" />
                <span className="text-sm font-bold text-slate-200">Audit Profile Review</span>
              </div>
              <Badge variant={categoryVariant[selected.category]}>{categoryLabel(selected.category)}</Badge>
            </div>

            {/* Finding Summary Card */}
            <div className="glass-panel rounded-2xl border border-white/5 p-4 bg-slate-900/40">
              <p className="text-white text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Record Identity</p>
              <div className="grid grid-cols-2 gap-y-3.5 gap-x-2 text-xs">
                <div>
                  <p className="text-slate-500 text-[11px]">System ID</p>
                  <p className="text-slate-300 font-mono text-[11px] truncate">{selected.id}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-[11px]">Source Entity</p>
                  <p className="text-slate-300 font-mono text-[11px] truncate">{selected.source}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-[11px]">Authorized Actor</p>
                  <p className="text-slate-300 truncate">{selected.actor || "System Auto-run"}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-[11px]">Execution Time</p>
                  <p className="text-slate-300">{selected.created_at}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-[11px]">Verification Target</p>
                  <p className="text-indigo-300">{selected.verifies}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-[11px]">Transaction Signal</p>
                  <p className="text-amber-300 truncate">{selected.signal}</p>
                </div>
              </div>
            </div>

            {/* Visual Diff Section */}
            {(selected.before !== undefined || selected.after !== undefined) && (
              <div className="glass-panel rounded-2xl border border-white/5 p-4 bg-black/20">
                <p className="text-white text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">State Mutation Details</p>
                <VisualDiff before={selected.before} after={selected.after} />
              </div>
            )}

            {/* Notes Section */}
            {selected.notes && selected.notes.length > 0 && (
              <div className="glass-panel rounded-2xl border border-white/5 p-4 bg-slate-900/30">
                <p className="text-white text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Audit Investigation Notes</p>
                <div className="space-y-2">
                  {selected.notes.map((note, index) => (
                    <div key={index} className="rounded-xl bg-white/[0.02] border border-white/5 px-3 py-2 text-xs text-slate-300 font-mono">
                      {note}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Auditor Forensic Checklist */}
            <div className="glass-panel rounded-2xl border border-white/5 p-4 bg-indigo-950/20">
              <p className="text-white text-xs font-bold uppercase tracking-wider text-indigo-400 mb-3 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                <span>Auditor Forensic Checklist</span>
              </p>
              <div className="space-y-2.5">
                <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer select-none">
                  <input type="checkbox" className="rounded border-white/10 bg-white/5 text-indigo-500 focus:ring-0 w-3.5 h-3.5" />
                  <span>Signature & Actor identification verified</span>
                </label>
                <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer select-none">
                  <input type="checkbox" className="rounded border-white/10 bg-white/5 text-indigo-500 focus:ring-0 w-3.5 h-3.5" />
                  <span>State mutation complies with business rules</span>
                </label>
                <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer select-none">
                  <input type="checkbox" className="rounded border-white/10 bg-white/5 text-indigo-500 focus:ring-0 w-3.5 h-3.5" />
                  <span>Cross-tenant boundaries verified manually</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </>
  );
}
