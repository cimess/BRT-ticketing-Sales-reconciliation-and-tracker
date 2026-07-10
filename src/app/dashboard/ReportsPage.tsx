"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { 
  FileText, 
  Loader2, 
  Download, 
  Plus, 
  RefreshCw, 
  Calendar, 
  X, 
  AlertCircle, 
  ArrowRight,
  FileSpreadsheet
} from 'lucide-react';
import { useSession } from "next-auth/react";
import StatCard from '@/components/StatCard';
import { Badge } from '@/components/Badge';
import { DataTable, type ColumnDef } from '@/components/DataTable';
import { FilterRow, Input, PageScaffold } from '@/components/pageScaffold';
import { Drawer } from '@/components/Drawer';
import api from '@/app/lib/axios';
import axios from 'axios';
import { toast } from 'react-toastify';

// Define the interface mapping exactly to the backend Prisma ReportTask schema
interface ReportTask {
  id: string;
  name: string;
  type: 'MONTHLY_SALES' | 'MONTHLY_FLOAT' | 'LOCATION_SALES';
  period_start: string;
  period_end: string;
  status: 'PENDING' | 'RUNNING' | 'READY' | 'FAILED';
  format: 'CSV' | 'PDF';
  storage_key?: string | null;
  created_by_id: string;
  created_at: string;
  completed_at?: string | null;
  error_message?: string | null;
  created_by?: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

export default function ReportsPage() {
  const { data: session } = useSession();
  const userRole = session?.user?.role || 'TICKETER';
  const canGenerate = userRole === 'ADMIN' || userRole === 'SUPERVISOR' || userRole === 'AUDITOR';
  
  // Search Filter Query
  const [q, setQ] = useState('');
const [mount, setMount] = useState(false);
  // States
  const [reports, setReports] = useState<ReportTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Drawer Staging State
  const [openCreateDrawer, setOpenCreateDrawer] = useState(false);
  const [formName, setFormName] = useState('');
  const [nameUserOverridden, setNameUserOverridden] = useState(false);
  const [type, setType] = useState<ReportTask['type']>('MONTHLY_SALES');
  const [format, setFormat] = useState<ReportTask['format']>('CSV');
  
  // Date Helpers for default: First of month to today
  const getFirstDayOfMonth = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  };
  const getTodayDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  const [period_start, setPeriodStart] = useState(getFirstDayOfMonth());
  const [period_end, setPeriodEnd] = useState(getTodayDate());

