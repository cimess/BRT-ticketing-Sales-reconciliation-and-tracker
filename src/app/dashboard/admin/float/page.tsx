"use client";
import React, { useEffect, useState, useCallback } from 'react';
import FloatLedgerPage from "@/app/dashboard/FloatLedgerPage";
import api from '@/app/lib/axios';
import { TopUpItem } from '@/types/float';
import { Float_Alocation } from '@/types/types';
import axios from 'axios';
import { toast } from 'react-toastify';

export default function FloatRoute() {
  const [entries, setEntries] = useState<Float_Alocation[]>([]);
  const [posAllocations, setPosAllocations] = useState<Float_Alocation[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Track date range state
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

    async function loadAdminData() {
      try {
        setLoading(true);
        
        const params = new URLSearchParams();
        if (dateRange.start) params.append("fromDate", dateRange.start.toISOString());
        if (dateRange.end) params.append("toDate", dateRange.end.toISOString());
        const queryStr = params.toString() ? `?${params.toString()}` : "";

        const [topUpsRes, allocationsRes] = await Promise.all([
          api.get(`/admin/float/gettopup${queryStr}`),
          api.get(`/supervisor/floatallocation${queryStr}`)
        ]);
        
        if (!isMounted) return;

        const topUpsObj = topUpsRes.data?.topUps;
        if (topUpsObj?.topups) {
          const mappedEntries: Float_Alocation[] = topUpsObj.topups.map((t: TopUpItem) => ({
            id: t.id,
            top_up_id: t.id,
            from_user: t.allocated_from,
            from_role: 'ADMIN' as const,
            to_user: 'COMPANY_ACCOUNT',
            to_role: 'ADMIN' as const,
            amount_allocated: t.amount,
            amount_remaining: t.amount,
            status: (t.status === 'AVAILABLE' ? 'SUCCESS' : t.status === 'USED' ? 'SUCCESS' : 'CANCELLED') as Float_Alocation['status'],
            allocated_at: t.date_received,
          }));
          setEntries(mappedEntries);
        }

        if (allocationsRes.data?.success) {
          setPosAllocations(allocationsRes.data.history || []);
        }
      } catch (err) {
        if(err instanceof axios.AxiosError)
        toast.error(err?.response?.data.message || "Error loading admin float data");
        else
        toast.error("Error loading admin float data");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadAdminData();

    return () => {
      isMounted = false;
    };
  }, [dateRange, refreshKey]);

  return (
    <FloatLedgerPage
      role="ADMIN"
      entries={entries}
      posAllocations={posAllocations}
      setEntries={setEntries}
      isLoading={loading}
      onRefresh={handleRefresh}
      dateRange={dateRange}
    />
  );
}
