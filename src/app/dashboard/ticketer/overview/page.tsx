"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Sigma, BriefcaseBusiness, Receipt, AlertTriangle, ArrowRight, RefreshCw, Smartphone, MapPin, Calendar } from "lucide-react";
import StatCard from "@/components/StatCard";
import { Badge } from "@/components/Badge";
import { PageScaffold } from "@/components/pageScaffold";
import { formatMoney } from "@/app/lib/utils";
import api from "@/app/lib/axios";
import type { DashboardMetrics } from "@/app/dashboard/layout";

interface PosSession {
  id: string;
  deviceId: string;
  deviceName: string;
  deviceSerial: string;
  posFloat: number;
  assignedAt: string;
  unassignedAt: string | null;
  assignedBy: string;
  status: "ACTIVE" | "CLOSED" | "RETURNED";
}

interface LocationAssignment {
  id: string;
  locationName: string;
  locationAddress: string;
  assignedFor: string;
}

interface TicketerOverviewProps {
  metrics: DashboardMetrics;
  onRefresh: () => Promise<void>;
  userId: string;
}

export default function TicketerOverview({ metrics, onRefresh, userId }: TicketerOverviewProps) {
  const [sessions, setSessions] = useState<PosSession[]>([]);
  const [locations, setLocations] = useState<LocationAssignment[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      setLoadingData(true);
      const res = await api.get("/ticketer/device");
      if (res.data?.success) {
        setSessions(res.data.sessions);
        setLocations(res.data.locations);
      }
    } catch (err) {
      console.error("Error loading ticketer device data:", err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    const loadData=async()=>{
        fetchData();
    }
    loadData();
  }, [userId]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([onRefresh(), fetchData()]);
    setIsRefreshing(false);
  };

  const activeSession = sessions.find((s) => s.status === "ACTIVE");
  const todayLocation = locations[0]; // Most recent assignment

  return (
    <PageScaffold
      title="Ticketer Dashboard"
      subtitle="Track your active shift, sales performance, and remittance expectations"
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
            title="Active Session Float"
            value={formatMoney(metrics.availableFloat)}
            icon={<BriefcaseBusiness className="text-cyan-400" />}
            iconBg="bg-cyan-500/10"
            subtitle="Current float carried on POS"
          />
          <StatCard
            title="My Sales Today"
            value={formatMoney(metrics.salesToday)}
            icon={<Receipt className="text-emerald-400" />}
            iconBg="bg-emerald-500/10"
            subtitle="Tickets sold in active shift"
          />
          <StatCard
            title="Expected Remittance"
            value={formatMoney(metrics.expectedRemittance ?? 0)}
            icon={<Sigma className="text-yellow-400" />}
            iconBg="bg-yellow-500/10"
            subtitle="Cash required to hand over"
          />
          <StatCard
            title="My Unpaid Fines"
            value={String(metrics.alertCount)}
            icon={<AlertTriangle className={metrics.alertCount > 0 ? "text-red-400" : "text-slate-400"} />}
            iconBg={metrics.alertCount > 0 ? "bg-red-500/10 animate-pulse" : "bg-white/5"}
            subtitle="Outstanding shortage penalties"
          />
        </div>
      }
    >
      {/* Shift & Device Status Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="premium-card lg:col-span-2 p-5 bg-slate-950/40 border border-white/5 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-sky-400" />
                <h3 className="text-white font-semibold text-sm sm:text-base">Assigned POS Hardware</h3>
              </div>
              {activeSession ? (
                <Badge variant="success" className="animate-pulse">Active Session</Badge>
              ) : (
                <Badge variant="neutral">No Active Session</Badge>
              )}
            </div>

            {activeSession ? (
              <div className="space-y-3.5">
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Device Name</p>
                    <p className="mt-1.5 text-white font-semibold text-sm">{activeSession.deviceName}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Serial Number</p>
                    <p className="mt-1.5 text-slate-300 font-mono text-sm">{activeSession.deviceSerial}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Assigned By</p>
                    <p className="mt-1.5 text-slate-300 text-sm">{activeSession.assignedBy}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Start Time</p>
                    <p className="mt-1.5 text-slate-300 text-sm">
                      {new Date(activeSession.assignedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-slate-500 text-xs">
                <AlertTriangle className="w-8 h-8 text-amber-500/60 mx-auto mb-2" />
                <span>You do not have an active POS session. Please contact your supervisor to assign a device.</span>
              </div>
            )}
          </div>
        </div>

        {/* Location Assignment Card */}
        <div className="premium-card p-5 bg-slate-950/40 border border-white/5 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-5 h-5 text-emerald-400" />
              <h3 className="text-white font-semibold text-sm sm:text-base">Target Work Location</h3>
            </div>
            {todayLocation ? (
              <div className="space-y-3 text-xs">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Location Name</p>
                  <p className="mt-1.5 text-white font-semibold text-sm">{todayLocation.locationName}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Address / Description</p>
                  <p className="mt-1.5 text-slate-400 text-sm leading-relaxed">{todayLocation.locationAddress}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Assigned Date</p>
                  <p className="mt-1.5 text-slate-300 text-sm">
                    {new Date(todayLocation.assignedFor).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-slate-500 text-xs">
                <MapPin className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <span>No specific location assignment found for today.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="mb-8">
        <h3 className="text-white font-semibold text-sm sm:text-base mb-3.5">Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/dashboard/ticketer/sales"
            className="premium-card p-4 bg-slate-950/40 border border-white/5 hover:border-emerald-500/30 hover:translate-y-[-2px] transition-all duration-300 rounded-2xl flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-all">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-white text-xs sm:text-sm font-semibold">Submit Sales Report</h4>
                <p className="premium-label text-[10px] mt-0.5">Log sales and closing balance</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-all" />
          </Link>

          <Link
            href="/dashboard/ticketer/remittances"
            className="premium-card p-4 bg-slate-950/40 border border-white/5 hover:border-cyan-500/30 hover:translate-y-[-2px] transition-all duration-300 rounded-2xl flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-all">
                <BriefcaseBusiness className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-white text-xs sm:text-sm font-semibold">Remit Shift Cash</h4>
                <p className="premium-label text-[10px] mt-0.5">Submit cash handover to supervisor</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition-all" />
          </Link>
        </div>
      </div>

      {/* Session History & Allocations */}
      {sessions.length > 0 && (
        <div>
          <div className="mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-sky-400" />
            <h3 className="text-white font-semibold text-base">Recent POS Session Logs</h3>
          </div>
          <div className="space-y-3">
            {sessions.slice(0, 5).map((s) => (
              <div
                key={s.id}
                className="premium-card p-4 bg-slate-950/20 border border-white/5 rounded-xl flex items-center justify-between text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-200">{s.deviceName}</span>
                    <span className="font-mono text-slate-500">{s.deviceSerial}</span>
                  </div>
                  <p className="text-slate-500 mt-1">
                    Assigned: {new Date(s.assignedAt).toLocaleString()}
                    {s.unassignedAt && ` • Closed: ${new Date(s.unassignedAt).toLocaleString()}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-300">Float: {formatMoney(s.posFloat)}</p>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                    s.status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                    s.status === "CLOSED" ? "bg-white/5 text-slate-400 border border-white/10" :
                                            "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                  }`}>
                    {s.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </PageScaffold>
  );
}
