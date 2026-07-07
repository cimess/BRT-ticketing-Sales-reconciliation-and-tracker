"use client";
import { useState, useEffect, useCallback } from "react";
import { Bell, ShieldCheck, CheckCircle2, AlertTriangle, XCircle, MailOpen, RefreshCw } from "lucide-react";
import StatCard from "@/components/StatCard";
import { PageScaffold } from "@/components/pageScaffold";
import { DashboardRoleUsers, SystemNotification } from "@/app/types/types";
import api from "@/lib/axios";
import { toast } from "react-toastify";
import axios from "axios";

export default function NotificationsPage({ role }: { role: DashboardRoleUsers }) {
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [filter, setFilter] = useState<"ALL" | "UNREAD">("ALL");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchNotifications = useCallback(async (currentPage = 1, currentFilter = filter) => {
    try {
      setLoading(true);
      const unreadOnly = currentFilter === "UNREAD" ? "true" : "false";
      const res = await api.get(`/notifications?page=${currentPage}&limit=20&unreadOnly=${unreadOnly}`);
      if (res.data?.success) {
        setNotifications(res.data.data);
        setUnreadCount(res.data.unreadCount);
        setTotalCount(res.data.pagination.total);
        setTotalPages(res.data.pagination.totalPages);
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        toast.error(err.response?.data?.error || "Failed to load notifications");
      } else {
        toast.error("An unexpected error occurred");
      }
    } finally {
      setLoading(false);
    }
  }, [filter]);


  useEffect(() => {
    let ignore = false;

    // Defer the initial loading trigger and call to prevent cascading renders
    Promise.resolve().then(() => {
      if (!ignore) {
        fetchNotifications(1, filter);
      }
    });

    return () => {
      ignore = true;
    };
  }, [filter,fetchNotifications]);

    useEffect(() => {
    const handleSSE = (e: Event) => {
      const customEvent = e as CustomEvent;
      const type = customEvent.detail?.type;
      // Refresh notifications on ANY SSE event (every event creates a DB notification)
      if (
        type === "NOTIFICATION_CREATED" ||
        type === "TOPUP_CREATED" ||
        type === "SALE_CREATED" ||
        type === "REMITTANCE_CREATED" ||
        type === "FINE_CREATED" ||
        type === "SHORTAGE_CREATED"
      ) {
        fetchNotifications(page, filter);
      }
    };

    window.addEventListener("sse", handleSSE);
    return () => {
      window.removeEventListener("sse", handleSSE);
    };
  }, [page, filter, fetchNotifications]);


  const handleMarkAsRead = async (id: string) => {
    try {
      const res = await api.patch("/notifications", { notificationId: id });
      if (res.data?.success) {
        setNotifications(prev =>
          prev.map(n => (n.id === id ? { ...n, is_read: true } : n))
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      toast.error("Failed to mark notification as read");
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const res = await api.patch("/notifications", { markAll: true });
      if (res.data?.success) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
        toast.success("All notifications marked as read");
      }
    } catch (err) {
      toast.error("Failed to mark all notifications as read");
    }
  };

  const getNotificationStyle = (type: string | null) => {
    switch (type) {
      case "REMITTANCE_ACCEPTED":
        return {
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
          bg: "bg-emerald-500/10 border-emerald-500/20",
        };
      case "REMITTANCE_REJECTED":
        return {
          icon: <XCircle className="w-5 h-5 text-rose-400" />,
          bg: "bg-rose-500/10 border-rose-500/20",
        };
      case "REMITTANCE_SUBMISSION":
        return {
          icon: <Bell className="w-5 h-5 text-cyan-400" />,
          bg: "bg-cyan-500/10 border-cyan-500/20",
        };
      case "FINE_ISSUED":
        return {
          icon: <AlertTriangle className="w-5 h-5 text-amber-400" />,
          bg: "bg-amber-500/10 border-amber-500/20",
        };
      default:
        return {
          icon: <Bell className="w-5 h-5 text-slate-400" />,
          bg: "bg-slate-500/10 border-slate-500/20",
        };
    }
  };

  return (
    <PageScaffold
      title={`${role.charAt(0) + role.slice(1).toLowerCase()} • Notification Center`}
      subtitle="View, manage, and filter important event notifications across system processes"
      kpis={
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard title="Unread Alerts" value={unreadCount.toString()} icon={<Bell className="text-cyan-400" />} iconBg="bg-cyan-500/10" />
          <StatCard title="Total Notifications" value={totalCount.toString()} icon={<MailOpen className="text-slate-400" />} iconBg="bg-slate-500/10" />
          <StatCard title="Inbox Filter" value={filter === "ALL" ? "All Logs" : "Unread Only"} icon={<Bell className="text-purple-400" />} iconBg="bg-purple-500/10" />
          <StatCard title="System Delivery" value="Active" icon={<ShieldCheck className="text-emerald-400" />} iconBg="bg-emerald-500/10" />
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setPage(1); setFilter("ALL"); }}
              className={`px-4 py-2 rounded-full text-xs font-semibold border transition-all ${
                filter === "ALL"
                  ? "bg-cyan-500/20 border-cyan-400/30 text-cyan-300"
                  : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              All Notifications
            </button>
            <button
              onClick={() => { setPage(1); setFilter("UNREAD"); }}
              className={`px-4 py-2 rounded-full text-xs font-semibold border transition-all ${
                filter === "UNREAD"
                  ? "bg-cyan-500/20 border-cyan-400/30 text-cyan-300"
                  : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => fetchNotifications(page)}
              className="p-2 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="glass-button text-xs px-4 py-2 bg-gray-800/50 border border-gray-700 hover:border-cyan-500/50 hover:bg-cyan-500/10 rounded-full font-semibold transition-all text-white"
              >
                Mark all as read
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col justify-center items-center py-20 gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
            <p className="text-slate-500 text-xs font-medium">Syncing notification inbox...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="glass-panel rounded-2xl border border-white/5 p-8 flex flex-col items-center justify-center text-center bg-slate-900/40 min-h-[350px] transition-all">
            <div className="p-4 rounded-full bg-slate-800/50 border border-white/5 mb-4">
              <Bell className="w-8 h-8 text-slate-600" />
            </div>
            <p className="text-white font-bold text-sm">Inbox is completely clear</p>
            <p className="text-slate-500 text-xs mt-2 max-w-xs">
              {filter === "UNREAD" ? "You have read all received alerts." : "No system event triggers or alerts generated."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {notifications.map((n, idx) => {
              const style = getNotificationStyle(n.type);
              return (
                <div
                  key={n.id}
                  onClick={() => !n.is_read && handleMarkAsRead(n.id)}
                  className={`glass-panel border rounded-2xl p-4 flex items-start gap-4 transition-all duration-300 cursor-pointer hover:bg-white/[0.04] animate-fade-in ${
                    style.bg
                  } ${!n.is_read ? "relative border-cyan-500/20" : "opacity-75 border-white/5"}`}
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  {!n.is_read && (
                    <span className="absolute top-4 right-4 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                    </span>
                  )}

                  <div className={`p-2.5 rounded-xl border bg-black/30 border-white/5`}>
                    {style.icon}
                  </div>

                  <div className="flex-1 space-y-1">
                    <p className={`text-xs md:text-sm font-semibold tracking-wide ${!n.is_read ? "text-white" : "text-slate-400"}`}>
                      {n.message}
                    </p>
                    <div className="flex items-center gap-3 text-[10px] text-slate-500 font-medium">
                      <span>{new Date(n.created_at).toLocaleString()}</span>
                      {n.type && (
                        <>
                          <span>•</span>
                          <span className="uppercase tracking-[0.1em] text-cyan-400">{n.type.replace(/_/g, " ")}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && totalPages > 1 && (
          <div className="flex justify-center items-center gap-4 mt-4 border-t border-white/5 pt-4">
            <button
              disabled={page <= 1}
              onClick={() => { setPage(p => p - 1); fetchNotifications(page - 1); }}
              className="px-4 py-2 text-xs rounded-full border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-50 font-bold transition-all text-white"
            >
              Previous
            </button>
            <span className="text-slate-400 text-xs font-semibold">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => { setPage(p => p + 1); fetchNotifications(page + 1); }}
              className="px-4 py-2 text-xs rounded-full border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-50 font-bold transition-all text-white"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </PageScaffold>
  );
}
