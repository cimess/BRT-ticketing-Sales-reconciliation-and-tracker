// app/src/dashboard/pages/AuditorOverviewPage.tsx
"use client";
import { AlertTriangle, ArrowRight, FileSearch, Fingerprint, ShieldCheck, Smartphone, Wallet } from 'lucide-react';
import StatCard from '@/components/StatCard';
import { Badge } from '@/components/Badge';
import { DataTable, type ColumnDef } from '@/components/DataTable';
import { Drawer } from '@/components/Drawer';
import { FilterRow, Input, PageScaffold, Select } from '@/components/pageScaffold';
import {
  mockAuditLogs,
  mockCommisionRules,
  mockFines,
  mockFloatAllocation,
  mockPosDevices,
  mockPosEvents,
  mockReconciliationRuns,
  mockRemittances,
  mockSalesRecords,
  mockUsers,
} from '@/lib/mock';
import { formatMoney } from '@/lib/utils';
import { useMemo, useState } from 'react';

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

function buildFindings(): FindingRow[] {
  const rows: FindingRow[] = [];

  mockReconciliationRuns
    .filter((run) => run.status !== 'MATCHED' && run.status !== 'RESOLVED')
    .forEach((run) => {
      rows.push({
        id: 'recon-' + run.run_id,
        category: 'DISCREPANCY',
        subject: run.scope + ' run ' + run.run_id,
        verifies: 'float allocation vs remittance',
        source: 'ReconciliationRun',
        signal: run.status + ' ' + formatMoney(run.variance),
        status: run.status === 'VARIANCE' ? 'RISK' : 'OPEN',
        actor: run.actor,
        created_at: run.generated_at,
        reference: 'expected ' + formatMoney(run.expected_float) + ' / actual ' + formatMoney(run.actual_remittance),
        notes: ['re-run reconciliation', 'scope ' + run.scope],
        before: { expected_float: run.expected_float },
        after: { actual_remittance: run.actual_remittance, variance: run.variance },
      });
    });

  mockAuditLogs
    .filter((log) => log.action.includes('EDIT') || log.action.includes('UPDATE'))
    .forEach((log) => {
      rows.push({
        id: 'audit-' + log.id,
        category: 'AUDIT',
        subject: log.action + ' - ' + log.entity_type,
        verifies: 'append-only mutation trail',
        source: 'AuditLogEntry',
        signal: 'before/after edit captured',
        status: 'RISK',
        actor: log.actor,
        created_at: log.created_at,
        reference: log.entity_type + ':' + log.entity_id,
        notes: [
          'origin ' + (log.meta?.device ?? 'unknown') + ' | ' + (log.meta?.ip ?? 'unknown'),
        ],
        before: log.before,
        after: log.after,
      });
    });

  const pendingRemittance = mockRemittances.find((remit) => remit.status === 'PENDING');
  if (pendingRemittance) {
    rows.push({
      id: 'remit-' + pendingRemittance.remit_id,
      category: 'REMITTANCE',
      subject: pendingRemittance.method + ' ' + formatMoney(pendingRemittance.amount),
      verifies: 'submitted vs verified remittance',
      source: 'Remittance',
      signal: 'pending verification',
      status: 'OPEN',
      actor: pendingRemittance.submitted_by,
      created_at: pendingRemittance.submitted_at,
      reference: 'proof ' + (pendingRemittance.proof_ref ?? 'none'),
      notes: [pendingRemittance.proof_ref ? 'proof attached: ' + pendingRemittance.proof_ref : 'no proof attached'],
      before: { status: pendingRemittance.status, amount: pendingRemittance.amount },
      after: { verified_by: pendingRemittance.verified_by ?? null, verified_at: pendingRemittance.verified_at ?? null },
    });
  }

  const returnedEvent = mockPosEvents.find((event) => event.status === 'RETURNED');
  if (returnedEvent) {
    const deviceName = mockPosDevices.find((device) => device.id === returnedEvent.id)?.name ?? 'POS';
    rows.push({
      id: 'pos-' + returnedEvent.id,
      category: 'DEVICE',
      subject: deviceName + ' / ' + returnedEvent.username,
      verifies: 'POS session history',
      source: 'PosDeviceEvent',
      signal: 'device returned after review',
      status: 'RISK',
      actor: returnedEvent.unassigned_by ?? returnedEvent.assigned_by,
      created_at: returnedEvent.unassigned_at ?? returnedEvent.assigned_at,
      reference: 'device ' + returnedEvent.id,
      notes: ['assigned by ' + returnedEvent.assigned_by, returnedEvent.unassigned_reason ?? 'returned'],
      before: { assigned_to: returnedEvent.username, status: 'ACTIVE' },
      after: {
        status: returnedEvent.status,
        unassigned_by: returnedEvent.unassigned_by ?? null,
        unassigned_at: returnedEvent.unassigned_at ?? null,
      },
    });
  }

  const fineGroups = mockUsers
    .filter((user) => user.role === 'TICKETER')
    .map((user) => {
      const userFines = mockFines.filter((fine) => fine.defaulter_id === user.user_id);
      return { user, userFines };
    })
    .filter(({ userFines }) => userFines.length > 0);

  fineGroups.forEach(({ user, userFines }) => {
    const totalFines = userFines.reduce((acc, fine) => acc + fine.amount, 0);
    rows.push({
      id: 'fine-' + user.user_id,
      category: 'FINE',
      subject: user.fullname,
      verifies: 'fine issuer + evidence trail',
      source: 'Fine',
      signal: userFines.length + ' unpaid fine(s)',
      status: 'OPEN',
      actor: userFines[0].issued_by,
      created_at: userFines[0].created_at,
      reference: user.user_id,
      notes: [
        'total fines ' + formatMoney(totalFines),
        'fine ids ' + userFines.map((fine) => fine.id).join(', '),
      ],
      before: { amount: totalFines, status: 'UNPAID' },
      after: { status: 'UNDER_REVIEW' },
    });
  });

  const ticketerRule = mockCommisionRules.find((rule) => rule.role === 'TICKETER');
  mockUsers
    .filter((user) => user.role === 'TICKETER')
    .forEach((user) => {
      const sales = mockSalesRecords.filter((record) => record.ticketer_id === user.user_id);
      const userFines = mockFines.filter((fine) => fine.defaulter_id === user.user_id);
      if (userFines.length === 0) return;

      const totalSales = sales.reduce((acc, record) => acc + record.total_sold, 0);
      const totalFines = userFines.reduce((acc, fine) => acc + fine.amount, 0);
      const rate = ticketerRule?.percentage ?? 0;
      const netPay = totalSales * rate - totalFines;

      rows.push({
        id: 'pay-' + user.user_id,
        category: 'PAYROLL',
        subject: user.fullname,
        verifies: 'sales vs fines vs commission rate',
        source: 'Sales_Record + Fine + Commission_Rate',
        signal: 'net pay ' + formatMoney(netPay),
        status: 'INFO',
        actor: user.fullname,
        created_at: sales[0]?.submitted_at ?? user.created_at,
        reference: 'sales ' + sales.length + ' / fines ' + userFines.length,
        notes: [
          'gross sales ' + formatMoney(totalSales),
          'deductions ' + formatMoney(totalFines),
          'commission ' + (rate * 100).toFixed(0) + '%',
        ],
        before: { gross_sales: totalSales, fine_deductions: totalFines },
        after: { net_pay: netPay },
      });
    });

  return rows;
}

