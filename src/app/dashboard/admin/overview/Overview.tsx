"use client";

import React, { useState, useEffect } from "react";
import { Sigma, BriefcaseBusiness, Receipt, AlertTriangle, CheckCircle, RefreshCw } from "lucide-react";
import StatCard from "@/components/StatCard";
import { Badge } from "@/components/Badge";
import { DataTable, type ColumnDef } from "@/components/DataTable";
import { PageScaffold } from "@/components/pageScaffold";
import { formatMoney } from "@/app/lib/utils";
import api from "@/app/lib/axios";
import dynamic from "next/dynamic";
import type { DashboardMetrics } from "@/app/dashboard/layout";

// Dynamic loading for the chart with skeleton fallbacks
const OverviewChart = dynamic(() => import("@/components/Piechart"), {
  ssr: false,
  loading: () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4 animate-pulse">
      <div className="premium-card p-4 lg:col-span-2 h-[380px] bg-slate-900/20 rounded-2xl" />
      <div className="premium-card p-4 h-[380px] bg-slate-900/20 rounded-2xl" />
    </div>
  ),
});

// Strict Typings
export interface ChartItem {
  name: string;
  sales: number;
  expected: number;
}

export interface PieChartItem {
  name: string;
  value: number;
}

export interface AuditReport {
  id: string;
  user_id: string;
  date: string;
  expected_float: number | string;
  actual_remittance: number | string;
  variance: number | string;
  status: "MATCHED" | "RESOLVED" | "VARIANCE" | "INVESTIGATING" | "PENDING";
  scope: "TICKETER" | "SUPERVISOR" | "ADMIN";
  generated_at: string;
  company_id: string;
}

export interface AuditRemittance {
  id: string;
  amount: number | string;
  status: "PENDING" | "CONFIRMED" | "REJECTED" | "CANCELLED" | "PENDING_SUPERVISOR_ACCEPTANCE" | "ACCEPTED_BY_SUPERVISOR" | "REJECTED_BY_SUPERVISOR" | "DEPOSITED";
}

interface AdminOverviewProps {
  metrics: DashboardMetrics;
  onRefresh: () => Promise<void>;
}

