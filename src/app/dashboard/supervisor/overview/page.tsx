"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Sigma, BriefcaseBusiness, Receipt, AlertTriangle, Users, ArrowRight, RefreshCw } from "lucide-react";
import StatCard from "@/components/StatCard";
import { DataTable, type ColumnDef } from "@/components/DataTable";
import { PageScaffold } from "@/components/pageScaffold";
import { formatMoney } from "@/app/lib/utils";
import api from "@/app/lib/axios";
import type { DashboardMetrics } from "@/app/dashboard/layout";


interface TeamMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
}

interface SupervisorOverviewProps {
  metrics: DashboardMetrics;
  onRefresh: () => Promise<void>;
  userId: string;
}

export default function SupervisorOverview({ metrics, onRefresh, userId }: SupervisorOverviewProps) {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(true);
  const [q, setQ] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mounted, setMounted] = useState(false);

  const fetchTeam = async () => {
       try {
      setLoadingTeam(true);
      const res = await api.get("/supervisor/user"); // 👈 Added 'await' here
      if (res.data?.success) {
        setTeam(res.data.data);
      }
    } catch (err) {
      console.error("Error loading team list:", err);
    } finally {
      setLoadingTeam(false); // 👈 Executes asynchronously after the API response
    }
  };


useEffect(() => {

  const loadTeam = async () => {
 fetchTeam();
}
  loadTeam();


}, [userId]);


  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([onRefresh(), fetchTeam()]);
    setIsRefreshing(false);
  };

  const columns: ColumnDef<TeamMember>[] = [
    {
      id: "name",
      header: "Name",
      cell: (r) => (
        <span className="text-white font-semibold text-xs">
          {r ? `${r.first_name} ${r.last_name}` : "---"}
        </span>
      ),
      sortValue: (r) => `${r.first_name} ${r.last_name}`,
    },
    {
      id: "email",
      header: "Email Address",
      cell: (r) => <span className="text-slate-400 font-mono text-xs">{r?.email}</span>,
    },
    {
      id: "role",
      header: "System Role",
      cell: (r) => (
        <span className="inline-flex items-center rounded-full bg-white/5 border border-white/10 px-2.5 py-0.5 text-[10px] font-bold text-slate-300 uppercase tracking-wider">
          {r?.role}
        </span>
      ),
      sortValue: (r) => r.role,
    },
    {
      id: "actions",
      header: "Quick View",
      cell: (r) => (
        r && (
          <Link
            href={`/dashboard/supervisor/sales`}
            className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-400 hover:text-sky-300 transition-all uppercase tracking-wider"
          >
            Sales Log <ArrowRight className="w-3 h-3" />
          </Link>
        )
      ),
    },
  ];

  return (
    <PageScaffold
      title="Supervisor Dashboard"
      subtitle="Overview of your assigned team, circulating float, and cash collections"
      right={
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-300 transition-all hover:bg-white/10 hover:text-white disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh Data
        </button>
      }
      kpis={
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Team Circulating Float"
            value={formatMoney(metrics.circulatingFloat ?? 0)}
            icon={<BriefcaseBusiness className="text-cyan-400" />}
            iconBg="bg-cyan-500/10"
            subtitle="Float held by your team's active POS"
          />
          <StatCard
            title="Team Sales Today"
            value={formatMoney(metrics.salesToday)}
            icon={<Receipt className="text-emerald-400" />}
            iconBg="bg-emerald-500/10"
            subtitle="Today's sales by your team"
          />
          <StatCard
            title="Held Cash (In Hand)"
            value={formatMoney(metrics.supervisorCash ?? 0)}
            icon={<Sigma className="text-yellow-400" />}
            iconBg="bg-yellow-500/10"
            subtitle="Accepted handovers in your custody"
          />
          <StatCard
            title="Team Fines & Handovers"
            value={String(metrics.alertCount)}
            icon={<AlertTriangle className={metrics.alertCount > 0 ? "text-red-400" : "text-slate-400"} />}
            iconBg={metrics.alertCount > 0 ? "bg-red-500/10 animate-pulse" : "bg-white/5"}
            subtitle="Team exceptions needing review"
          />
        </div>
      }
    >
      {/* Quick Navigation Cards */}
      <div className="mb-8">
        <h3 className="text-white font-semibold text-sm sm:text-base mb-3.5">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/dashboard/supervisor/float"
            className="premium-card p-4 bg-slate-950/40 border border-white/5 hover:border-cyan-500/30 hover:translate-y-[-2px] transition-all duration-300 rounded-2xl flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-all">
                <BriefcaseBusiness className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-white text-xs sm:text-sm font-semibold">Allocate Float</h4>
                <p className="premium-label text-[10px] mt-0.5">Top-up ticketer POS accounts</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition-all" />
          </Link>

          <Link
            href="/dashboard/supervisor/remittances"
            className="premium-card p-4 bg-slate-950/40 border border-white/5 hover:border-emerald-500/30 hover:translate-y-[-2px] transition-all duration-300 rounded-2xl flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-all">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-white text-xs sm:text-sm font-semibold">Verify Handovers</h4>
                <p className="premium-label text-[10px] mt-0.5">Confirm cash submissions</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-all" />
          </Link>

          <Link
            href="/dashboard/supervisor/fines"
            className="premium-card p-4 bg-slate-950/40 border border-white/5 hover:border-red-500/30 hover:translate-y-[-2px] transition-all duration-300 rounded-2xl flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 group-hover:scale-105 transition-all">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-white text-xs sm:text-sm font-semibold">Manage Fines</h4>
                <p className="premium-label text-[10px] mt-0.5">Track shortages & compliance</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-red-400 transition-all" />
          </Link>
        </div>
      </div>

      {/* Team List Table */}
      <div>
        <div className="mb-4 flex items-center gap-2">
          <Users className="w-4 h-4 text-sky-400" />
          <h3 className="text-white font-semibold text-base">Your Active Team ({team.length})</h3>
        </div>
        {loadingTeam ? (
          <div className="flex h-32 items-center justify-center">
            <div className="animate-spin rounded-full border-2 border-sky-400 border-t-transparent h-6 w-6" />
          </div>
        ) : (
          <DataTable
            rows={team}
            columns={columns}
            getRowId={(r) => r.id}
            searchValue={q}
            searchPredicate={(r, qq) =>
              r.first_name.toLowerCase().includes(qq) ||
              r.last_name.toLowerCase().includes(qq) ||
              r.email.toLowerCase().includes(qq)
            }
          />
        )}
      </div>
    </PageScaffold>
  );
}