const FINDINGS = buildFindings();
const DISCOVERY_COUNTS = {
  discrepancies: FINDINGS.filter((finding) => finding.category === 'DISCREPANCY').length,
  edits: FINDINGS.filter((finding) => finding.category === 'AUDIT').length,
  remittances: FINDINGS.filter((finding) => finding.category === 'REMITTANCE').length,
  devices: FINDINGS.filter((finding) => finding.category === 'DEVICE').length,
  payroll: FINDINGS.filter((finding) => finding.category === 'PAYROLL').length,
};

const VERIFICATION_STAGES: VerificationStage[] = [
  {
    id: 'float',
    title: 'Float trail',
    reads: 'FloatAllocation + FloatLedger',
    checks: 'who moved float and what remains',
    count: mockFloatAllocation.length,
    variant: 'success',
  },
  {
    id: 'sales',
    title: 'Sales trail',
    reads: 'Sales_Record + POS session history',
    checks: 'device session backs the sales report',
    count: mockSalesRecords.length,
    variant: 'info',
  },
  {
    id: 'remittance',
    title: 'Remittance trail',
    reads: 'Remittance + ReconciliationRun',
    checks: 'submitted amount vs variance',
    count: DISCOVERY_COUNTS.discrepancies + DISCOVERY_COUNTS.remittances,
    variant: 'warning',
  },
  {
    id: 'audit',
    title: 'Audit trail',
    reads: 'AuditLogEntry',
    checks: 'before / after mutation history',
    count: DISCOVERY_COUNTS.edits,
    variant: 'danger',
  },
  {
    id: 'payroll',
    title: 'Salary review',
    reads: 'Sales_Record + Fine + Commission_Rate',
    checks: 'net pay after deductions',
    count: DISCOVERY_COUNTS.payroll,
    variant: 'warning',
  },
];

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