export default function AdminOverview({ metrics, onRefresh }: AdminOverviewProps) {
  const [q, setQ] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  const [auditLogs, setAuditLogs] = useState<AuditReport[]>([]);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(true);
  const [chartRemittanceData, setChartRemittanceData] = useState<PieChartItem[] | undefined>(undefined);

  // Fetch real audit trail reports and map details
  const fetchAuditLogs = async (): Promise<void> => {
    try {
      setLoadingLogs(true);
      const res = await api.get("/admin/audit");
      if (res.data?.success && res.data?.data) {
        const reports: AuditReport[] = res.data.data.reconciliationReports || [];
        setAuditLogs(reports);

        // Process remittance data with type safety (zero 'any')
        const remittancesList: AuditRemittance[] = res.data.data.remittances || [];
        
        const matched = remittancesList
          .filter((r: AuditRemittance) => r.status === "CONFIRMED" || r.status === "DEPOSITED")
          .reduce((sum: number, r: AuditRemittance) => sum + Number(r.amount), 0);
          
        const pending = remittancesList
          .filter((r: AuditRemittance) => r.status === "PENDING" || r.status === "PENDING_SUPERVISOR_ACCEPTANCE")
          .reduce((sum: number, r: AuditRemittance) => sum + Number(r.amount), 0);
          
        const investigating = remittancesList
          .filter((r: AuditRemittance) => r.status === "REJECTED" || r.status === "REJECTED_BY_SUPERVISOR")
          .reduce((sum: number, r: AuditRemittance) => sum + Number(r.amount), 0);

        setChartRemittanceData([
          { name: "Matched", value: matched },
          { name: "Pending", value: pending },
          { name: "Investigating", value: investigating },
          { name: "Variance", value: Number(metrics.alertCount) * 1000 },
        ]);
      }
    } catch (err) {
      console.error("Error loading reconciliation reports:", err);
    } finally {
      setLoadingLogs(false);
    }
  };

  // Run on mount in a callback structure
  useEffect(() => {
    const loadInitialData = async () => {
      await fetchAuditLogs();
      setMounted(true);
    };
    loadInitialData();
  }, []);

  const handleRefresh = async (): Promise<void> => {
    setIsRefreshing(true);
    await Promise.all([onRefresh(), fetchAuditLogs()]);
    setIsRefreshing(false);
  };

  const columns: ColumnDef<AuditReport>[] = [
    {
      id: "role",
      header: "Audit Scope",
      cell: (r) => <span className="text-slate-300 text-xs font-bold">{r?.scope}</span>,
      sortValue: (r) => r.scope,
    },
    {
      id: "expected_float",
      header: "Expected Float",
      cell: (r) => (
        <span className="text-slate-500 font-mono text-xs">
          {r && formatMoney(Number(r.expected_float))}
        </span>
      ),
    },
    {
      id: "actual_remittance",
      header: "Actual Remittance",
      cell: (r) => (
        <span className="text-slate-500 font-mono text-xs">
          {r && formatMoney(Number(r.actual_remittance))}
        </span>
      ),
      sortValue: (r) => Number(r.actual_remittance),
    },
    {
      id: "variance",
      header: "Variance",
      cell: (r) => {
        if (!r) return null;
        const varianceVal = Number(r.variance);
        return (
          <span
            className={`text-xs font-bold font-mono ${
              varianceVal === 0 ? "text-slate-400" : varianceVal < 0 ? "text-red-300" : "text-emerald-300"
            }`}
          >
            {varianceVal === 0 ? "---" : formatMoney(varianceVal)}
          </span>
        );
      },
      sortValue: (r) => Number(r.variance),
    },
    {
      id: "actor",
      header: "Audited Entity ID",
      cell: (r) => <span className="text-slate-400 font-mono text-xs">{r?.user_id}</span>,
      sortValue: (r) => r?.user_id || "",
    },
    {
      id: "date",
      header: "Execution Date",
      cell: (r) => (
        <span className="text-slate-400 text-xs">
          {r ? new Date(r.generated_at).toLocaleDateString() : "---"}
        </span>
      ),
      sortValue: (r) => r.generated_at,
    },
  ];

  const reconciliation = metrics.ledgerReconciliation;

  // Hydration safety: do not render markup before client-side hydration is complete
  if (!mounted) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="animate-spin rounded-full border-2 border-sky-400 border-t-transparent h-8 w-8" />
      </div>
    );
  }

  return (
    <PageScaffold
      title="Company Finance Overview"
      subtitle="Comprehensive view of all float accounts, sales, and system reconciliations"
      right={
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-300 transition-all hover:bg-white/10 hover:text-white disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh Metrics
        </button>
      }
      kpis={
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <StatCard
            title="Company Float Account"
            value={formatMoney(metrics.availableFloat)}
            icon={<BriefcaseBusiness className="text-cyan-400" />}
            iconBg="bg-cyan-500/10"
            subtitle="Available balance in treasury"
          />
          <StatCard
            title="Today's Sales"
            value={formatMoney(metrics.salesToday)}
            icon={<Receipt className="text-emerald-400" />}
            iconBg="bg-emerald-500/10"
            subtitle="Total ticket sales today"
          />
          <StatCard
            title="Circulating POS Float"
            value={formatMoney(metrics.circulatingFloat ?? 0)}
            icon={<BriefcaseBusiness className="text-orange-400" />}
            iconBg="bg-orange-500/10"
            subtitle="Held by POS devices"
          />
          <StatCard
            title="Supervisor Held Cash"
            value={formatMoney(metrics.supervisorCash ?? 0)}
            icon={<Sigma className="text-yellow-400" />}
            iconBg="bg-yellow-500/10"
            subtitle="Collected from ticketers"
          />
          <StatCard
            title="Active Fines & Shortages"
            value={String(metrics.alertCount)}
            icon={<AlertTriangle className={metrics.alertCount > 0 ? "text-red-400" : "text-slate-400"} />}
            iconBg={metrics.alertCount > 0 ? "bg-red-500/10 animate-pulse" : "bg-white/5"}
            subtitle="Unresolved exceptions"
          />
        </div>
      }
    >
      {/* Ledger Reconciliation Card */}
      {reconciliation && (
        <div className="premium-card p-5 bg-slate-950/40 border border-white/5 rounded-2xl mb-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-white font-semibold text-sm sm:text-base">Ledger Integrity Status</h3>
                {reconciliation.isInSync ? (
                  <Badge variant="success" className="gap-1 flex items-center">
                    <CheckCircle className="w-2.5 h-2.5" /> Balanced
                  </Badge>
                ) : (
                  <Badge variant="danger" className="gap-1 flex items-center animate-pulse">
                    <AlertTriangle className="w-2.5 h-2.5" /> Drift Detected
                  </Badge>
                )}
              </div>
              <p className="premium-label mt-1">
                Compares historical ledger entries against computed account balances.
              </p>
            </div>
            {!reconciliation.isInSync && (
              <div className="flex items-center gap-2 text-xs bg-red-500/10 text-red-300 px-3 py-1.5 rounded-xl border border-red-500/20">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Discrepancy of {formatMoney(reconciliation.drift)} between ledger and cash accounts.</span>
              </div>
            )}
          </div>

          <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="rounded-xl border border-white/5 bg-white/3 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Total Credits</p>
              <p className="mt-1 text-slate-200 font-mono font-bold text-sm">{formatMoney(reconciliation.totalCredits)}</p>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/3 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Total Debits</p>
              <p className="mt-1 text-slate-200 font-mono font-bold text-sm">{formatMoney(reconciliation.totalDebits)}</p>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/3 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Computed Balance</p>
              <p className="mt-1 text-slate-200 font-mono font-bold text-sm">{formatMoney(reconciliation.computedBalance)}</p>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/3 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">System Drift</p>
              <p className={`mt-1 font-mono font-bold text-sm ${reconciliation.drift === 0 ? "text-slate-400" : "text-red-400"}`}>
                {formatMoney(reconciliation.drift)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Charts with dynamic data passed */}
      <OverviewChart remittanceData={chartRemittanceData} />

      {/* Reconciliation Audits List */}
      <div className="mt-6">
        <div className="mb-4">
          <h3 className="text-white font-semibold text-base">Reconciliation Audit Trail</h3>
          <p className="premium-label mt-0.5">Historical verification runs and variance tracking</p>
        </div>
        <DataTable
          rows={auditLogs}
          columns={columns}
          getRowId={(r) => r.id}
          searchValue={q}
          searchPredicate={(r, qq) =>
            r.id.toLowerCase().includes(qq) ||
            r.user_id.toLowerCase().includes(qq) ||
            r.scope.toLowerCase().includes(qq)
          }
        />
      </div>
    </PageScaffold>
  );
}
