// src/app/dashboard/SalesPage.tsx
"use client";

import React, { useMemo, useState, useEffect } from "react";
import {
  ArrowUpRight,
  Banknote,
  CircleDollarSign,
  Layers3,
  CheckCircle2,
  XCircle,
  RotateCcw,
  AlertTriangle,
  RefreshCw,
  Trash2
} from "lucide-react";
import { Badge } from "@/components/Badge";
import { DataTable, type ColumnDef } from "@/components/DataTable";
import { Drawer } from "@/components/Drawer";
import { FilterRow, Input, PageScaffold } from "@/components/pageScaffold";
import { ResponsiveDrawerShell } from "@/components/ResponsiveDrawerShell";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatMoney } from "@/app/lib/utils";
import type { DashboardRoleUsers, Sales_Record, Ticketer_Location_Assignment } from "@/app/types/types";
import { PosDeviceSession } from "./PosDevicesPage";

type SalesView = "LATEST" | "TOP" | "BALANCED";

type SalesPageProps = {
  role?: DashboardRoleUsers;
  records?: Sales_Record[];
};

const ROLE_COPY: Record<
  DashboardRoleUsers,
  {
    badge: string;
    description: string;
    accent: string;
    glow: string;
  }
> = {
  ADMIN: {
    badge: "Company view",
    description: "Track sales volume, float coverage, and the sessions moving the most money across the estate.",
    accent: "from-amber-500/20 to-orange-500/10",
    glow: "bg-amber-400/20",
  },
  SUPERVISOR: {
    badge: "Team view",
    description: "Monitor team sales pace, session health, and the reports that need attention first.",
    accent: "from-sky-500/20 to-cyan-500/10",
    glow: "bg-sky-400/20",
  },
  TICKETER: {
    badge: "Personal view",
    description: "Review your own sales trail, remaining float, and recent report submissions at a glance.",
    accent: "from-emerald-500/20 to-teal-500/10",
    glow: "bg-emerald-400/20",
  },
  AUDITOR: {
    badge: "Audit view",
    description: "Cross-check sales reports, session totals, and balance movement in a read-only review surface.",
    accent: "from-slate-400/20 to-slate-600/10",
    glow: "bg-slate-300/20",
  },
};

