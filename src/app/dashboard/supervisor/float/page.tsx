"use client"
import React, { useEffect, useState, useCallback } from 'react';
import FloatLedgerPage from "@/app/dashboard/FloatLedgerPage";
import api from '@/app/lib/axios';
import { Float_Alocation } from '@/types/types';

export default function FloatRoute() {
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

    async function loadSupervisorData() {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (dateRange.start) params.append("fromDate", dateRange.start.toISOString());
        if (dateRange.end) params.append("toDate", dateRange.end.toISOString());
        const queryStr = params.toString() ? `?${params.toString()}` : "";

        const allocationsRes = await api.get(`/supervisor/floatallocation${queryStr}`);
        
        if (!isMounted) return;

        if (allocationsRes.data?.success) {
          setEntries(allocationsRes.data.history || []);
        }
      } catch (err) {
        console.error("Error loading supervisor float data:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadSupervisorData();

    return () => {
      isMounted = false;
    };
  }, [dateRange, refreshKey]);

  return (
    <FloatLedgerPage
      role="SUPERVISOR"
      entries={entries}
      setEntries={setEntries}
      isLoading={loading}
      onRefresh={handleRefresh}
      dateRange={dateRange}
    />
  );
}