  // Fetch all reports
  const fetchReports = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get('/reports');
      if (res.data?.success) {
        setReports(res.data.data);
      }
    } catch (err) {
      console.error("Failed to load reports:", err);
      if (!silent) toast.error("Failed to fetch reports roster.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Sync Initial Load
  useEffect(() => {
    if (!mount){
      setTimeout(() => {
        fetchReports(false);
        setMount(true)
      },0)
    }
  }, [fetchReports, mount]);

  // Polling for active background jobs (every 5 seconds)
  useEffect(() => {
    const hasActiveTasks = reports.some(r => r.status === 'PENDING' || r.status === 'RUNNING');
    if (!hasActiveTasks) return;

    const timer = setInterval(() => {
      fetchReports(true);
    }, 5000);

    return () => clearInterval(timer);
  }, [reports, fetchReports]);

  // Autogenerate name when date range/type edits, unless overridden by user
  useEffect(() => {
    if (!nameUserOverridden && period_start && period_end) {
      const typeLabel = 
        type === 'MONTHLY_SALES' ? 'Monthly Sales' : 
        type === 'MONTHLY_FLOAT' ? 'Monthly Float' : 'Location Sales';
      
      const startStr = new Date(period_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const endStr = new Date(period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      setTimeout(() => {
        setFormName(`${typeLabel} (${startStr} - ${endStr})`);
      }, 0)
    }
  }, [type, period_start, period_end, nameUserOverridden]);

  // Submit background generation job
  const handleGenerateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName) return toast.error("Please enter a report name");

    setSubmitting(true);
    const actionToast = toast.loading(`Queuing background job for "${formName}"...`);

    try {
      const res = await api.post('/reports', {
        name: formName,
        type,
        period_start: `${period_start}T00:00:00.000Z`,
        period_end: `${period_end}T23:59:59.999Z`,
        format
      });

      if (res.status === 202) {
        toast.update(actionToast, {
          render: "Job queued! Running in background...",
          type: "success",
          isLoading: false,
          autoClose: 3000
        });
        setOpenCreateDrawer(false);
        setNameUserOverridden(false);
        fetchReports(true); // reload list silently
      }
    } catch (err) {
      console.error(err);
      const msg = err instanceof axios.AxiosError ? err.response?.data?.error : "Failed to queue job.";
      toast.update(actionToast, {
        render: msg || "Failed to trigger report generation",
        type: "error",
        isLoading: false,
        autoClose: 4000
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Securely request presigned URL and download
  const handleDownload = async (reportId: string, reportName: string) => {
    if (downloadingId) return;
    setDownloadingId(reportId);
    const linkToast = toast.loading(`Retrieving secure download token for "${reportName}"...`);

    try {
      const res = await api.get(`/reports/${reportId}`);
      if (res.data?.success && res.data.url) {
        window.open(res.data.url, '_blank');
        toast.update(linkToast, {
          render: "Secure URL generated! Downloading...",
          type: "success",
          isLoading: false,
          autoClose: 2000
        });
      } else {
        throw new Error("Missing link in API response");
      }
    } catch (err) {
      console.error(err);
      toast.update(linkToast, {
        render: "Failed to load download link. Link may have expired.",
        type: "error",
        isLoading: false,
        autoClose: 3000
      });
    } finally {
      setDownloadingId(null);
    }
  };

  // KPI Calculations
  const total = reports.length;
  const ready = reports.filter((r) => r.status === 'READY').length;
  const running = reports.filter((r) => r.status === 'RUNNING' || r.status === 'PENDING').length;
  const failed = reports.filter((r) => r.status === 'FAILED').length;

  const columns: ColumnDef<ReportTask>[] = [
    {
      id: 'name',
      header: 'report_name',
      cell: (r) => (
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-indigo-400">
            {r?.format === 'PDF' ? <FileText className="size-4" /> : <FileSpreadsheet className="size-4 text-emerald-400" />}
          </div>
          <div>
            <span className="text-slate-200 text-sm font-semibold block leading-tight">{r?.name}</span>
            <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5 mt-0.5">
              {r?.type?.replace('_', ' ')}
            </span>
          </div>
        </div>
      ),
      sortValue: (r) => r?.name
    },
    {
      id: 'period',
      header: 'period',
      cell: (r) => {
        const start = new Date(r?.period_start||"-").toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
        const end = new Date(r?.period_end||"-").toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
        return (
          <span className="text-slate-400 text-xs font-semibold flex items-center gap-1">
            {start} <ArrowRight className="size-3 text-slate-600" /> {end}
          </span>
        );
      },
      sortValue: (r) => r?.period_start
    },
    {
      id: 'status',
      header: 'status',
      align: 'center',
      cell: (r) => {
        const variant = 
          r?.status === 'READY' ? 'success' : 
          r?.status === 'FAILED' ? 'danger' : 
          r?.status === 'RUNNING' ? 'warning' : 'info';
        
        return (
          <Badge variant={variant}>
            {r?.status === 'RUNNING' ? (
              <span className="flex items-center gap-1">
                <Loader2 className="size-3 animate-spin" /> {r.status}
              </span>
            ) : r?.status}
          </Badge>
        );
      },
      sortValue: (r) => r?.status
    },
    {
      id: 'created',
      header: 'created_at',
      cell: (r) => (
        <div>
          <span className="text-slate-300 text-xs block font-semibold">
            {new Date(r?.created_at||"").toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
          <span className="text-slate-500 text-[10px] block mt-0.5">
            by {r?.created_by ? `${r.created_by.first_name} ${r.created_by.last_name}` : 'Unknown'}
          </span>
        </div>
      ),
      sortValue: (r) => r?.created_at
    },
    {
      id: 'actions',
      header: 'actions',
      align: 'center',
      cell: (r) => {
        if (r?.status === 'READY') {
          return (
            <button
              onClick={() => handleDownload(r.id, r.name)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 active:scale-[0.98] transition-all text-xs font-bold uppercase tracking-wider"
            >
              <Download className="size-3.5" /> Download
            </button>
          );
        }
        if (r?.status === 'FAILED') {
          return (
            <div className="flex items-center gap-1.5 text-rose-400 text-xs group relative cursor-help">
              <AlertCircle className="size-4 shrink-0" />
              <span className="underline decoration-dotted font-semibold">Details</span>
              {r.error_message && (
                <div className="absolute right-0 bottom-full mb-2 hidden group-hover:block w-48 p-3 rounded-xl bg-slate-900 border border-white/10 shadow-2xl text-[10px] text-slate-300 z-50">
                  <p className="font-bold text-rose-400 mb-1">Task Error:</p>
                  {r.error_message}
                </div>
              )}
            </div>
          );
        }
        return (
          <span className="text-slate-500 text-xs italic flex items-center gap-1">
            <Loader2 className="size-3 animate-spin text-slate-500" /> Generating...
          </span>
        );
      }
    }
  ];

   if (!mount) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <>
      <PageScaffold
        title="Reporting & Analytics"
        subtitle="Secure operational and reconciliation analytics dashboard"
        kpis={
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard title="Reports" value={String(total)} icon={<FileText className="text-blue-300" />} iconBg="bg-blue-500/10" />
            <StatCard title="Ready to Download" value={String(ready)} icon={<FileText className="text-emerald-300" />} iconBg="bg-emerald-500/10" />
            <StatCard title="Running Tasks" value={String(running)} icon={<Loader2 className={`text-amber-300 ${running > 0 ? 'animate-spin' : ''}`} />} iconBg="bg-amber-500/10" />
            <StatCard title="Failed Runs" value={String(failed)} icon={<AlertCircle className="text-rose-300" />} iconBg="bg-rose-500/10" />
          </div>
        }
      >
        <FilterRow>
          <div className="flex-1">
            <Input value={q} onChange={setQ} placeholder="Search reports by ID, name, or format…" />
          </div>
          <div className="flex items-center gap-2 w-full lg:w-auto shrink-0 mt-3 lg:mt-0">
            <button
              onClick={() => fetchReports(false)}
              disabled={loading}
              className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all disabled:opacity-50"
              title="Refresh lists"
            >
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            
            {canGenerate && (
              <button
                onClick={() => {
                  setPeriodStart(getFirstDayOfMonth());
                  setPeriodEnd(getTodayDate());
                  setOpenCreateDrawer(true);
                }}
                className="w-full lg:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-indigo-400 hover:bg-indigo-500/20 active:scale-[0.98] transition-all"
              >
                <Plus className="size-4" /> Generate Report
              </button>
            )}
          </div>
        </FilterRow>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 text-sm gap-2">
            <Loader2 className="size-6 animate-spin text-indigo-400" />
            <span>Loading generated reports...</span>
          </div>
        ) : (
          <DataTable
            rows={reports}
            columns={columns}
            getRowId={(r) => r.id}
            searchValue={q}
                      searchPredicate={(r, qq) =>
              r.id.toLowerCase().includes(qq) ||
              r.name.toLowerCase().includes(qq) ||
              r.type.toLowerCase().includes(qq) ||
              r.format.toLowerCase().includes(qq) ||
              (r.created_by ? `${r.created_by.first_name} ${r.created_by.last_name}`.toLowerCase().includes(qq) : false)
            }

          />
        )}
      </PageScaffold>

      {/* DRAWER: Generate Report Form */}
      <Drawer
        open={openCreateDrawer}
        title="Generate Analytics Report"
        subtitle="Queue a new background operational report task"
        onClose={() => setOpenCreateDrawer(false)}
      >
        <form onSubmit={handleGenerateReport} className="space-y-5">
          <div>
            <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest block mb-1">
              Report Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ReportTask['type'])}
              className="w-full rounded-xl bg-white/3 border border-white/10 p-3 text-sm text-white focus:outline-none focus:border-white/20 mt-1"
            >
              <option value="MONTHLY_SALES" className="bg-slate-900">Monthly Sales Ledger</option>
              <option value="MONTHLY_FLOAT" className="bg-slate-900">Monthly Float Reconciliation</option>
              <option value="LOCATION_SALES" className="bg-slate-900">Location-wise Ticket Sales</option>
            </select>
          </div>

          <div>
            <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest block mb-1">
              Export Format
            </label>
            <div className="grid grid-cols-2 gap-3 mt-1">
              <button
                type="button"
                onClick={() => setFormat('CSV')}
                className={`py-2.5 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all ${
                  format === 'CSV' 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                    : 'bg-white/3 border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                CSV Spreadsheet
              </button>
              <button
                type="button"
                onClick={() => setFormat('PDF')}
                className={`py-2.5 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all ${
                  format === 'PDF' 
                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' 
                    : 'bg-white/3 border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                PDF Document
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest block mb-1">
                Period Start
              </label>
              <input
                type="date"
                required
                value={period_start}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="w-full rounded-xl bg-white/3 border border-white/10 p-3 text-sm text-white focus:outline-none focus:border-white/20 mt-1"
              />
            </div>
            <div>
              <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest block mb-1">
                Period End
              </label>
              <input
                type="date"
                required
                value={period_end}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="w-full rounded-xl bg-white/3 border border-white/10 p-3 text-sm text-white focus:outline-none focus:border-white/20 mt-1"
              />
            </div>
          </div>

          <div>
            <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest block mb-1">
              Report Filename
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Sales report Q3"
              value={formName}
              onChange={(e) => {
                setFormName(e.target.value);
                setNameUserOverridden(true);
              }}
              className="w-full rounded-xl bg-white/3 border border-white/10 px-4 py-3 text-sm text-white focus:outline-none focus:border-white/20 mt-1"
            />
            {!nameUserOverridden && (
              <span className="text-[9px] text-slate-500 mt-1.5 block">
                Auto-updates based on dates. Start typing to customize.
              </span>
            )}
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={() => setOpenCreateDrawer(false)}
              className="flex-1 py-3 rounded-xl border border-white/10 hover:bg-white/5 text-slate-300 text-xs font-bold uppercase tracking-widest transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-3 rounded-xl bg-linear-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-black text-xs font-extrabold uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-500/10"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" /> Queuing...
                </>
              ) : (
                'Generate Report'
              )}
            </button>
          </div>
        </form>
      </Drawer>
    </>
  );
}
