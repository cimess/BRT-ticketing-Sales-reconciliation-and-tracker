"use client"
import React, { useEffect, useState, useCallback } from 'react';
import FloatLedgerPage from "@/app/dashboard/FloatLedgerPage";
import api from '@/app/lib/axios';
import { TicketerPosSnapshot, TicketerPosSessionSummary } from '@/app/types/float';
import { Float_Alocation, DashboardRoleUsers } from '@/app/types/types';
import axios from 'axios';
import { toast } from 'react-toastify';

export default function FloatRoute() {
  const [ticketerSnapshot, setTicketerSnapshot] = useState<TicketerPosSnapshot | null>(null);
  const [entries, setEntries] = useState<Float_Alocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({ start: null, end: null });
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionsList, setSessionsList] = useState<TicketerPosSessionSummary[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = useCallback((start?: Date | null, end?: Date | null) => {
    if (start !== undefined || end !== undefined) {
      setDateRange({ start: start ?? null, end: end ?? null });
    } else {
      setRefreshKey(prev => prev + 1);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadTicketerData() {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (dateRange.start) params.append("fromDate", dateRange.start.toISOString());
        if (dateRange.end) params.append("toDate", dateRange.end.toISOString());
        if (selectedSessionId) params.append("sessionId", selectedSessionId);

        const queryStr = params.toString() ? `?${params.toString()}` : "";

        const res = await api.get(`/ticketer/float${queryStr}`);
        const snapshot: TicketerPosSnapshot = res.data;

        if (!isMounted) return;

        if (snapshot?.success && snapshot.data) {
          setTicketerSnapshot(snapshot);
          setSessionsList(snapshot.data.sessionsList || []);

          if (!selectedSessionId && snapshot.data.pos_device_id) {
            setSelectedSessionId(snapshot.data.pos_device_id);
          }

          const mappedEntries: Float_Alocation[] = (snapshot.data.topUp || []).map(
            (t) => ({
              id: t.id,
              top_up_id: t.id,
              from_user: t.from_user_name,
              from_role: t.from_user_role as DashboardRoleUsers,
              to_user: t.to_device_name,
              to_role: 'TICKETER' as const,
              amount_allocated: t.amount_allocated,
              amount_remaining: t.amount_allocated,
              status: t.status,
              allocated_at: new Date(t.allocated_at).toISOString(),
            })
          );

          setEntries(mappedEntries);
        }
      } catch (err) {
      if(err instanceof axios.AxiosError)
      toast.error(err?.response?.data.message || "Error loading ticketer float data");
      else
      toast.error("Error loading ticketer float data");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadTicketerData();

    return () => {
      isMounted = false;
    };
  }, [dateRange, selectedSessionId, refreshKey]);

  return (
    <div className="space-y-4">
      {/* Session Selector Bar */}
      {sessionsList.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/3 p-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold uppercase tracking-wider text-slate-400">POS Session View:</span>
            <select
              value={selectedSessionId || ""}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-white outline-none focus:border-emerald-500"
            >
              {sessionsList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.deviceName} ({s.serialNumber}) — [{s.status}]
                </option>
              ))}
            </select>
          </div>
          {ticketerSnapshot?.data && (
            <div className="flex items-center gap-2 text-slate-300">
              <span>Viewing Status:</span>
              <span className={`font-bold uppercase px-2 py-0.5 rounded-md text-[10px] ${
                ticketerSnapshot.data.sessionStatus === "ACTIVE"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
              }`}>
                {ticketerSnapshot.data.sessionStatus}
              </span>
            </div>
          )}
        </div>
      )}

      <FloatLedgerPage
        role="TICKETER"
        ticketerSnapshot={ticketerSnapshot}
        entries={entries}
        setEntries={setEntries}
        isLoading={loading}
        onRefresh={handleRefresh}
        dateRange={dateRange}
      />
    </div>
  );
}
