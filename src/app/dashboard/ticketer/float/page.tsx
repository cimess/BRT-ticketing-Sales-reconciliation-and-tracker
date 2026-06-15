"use client"
import React, { useEffect, useState, useCallback } from 'react';
import FloatLedgerPage from "@/app/dashboard/FloatLedgerPage";
import api from '@/app/lib/axios';
import { TicketerPosSnapshot } from '@/types/float';
import { Float_Alocation } from '@/types/types';

export default function FloatRoute() {
  const [ticketerSnapshot, setTicketerSnapshot] = useState<TicketerPosSnapshot | null>(null);
  const [entries, setEntries] = useState<Float_Alocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({ start: null, end: null });
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
        const queryStr = params.toString() ? `?${params.toString()}` : "";

        const res = await api.get(`/ticketer/float${queryStr}`);
        const snapshot: TicketerPosSnapshot = res.data;
        
        if (!isMounted) return;

        if (snapshot?.success && snapshot.data) {
          setTicketerSnapshot(snapshot);
          
          const mappedEntries: Float_Alocation[] = (snapshot.data.topUp || []).map(
            (t) => ({
              id: t.id,
              top_up_id: t.id,
              from_user: t.from_user_name,
              from_role: t.from_user_role,
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
        console.error("Error loading ticketer float data:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadTicketerData();

    return () => {
      isMounted = false;
    };
  }, [dateRange, refreshKey]);

  return (
    <FloatLedgerPage
      role="TICKETER"
      ticketerSnapshot={ticketerSnapshot}
      entries={entries}
      setEntries={setEntries}
      isLoading={loading}
      onRefresh={handleRefresh}
      dateRange={dateRange}
    />
  );
}