export default function AuditorPage() {
  const [q, setQ] = useState('');
  const [scope, setScope] = useState<FindingScope>('ALL');
  const [selected, setSelected] = useState<FindingRow | null>(null);


    const filtered = FINDINGS.filter((finding) => (scope === 'ALL' ? true : finding.category === scope));


  const columns: ColumnDef<FindingRow>[] = [
    {
      id: 'category',
      header: 'category',
      cell: (row) => <Badge variant={categoryVariant[row?.category||"AUDIT"]}>{categoryLabel(row?.category||"AUDIT")}</Badge>,
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
      cell: (row) => <Badge variant={statusVariant[row?.status||"INFO"]}>{row?.status}</Badge>,
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
            <StatCard title="Discrepancies" value={String(DISCOVERY_COUNTS.discrepancies)} icon={<AlertTriangle className="text-amber-300" />} iconBg="bg-amber-500/10" />
            <StatCard title="Suspicious edits" value={String(DISCOVERY_COUNTS.edits)} icon={<Fingerprint className="text-red-300" />} iconBg="bg-red-500/10" />
            <StatCard title="Overdue remittances" value={String(DISCOVERY_COUNTS.remittances)} icon={<Wallet className="text-blue-300" />} iconBg="bg-blue-500/10" />
            <StatCard title="Device returns" value={String(DISCOVERY_COUNTS.devices)} icon={<Smartphone className="text-purple-300" />} iconBg="bg-purple-500/10" />
            <StatCard title="Salary reviews" value={String(DISCOVERY_COUNTS.payroll)} icon={<FileSearch className="text-emerald-300" />} iconBg="bg-emerald-500/10" />
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
            {VERIFICATION_STAGES.map((stage) => (
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

        <FilterRow>
          <Input value={q} onChange={setQ} placeholder="Search subject / source / actor / signal..." />
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
          <div className="text-slate-500 text-xs font-medium">Mostly read-only: verify the record, do not mutate it.</div>
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
          emptyLabel="No audit findings match this filter."
        />
      </PageScaffold>

      <Drawer
        open={Boolean(selected)}
        title={selected ? selected.subject : 'Finding'}
        subtitle={selected ? selected.source + ' | ' + selected.reference : undefined}
        onClose={() => setSelected(null)}
      >
        {selected && (
          <div className="space-y-4">
            <div className="glass-panel rounded-2xl border border-white/5 p-4">
              <p className="text-white text-sm font-bold">Finding summary</p>
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-slate-600">category</p>
                  <p className="text-slate-300">{categoryLabel(selected.category)}</p>
                </div>
                <div>
                  <p className="text-slate-600">status</p>
                  <p className="text-slate-300">{selected.status}</p>
                </div>
                <div>
                  <p className="text-slate-600">actor</p>
                  <p className="text-slate-300">{selected.actor}</p>
                </div>
                <div>
                  <p className="text-slate-600">created_at</p>
                  <p className="text-slate-300">{selected.created_at}</p>
                </div>
                <div>
                  <p className="text-slate-600">verifies</p>
                  <p className="text-slate-300">{selected.verifies}</p>
                </div>
                <div>
                  <p className="text-slate-600">signal</p>
                  <p className="text-slate-300">{selected.signal}</p>
                </div>
              </div>
            </div>

            <div className="glass-panel rounded-2xl border border-white/5 p-4">
              <p className="text-white text-sm font-bold">Notes</p>
              <div className="mt-3 space-y-2">
                {selected.notes.map((note, index) => (
                  <div key={index} className="rounded-xl bg-white/3 border border-white/10 px-3 py-2 text-xs text-slate-400">
                    {note}
                  </div>
                ))}
              </div>
            </div>

            {selected.before !== undefined || selected.after !== undefined ? (
              <>
                <div className="glass-panel rounded-2xl border border-white/5 p-4">
                  <p className="text-white text-sm font-bold">Before</p>
                  <pre className="mt-3 text-[11px] text-slate-400 whitespace-pre-wrap wrap-break-words bg-black/40 border border-white/5 rounded-xl p-3">
                    {JSON.stringify(selected.before ?? null, null, 2)}
                  </pre>
                </div>

                <div className="glass-panel rounded-2xl border border-white/5 p-4">
                  <p className="text-white text-sm font-bold">After</p>
                  <pre className="mt-3 text-[11px] text-slate-400 whitespace-pre-wrap wrap-break-words bg-black/40 border border-white/5 rounded-xl p-3">
                    {JSON.stringify(selected.after ?? null, null, 2)}
                  </pre>
                </div>
              </>
            ) : null}
          </div>
        )}
      </Drawer>
    </>
  );
}