const VIEW_OPTIONS: { value: SalesView; label: string }[] = [
  { value: "LATEST", label: "Latest" },
  { value: "TOP", label: "Top sales" },
  { value: "BALANCED", label: "Balanced" },
];

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString("en-NG", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function CompactMetric({
  title,
  value,
  note,
  icon,
  accentClass,
}: {
  title: string;
  value: string;
  note?: string;
  icon: React.ReactNode;
  accentClass: string;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 sm:p-4 shadow-sm shadow-black/20">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
            {title}
          </p>
          <p className="mt-1 truncate font-mono text-lg font-bold tracking-tight text-white sm:text-2xl">
            {value}
          </p>
          {note && <p className="mt-1 text-[10px] text-slate-500">{note}</p>}
        </div>
        <div className={`flex size-9 shrink-0 items-center justify-center rounded-2xl border border-white/10 ${accentClass}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function TrendChart({
  data,
  accentClass,
  summary,
}: {
  data: { label: string; sales: number }[];
  accentClass: string;
  summary: {
    totalTopUps: number;
    totalClosing: number;
    recordCount: number;
  };
}) {
  const maxValue = Math.max(...data.map((item) => item.sales), 1);

  return (
    <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="premium-label">Sales rhythm</p>
          <h3 className="mt-1 text-base font-bold text-white sm:text-lg">
            Weekly pacing
          </h3>
        </div>
        <Badge variant="info">Built-in data</Badge>
      </div>

      <div className="mt-5 grid grid-cols-7 gap-2 sm:gap-3">
        {data.map((point) => {
          const height = Math.max(16, (point.sales / maxValue) * 100);

          return (
            <div key={point.label} className="min-w-0">
              <div className="flex h-36 items-end rounded-2xl border border-white/5 bg-black/20 p-1.5 sm:h-44 sm:p-2">
                <div
                  className={`w-full rounded-2xl bg-linear-to-t ${accentClass} shadow-lg shadow-black/20`}
                  style={{ height: `${height}%` }}
                />
              </div>
              <p className="mt-2 truncate text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {point.label}
              </p>
              <p className="mt-1 truncate text-center font-mono text-[10px] text-slate-300 sm:text-xs">
                {formatMoney(point.sales)}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/5 bg-black/20 p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
            Total top up
          </p>
          <p className="mt-1 text-sm font-semibold text-white">
            {formatMoney(summary.totalTopUps||0)}
          </p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-black/20 p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
            Closing float
          </p>
          <p className="mt-1 text-sm font-semibold text-white">
            {formatMoney(summary.totalClosing||0)}
          </p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-black/20 p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
            Reports in view
          </p>
          <p className="mt-1 text-sm font-semibold text-white">
            {summary.recordCount}
          </p>
        </div>
      </div>
    </div>
  );
}

function PerformerList({
  items,
}: {
  items: {
    name: string;
    total: number;
    records: number;
    share: number;
  }[];
}) {
  return (
    <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="premium-label">Top performers</p>
          <h3 className="mt-1 text-base font-bold text-white sm:text-lg">
            Who is carrying volume
          </h3>
        </div>
        <Badge variant="success">{items.length} ticketers</Badge>
      </div>

      <div className="mt-4 space-y-3">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-slate-500">
            No matching ticketers yet. Clear the search to see the full ranking.
          </div>
        ) : (
          items.map((item, index) => (
            <div key={item.name} className="rounded-2xl border border-white/5 bg-black/20 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">
                    {item.name}
                  </p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                    {item.records} report{item.records === 1 ? "" : "s"}
                  </p>
                </div>
                <Badge variant={index === 0 ? "success" : "info"}>
                  {item.share.toFixed(0)}%
                </Badge>
              </div>

              <div className="mt-3 h-1.5 rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-linear-to-r from-emerald-400 via-cyan-400 to-sky-400"
                  style={{ width: `${Math.min(100, item.share)}%` }}
                />
              </div>

              <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500">
                <span>{formatMoney(item.total||0)}</span>
                <span>{item.share.toFixed(1)}% of visible sales</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function balanceTone(value: number) {
  if (value > 0) return "success";
  if (value < 0) return "warning";
  return "info";
}

export default function SalesPage({
  role = "TICKETER",
  records,
}: SalesPageProps) {

  const [salesRecords, setSalesRecords] = useState<Sales_Record[]>(records ?? []);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<SalesView>("LATEST");
  const [selected, setSelected] = useState<Sales_Record | null>(null);
  const [openForm, setOpenForm] = useState(false);
  // State for result limit (defaults to 10 records when filtering)
const [limit, setLimit] = useState<number | null>(10);



  // API loading states
  const [isLoading, setIsLoading] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [ticketers, setTicketers] = useState<{ id: string; first_name: string; last_name: string; email: string }[]>([]);

  // Action form states
  const [handoverId, setHandoverId] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectionForm, setShowRejectionForm] = useState(false);

  // Trigger state to safely refresh data without cascading render risks
  const [refreshKey, setRefreshKey] = useState(0);

  const roleCopy = ROLE_COPY[role];

  // Effect to fetch real records when records prop is not provided
  useEffect(() => {
    if (records) {
      return; // Use records prop, avoiding cascading renders
    }

    let active = true;
    async function loadSales() {
      setIsLoading(true);
      try {
        const res = await fetch("/api/sales");
        const json = await res.json();
        if (active && json.success) {
          setSalesRecords(json.reports || []);
        }
      } catch (e) {
        console.error("Failed to load real sales records:", e);
      } finally {
        if (active) setIsLoading(false);
      }
    }

    loadSales();

    return () => {
      active = false;
    };
  }, [records, refreshKey]);

  // Effect to fetch company ticketers for handover selector
  useEffect(() => {
    if (role !== "ADMIN" && role !== "SUPERVISOR") return;

    let active = true;
    async function loadTicketers() {
      try {
        const endpoint = role === "ADMIN" ? "/api/admin/user?role=TICKETER" : "/api/supervisor/user";
        const res = await fetch(endpoint);
        const json = await res.json();
        if (active && json.success) {
          setTicketers(json.data || []);
        }
      } catch (e) {
        console.error("Failed to load ticketers:", e);
      }
    }

    loadTicketers();

    return () => {
      active = false;
    };
  }, [role, refreshKey]);

  // Handover & verification submit
  const handleVerify = async (reportId: string) => {
    setIsActionLoading(true);
    setActionError("");
    try {
      const res = await fetch(`/api/sales/${reportId}/verify`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "VERIFIED",
          handoverToTicketerId: handoverId || undefined
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSelected(null);
        setHandoverId("");
        setRefreshKey((prev) => prev + 1);
      } else {
        setActionError(data.error || "Failed to verify report");
      }
    } catch (e) {
      setActionError("Network error. Failed to verify report.");
    } finally {
      setIsActionLoading(false);
    }
  };

  // Reject submit
  const handleReject = async (reportId: string) => {
    if (!rejectionReason.trim()) {
      setActionError("Please provide a reason for rejection");
      return;
    }
    setIsActionLoading(true);
    setActionError("");
    try {
      const res = await fetch(`/api/sales/${reportId}/verify`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "REJECTED",
          rejectionReason
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSelected(null);
        setRejectionReason("");
        setShowRejectionForm(false);
        setRefreshKey((prev) => prev + 1);
      } else {
        setActionError(data.error || "Failed to reject report");
      }
    } catch (e) {
      setActionError("Network error. Failed to reject report.");
    } finally {
      setIsActionLoading(false);
    }
  };

  // Revert verify submit
  const handleRevert = async (reportId: string) => {
    setIsActionLoading(true);
    setActionError("");
    try {
      const res = await fetch(`/api/sales/${reportId}/verify`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "PENDING"
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSelected(null);
        setRefreshKey((prev) => prev + 1);
      } else {
        setActionError(data.error || "Failed to revert report");
      }
    } catch (e) {
      setActionError("Network error. Failed to revert report.");
    } finally {
      setIsActionLoading(false);
    }
  };

  // Cancel report submit
  const handleCancel = async (reportId: string) => {
    setIsActionLoading(true);
    setActionError("");
    try {
      const res = await fetch(`/api/sales/${reportId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSelected(null);
        setRefreshKey((prev) => prev + 1);
      } else {
        setActionError(data.error || "Failed to cancel report");
      }
    } catch (e) {
      setActionError("Network error. Failed to cancel report.");
    } finally {
      setIsActionLoading(false);
    }
  };

const visibleRecords = useMemo(() => {
  const query = search.trim().toLowerCase();

  // Fallback to local salesRecords
  const activeData = records ?? salesRecords;

  const filtered = activeData.filter((record) => {
    if (!query) return true;

    return [
      record.id,
      record.ticketer_id,
      record.user_name,
      record.pos_session_id,
      record.location_id,
      record.report_date,
      record.submitted_at,
      String(record.opening_balance),
      String(record.top_up),
      String(record.total_sold),
      String(record.closing_balance),
      record.status || "PENDING",
    ].some((value) => value.toLowerCase().includes(query));
  });

  const sorted = [...filtered];

  if (view === "TOP") {
    sorted.sort((left, right) => right.total_sold - left.total_sold);
  } else if (view === "BALANCED") {
    sorted.sort(
      (left, right) =>
        Math.abs(left.top_up - left.total_sold) - Math.abs(right.top_up - right.total_sold)
    );
  } else {
    sorted.sort(
      (left, right) =>
        new Date(right.submitted_at).getTime() - new Date(left.submitted_at).getTime()
    );
  }

  // Apply limit ONLY when searching/filtering and limit is set
  if (query && limit !== null) {
    return sorted.slice(0, limit);
  }

  return sorted;
}, [records, salesRecords, search, view, limit]);


  

  const totals = useMemo(() => {
    const recordCount = visibleRecords.length;
    
    // Exclude rejected/cancelled reports from financial sums
    const validRecords = visibleRecords.filter(
      (r) => r.status !== "REJECTED" && r.status !== "CANCELLED"
    );

    const totalSales = validRecords.reduce((sum, record) => sum + record.total_sold, 0);
    const totalTopUps = validRecords.reduce((sum, record) => sum + record.top_up, 0);
    const totalOpening = validRecords.reduce((sum, record) => sum + record.opening_balance, 0);
    const totalClosing = validRecords.reduce((sum, record) => sum + record.closing_balance, 0);
    
    const averageTicket = recordCount ? totalSales / recordCount : 0;
    const coverage = totalTopUps ? (totalSales / totalTopUps) * 100 : 0;
    const gap = totalTopUps - totalSales;
    const ticketerCount = new Set(visibleRecords.map((record) => record.user_name)).size;
    const highestReport = [...validRecords].sort((left, right) => right.total_sold - left.total_sold)[0];

    return {
      recordCount,
      totalSales,
      totalTopUps,
      totalOpening,
      totalClosing,
      averageTicket,
      overrideHighestReport: highestReport, // Use only valid reports for highest report metric
      coverage,
      gap,
      ticketerCount,
      highestReport,
    };
  }, [visibleRecords]);

  const performers = useMemo(() => {
    const aggregate = new Map<string, { name: string; total: number; records: number }>();
    
    // Exclude rejected/cancelled reports from performer volume
    const validRecords = visibleRecords.filter(
      (r) => r.status !== "REJECTED" && r.status !== "CANCELLED"
    );

    for (const record of validRecords) {
      const current = aggregate.get(record.user_name);
      if (current) {
        current.total += record.total_sold;
        current.records += 1;
      } else {
        aggregate.set(record.user_name, {
          name: record.user_name,
          total: record.total_sold,
          records: 1,
        });
      }
    }

    return [...aggregate.values()]
      .sort((left, right) => right.total - left.total)
      .map((item) => ({
        ...item,
        share: totals.totalSales ? (item.total / totals.totalSales) * 100 : 0,
      }));
  }, [totals, visibleRecords]);

   const trendData = useMemo(() => {
    const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const dailySums = [0, 0, 0, 0, 0, 0, 0]; // Index: 0=Mon, 1=Tue, ..., 6=Sun

    const validRecords = visibleRecords.filter(
      (r) => r.status !== "REJECTED" && r.status !== "CANCELLED"
    );

    for (const record of validRecords) {
      if (!record.submitted_at) continue;
      const date = new Date(record.submitted_at);
      // JS day index: 0 is Sunday, 1 is Monday, ..., 6 is Saturday
      const jsDay = date.getDay();
      // Map JS day to our labels: 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
      const labelIndex = jsDay === 0 ? 6 : jsDay - 1;
      dailySums[labelIndex] += record.total_sold || 0;
    }

    return labels.map((label, index) => ({
      label,
      sales: dailySums[index],
    }));
  }, [visibleRecords]);


  const columns: ColumnDef<Sales_Record>[] = [
    {
      id: "submitted_at",
      header: "submitted",
      cell: (record) => (
        <span className="text-slate-200 text-xs font-semibold">
          {record ? formatShortDate(record.submitted_at) : ""}
        </span>
      ),
      sortValue: (record) => new Date(record.submitted_at).getTime(),
    },
    {
      id: "user_name",
      header: "ticketer",
      cell: (record) => (
        <span className="text-slate-300 text-xs font-semibold">
          {record?.user_name}
        </span>
      ),
      sortValue: (record) => record.user_name,
    },
    {
      id: "pos_session_id",
      header: "session",
      cell: (record) => (
        <span className="font-mono text-xs text-slate-400">
          {record?.pos_session_id}
        </span>
      ),
      sortValue: (record) => record.pos_session_id,
    },
    {
      id: "location_id",
      header: "location",
      cell: (record) => (
        <span className="font-mono text-xs text-slate-500">
          {record?.location_id}
        </span>
      ),
      sortValue: (record) => record.location_id,
    },
    {
      id: "opening_balance",
      header: "opening",
      align: "right",
      cell: (record) => (
        <span className="font-mono text-xs text-slate-300">
          {record ? formatMoney(record.opening_balance) : ""}
        </span>
      ),
      sortValue: (record) => record.opening_balance,
    },
    {
      id: "top_up",
      header: "top up",
      align: "right",
      cell: (record) => (
        <span className="font-mono text-xs text-sky-300">
          {record ? formatMoney(record.top_up) : ""}
        </span>
      ),
      sortValue: (record) => record.top_up,
    },
    {
      id: "total_sold",
      header: "sales",
      align: "right",
      cell: (record) => (
        <span className="font-mono text-xs font-bold text-white">
          {record ? formatMoney(record.total_sold) : ""}
        </span>
      ),
      sortValue: (record) => record.total_sold,
    },
    {
      id: "closing_balance",
      header: "closing",
      align: "right",
      cell: (record) => (
        <span className="font-mono text-xs text-emerald-300">
          {record ? formatMoney(record.closing_balance) : ""}
        </span>
      ),
      sortValue: (record) => record.closing_balance,
    },
    {
      id: "status",
      header: "status",
      cell: (record) => {
        if (!record) return null;
        const recordStatus = record.status || "PENDING";
        const statusVariants: Record<string, "warning" | "success" | "danger" | "neutral"> = {
          PENDING: "warning",
          VERIFIED: "success",
          REJECTED: "danger",
          CANCELLED: "neutral"
        };
        return (
          <Badge variant={statusVariants[recordStatus] ?? "neutral"}>
            {recordStatus}
          </Badge>
        );
      },
      sortValue: (record) => record.status || "PENDING",
    }
  ];

  return (
    <>
      <PageScaffold
        title="Sales"
        subtitle={roleCopy.description}
        right={
          <div className="flex items-center gap-3">
            {role === "TICKETER" && (
              <button
                type="button"
                onClick={() => setOpenForm(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest text-emerald-400 hover:bg-emerald-500/20 transition-colors"
              >
                Submit report
              </button>
            )}
            <div className="inline-flex rounded-full border border-white/10 bg-white/3 p-1 shadow-sm shadow-black/20">
              {VIEW_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setView(option.value)}
                  className={`rounded-full px-3 py-2 text-[10px] font-bold uppercase tracking-[0.22em] transition-colors ${view === option.value
                    ? "bg-white/10 text-white"
                    : "text-slate-500 hover:text-slate-200"
                    }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        }

        kpis={
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <CompactMetric
              title="Gross Sales"
              value={formatMoney(totals.totalSales||0)}
              note={`${totals.recordCount} visible report${totals.recordCount === 1 ? "" : "s"}`}
              icon={<Banknote className="size-4 text-emerald-300" strokeWidth={1.6} />}
              accentClass="bg-emerald-500/10"
            />
            <CompactMetric
              title="Float Coverage"
              value={`${totals.coverage.toFixed(1)}%`}
              note={`Gap ${formatMoney(totals.gap||0)}`}
              icon={<ArrowUpRight className="size-4 text-amber-300" strokeWidth={1.6} />}
              accentClass="bg-amber-500/10"
            />
            <CompactMetric
              title="Closing Float"
              value={formatMoney(totals.totalClosing||0)}
              note={`Opening base ${formatMoney(totals.totalOpening||0)}`}
              icon={<Layers3 className="size-4 text-purple-300" strokeWidth={1.6} />}
              accentClass="bg-purple-500/10"
            />
          </div>
        }
      >
        <section className="grid gap-4 xl:grid-cols-[1.25fr_.85fr]">
          <TrendChart
            data={trendData}
            accentClass={ROLE_COPY[role].accent}
            summary={{
              totalTopUps: totals.totalTopUps,
              totalClosing: totals.totalClosing,
              recordCount: totals.recordCount,
            }}
          />

          <PerformerList items={performers.slice(0, 4)} />
        </section>

      <FilterRow>
  <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
    <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:max-w-xl">
      <div className="w-full">
        <Input
          value={search}
          onChange={setSearch}
          placeholder="Search report, ticketer, session, location..."
        />
      </div>

      {/* Limit controls - ONLY visible when actively searching/filtering */}
      {search.trim() !== "" && (
        <div className="flex shrink-0 items-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.03] p-1.5 backdrop-blur-md animate-in fade-in slide-in-from-left-2 duration-200">
          <span className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Limit:
          </span>
          {([10, 25, 50, null] as const).map((opt) => {
            const isSelected = limit === opt;
            const label = opt === null ? "All" : String(opt);
            return (
              <button
                key={label}
                type="button"
                onClick={() => setLimit(opt)}
                className={`rounded-xl px-2.5 py-1 text-[11px] font-bold transition-all ${
                  isSelected
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
    </div>

    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-black/20 px-3 py-2">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
          Visible reports
        </p>
        <p className="mt-1 text-sm font-semibold text-white">
          {visibleRecords.length}
        </p>
      </div>
      <Badge variant={balanceTone(totals.gap)}>
        {roleCopy.badge}
      </Badge>
    </div>
  </div>
</FilterRow>


        {isLoading && salesRecords.length === 0 ? (
          <div className="flex h-64 items-center justify-center">
            <RefreshCw className="size-8 animate-spin text-slate-500" />
          </div>
        ) : (
          <DataTable
            rows={visibleRecords}
            columns={columns}
            getRowId={(record) => record.id}
            onRowClick={(record) => {
              setActionError("");
              setShowRejectionForm(false);
              setRejectionReason("");
              setHandoverId("");
              setSelected(record);
            }}
          />
        )}
      </PageScaffold>

      <Drawer
        open={Boolean(selected)}
        title={selected ? `Report ${selected.id.slice(0, 8)}` : "Sales report"}
        subtitle={
          selected
            ? `${selected.user_name} • ${formatDateTime(selected.submitted_at)}`
            : undefined
        }
        onClose={() => setSelected(null)}
      >
        {selected && (
          <ResponsiveDrawerShell
            title={selected.user_name}
            subtitle={`${selected.location_id} • ${selected.pos_session_id}`}
            badge={
              <Badge variant={
                selected.status === "VERIFIED" ? "success" :
                  selected.status === "REJECTED" ? "danger" :
                    selected.status === "CANCELLED" ? "neutral" : "warning"
              }>
                {selected.status || "PENDING"}
              </Badge>
            }
            stats={[
              { label: "Sales", value: formatMoney(selected.total_sold||0), tone: "success" },
              { label: "Top up", value: formatMoney(selected.top_up||0), tone: "info" },
              { label: "Opening", value: formatMoney(selected.opening_balance||0), tone: "default" },
              {
                label: "Closing",
                value: formatMoney(selected.closing_balance||0),
                tone: (selected.closing_balance||0) > 0 ? "success" : "warning",
              },
            ]}
            fields={[
              { label: "Report ID", value: selected.id },
              { label: "Ticketer", value: selected.user_name },
              { label: "Ticketer ID", value: selected.ticketer_id },
              { label: "POS Session", value: selected.pos_session_id },
              { label: "Location", value: selected.location_id },
              { label: "Report Date", value: formatDateTime(selected.report_date) },
              { label: "Submitted At", value: formatDateTime(selected.submitted_at) },
              {
                label: "Float Gap",
                value: formatMoney((selected.top_up||0) - (selected.total_sold||0)),
              },
            ]}
            sections={[
              {
                title: "Balance story",
                content: (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-2xl border border-white/5 bg-black/20 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
                        Opening
                      </p>
                      <p className="mt-1 text-sm font-semibold text-white">
                        {formatMoney(selected.opening_balance||0)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/5 bg-black/20 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
                        Top up
                      </p>
                      <p className="mt-1 text-sm font-semibold text-sky-300">
                        {formatMoney(selected.top_up||0)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/5 bg-black/20 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
                        Sold
                      </p>
                      <p className="mt-1 text-sm font-semibold text-emerald-300">
                        {formatMoney(selected.total_sold||0)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/5 bg-black/20 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
                        Closing
                      </p>
                      <p className="mt-1 text-sm font-semibold text-white">
                        {formatMoney(selected.closing_balance||0)}
                      </p>
                    </div>
                  </div>
                ),
              },
              // 💡 DYNAMIC ACTION CONSOLE SECTION
              {
                title: "Action console",
                content: (
                  <div className="space-y-4">
                    {actionError && (
                      <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-200">
                        <AlertTriangle className="size-4 shrink-0" />
                        <span>{actionError}</span>
                      </div>
                    )}

                    {/* SUPERVISOR & ADMIN ACTION BOARD */}
                    {(role === "SUPERVISOR" || role === "ADMIN") && (
                      <>
                        {(selected.status === "PENDING" || !selected.status) && (
                          <div className="space-y-4">
                            {/* Handover Ticketer Field */}
                            <div className="rounded-2xl border border-white/5 bg-black/40 p-3">
                              <label className="block text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
                                Hand over POS to Ticketer after verification (Optional)
                              </label>
                              <select
                                value={handoverId}
                                onChange={(e) => setHandoverId(e.target.value)}
                                className="mt-2 w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2 font-sans text-xs text-white outline-none focus:border-white/20"
                              >
                                <option value="">No Handover (Return Device to Pool)</option>
                                {ticketers.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.first_name} {t.last_name} ({t.email})
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Verification Form Actions */}
                            {!showRejectionForm ? (
                              <div className="flex items-center gap-3">
                                <Button
                                  variant="default"
                                  onClick={() => handleVerify(selected.id)}
                                  disabled={isActionLoading}
                                  className="flex-1 bg-emerald-600 font-bold uppercase tracking-wider text-white hover:bg-emerald-700"
                                >
                                  <CheckCircle2 className="mr-1.5 size-4" />
                                  Verify Report
                                </Button>
                                <Button
                                  variant="destructive"
                                  onClick={() => setShowRejectionForm(true)}
                                  disabled={isActionLoading}
                                  className="flex-1 font-bold uppercase tracking-wider text-red-400"
                                >
                                  <XCircle className="mr-1.5 size-4" />
                                  Reject Report
                                </Button>
                              </div>
                            ) : (
                              <div className="space-y-3 rounded-2xl border border-white/5 bg-black/40 p-3">
                                <label className="block text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
                                  Rejection Reason
                                </label>
                                <textarea
                                  value={rejectionReason}
                                  onChange={(e) => setRejectionReason(e.target.value)}
                                  placeholder="Specify why you are rejecting this sales report..."
                                  rows={3}
                                  className="w-full rounded-lg border border-white/10 bg-black/60 p-2 text-xs text-white outline-none focus:border-white/20"
                                />
                                <div className="flex items-center gap-3">
                                  <Button
                                    variant="default"
                                    onClick={() => handleReject(selected.id)}
                                    disabled={isActionLoading}
                                    className="flex-1 bg-red-600 font-bold uppercase tracking-wider text-white hover:bg-red-700"
                                  >
                                    Submit Rejection
                                  </Button>
                                  <Button
                                    variant="outline"
                                    onClick={() => {
                                      setShowRejectionForm(false);
                                      setRejectionReason("");
                                    }}
                                    disabled={isActionLoading}
                                    className="flex-1 font-bold uppercase tracking-wider text-slate-400"
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Reversion action for Verified/Rejected reports */}
                        {(selected.status === "VERIFIED" || selected.status === "REJECTED") && (
                          <div>
                            <Button
                              variant="outline"
                              onClick={() => handleRevert(selected.id)}
                              disabled={isActionLoading}
                              className="w-full border-amber-500/20 bg-amber-500/10 font-bold uppercase tracking-wider text-amber-300 hover:bg-amber-500/20"
                            >
                              <RotateCcw className="mr-1.5 size-4 animate-spin-hover" />
                              Revert back to Pending
                            </Button>
                          </div>
                        )}

                        {selected.status === "CANCELLED" && (
                          <p className="text-center text-xs text-slate-500 italic">
                            This report was cancelled and cannot be processed further.
                          </p>
                        )}
                      </>
                    )}

                    {/* TICKETER ACTION BOARD */}
                    {role === "TICKETER" && (
                      <>
                        {(selected.status === "PENDING" || !selected.status) ? (
                          <div className="space-y-3">
                            <p className="text-[10px] text-slate-500 italic">
                              Need to change something? You can cancel this submission to correct your sales entry, provided it is cancelled today and the supervisor has not verified it.
                            </p>
                            <Button
                              variant="destructive"
                              onClick={() => handleCancel(selected.id)}
                              disabled={isActionLoading}
                              className="w-full font-bold uppercase tracking-wider text-red-400"
                            >
                              <Trash2 className="mr-1.5 size-4" />
                              Cancel Submission
                            </Button>
                          </div>
                        ) : (
                          <p className="text-center text-xs text-slate-500 italic">
                            No actions available. This report has already been finalized ({selected.status}).
                          </p>
                        )}


                      </>
                    )}

                    {role === "AUDITOR" && (
                      <p className="text-center text-xs text-slate-500 italic">
                        Auditor view. Actions are read-only.
                      </p>
                    )}
                  </div>
                )
              }
            ]}
          />
        )}
      </Drawer>
      {/* Sales Report Submission Drawer */}
      <Drawer
        open={openForm}
        title="Submit Sales Report"
        subtitle="Submit your sales report for your active POS session"
        onClose={() => setOpenForm(false)}
      >
        <SalesReportForm
          onSuccess={() => {
            setOpenForm(false);
            setRefreshKey(prev => prev + 1);
          }}
        />
      </Drawer>
    </>
  );
}




interface DeviceApiResponse {
  success: boolean;
  sessions?: PosDeviceSession[];
  locations?: Ticketer_Location_Assignment[];
}

function SalesReportForm({
  onSuccess,
}: {
  onSuccess: () => void;
}) {
  const [sessions, setSessions] = useState<PosDeviceSession[]>([]);
  const [locations, setLocations] = useState<Ticketer_Location_Assignment[]>([]);
  const [selectedSession, setSelectedSession] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const [closingBalance, setClosingBalance] = useState("");
  const [totalSold, setTotalSold] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Fetch active sessions & location assignments for the logged-in ticketer
  useEffect(() => {
    let active = true;

    async function loadTicketerDetails() {
      setError("");
      try {
        const res = await fetch("/api/ticketer/device");
        const data: DeviceApiResponse = await res.json();

        if (active && data.success) {
          // 1. Filter to only display ACTIVE sessions for report submissions
          const activeSessions = (data.sessions || []).filter((s) => s.status === "ACTIVE");
          setSessions(activeSessions);
          setLocations(data.locations || []);

          // 2. Auto-select POS session if there is exactly one active session
          if (activeSessions.length === 1) {
            const singleSession = activeSessions[0];
            setSelectedSession(singleSession.id);
            setOpeningBalance(String(singleSession.posFloat || 0));
          }

          // 3. Auto-select location assigned for today
          const todayStr = new Date().toLocaleDateString("en-CA"); // Gets YYYY-MM-DD in local time
          const todayAssignment = (data.locations || []).find((la) => {
            const datePart = la.assignedFor.split("T")[0];
            return datePart === todayStr;
          });

          if (todayAssignment) {
            setSelectedLocation(todayAssignment.id);
          } else if (data.locations && data.locations.length > 0) {
            // Fallback to the most recent assignment if no assignment for today is found
            setSelectedLocation(data.locations[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to load ticketer details:", err);
        setError("Failed to fetch device and location data");
      }
    }

    loadTicketerDetails();

    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSession) return setError("Please select a POS session");
    if (!selectedLocation) return setError("Please select a location");
    if (!openingBalance) return setError("Opening balance is required");
    if (!closingBalance) return setError("Closing balance is required");
    if (!totalSold) return setError("Total sold (sales) is required");

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          posSessionId: selectedSession,
          locationId: selectedLocation,
          openingBalance: Number(openingBalance),
          closingBalance: Number(closingBalance),
          totalSold: Number(totalSold),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        onSuccess();
      } else {
        setError(data.error || "Failed to submit sales report");
      }
    } catch (err) {
      setError("Network error. Failed to submit sales report.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-200">
          <AlertTriangle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Select POS Device / Session */}
      <div>
        <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">POS Device / Session</label>
        <select
          value={selectedSession}
          onChange={(e) => {
            const val = e.target.value;
            setSelectedSession(val);
            if (val) {
              const sess = sessions.find((s) => s.id === val);
              setOpeningBalance(sess ? String(sess.posFloat || 0) : "");
            } else {
              setOpeningBalance("");
            }
          }}
          disabled={sessions.length === 0}
          className="mt-2 w-full rounded-xl bg-white/3 border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none disabled:opacity-50"
        >
          {sessions.length === 0 ? (
            <option value="" className="bg-black">
              No active sessions found
            </option>
          ) : (
            <>
              <option value="" className="bg-black">Select active session...</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id} className="bg-black">
                  {s.deviceName} ({s.deviceSerial}) - Float: {formatMoney(s.posFloat||0)}
                </option>
              ))}
            </>
          )}
        </select>
      </div>

      {/* Select Location */}
      <div>
        <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Location</label>
        <select
          value={selectedLocation}
          onChange={(e) => setSelectedLocation(e.target.value)}
          disabled={locations.length === 0}
          className="mt-2 w-full rounded-xl bg-white/3 border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none disabled:opacity-50"
        >
          {locations.length === 0 ? (
            <option value="" className="bg-black">
              No assigned locations found
            </option>
          ) : (
            <>
              <option value="" className="bg-black">Select location...</option>
              {locations.map((la) => (
                <option key={la.assignmentId} value={la.id} className="bg-black">
                  {la.locationName} ({la.locationAddress})
                </option>
              ))}
            </>
          )}
        </select>
      </div>

      {/* Opening Balance (Prefilled from POS Float) */}
      <div>
        <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Opening Balance</label>
        <input
          type="number"
          value={openingBalance}
          onChange={(e) => setOpeningBalance(e.target.value)}
          placeholder="0.00"
          className="mt-2 w-full rounded-xl bg-white/3 border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none"
        />
      </div>

      {/* Total Sold (Sales) */}
      <div>
        <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Total Sold (Sales)</label>
        <input
          type="number"
          value={totalSold}
          onChange={(e) => setTotalSold(e.target.value)}
          placeholder="e.g. 50000"
          className="mt-2 w-full rounded-xl bg-white/3 border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none"
        />
      </div>

      {/* Closing Balance */}
      <div>
        <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Closing Balance</label>
        <input
          type="number"
          value={closingBalance}
          onChange={(e) => setClosingBalance(e.target.value)}
          placeholder="e.g. 50000"
          className="mt-2 w-full rounded-xl bg-white/3 border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none"
        />
      </div>

      <button
        type="submit"
        disabled={loading || !selectedSession || !selectedLocation || !openingBalance || !closingBalance || !totalSold}
        className="w-full rounded-xl bg-linear-to-r from-emerald-400 to-teal-400 text-black py-3 text-sm font-bold tracking-tight active:scale-[0.99] disabled:opacity-50 transition-all mt-4"
      >
        {loading ? "Submitting report..." : "Submit report"}
      </button>
    </form>
  );
}


